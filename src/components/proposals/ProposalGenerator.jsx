import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, Send, RefreshCw, ChevronDown, ChevronUp, Copy, CheckCircle2, Loader2, Zap, Target, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery, useQueryClient } from '@tanstack/react-query';

function ScoreBadge({ score }) {
  const color = score >= 80 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    : score >= 60 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    : 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${color}`}>{score}% confidence</span>
  );
}

export default function ProposalGenerator({ opportunity, onClose }) {
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [proposal, setProposal] = useState(null);
  const [editedBody, setEditedBody] = useState('');
  const [refineInstruction, setRefineInstruction] = useState('');
  const [refining, setRefining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const qc = useQueryClient();

  const { data: identityData } = useQuery({
    queryKey: ['active_identity'],
    queryFn: () => base44.functions.invoke('identityEngine', { action: 'get_active' }),
    staleTime: 30000
  });
  const identity = identityData?.data?.identity;

  const generate = async () => {
    setGenerating(true);
    setProposal(null);
    const res = await base44.functions.invoke('proposalEngine', {
      action: 'generate',
      opportunity_id: opportunity.id
    });
    if (res?.data?.proposal) {
      setProposal(res.data);
      setEditedBody(res.data.proposal.proposal_body);
    }
    setGenerating(false);
  };

  const refine = async () => {
    if (!refineInstruction.trim()) return;
    setRefining(true);
    const res = await base44.functions.invoke('proposalEngine', {
      action: 'refine',
      current_proposal: editedBody,
      refinement_instruction: refineInstruction
    });
    if (res?.data?.refined?.proposal_body) {
      setEditedBody(res.data.refined.proposal_body);
    }
    setRefineInstruction('');
    setRefining(false);
  };

  const submit = async () => {
    setSubmitting(true);
    await base44.functions.invoke('proposalEngine', {
      action: 'submit',
      opportunity_id: opportunity.id,
      proposal_body: editedBody,
      subject_line: proposal?.proposal?.subject_line,
      platform: opportunity.source,
      bid_amount: proposal?.proposal?.estimated_bid,
      identity_id: identity?.id
    });
    qc.invalidateQueries({ queryKey: ['aiWorkLogs'] });
    qc.invalidateQueries({ queryKey: ['opportunities'] });
    setSubmitting(false);
    onClose?.();
  };

  const copy = () => {
    navigator.clipboard.writeText(editedBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              AI Proposal Generator
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-md">{opportunity.title}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1 text-lg leading-none">✕</button>
        </div>

        {/* Identity + Opportunity context strip */}
        <div className="flex gap-3 px-5 py-3 bg-slate-950/40 border-b border-slate-800/50 flex-wrap">
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-[11px] text-slate-400">Identity:</span>
            <span className="text-[11px] font-semibold text-white">{identity?.name || 'No identity set'}</span>
            {identity?.communication_tone && (
              <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded capitalize">{identity.communication_tone}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] text-slate-400">Platform:</span>
            <span className="text-[11px] font-semibold text-white capitalize">{opportunity.source || 'Unknown'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] text-slate-400">Budget:</span>
            <span className="text-[11px] font-semibold text-emerald-400">${opportunity.profit_estimate_low || 0}–${opportunity.profit_estimate_high || 0}</span>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Generate button */}
          {!proposal && (
            <Button onClick={generate} disabled={generating}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white h-10 gap-2">
              {generating
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing identity, opportunity & past wins...</>
                : <><Sparkles className="w-4 h-4" /> Generate AI Proposal</>
              }
            </Button>
          )}

          {/* Proposal result */}
          {proposal && (
            <div className="space-y-4">
              {/* Meta row */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <ScoreBadge score={proposal.proposal.confidence_score || 75} />
                  <span className="text-xs text-slate-500">Bid: <span className="text-white font-semibold">${proposal.proposal.estimated_bid || '—'}</span></span>
                  <span className="text-xs text-slate-500">Timeline: <span className="text-white">{proposal.proposal.estimated_timeline || '—'}</span></span>
                </div>
                <Button onClick={generate} variant="outline" size="sm"
                  className="border-slate-700 text-slate-400 text-xs h-7 gap-1">
                  <RefreshCw className="w-3 h-3" /> Regenerate
                </Button>
              </div>

              {/* Subject */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Subject Line</label>
                <div className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white">{proposal.proposal.subject_line}</div>
              </div>

              {/* Editable proposal body */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider">Proposal Body</label>
                  <button onClick={copy} className="text-[10px] flex items-center gap-1 text-slate-500 hover:text-white transition-colors">
                    {copied ? <><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
                <textarea
                  value={editedBody}
                  onChange={e => setEditedBody(e.target.value)}
                  rows={10}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white leading-relaxed focus:outline-none focus:border-violet-500/50 resize-none"
                />
              </div>

              {/* Key selling points */}
              {proposal.proposal.key_selling_points?.length > 0 && (
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">Key Selling Points</label>
                  <div className="flex flex-wrap gap-1.5">
                    {proposal.proposal.key_selling_points.map((p, i) => (
                      <span key={i} className="text-[11px] bg-violet-500/10 border border-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full">{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Platform tips toggle */}
              {proposal.proposal.platform_tips?.length > 0 && (
                <div>
                  <button onClick={() => setShowTips(v => !v)} className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-white transition-colors">
                    {showTips ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    Platform tips ({proposal.proposal.platform_tips.length})
                  </button>
                  {showTips && (
                    <ul className="mt-1.5 space-y-0.5">
                      {proposal.proposal.platform_tips.map((t, i) => (
                        <li key={i} className="text-[11px] text-slate-400 flex items-start gap-1.5"><span className="text-amber-500 mt-0.5">·</span>{t}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Strategy notes */}
              {proposal.proposal.strategy_notes && (
                <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Strategy Notes</p>
                  <p className="text-xs text-slate-400">{proposal.proposal.strategy_notes}</p>
                </div>
              )}

              {/* Refine input */}
              <div className="flex gap-2">
                <input
                  value={refineInstruction}
                  onChange={e => setRefineInstruction(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && refine()}
                  placeholder="e.g. Make it shorter, add a portfolio link, more aggressive pricing..."
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
                />
                <Button onClick={refine} disabled={refining} variant="outline" size="sm"
                  className="border-slate-700 text-slate-400 hover:text-white text-xs h-9 shrink-0 gap-1">
                  {refining ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Refine
                </Button>
              </div>

              {/* Submit */}
              <Button onClick={submit} disabled={submitting}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white h-10 gap-2">
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                  : <><Send className="w-4 h-4" /> Submit Proposal & Mark Executing</>
                }
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}