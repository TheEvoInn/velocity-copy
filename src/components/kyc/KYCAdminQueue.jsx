import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield, Clock, CheckCircle2, XCircle, AlertTriangle, Eye, EyeOff,
  MessageSquare, Flag, User, FileText, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const STATUS_STYLES = {
  submitted:       { color: 'text-blue-400',    bg: 'bg-blue-500/15 border-blue-500/25',    label: 'Pending Review' },
  under_review:    { color: 'text-amber-400',   bg: 'bg-amber-500/15 border-amber-500/25',  label: 'Under Review' },
  approved:        { color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/25', label: 'Approved' },
  rejected:        { color: 'text-red-400',     bg: 'bg-red-500/15 border-red-500/25',      label: 'Denied' },
  additional_info: { color: 'text-yellow-400',  bg: 'bg-yellow-500/15 border-yellow-500/25',label: 'Info Requested' },
  flagged:         { color: 'text-orange-400',  bg: 'bg-orange-500/15 border-orange-500/25',label: 'Flagged' },
};

function KYCReviewCard({ record, onAction }) {
  const [expanded, setExpanded] = useState(false);
  const [showSensitive, setShowSensitive] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [actionMode, setActionMode] = useState(null); // 'deny' | 'request' | 'flag'

  const statusKey = record.admin_status || record.status || 'submitted';
  const style = STATUS_STYLES[statusKey] || STATUS_STYLES.submitted;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header Row */}
      <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
            <User className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold">{record.full_legal_name || 'Unknown'}</p>
            <p className="text-slate-500 text-xs">{record.email_verified} · Submitted {new Date(record.created_date).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-1 rounded-md border ${style.bg} ${style.color}`}>
            {style.label}
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-800 p-4 space-y-4">
          {/* Personal Info */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Personal Information</p>
              <button onClick={() => setShowSensitive(s => !s)} className="text-slate-500 hover:text-slate-300">
                {showSensitive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              {[
                ['Full Name', record.full_legal_name],
                ['Date of Birth', record.date_of_birth],
                ['Phone', record.phone_number],
                ['Email', record.email_verified],
                ['ID Type', record.government_id_type?.replace(/_/g, ' ')],
                ['ID Expiry', record.government_id_expiry],
                ['Tax ID', showSensitive ? record.tax_id : record.tax_id ? '••••••••' : '—'],
                ['Gov ID #', showSensitive ? record.government_id_number : record.government_id_number ? '••••••••' : '—'],
              ].map(([label, val]) => (
                <div key={label}>
                  <p className="text-slate-500">{label}</p>
                  <p className="text-white font-medium">{val || '—'}</p>
                </div>
              ))}
              <div className="col-span-2">
                <p className="text-slate-500">Address</p>
                <p className="text-white font-medium">
                  {[record.residential_address, record.city, record.state, record.postal_code, record.country].filter(Boolean).join(', ')}
                </p>
              </div>
            </div>
          </div>

          {/* Documents */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Documents</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['ID Front', record.id_document_front_url],
                ['ID Back', record.id_document_back_url],
                ['Selfie', record.selfie_url],
              ].map(([label, url]) => (
                <div key={label} className="bg-slate-800 rounded-lg p-2 text-center">
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt={label} className="w-full h-20 object-cover rounded mb-1 border border-slate-600" />
                      <p className="text-xs text-blue-400 hover:underline">{label} ↗</p>
                    </a>
                  ) : (
                    <>
                      <div className="w-full h-20 bg-slate-700 rounded mb-1 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-slate-500" />
                      </div>
                      <p className="text-xs text-slate-500">{label} (not uploaded)</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Existing Admin Notes */}
          {record.admin_notes && (
            <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3">
              <p className="text-xs font-semibold text-slate-400 mb-1">Previous Admin Notes</p>
              <p className="text-xs text-slate-300">{record.admin_notes}</p>
            </div>
          )}

          {/* Note Input */}
          {actionMode && (
            <div className="space-y-2">
              <textarea
                className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white text-xs resize-none h-20 focus:outline-none focus:border-blue-500"
                placeholder={
                  actionMode === 'deny' ? 'Reason for denial (required)...' :
                  actionMode === 'request' ? 'Describe what additional info is needed...' :
                  'Describe the suspicious activity or inconsistency...'
                }
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            {/* Mark Under Review */}
            {statusKey === 'submitted' && (
              <Button
                onClick={() => onAction(record.id, 'under_review', {})}
                variant="outline"
                className="text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10 col-span-2"
              >
                <Clock className="w-3 h-3 mr-1" /> Mark Under Review
              </Button>
            )}

            {/* Approve */}
            {['submitted', 'under_review', 'flagged', 'additional_info'].includes(statusKey) && (
              <Button
                onClick={() => onAction(record.id, 'approve', { note: noteText })}
                className="text-xs bg-emerald-600 hover:bg-emerald-500"
              >
                <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
              </Button>
            )}

            {/* Deny */}
            {['submitted', 'under_review', 'flagged', 'additional_info'].includes(statusKey) && (
              actionMode === 'deny' ? (
                <Button
                  onClick={() => { onAction(record.id, 'deny', { note: noteText }); setActionMode(null); setNoteText(''); }}
                  disabled={!noteText.trim()}
                  className="text-xs bg-red-600 hover:bg-red-500"
                >
                  <XCircle className="w-3 h-3 mr-1" /> Confirm Denial
                </Button>
              ) : (
                <Button
                  onClick={() => setActionMode('deny')}
                  variant="outline"
                  className="text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                >
                  <XCircle className="w-3 h-3 mr-1" /> Deny
                </Button>
              )
            )}

            {/* Request More Info */}
            {['submitted', 'under_review', 'flagged'].includes(statusKey) && (
              actionMode === 'request' ? (
                <Button
                  onClick={() => { onAction(record.id, 'request_info', { note: noteText }); setActionMode(null); setNoteText(''); }}
                  disabled={!noteText.trim()}
                  className="text-xs bg-yellow-600 hover:bg-yellow-500"
                >
                  <MessageSquare className="w-3 h-3 mr-1" /> Send Request
                </Button>
              ) : (
                <Button
                  onClick={() => setActionMode('request')}
                  variant="outline"
                  className="text-xs border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                >
                  <MessageSquare className="w-3 h-3 mr-1" /> Request Info
                </Button>
              )
            )}

            {/* Flag as Suspicious */}
            {['submitted', 'under_review'].includes(statusKey) && (
              actionMode === 'flag' ? (
                <Button
                  onClick={() => { onAction(record.id, 'flag', { note: noteText }); setActionMode(null); setNoteText(''); }}
                  disabled={!noteText.trim()}
                  className="text-xs bg-orange-600 hover:bg-orange-500"
                >
                  <Flag className="w-3 h-3 mr-1" /> Confirm Flag
                </Button>
              ) : (
                <Button
                  onClick={() => setActionMode('flag')}
                  variant="outline"
                  className="text-xs border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                >
                  <Flag className="w-3 h-3 mr-1" /> Flag Suspicious
                </Button>
              )
            )}
          </div>

          {actionMode && (
            <button onClick={() => { setActionMode(null); setNoteText(''); }} className="text-xs text-slate-500 hover:text-slate-300 w-full text-center">
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function KYCAdminQueue() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('pending');

  const { data: allKYC = [], isLoading, refetch } = useQuery({
    queryKey: ['kyc-admin-all'],
    queryFn: () => base44.entities.KYCVerification.list('-created_date', 100),
    initialData: [],
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action, note }) => {
      const now = new Date().toISOString();
      const updates = {
        updated_date: now,
        admin_notes: note || undefined,
      };

      if (action === 'approve') {
        Object.assign(updates, {
          status: 'approved',
          admin_status: 'approved',
          approved_at: now,
          verified_at: now,
          user_approved_for_autopilot: true,
          allowed_modules: ['financial_onboarding', 'payment_payout', 'prize_claiming', 'tax_compliance', 'government_compliance'],
          admin_denial_reason: null,
          admin_request_note: null,
        });
      } else if (action === 'deny') {
        Object.assign(updates, {
          status: 'rejected',
          admin_status: 'rejected',
          rejection_reason: note,
          admin_denial_reason: note,
          user_approved_for_autopilot: false,
          allowed_modules: [],
        });
      } else if (action === 'under_review') {
        Object.assign(updates, {
          status: 'under_review',
          admin_status: 'under_review',
        });
      } else if (action === 'request_info') {
        Object.assign(updates, {
          status: 'submitted',
          admin_status: 'additional_info',
          admin_request_note: note,
        });
      } else if (action === 'flag') {
        Object.assign(updates, {
          admin_status: 'flagged',
          admin_notes: `[FLAGGED] ${note}`,
        });
      }

      // Log to KYC access log
      const logEntry = {
        accessed_at: now,
        accessed_by: 'admin',
        purpose: action,
        module: 'kyc_admin_review',
      };
      const existing = await base44.entities.KYCVerification.filter({ id });
      const existingLog = existing[0]?.access_log || [];
      updates.access_log = [...existingLog, logEntry];

      return base44.entities.KYCVerification.update(id, updates);
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['kyc-admin-all'] });
      queryClient.invalidateQueries({ queryKey: ['kyc'] });
      const messages = {
        approve: '✅ KYC approved',
        deny: '❌ KYC denied',
        under_review: '🔍 Marked under review',
        request_info: '📋 Additional info requested',
        flag: '🚩 Submission flagged',
      };
      toast.success(messages[action] || 'Updated');
    },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const handleAction = (id, action, { note } = {}) => {
    actionMutation.mutate({ id, action, note });
  };

  const filtered = allKYC.filter(r => {
    const s = r.admin_status || r.status;
    if (statusFilter === 'pending') return ['submitted', 'under_review', 'additional_info'].includes(s);
    if (statusFilter === 'flagged') return s === 'flagged';
    if (statusFilter === 'approved') return s === 'approved';
    if (statusFilter === 'denied') return s === 'rejected';
    return true;
  });

  const counts = {
    pending:  allKYC.filter(r => ['submitted', 'under_review', 'additional_info'].includes(r.admin_status || r.status)).length,
    flagged:  allKYC.filter(r => (r.admin_status || r.status) === 'flagged').length,
    approved: allKYC.filter(r => (r.admin_status || r.status) === 'approved').length,
    denied:   allKYC.filter(r => (r.admin_status || r.status) === 'rejected').length,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            KYC Review Queue
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Manual human verification · All decisions are logged</p>
        </div>
        <Button onClick={() => refetch()} variant="ghost" size="sm" className="text-slate-400">
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { key: 'pending',  label: 'Pending',  color: 'text-blue-400',    count: counts.pending },
          { key: 'flagged',  label: 'Flagged',  color: 'text-orange-400',  count: counts.flagged },
          { key: 'approved', label: 'Approved', color: 'text-emerald-400', count: counts.approved },
          { key: 'denied',   label: 'Denied',   color: 'text-red-400',     count: counts.denied },
        ].map(({ key, label, color, count }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`bg-slate-900 border rounded-lg p-3 text-center transition-colors ${statusFilter === key ? 'border-slate-500' : 'border-slate-800 hover:border-slate-700'}`}
          >
            <p className={`text-xl font-bold ${color}`}>{count}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </button>
        ))}
      </div>

      {/* All filter */}
      <div className="flex gap-1">
        {['pending', 'flagged', 'approved', 'denied', 'all'].map(f => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={`px-3 py-1 rounded-lg text-xs capitalize border transition-colors ${statusFilter === f ? 'bg-slate-700 border-slate-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Review Queue */}
      {isLoading ? (
        <p className="text-slate-500 text-sm text-center py-8">Loading submissions...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Shield className="w-10 h-10 mx-auto mb-3 text-slate-700" />
          <p className="text-sm">No {statusFilter} submissions.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(record => (
            <KYCReviewCard key={record.id} record={record} onAction={handleAction} />
          ))}
        </div>
      )}
    </div>
  );
}