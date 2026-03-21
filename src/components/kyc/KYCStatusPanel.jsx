import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { CheckCircle2, AlertCircle, Clock, Lock, Shield, FileText, XCircle, MessageSquare, Info, RefreshCw, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import KYCUpdateForm from './KYCUpdateForm';

const STATUS_CONFIG = {
pending:             { icon: Clock,         color: 'text-slate-400',   bg: 'bg-slate-700/30',     border: 'border-slate-700',   label: 'Not Submitted' },
submitted:           { icon: Clock,         color: 'text-blue-400',    bg: 'bg-blue-500/10',      border: 'border-blue-500/20', label: 'Pending Review' },
under_review:        { icon: Clock,         color: 'text-amber-400',   bg: 'bg-amber-500/10',     border: 'border-amber-500/20',label: 'Under Review' },
verified:            { icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-500/10',   border: 'border-emerald-500/20', label: 'Verified' },
approved:            { icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-500/10',   border: 'border-emerald-500/20', label: 'Approved' },
rejected:            { icon: XCircle,       color: 'text-red-400',     bg: 'bg-red-500/10',       border: 'border-red-500/20',  label: 'Denied' },
expired:             { icon: AlertCircle,   color: 'text-amber-400',   bg: 'bg-amber-500/10',     border: 'border-amber-500/20',label: 'Expired' },
additional_info:     { icon: MessageSquare, color: 'text-yellow-400',  bg: 'bg-yellow-500/10',    border: 'border-yellow-500/20',label: 'Additional Info Required' },
check_again_required: { icon: AlertCircle, color: 'text-purple-400',  bg: 'bg-purple-500/10',    border: 'border-purple-500/20',label: 'Check Again Required' },
};

export default function KYCStatusPanel({ onStartKYC }) {
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const { data: kycRecord = null, isLoading, refetch: refetchKYC } = useQuery({
    queryKey: ['kyc_my'],
    queryFn: async () => {
      const res = await base44.functions.invoke('kycAdminService', { action: 'get_my_kyc' });
      return res.data?.record || null;
    },
  });

  const { data: adminNotifications = [] } = useQuery({
    queryKey: ['kyc_admin_notifications', kycRecord?.id],
    queryFn: async () => {
      if (!kycRecord?.id) return [];
      const res = await base44.entities.Notification.filter({
        related_entity_type: 'KYCVerification',
        related_entity_id: kycRecord.id,
        type: 'compliance_alert',
      }, '-created_date', 10);
      return res || [];
    },
    enabled: !!kycRecord?.id,
  });

  const checkAgainMutation = useMutation({
    mutationFn: async () => {
      return base44.functions.invoke('kycAdminService', { action: 'mark_check_again_acknowledged' });
    },
    onSuccess: () => {
      toast.success('Check again request acknowledged. Please review the flagged fields.');
      refetchKYC();
    },
  });

  const reapplyMutation = useMutation({
    mutationFn: async () => {
      return base44.functions.invoke('kycAdminService', { action: 'reapply_kyc' });
    },
    onSuccess: () => {
      toast.success('KYC reapplied. Your submission is back in the review queue.');
      refetchKYC();
    },
  });

  if (isLoading) {
    return (
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="py-8 text-center text-slate-500 text-sm">Loading KYC status...</CardContent>
      </Card>
    );
  }

  if (!kycRecord) {
    return (
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            Identity Verification (KYC)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Manual Review Notice */}
          <div className="bg-blue-950/40 border border-blue-800/40 rounded-lg p-3 flex gap-2">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-200">
              KYC verification is processed manually by an administrator. Approval may take up to <strong>5 business days</strong>.
            </p>
          </div>
          <p className="text-sm text-slate-300">
            Submit your verified legal identity to unlock identity-dependent platform features.
          </p>
          <div className="space-y-2 text-xs text-slate-400">
            <div className="flex gap-2"><span className="text-emerald-400">✓</span><span>All data is encrypted and stored securely</span></div>
            <div className="flex gap-2"><span className="text-emerald-400">✓</span><span>Reviewed by a certified human verifier</span></div>
            <div className="flex gap-2"><span className="text-emerald-400">✓</span><span>Used only when legally required</span></div>
          </div>
          <Button onClick={onStartKYC} className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500">
            <Lock className="w-3.5 h-3.5 mr-2" />
            Start KYC Verification
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (showUpdateForm) {
    return <KYCUpdateForm kycRecord={kycRecord} onClose={() => setShowUpdateForm(false)} />;
  }

  const statusKey = kycRecord.admin_status || kycRecord.status || 'pending';
  const config = STATUS_CONFIG[statusKey] || STATUS_CONFIG.submitted;
  const Icon = config.icon;

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-400" />
          Identity Verification (KYC)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Manual Review Notice */}
        <div className="bg-blue-950/40 border border-blue-800/40 rounded-lg p-3 flex gap-2">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-200">
            KYC verification is processed manually by an administrator. Approval may take up to <strong>5 business days</strong>.
          </p>
        </div>

        {/* Status Badge */}
        <div className={`${config.bg} border ${config.border} rounded-lg p-3 flex items-center gap-3`}>
          <Icon className={`w-5 h-5 ${config.color} shrink-0`} />
          <div>
            <p className={`text-sm font-semibold ${config.color}`}>{config.label}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {statusKey === 'submitted' && 'Your submission is in the review queue.'}
              {statusKey === 'under_review' && 'A verifier is currently reviewing your documents.'}
              {statusKey === 'approved' && 'Your identity has been verified and approved.'}
              {statusKey === 'rejected' && (kycRecord.admin_denial_reason || kycRecord.rejection_reason || 'Your submission was denied.')}
              {statusKey === 'additional_info' && (kycRecord.admin_request_note || 'The reviewer has requested additional documentation.')}
              {statusKey === 'expired' && 'Your verification has expired. Please resubmit.'}
            </p>
          </div>
        </div>

        {/* Additional Info Request */}
        {statusKey === 'additional_info' && kycRecord.admin_request_note && (
          <div className="bg-yellow-950/30 border border-yellow-800/30 rounded-lg p-3">
            <p className="text-xs font-semibold text-yellow-400 mb-1">Reviewer Note:</p>
            <p className="text-xs text-yellow-200">{kycRecord.admin_request_note}</p>
          </div>
        )}

        {/* Check Again Request */}
        {statusKey === 'check_again_required' && kycRecord.check_again_fields?.length > 0 && (
          <div className="bg-purple-950/30 border border-purple-800/30 rounded-lg p-3">
            <p className="text-xs font-semibold text-purple-400 mb-2">Fields to Review:</p>
            <div className="space-y-1">
              {kycRecord.check_again_fields.map(field => (
                <p key={field} className="text-xs text-purple-300">• {field.replace(/_/g, ' ').toUpperCase()}</p>
              ))}
            </div>
            {kycRecord.admin_request_note && (
              <p className="text-xs text-purple-200 mt-2 italic">"{kycRecord.admin_request_note}"</p>
            )}
          </div>
        )}

        {/* Admin Notifications */}
        {adminNotifications.length > 0 && (
          <div className="space-y-2">
            {adminNotifications.slice(0, 2).map(notif => (
              <div key={notif.id} className="bg-amber-950/40 border border-amber-800/50 rounded-lg p-3 flex gap-3">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-amber-300">{notif.title}</p>
                  <p className="text-xs text-amber-200 mt-0.5">{notif.message}</p>
                  {notif.action_type === 'document_upload_required' && (
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        onClick={() => setShowUpdateForm(true)}
                        className="h-7 text-xs bg-amber-600 hover:bg-amber-500 gap-1"
                      >
                        <Edit2 className="w-3 h-3" />
                        Upload Documents
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => reapplyMutation.mutate()}
                        disabled={reapplyMutation.isPending}
                        className="h-7 text-xs bg-blue-600 hover:bg-blue-500 gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Reapply
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Details */}
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">Name:</span>
            <span className="text-white font-semibold">{kycRecord.full_legal_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Submitted:</span>
            <span className="text-slate-300">{new Date(kycRecord.created_date).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Type:</span>
            <span className="text-white capitalize">{kycRecord.verification_type || 'standard'}</span>
          </div>
          {kycRecord.approved_at && (
            <div className="flex justify-between">
              <span className="text-slate-400">Approved:</span>
              <span className="text-emerald-400">{new Date(kycRecord.approved_at).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Autopilot clearance unlock status */}
        {(statusKey === 'approved' || statusKey === 'verified') && kycRecord.ai_analysis?.autopilot_clearance && (
          <div className="space-y-1.5">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Autopilot Clearance</p>
            {[
              { key: 'can_submit_w9',                  label: 'Tax Form Submissions' },
              { key: 'can_submit_grant_applications',  label: 'Grant Applications' },
              { key: 'can_use_government_portals',     label: 'Government Portals' },
              { key: 'can_submit_financial_onboarding',label: 'Financial Onboarding' },
              { key: 'can_attach_id_documents',        label: 'ID Document Tasks' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2 text-[11px]">
                {kycRecord.ai_analysis.autopilot_clearance[key]
                  ? <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  : <Shield className="w-3 h-3 text-slate-600 shrink-0" />
                }
                <span className={kycRecord.ai_analysis.autopilot_clearance[key] ? 'text-slate-300' : 'text-slate-600'}>{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Feature Lock Notice */}
        {statusKey !== 'approved' && statusKey !== 'verified' && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 flex gap-2">
            <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400">Identity-dependent features are locked until your KYC is approved.</p>
          </div>
        )}

        {/* Resubmit if denied/expired/additional info/check again */}
        {(statusKey === 'rejected' || statusKey === 'expired' || statusKey === 'additional_info' || statusKey === 'check_again_required') && (
          <div className="flex gap-2">
            <Button 
              onClick={() => setShowUpdateForm(true)} 
              disabled={checkAgainMutation.isPending || reapplyMutation.isPending}
              className="flex-1 text-xs bg-blue-600 hover:bg-blue-500 gap-1.5"
            >
              <Edit2 className="w-3 h-3" />
              {statusKey === 'check_again_required' ? 'Review & Update' : 'Update Information'}
            </Button>
            {statusKey === 'check_again_required' ? (
              <Button 
                onClick={() => checkAgainMutation.mutate()}
                disabled={checkAgainMutation.isPending}
                className="flex-1 text-xs bg-purple-600 hover:bg-purple-500 gap-1.5"
              >
                <RefreshCw className="w-3 h-3" />
                {checkAgainMutation.isPending ? 'Processing...' : 'Acknowledge'}
              </Button>
            ) : (
              <Button 
                onClick={() => reapplyMutation.mutate()}
                disabled={reapplyMutation.isPending}
                className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-500 gap-1.5"
              >
                <RefreshCw className="w-3 h-3" />
                {reapplyMutation.isPending ? 'Reapplying...' : 'Reapply'}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}