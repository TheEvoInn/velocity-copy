import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { X, Zap, Bot, CheckCircle2, Copy, ExternalLink, Loader2, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function QuickApplyModal({ opportunity, onClose }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState(null); // null | 'quick_apply' | 'autopilot'
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleAction = async (selectedMode) => {
    setMode(selectedMode);
    setLoading(true);
    try {
      const res = await base44.functions.invoke('autopilotApply', {
        opportunityId: opportunity.id,
        mode: selectedMode,
      });
      setResult(res.data);
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['userGoals'] });
      queryClient.invalidateQueries({ queryKey: ['aiTasks'] });
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  const copyProposal = () => {
    navigator.clipboard.writeText(result?.application_text || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const platformUrl = opportunity.source?.startsWith('http') ? opportunity.source : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Opportunity</p>
            <h2 className="text-sm font-bold text-white leading-tight line-clamp-1">{opportunity.title}</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white shrink-0 ml-3">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          {/* Earnings badge */}
          <div className="flex items-center gap-2 mb-6">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs text-slate-400">Estimated:</span>
            <span className="text-sm font-bold text-emerald-400">
              ${opportunity.profit_estimate_low}–${opportunity.profit_estimate_high}
            </span>
            {opportunity.source && (
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                {opportunity.source.startsWith('http') ? new URL(opportunity.source).hostname.replace('www.', '') : opportunity.source}
              </span>
            )}
          </div>

          {!mode && !loading && !result ? (
            /* Action Selection */
            <div className="space-y-3">
              <p className="text-xs text-slate-400 mb-4">How do you want to handle this opportunity?</p>

              {/* Quick Apply */}
              <button
                onClick={() => handleAction('quick_apply')}
                className="w-full rounded-xl bg-emerald-500/10 border border-emerald-500/30 hover:border-emerald-400/60 p-4 text-left transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-400">Quick Apply</p>
                    <p className="text-[10px] text-slate-500">AI writes a tailored proposal for you to submit</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400 ml-11">You get a polished, personalized application ready to copy & paste. You control the submit.</p>
              </button>

              {/* Pass to Autopilot */}
              <button
                onClick={() => handleAction('autopilot')}
                className="w-full rounded-xl bg-violet-500/10 border border-violet-500/30 hover:border-violet-400/60 p-4 text-left transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-violet-400">Pass to Autopilot</p>
                    <p className="text-[10px] text-slate-500">AI handles everything — apply, complete, collect payment</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400 ml-11">AI signs up if needed, submits application, completes the work, and deposits earnings directly to your wallet.</p>
              </button>

              {platformUrl && (
                <a href={platformUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-xs transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Original Posting
                </a>
              )}
            </div>
          ) : loading ? (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                {mode === 'autopilot'
                  ? <Bot className="w-6 h-6 text-violet-400 animate-pulse" />
                  : <Zap className="w-6 h-6 text-emerald-400 animate-pulse" />
                }
              </div>
              <p className="text-sm font-semibold text-white mb-1">
                {mode === 'autopilot' ? 'Autopilot Executing...' : 'Generating Proposal...'}
              </p>
              <p className="text-xs text-slate-500">
                {mode === 'autopilot'
                  ? 'AI is applying, completing the task, and collecting payment'
                  : 'AI is crafting a personalized application for you'
                }
              </p>
              <Loader2 className="w-5 h-5 text-slate-600 animate-spin mx-auto mt-4" />
            </div>
          ) : result?.error ? (
            <div className="text-center py-8">
              <p className="text-rose-400 text-sm">{result.error}</p>
              <Button onClick={() => { setMode(null); setResult(null); }} variant="outline" size="sm" className="mt-4 border-slate-700 text-slate-400">
                Try Again
              </Button>
            </div>
          ) : result && mode === 'autopilot' ? (
            /* Autopilot success */
            <div>
              <div className="flex items-center gap-3 mb-5 p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-white">Task Completed by Autopilot</p>
                  <p className="text-xs text-emerald-400 font-semibold mt-0.5">
                    +${(result.revenue_generated || 0).toFixed(2)} deposited to wallet
                  </p>
                </div>
              </div>

              {result.deliverable_summary && (
                <div className="mb-4 p-3 rounded-lg bg-slate-800 border border-slate-700">
                  <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">Deliverable</p>
                  <p className="text-xs text-slate-300">{result.deliverable_summary}</p>
                </div>
              )}

              {/* Execution log */}
              {result.execution_log?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Execution Log</p>
                  {result.execution_log.map((log, i) => (
                    <div key={i} className="flex gap-2 text-xs">
                      <span className="text-emerald-500 font-mono shrink-0">{String(i + 1).padStart(2, '0')}</span>
                      <div>
                        <p className="text-slate-300">{log.action}</p>
                        <p className="text-slate-500">{log.result}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button onClick={onClose} className="w-full mt-5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm">
                Done
              </Button>
            </div>
          ) : result && mode === 'quick_apply' ? (
            /* Quick apply proposal */
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-white">Your Proposal</p>
                <button onClick={copyProposal} className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white transition-colors">
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="rounded-xl bg-slate-800 border border-slate-700 p-4 mb-4 max-h-64 overflow-y-auto">
                <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{result.application_text}</p>
              </div>

              {platformUrl && (
                <a href={platformUrl} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm mb-3">
                    <ExternalLink className="w-3.5 h-3.5 mr-1" />
                    Open Job Posting to Submit
                  </Button>
                </a>
              )}

              <p className="text-[10px] text-slate-600 text-center">Copy the proposal and paste it into the job posting platform</p>

              <button
                onClick={() => handleAction('autopilot')}
                className="w-full mt-3 py-2 rounded-lg border border-violet-500/30 text-violet-400 hover:border-violet-400/60 text-xs transition-colors"
              >
                <Bot className="w-3 h-3 inline mr-1" />
                Actually, let Autopilot handle it instead
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}