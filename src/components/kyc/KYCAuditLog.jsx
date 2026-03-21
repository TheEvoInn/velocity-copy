import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, CheckCircle2, XCircle, Flag, MessageSquare, Clock, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ACTION_CONFIG = {
  approve:      { icon: CheckCircle2, color: 'text-emerald-400', label: 'Approved' },
  deny:         { icon: XCircle,      color: 'text-red-400',     label: 'Denied' },
  flag:         { icon: Flag,         color: 'text-orange-400',  label: 'Flagged' },
  request_info: { icon: MessageSquare,color: 'text-yellow-400',  label: 'Info Requested' },
  under_review: { icon: Eye,          color: 'text-blue-400',    label: 'Reviewed' },
  kyc_admin_review: { icon: ClipboardList, color: 'text-slate-400', label: 'Accessed' },
};

export default function KYCAuditLog() {
  const { data: allKYC = [] } = useQuery({
    queryKey: ['kyc-admin-all'],
    queryFn: async () => {
      try {
        const res = await base44.functions.invoke('kycAdminService', { action: 'list' });
        return res.data?.records || [];
      } catch (err) {
        console.error('Failed to fetch KYC records:', err);
        return [];
      }
    },
    initialData: [],
  });

  // Flatten all access_log entries from all records
  const auditEntries = allKYC
    .flatMap(r => (r.access_log || []).map(entry => ({
      ...entry,
      subject_name: r.full_legal_name,
      subject_email: r.email_verified,
      kyc_id: r.id,
    })))
    .sort((a, b) => new Date(b.accessed_at) - new Date(a.accessed_at))
    .slice(0, 100);

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader>
        <CardTitle className="text-white text-sm flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-blue-400" />
          KYC Decision Audit Log
        </CardTitle>
        <p className="text-xs text-slate-500">All admin actions on KYC submissions — for compliance & traceability</p>
      </CardHeader>
      <CardContent>
        {auditEntries.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">No audit entries yet.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {auditEntries.map((entry, idx) => {
              const cfg = ACTION_CONFIG[entry.purpose] || { icon: Clock, color: 'text-slate-400', label: entry.purpose };
              const Icon = cfg.icon;
              return (
                <div key={idx} className="flex items-start gap-3 text-xs border-b border-slate-800 pb-2 last:border-0">
                  <Icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-semibold ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-slate-600 shrink-0">
                        {new Date(entry.accessed_at).toLocaleDateString()} {new Date(entry.accessed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-400 truncate">{entry.subject_name || '—'} · {entry.subject_email || '—'}</p>
                    <p className="text-slate-600">by {entry.accessed_by}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}