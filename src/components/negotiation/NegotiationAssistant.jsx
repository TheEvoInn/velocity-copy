import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { MessageSquare, Zap, AlertTriangle, TrendingUp, Copy, CheckCircle2, Loader2, ArrowUp, Clock, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PRIORITY_CONFIG = {
  high: { color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', label: '🔴 High Priority' },
  medium: { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', label: '🟡 Medium' },
  low: { color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20', label: '⚪ Low' },
};

const SENTIMENT_ICONS = {
  positive: '😊', neutral: '😐', negative: '😟', urgent: '⚡'
};

const RATE_COLORS = {
  'push higher': 'text-emerald-400',
  'hold current': 'text-blue-400',
  'close now': 'text-violet-400',
  'negotiate': 'text-amber-400',
};

export default function NegotiationAssistant({ thread, onClose }) {
  const [message, setMessage] = useState('');
  const [platform, setPlatform] = useState(thread?.platform || '');
  const [clientName, setClientName] = useState(thread?.client || '');
  const [currentRate, setCurrentRate] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);

  const analyze = async () => {
    if (!message.trim()) return;
    setAnalyzing(true);
    const res = await base44.functions.invoke('negotiationEngine', {
      action: 'analyze_message',
      message_content: message,
      platform,
      client_name: clientName,
      current_rate: currentRate ? parseFloat(currentRate) : null,
      thread_context: thread?.last_message || null
    });
    setAnalysis(res?.data?.analysis);
    setAnalyzing(false);
  };

  const copyResponse = () => {
    navigator.clipboard.writeText(analysis?.suggested_response || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendResponse = async () => {
    if (!analysis?.suggested_response) return;
    setSending(true);
    await base44.functions.invoke('negotiationEngine', {
      action: 'add_message',
      thread_id: thread?.id || clientName,
      content: analysis.suggested_response,
      direction: 'outbound',
      platform,
      client_name: clientName
    });
    setSending(false);
    setAnalysis(null);
    setMessage('');
  };

  const priority = PRIORITY_CONFIG[analysis?.priority] || PRIORITY_CONFIG.low;
  const rateColor = analysis?.rate_recommendation
    ? (Object.entries(RATE_COLORS).find(([k]) => analysis.rate_recommendation.toLowerCase().includes(k))?.[1] || 'text-white')
    : 'text-white';

  return (
    <div className="space-y-4">
      {/* Input form */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-400" />
          Analyze Client Message
        </h3>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Client Name</label>
            <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="John Smith"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none" />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Platform</label>
            <input value={platform} onChange={e => setPlatform(e.target.value)} placeholder="upwork, fiverr..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none" />
          </div>
        </div>

        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Client Message</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
            placeholder="Paste the client's message here..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 resize-none" />
        </div>

        <div className="flex items-center gap-2">
          <input value={currentRate} onChange={e => setCurrentRate(e.target.value)} placeholder="Current rate ($)"
            className="w-32 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none" />
          <Button onClick={analyze} disabled={analyzing || !message.trim()}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs h-8 gap-1.5">
            {analyzing
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...</>
              : <><Zap className="w-3.5 h-3.5" /> Analyze & Get Strategy</>
            }
          </Button>
        </div>
      </div>

      {/* Analysis result */}
      {analysis && (
        <div className="space-y-3">
          {/* Priority + sentiment strip */}
          <div className={`rounded-xl border px-4 py-2.5 flex items-center justify-between flex-wrap gap-2 ${priority.bg}`}>
            <span className={`text-xs font-bold ${priority.color}`}>{priority.label}</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">
                {SENTIMENT_ICONS[analysis.sentiment?.toLowerCase()] || '💬'} {analysis.sentiment}
              </span>
              <span className="text-xs text-slate-400">Intent: <span className="text-white">{analysis.intent}</span></span>
            </div>
          </div>

          {/* Rate recommendation */}
          {analysis.rate_recommendation && (
            <div className="rounded-xl bg-slate-900 border border-slate-800 px-4 py-3 flex items-center gap-3">
              <ArrowUp className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Rate Recommendation</div>
                <div className={`text-sm font-bold capitalize ${rateColor}`}>{analysis.rate_recommendation}</div>
              </div>
              {analysis.follow_up_timing && (
                <>
                  <Clock className="w-4 h-4 text-slate-600 shrink-0 ml-auto" />
                  <div className="text-xs text-slate-500">Follow up: <span className="text-white">{analysis.follow_up_timing}</span></div>
                </>
              )}
            </div>
          )}

          {/* Strategy */}
          {analysis.strategy && (
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Strategy</p>
              <p className="text-sm text-slate-300 leading-relaxed">{analysis.strategy}</p>
            </div>
          )}

          {/* Suggested response */}
          <div className="rounded-xl bg-slate-900 border border-blue-500/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Suggested Response</p>
              <button onClick={copyResponse} className="text-[10px] flex items-center gap-1 text-slate-500 hover:text-white">
                {copied ? <><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
              </button>
            </div>
            <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{analysis.suggested_response}</p>
            <Button onClick={sendResponse} disabled={sending}
              className="mt-3 w-full bg-blue-600 hover:bg-blue-500 text-white text-xs h-8 gap-1.5">
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
              Log as Sent
            </Button>
          </div>

          {/* Upsell opportunities */}
          {analysis.upsell_opportunities?.length > 0 && (
            <div className="rounded-xl bg-emerald-950/20 border border-emerald-500/20 p-4">
              <p className="text-[10px] text-emerald-500 uppercase tracking-wider mb-2">💰 Upsell Opportunities</p>
              {analysis.upsell_opportunities.map((u, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-emerald-300 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {u}
                </div>
              ))}
            </div>
          )}

          {/* Risk flags */}
          {analysis.risk_flags?.length > 0 && (
            <div className="rounded-xl bg-rose-950/20 border border-rose-500/20 p-4">
              <p className="text-[10px] text-rose-500 uppercase tracking-wider mb-2">⚠️ Risk Flags</p>
              {analysis.risk_flags.map((r, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-rose-300 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {r}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}