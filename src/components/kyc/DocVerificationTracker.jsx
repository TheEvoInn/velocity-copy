/**
 * DocVerificationTracker — Admin component
 * Per-document compliance checklist with approve/reject per doc type,
 * auto-updates KYC status when all required docs are approved.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileCheck, CheckCircle2, XCircle, Clock, Eye, EyeOff,
  ShieldCheck, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

// All doc types and whether they're required for full KYC approval
const DOC_CHECKLIST = [
  { key: 'id_front',         label: 'Government ID (Front)',    required: true,  urlField: 'id_document_front_url' },
  { key: 'id_back',          label: 'Government ID (Back)',     required: true,  urlField: 'id_document_back_url' },
  { key: 'selfie',           label: 'Selfie / Liveness Check', required: true,  urlField: 'selfie_url' },
  { key: 'tax_id',           label: 'Tax ID Verified',         required: false, field: 'tax_id_verified' },
  { key: 'supporting_docs',  label: 'Supporting Documents',    required: false, virtual: true },
];

function docStatus(kyc, docKey) {
  const approved = kyc.doc_approvals?.[docKey];
  if (approved === true)  return 'approved';
  if (approved === false) return 'rejected';
  return 'pending';
}

function allRequiredApproved(kyc) {
  return DOC_CHECKLIST
    .filter(d => d.required)
    .every(d => kyc.doc_approvals?.[d.key] === true);
}

const STATUS_STYLE = {
  approved: { color: '#10b981', icon: CheckCircle2, label: 'Approved' },
  rejected: { color: '#ef4444', icon: XCircle,      label: 'Rejected' },
  pending:  { color: '#64748b', icon: Clock,         label: 'Pending'  },
};

export default function DocVerificationTracker({ kyc, onKycUpdated }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showImages, setShowImages] = useState({});

  const updateMutation = useMutation({
    mutationFn: (updates) =>
      base44.functions.invoke('kycAdminService', {
        action: 'update',
        id: kyc.id,
        updates: {
          ...updates,
          reviewed_by: user?.email,
          review_started_at: new Date().toISOString(),
          access_log: [
            ...(kyc.access_log || []),
            {
              accessed_at: new Date().toISOString(),
              accessed_by: user?.email,
              purpose: 'doc_review',
              module: 'DocVerificationTracker',
            }
          ]
        }
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_kyc_list'] });
      onKycUpdated?.();
    },
    onError: err => toast.error(err.message),
  });

  const handleDocAction = (docKey, approved) => {
    const newApprovals = { ...(kyc.doc_approvals || {}), [docKey]: approved };
    const allApproved = DOC_CHECKLIST.filter(d => d.required).every(d => newApprovals[d.key] === true);

    const updates = {
      doc_approvals: newApprovals,
    };

    // Auto-advance KYC status when all required docs pass
    if (allApproved) {
      updates.admin_status = 'approved';
      updates.status = 'approved';
      updates.approved_at = new Date().toISOString();
      updates.user_approved_for_autopilot = true;
      toast.success('All required docs approved — KYC marked as Approved!');
    } else if (!approved) {
      updates.admin_status = 'under_review';
      updates.status = 'under_review';
    } else {
      updates.admin_status = 'under_review';
    }

    updateMutation.mutate(updates);
  };

  const toggleImage = (key) => setShowImages(p => ({ ...p, [key]: !p[key] }));

  const completedCount = DOC_CHECKLIST.filter(d => kyc.doc_approvals?.[d.key] === true).length;
  const totalCount = DOC_CHECKLIST.length;
  const progress = Math.round((completedCount / totalCount) * 100);
  const requiredAllDone = allRequiredApproved(kyc);

  return (
    <div className="space-y-3">
      {/* Progress Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-semibold text-white">Document Compliance Checklist</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">{completedCount}/{totalCount} approved</span>
          {requiredAllDone && (
            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-medium">
              ✓ All Required Docs Cleared
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${progress}%`,
            background: requiredAllDone ? '#10b981' : '#7c3aed'
          }}
        />
      </div>

      {/* Document Rows */}
      <div className="space-y-2">
        {DOC_CHECKLIST.map((doc) => {
          const status = docStatus(kyc, doc.key);
          const { color, icon: StatusIcon, label } = STATUS_STYLE[status];

          // Resolve image URL
          const imgUrl = doc.urlField ? kyc[doc.urlField] : null;
          // For tax_id: use boolean field
          const isBoolDoc = doc.field === 'tax_id_verified';
          const taxVerified = isBoolDoc ? kyc.tax_id_verified : null;
          // For supporting docs: use array
          const isVirtual = doc.virtual;
          const supportingDocs = isVirtual ? (kyc.supporting_documents || []) : null;
          const hasContent = imgUrl || (isBoolDoc && kyc.tax_id) || (isVirtual && supportingDocs?.length > 0);

          return (
            <div
              key={doc.key}
              className="rounded-xl border overflow-hidden"
              style={{ borderColor: `${color}25`, background: `${color}05` }}
            >
              {/* Row Header */}
              <div className="flex items-center gap-3 p-3">
                <StatusIcon className="w-4 h-4 shrink-0" style={{ color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-white">{doc.label}</span>
                    {doc.required && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-violet-500/15 border border-violet-500/25 text-violet-400">Required</span>
                    )}
                    {!hasContent && status === 'pending' && (
                      <span className="text-[9px] text-slate-600 italic">Not uploaded</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* View toggle for images */}
                  {imgUrl && (
                    <button
                      onClick={() => toggleImage(doc.key)}
                      className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showImages[doc.key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  )}

                  {/* Status badge */}
                  <span className="text-[10px] px-1.5 py-0.5 rounded capitalize"
                    style={{ background: `${color}15`, border: `1px solid ${color}30`, color }}>
                    {label}
                  </span>

                  {/* Approve / Reject buttons */}
                  {hasContent && status !== 'approved' && (
                    <Button size="sm"
                      onClick={() => handleDocAction(doc.key, true)}
                      disabled={updateMutation.isPending}
                      className="h-6 px-2 text-[10px] bg-emerald-600/80 hover:bg-emerald-500 text-white">
                      <CheckCircle2 className="w-3 h-3 mr-0.5" /> Approve
                    </Button>
                  )}
                  {hasContent && status !== 'rejected' && (
                    <Button size="sm"
                      onClick={() => handleDocAction(doc.key, false)}
                      disabled={updateMutation.isPending}
                      variant="outline"
                      className="h-6 px-2 text-[10px] border-red-500/40 text-red-400 hover:bg-red-500/10">
                      <XCircle className="w-3 h-3 mr-0.5" /> Reject
                    </Button>
                  )}
                  {status !== 'pending' && (
                    <button
                      onClick={() => handleDocAction(doc.key, status === 'approved' ? undefined : undefined)}
                      className="p-1 rounded text-slate-600 hover:text-slate-400 text-[9px]"
                      title="Reset"
                      onClick={() => {
                        const newApprovals = { ...(kyc.doc_approvals || {}) };
                        delete newApprovals[doc.key];
                        updateMutation.mutate({ doc_approvals: newApprovals });
                      }}
                    >
                      ↺
                    </button>
                  )}
                </div>
              </div>

              {/* Image Preview */}
              {imgUrl && showImages[doc.key] && (
                <div className="px-3 pb-3">
                  <img src={imgUrl} alt={doc.label}
                    className="w-full max-h-48 object-contain rounded-lg border border-slate-700 bg-slate-900" />
                </div>
              )}

              {/* Tax ID special row */}
              {isBoolDoc && kyc.tax_id && (
                <div className="px-3 pb-2 text-[10px] text-slate-500">
                  Tax ID on file — currently {taxVerified ? '✅ verified' : '❌ unverified'}
                </div>
              )}

              {/* Supporting docs list */}
              {isVirtual && supportingDocs?.length > 0 && (
                <div className="px-3 pb-3 space-y-1">
                  {supportingDocs.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px] text-slate-400">
                      <FileCheck className="w-3 h-3 text-blue-400" />
                      <span className="capitalize">{d.document_type?.replace(/_/g, ' ')}</span>
                      {d.document_url && (
                        <a href={d.document_url} target="_blank" rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 underline ml-auto">View</a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Final Status Summary */}
      {requiredAllDone ? (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-400">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          All required documents verified — KYC has been automatically approved.
        </div>
      ) : (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {DOC_CHECKLIST.filter(d => d.required && kyc.doc_approvals?.[d.key] !== true).length} required document(s) still need approval.
        </div>
      )}
    </div>
  );
}