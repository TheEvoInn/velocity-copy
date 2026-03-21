/**
 * KYCAIAnalysisPanel — Admin component
 * Shows AI document analysis results: extracted data, face match, cross-validation,
 * and provides buttons to run analysis and sync verified data to identity.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Brain, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
  User, Calendar, CreditCard, Fingerprint, Link, ShieldCheck,
  Loader2, ChevronDown, ChevronUp, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const VERDICT_CONFIG = {
  pass:             { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', label: 'All Clear' },
  review_required:  { color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/25',   label: 'Review Needed' },
  fail:             { color: 'text-red-400',      bg: 'bg-red-500/10',     border: 'border-red-500/25',     label: 'Failed' },
};

const FACE_VERDICT = {
  match:            { color: 'text-emerald-400', label: 'Strong Match' },
  likely_match:     { color: 'text-blue-400',    label: 'Likely Match' },
  likely_mismatch:  { color: 'text-amber-400',   label: 'Likely Mismatch' },
  mismatch:         { color: 'text-red-400',      label: 'Mismatch' },
  inconclusive:     { color: 'text-slate-400',    label: 'Inconclusive' },
};

function FieldRow({ label, value, match, icon: Icon }) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-slate-800/50 last:border-0">
      {Icon && <Icon className="w-3 h-3 text-slate-500 shrink-0" />}
      <span className="text-[11px] text-slate-500 w-28 shrink-0">{label}</span>
      <span className="text-[11px] text-white flex-1 font-mono">{value || '—'}</span>
      {match === true  && <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />}
      {match === false && <XCircle className="w-3 h-3 text-red-400 shrink-0" />}
    </div>
  );
}

export default function KYCAIAnalysisPanel({ kyc, identities = [], onUpdated }) {
  const [expanded, setExpanded] = useState(false);
  const qc = useQueryClient();
  const analysis = kyc.ai_analysis || null;
  const status = kyc.ai_analysis_status || 'not_run';

  const analyzeMutation = useMutation({
    mutationFn: () => base44.functions.invoke('kycDocAnalyzer', {
      action: 'analyze_documents',
      kyc_id: kyc.id
    }),
    onSuccess: (res) => {
      if (res.data?.error) { toast.error(res.data.error); return; }
      toast.success('AI analysis complete');
      qc.invalidateQueries({ queryKey: ['admin_kyc_list'] });
      onUpdated?.();
      setExpanded(true);
    },
    onError: err => toast.error(`Analysis failed: ${err.message}`)
  });

  const syncMutation = useMutation({
    mutationFn: (identity_id) => base44.functions.invoke('kycDocAnalyzer', {
      action: 'sync_to_identity',
      kyc_id: kyc.id,
      identity_id
    }),
    onSuccess: (res) => {
      if (res.data?.error) { toast.error(res.data.error); return; }
      toast.success(`KYC data synced to "${res.data?.identity_name}" — Autopilot tier: ${res.data?.kyc_tier}`);
      qc.invalidateQueries({ queryKey: ['admin_kyc_list'] });
      qc.invalidateQueries({ queryKey: ['aiIdentities'] });
      onUpdated?.();
    },
    onError: err => toast.error(`Sync failed: ${err.message}`)
  });

  const crossVal = analysis?.cross_validation;
  const faceMatch = analysis?.face_match;
  const extracted = analysis?.id_front;
  const pii = analysis?.extracted_pii;
  const clearance = analysis?.autopilot_clearance;
  const verdictCfg = VERDICT_CONFIG[crossVal?.overall_verdict] || VERDICT_CONFIG.review_required;
  const faceCfg = FACE_VERDICT[faceMatch?.match_verdict] || FACE_VERDICT.inconclusive;

  return (
    <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpanded(p => !p)}>
        <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0">
          <Brain className="w-3.5 h-3.5 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white">AI Document Analysis</p>
          <p className="text-[10px] text-slate-500">
            {status === 'not_run' && 'Not yet analyzed — click Run Analysis'}
            {status === 'pending'   && 'Analysis in progress...'}
            {status === 'completed' && `Analyzed ${analysis?.analyzed_at ? new Date(analysis.analyzed_at).toLocaleString() : ''}`}
            {status === 'failed'    && `Analysis failed — ${analysis?.error || 'unknown error'}`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {status === 'completed' && crossVal && (
            <span className={`text-[10px] px-2 py-0.5 rounded border ${verdictCfg.bg} ${verdictCfg.border} ${verdictCfg.color}`}>
              {verdictCfg.label}
            </span>
          )}
          {status === 'completed' && faceMatch && (
            <span className={`text-[10px] px-2 py-0.5 rounded border border-slate-700 bg-slate-800/50 ${faceCfg.color}`}>
              Face: {faceCfg.label}
            </span>
          )}
          <Button
            size="sm"
            onClick={e => { e.stopPropagation(); analyzeMutation.mutate(); }}
            disabled={analyzeMutation.isPending}
            className="h-6 px-2 text-[10px] bg-violet-600/80 hover:bg-violet-500 text-white"
          >
            {analyzeMutation.isPending
              ? <><Loader2 className="w-3 h-3 mr-0.5 animate-spin" /> Analyzing...</>
              : <><RefreshCw className="w-3 h-3 mr-0.5" /> {status === 'completed' ? 'Re-run' : 'Run Analysis'}</>
            }
          </Button>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && status === 'completed' && analysis && (
        <div className="border-t border-violet-500/15 p-3 space-y-4">

          {/* Cross-Validation */}
          {crossVal && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Cross-Validation</p>
              <div className={`rounded-lg p-2.5 border ${verdictCfg.bg} ${verdictCfg.border}`}>
                <div className="flex items-center gap-2 mb-2">
                  {crossVal.overall_verdict === 'pass'
                    ? <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    : crossVal.overall_verdict === 'fail'
                    ? <XCircle className="w-4 h-4 text-red-400" />
                    : <AlertTriangle className="w-4 h-4 text-amber-400" />
                  }
                  <span className={`text-xs font-semibold ${verdictCfg.color}`}>{verdictCfg.label}</span>
                </div>
                <div className="space-y-1 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    {crossVal.name_matches_submitted
                      ? <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      : crossVal.name_matches_submitted === false
                      ? <XCircle className="w-3 h-3 text-red-400" />
                      : <AlertTriangle className="w-3 h-3 text-slate-500" />
                    }
                    <span className="text-slate-400">Name match</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {crossVal.dob_matches_submitted
                      ? <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      : crossVal.dob_matches_submitted === false
                      ? <XCircle className="w-3 h-3 text-red-400" />
                      : <AlertTriangle className="w-3 h-3 text-slate-500" />
                    }
                    <span className="text-slate-400">DOB match</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {crossVal.expiry_valid
                      ? <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      : <XCircle className="w-3 h-3 text-red-400" />
                    }
                    <span className="text-slate-400">ID not expired</span>
                  </div>
                </div>
                {crossVal.discrepancies?.length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    {crossVal.discrepancies.map((d, i) => (
                      <p key={i} className="text-[10px] text-red-300">⚠ {d}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Face Match */}
          {faceMatch && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Biometric Face Match</p>
              <div className="rounded-lg p-2.5 border border-slate-700 bg-slate-800/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Fingerprint className="w-4 h-4 text-slate-500" />
                    <span className={`text-sm font-bold ${faceCfg.color}`}>{faceCfg.label}</span>
                  </div>
                  <span className={`text-lg font-orbitron font-bold ${faceCfg.color}`}>
                    {faceMatch.match_score ?? '—'}%
                  </span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${faceMatch.match_score || 0}%`,
                      background: (faceMatch.match_score || 0) >= 85 ? '#10b981'
                        : (faceMatch.match_score || 0) >= 70 ? '#3b82f6'
                        : '#ef4444'
                    }}
                  />
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                  {faceMatch.liveness_check
                    ? <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    : <XCircle className="w-3 h-3 text-red-400" />
                  }
                  Liveness check {faceMatch.liveness_check ? 'passed' : 'failed'}
                </div>
                {faceMatch.notes && (
                  <p className="text-[10px] text-slate-500 italic">{faceMatch.notes}</p>
                )}
              </div>
            </div>
          )}

          {/* Extracted PII */}
          {extracted && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">AI-Extracted Document Data</p>
              <div className="rounded-lg border border-slate-700 bg-slate-800/20 p-2.5">
                <FieldRow label="Full Name" value={extracted.extracted_name} match={crossVal?.name_matches_submitted} icon={User} />
                <FieldRow label="Date of Birth" value={extracted.extracted_dob} match={crossVal?.dob_matches_submitted} icon={Calendar} />
                <FieldRow label="ID Number" value={extracted.extracted_id_number} icon={CreditCard} />
                <FieldRow label="Expiry Date" value={extracted.extracted_expiry} match={crossVal?.expiry_valid} icon={Calendar} />
                <FieldRow label="ID Type" value={extracted.id_type_detected} icon={CreditCard} />
                <FieldRow label="Country" value={extracted.issuing_country} icon={User} />
                <FieldRow label="State" value={extracted.issuing_state} icon={User} />
                {extracted.extracted_address && (
                  <FieldRow label="Address" value={extracted.extracted_address} icon={User} />
                )}
                <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span>Confidence:</span>
                  <span className="font-mono text-violet-400">{extracted.confidence_score}%</span>
                  {extracted.tampering_detected && (
                    <span className="ml-2 text-red-400 font-semibold">⚠ Tampering detected</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Autopilot Clearance */}
          {clearance && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Autopilot Clearance</p>
              <div className="rounded-lg border border-slate-700 bg-slate-800/20 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-slate-400">KYC Tier</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                    clearance.kyc_tier === 'enhanced' ? 'bg-emerald-500/15 text-emerald-400' :
                    clearance.kyc_tier === 'standard' ? 'bg-blue-500/15 text-blue-400' :
                    'bg-slate-700 text-slate-400'
                  }`}>{clearance.kyc_tier || 'none'}</span>
                </div>
                {[
                  { key: 'can_submit_w9', label: 'W-9 / Tax Forms' },
                  { key: 'can_submit_1099_forms', label: '1099 Forms' },
                  { key: 'can_submit_grant_applications', label: 'Grant Applications' },
                  { key: 'can_use_government_portals', label: 'Government Portals' },
                  { key: 'can_submit_financial_onboarding', label: 'Financial Onboarding' },
                  { key: 'can_attach_id_documents', label: 'Attach ID Documents' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    {clearance[key]
                      ? <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                      : <XCircle className="w-3 h-3 text-slate-600 shrink-0" />
                    }
                    <span className={`text-[10px] ${clearance[key] ? 'text-slate-300' : 'text-slate-600'}`}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sync to Identity */}
          {(kyc.status === 'approved' || kyc.admin_status === 'approved') && (
            <div className="pt-1">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Sync to Autopilot Identity</p>
              <div className="space-y-2">
                {identities.length > 0 ? (
                  identities.map(id => (
                    <div key={id.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40 border border-slate-700">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded bg-violet-500/20 flex items-center justify-center">
                          <User className="w-3 h-3 text-violet-400" />
                        </div>
                        <div>
                          <p className="text-[11px] text-white font-medium">{id.name}</p>
                          <p className="text-[9px] text-slate-500">{id.role_label || 'AI Identity'}</p>
                        </div>
                        {id.kyc_verified_data?.kyc_id === kyc.id && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 ml-1">Synced</span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => syncMutation.mutate(id.id)}
                        disabled={syncMutation.isPending}
                        className="h-6 px-2 text-[10px] bg-emerald-600/70 hover:bg-emerald-500 text-white"
                      >
                        {syncMutation.isPending
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <><Link className="w-3 h-3 mr-0.5" /> Sync</>
                        }
                      </Button>
                    </div>
                  ))
                ) : (
                  <Button
                    size="sm"
                    onClick={() => syncMutation.mutate(null)}
                    disabled={syncMutation.isPending}
                    className="w-full h-7 text-[11px] bg-emerald-600/70 hover:bg-emerald-500 text-white"
                  >
                    {syncMutation.isPending
                      ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Syncing...</>
                      : <><Zap className="w-3 h-3 mr-1" /> Sync to Active Identity</>
                    }
                  </Button>
                )}
                <p className="text-[9px] text-slate-600">
                  Syncing pushes verified name, DOB, ID number, tax ID, and document URLs into the identity's secure profile for autopilot use.
                </p>
              </div>
            </div>
          )}

          {status === 'completed' && !(kyc.status === 'approved' || kyc.admin_status === 'approved') && (
            <p className="text-[10px] text-slate-600 text-center py-1">
              Approve the KYC submission to enable identity sync and autopilot clearance.
            </p>
          )}
        </div>
      )}

      {expanded && status === 'not_run' && (
        <div className="border-t border-violet-500/15 p-4 text-center">
          <Brain className="w-8 h-8 text-violet-500/40 mx-auto mb-2" />
          <p className="text-xs text-slate-500">
            Run AI analysis to automatically extract name, DOB, and ID data from the uploaded documents, perform a face match between the selfie and ID, and compute autopilot clearance levels.
          </p>
        </div>
      )}

      {expanded && status === 'failed' && (
        <div className="border-t border-red-500/15 p-3">
          <p className="text-[10px] text-red-400">Analysis error: {analysis?.error}</p>
          <p className="text-[10px] text-slate-500 mt-1">Ensure document images are accessible public URLs and try again.</p>
        </div>
      )}
    </div>
  );
}