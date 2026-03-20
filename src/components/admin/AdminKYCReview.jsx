/**
 * Admin KYC Review — Approve / Deny KYC submissions with compliance logging
 * Sensitive documents are shown only to authorized admin reviewers.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileCheck, CheckCircle2, XCircle, Clock, AlertTriangle,
  ChevronDown, ChevronUp, RefreshCw, MessageSquare, Eye, EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

const STATUS_COLOR = {
  pending:      '#64748b',
  submitted:    '#f59e0b',
  under_review: '#3b82f6',
  verified:     '#10b981',
  approved:     '#10b981',
  rejected:     '#ef4444',
  flagged:      '#ef4444',
};

function KYCCard({ kyc, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [denialReason, setDenialReason] = useState('');
  const { user } = useAuth();
  const qc = useQueryClient();

  const color = STATUS_COLOR[kyc.admin_status || kyc.status] || '#64748b';

  const updateMutation = useMutation({
    mutationFn: (updates) => base44.entities.KYCVerification.update(kyc.id, {
      ...updates,
      reviewed_by: user?.email,
      review_started_at: new Date().toISOString(),
      access_log: [
        ...(kyc.access_log || []),
        {
          accessed_at: new Date().toISOString(),
          accessed_by: user?.email,
          purpose: 'admin_review',
          module: 'AdminKYCReview',
        }
      ]
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_kyc_list'] });
      toast.success('KYC record updated');
    },
    onError: err => toast.error(err.message),
  });

  const handleApprove = () => {
    updateMutation.mutate({
      admin_status: 'approved',
      status: 'approved',
      approved_at: new Date().toISOString(),
      admin_notes: adminNote || 'Approved by admin',
      user_approved_for_autopilot: true,
    });
  };

  const handleReject = () => {
    if (!denialReason.trim()) { toast.error('Please provide a denial reason'); return; }
    updateMutation.mutate({
      admin_status: 'rejected',
      status: 'rejected',
      admin_denial_reason: denialReason,
      admin_notes: adminNote,
    });
  };

  const handleRequestInfo = () => {
    if (!adminNote.trim()) { toast.error('Please provide a message for the user'); return; }
    updateMutation.mutate({
      admin_status: 'additional_info',
      status: 'under_review',
      admin_request_note: adminNote,
    });
  };

  const handleFlagFraud = () => {
    updateMutation.mutate({
      admin_status: 'flagged',
      fraud_flags: [...(kyc.fraud_flags || []), adminNote || 'Flagged by admin'],
    });
  };

  const submittedAt = kyc.created_date ? new Date(kyc.created_date) : null;
  const waitHours = submittedAt
    ? Math.round((Date.now() - submittedAt.getTime()) / 3600000)
    : 0;

  return (
    <div className="border rounded-xl overflow-hidden"
      style={{ borderColor: `${color}30` }}>
      <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-800/30 transition-colors"
        style={{ background: `${color}08` }}
        onClick={() => setExpanded(p => !p)}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${color}20`, border: `1px solid ${color}30` }}>
          <FileCheck className="w-4 h-4" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{kyc.full_legal_name || 'Unknown'}</p>
          <p className="text-xs text-slate-500">{kyc.created_by} · {kyc.country || '—'}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2 py-0.5 rounded text-[10px] font-medium capitalize"
            style={{ background: `${color}15`, border: `1px solid ${color}30`, color }}>
            {kyc.admin_status || kyc.status}
          </span>
          {waitHours > 48 && (
            <span className="px-2 py-0.5 rounded text-[10px] bg-red-500/10 border border-red-500/30 text-red-400">
              {waitHours}h wait
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </div>

      {expanded && (
        <div className="border-t p-4 space-y-4" style={{ borderColor: `${color}20` }}>
          {/* Metadata */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {[
              { label: 'Verification Type', value: kyc.verification_type },
              { label: 'Submitted',         value: submittedAt ? submittedAt.toLocaleDateString() : '—' },
              { label: 'Country',           value: kyc.country || '—' },
              { label: 'ID Type',           value: kyc.government_id_type?.replace('_', ' ') || '—' },
              { label: 'State',             value: kyc.state || '—' },
              { label: 'Tax Verified',      value: kyc.tax_id_verified ? '✅ Yes' : '❌ No' },
              { label: 'Reviewed By',       value: kyc.reviewed_by || 'Pending' },
              { label: 'Wait Time',         value: `${waitHours}h` },
            ].map(({ label, value }) => (
              <div key={label} className="p-2 rounded-lg bg-slate-800/40">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">{label}</p>
                <p className="text-white capitalize">{value || '—'}</p>
              </div>
            ))}
          </div>

          {/* Documents — secure view toggle */}
          {(kyc.id_document_front_url || kyc.id_document_back_url || kyc.selfie_url) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-white">Identity Documents</p>
                <Button size="sm" variant="outline" onClick={() => setShowDocs(p => !p)}
                  className="border-slate-700 text-slate-400 text-xs h-7 gap-1">
                  {showDocs ? <><EyeOff className="w-3 h-3" /> Hide</> : <><Eye className="w-3 h-3" /> View Securely</>}
                </Button>
              </div>
              {showDocs && (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'ID Front', url: kyc.id_document_front_url },
                    { label: 'ID Back',  url: kyc.id_document_back_url },
                    { label: 'Selfie',   url: kyc.selfie_url },
                  ].filter(d => d.url).map(doc => (
                    <div key={doc.label} className="rounded-lg overflow-hidden border border-slate-700">
                      <img src={doc.url} alt={doc.label}
                        className="w-full h-24 object-cover" />
                      <p className="text-[10px] text-slate-500 p-1.5 text-center">{doc.label}</p>
                    </div>
                  ))}
                </div>
              )}
              {!showDocs && (
                <p className="text-xs text-slate-600">Documents hidden for privacy. Click "View Securely" to review.</p>
              )}
            </div>
          )}

          {/* Supporting documents */}
          {kyc.supporting_documents?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-white mb-2">Supporting Documents ({kyc.supporting_documents.length})</p>
              <div className="space-y-1.5">
                {kyc.supporting_documents.map((doc, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/40 text-xs">
                    <FileCheck className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-white capitalize">{doc.document_type?.replace('_', ' ')}</span>
                    {doc.verified && <CheckCircle2 className="w-3 h-3 text-emerald-400 ml-auto" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin Notes */}
          <div>
            <p className="text-xs font-medium text-white mb-1.5">Admin Notes / Message to User</p>
            <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} rows={2}
              placeholder="Add internal notes or a message to the user..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500/50 resize-none" />
          </div>
          {['rejected', 'flagged'].includes(kyc.admin_status) || (
            <div>
              <p className="text-xs font-medium text-white mb-1.5">Denial Reason (required for reject)</p>
              <textarea value={denialReason} onChange={e => setDenialReason(e.target.value)} rows={1}
                placeholder="Reason for rejection..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500/50 resize-none" />
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleApprove} disabled={updateMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Approve
            </Button>
            <Button size="sm" onClick={handleReject} disabled={updateMutation.isPending}
              className="bg-red-600 hover:bg-red-500 text-white text-xs h-8 gap-1.5">
              <XCircle className="w-3.5 h-3.5" /> Reject
            </Button>
            <Button size="sm" onClick={handleRequestInfo} disabled={updateMutation.isPending}
              variant="outline"
              className="border-blue-500/40 text-blue-400 text-xs h-8 gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Request Info
            </Button>
            <Button size="sm" onClick={handleFlagFraud} disabled={updateMutation.isPending}
              variant="outline"
              className="border-red-500/40 text-red-400 text-xs h-8 gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Flag Fraud
            </Button>
          </div>

          {/* Existing admin notes */}
          {kyc.admin_notes && (
            <div className="p-2.5 rounded-lg bg-slate-800/40 text-xs text-slate-400">
              <span className="text-slate-500">Admin note: </span>{kyc.admin_notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminKYCReview() {
  const [filter, setFilter] = useState('pending');
  const qc = useQueryClient();

  const { data: kycs = [], isLoading, refetch } = useQuery({
    queryKey: ['admin_kyc_list'],
    queryFn: () => base44.entities.KYCVerification.list('-created_date', 100),
    refetchInterval: 20000,
  });

  const FILTERS = [
    { id: 'pending',      label: 'Pending Review', count: kycs.filter(k => ['pending','submitted'].includes(k.status)).length },
    { id: 'under_review', label: 'Under Review',   count: kycs.filter(k => k.admin_status === 'under_review').length },
    { id: 'approved',     label: 'Approved',        count: kycs.filter(k => k.status === 'approved').length },
    { id: 'rejected',     label: 'Rejected',        count: kycs.filter(k => k.status === 'rejected').length },
    { id: 'all',          label: 'All',             count: kycs.length },
  ];

  const filtered = kycs.filter(k => {
    if (filter === 'all')          return true;
    if (filter === 'pending')      return ['pending','submitted'].includes(k.status);
    if (filter === 'under_review') return k.admin_status === 'under_review';
    return k.status === filter;
  });

  const avgWaitHours = kycs.filter(k => ['pending','submitted'].includes(k.status)).reduce((acc, k) => {
    const hrs = Math.round((Date.now() - new Date(k.created_date).getTime()) / 3600000);
    return acc + hrs;
  }, 0) / (kycs.filter(k => ['pending','submitted'].includes(k.status)).length || 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-orbitron text-base font-bold text-amber-400 tracking-wide flex items-center gap-2">
          <FileCheck className="w-4 h-4" /> KYC Review Queue
        </h2>
        <Button size="sm" variant="outline" onClick={refetch}
          className="border-slate-700 text-slate-400 text-xs h-7 gap-1.5">
          <RefreshCw className="w-3 h-3" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Pending Review', value: kycs.filter(k => ['pending','submitted'].includes(k.status)).length, color: '#f59e0b', icon: Clock },
          { label: 'Under Review',   value: kycs.filter(k => k.admin_status === 'under_review').length,          color: '#3b82f6', icon: Eye },
          { label: 'Approved',       value: kycs.filter(k => k.status === 'approved').length,                    color: '#10b981', icon: CheckCircle2 },
          { label: 'Avg Wait',       value: `${Math.round(avgWaitHours)}h`,                                        color: '#a855f7', icon: Clock },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="rounded-xl p-3" style={{ background: `${color}10`, border: `1px solid ${color}25` }}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className="w-3.5 h-3.5" style={{ color }} />
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
            </div>
            <p className="text-xl font-orbitron font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
              filter === f.id
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-slate-800/50 border-slate-700 text-slate-500 hover:text-slate-300'
            }`}>
            {f.label}
            {f.count > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">{f.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* KYC Cards */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="text-center py-8 text-slate-500 text-sm">Loading KYC submissions...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">No KYC records in this category.</div>
        ) : (
          filtered.map(kyc => <KYCCard key={kyc.id} kyc={kyc} />)
        )}
      </div>
    </div>
  );
}