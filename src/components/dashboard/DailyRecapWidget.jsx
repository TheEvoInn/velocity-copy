/**
 * VELO AI — Daily Recap Widget
 * Shows on the Dashboard: overnight agent activity, revenue, blockers
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Sun, ChevronRight, ChevronDown, RefreshCw, Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const AGENT_ORDER = ['APEX', 'SCOUT', 'CIPHER', 'MERCH'];

const STATUS_DOT = {
  active:  { bg: '#10b981', shadow: '0 0 8px #10b981' },
  warning: { bg: '#f59e0b', shadow: '0 0 8px #f59e0b' },
  idle:    { bg: '#334155', shadow: 'none' },
};

export default function DailyRecapWidget() {
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dailyRecap'],
    queryFn: () => base44.functions.invoke('dailyRecapEngine', { action: 'generate_recap' }).then(r => r.data?.recap),
    staleTime: 5 * 60 * 1000,
  });

  const sendMutation = useMutation({
    mutationFn: () => base44.functions.invoke('dailyRecapEngine', { action: 'send_recap' }),
    onSuccess: () => toast.success('Daily recap sent to your email!'),
    onError: (e) => toast.error('Failed to send recap: ' + e.message),
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl p-4 flex items-center gap-3"
        style={{ background: 'rgba(10,15,42,0.65)', border: '1px solid rgba(249,214,92,0.15)', backdropFilter: 'blur(20px)' }}>
        <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
        <span className="text-xs text-slate-500 font-mono">Loading daily recap…</span>
      </div>
    );
  }

  if (!data || data.total_events === 0) return null;

  const recap = data;
  const agents = recap.agents || {};

  return (
    <div className="rounded-2xl overflow-hidden mb-6"
      style={{ background: 'rgba(10,15,42,0.7)', border: '1px solid rgba(249,214,92,0.25)', backdropFilter: 'blur(20px)' }}>

      {/* Top bar highlight */}
      <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(249,214,92,0.6), transparent)' }} />

      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <Sun className="w-4 h-4 text-amber-400" />
          <div className="text-left">
            <span className="font-orbitron text-xs tracking-widest text-amber-400">DAILY RECAP</span>
            <span className="text-xs text-slate-500 ml-3 font-mono">
              ${recap.total_revenue?.toFixed(2)} earned · {recap.target_pct}% of ${recap.daily_target?.toFixed(0)} target
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {AGENT_ORDER.map(key => {
            const a = agents[key];
            const dot = STATUS_DOT[a?.status || 'idle'];
            return (
              <div key={key} className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg"
                style={{ background: `${a?.color || '#334155'}12`, border: `1px solid ${a?.color || '#334155'}25` }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot.bg, boxShadow: dot.shadow }} />
                <span className="text-[10px] font-mono" style={{ color: a?.color || '#64748b' }}>{key}</span>
              </div>
            );
          })}
          {expanded
            ? <ChevronDown className="w-4 h-4 text-amber-400/60" />
            : <ChevronRight className="w-4 h-4 text-amber-400/60" />}
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="px-5 pb-5">
          <div className="border-t border-amber-400/10 pt-4 space-y-3">

            {/* Agent cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AGENT_ORDER.map(key => {
                const agent = agents[key];
                if (!agent) return null;
                const dot = STATUS_DOT[agent.status || 'idle'];
                return (
                  <Link key={key} to={agent.hub_url}>
                    <div className="rounded-xl p-3.5 cursor-pointer transition-all hover:scale-[1.01]"
                      style={{ background: `${agent.color}08`, border: `1px solid ${agent.color}25` }}>

                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: dot.bg, boxShadow: dot.shadow }} />
                          <span className="font-orbitron text-xs font-bold" style={{ color: agent.color }}>{key}</span>
                          <span className="text-[10px] text-slate-600">{agent.label}</span>
                        </div>
                        {agent.earnings > 0 && (
                          <span className="text-xs font-mono text-emerald-400">+${agent.earnings.toFixed(2)}</span>
                        )}
                      </div>

                      {agent.highlights.length > 0 ? (
                        <ul className="space-y-1">
                          {agent.highlights.map((h, i) => (
                            <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                              <span className="mt-0.5 shrink-0" style={{ color: agent.color }}>›</span>
                              {h}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-600 italic">No significant activity in the last 24h</p>
                      )}

                      {agent.blockers > 0 && (
                        <div className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-lg"
                          style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)' }}>
                          <span className="text-[10px] text-orange-400">⚠ {agent.blockers} blocker{agent.blockers > 1 ? 's' : ''} need attention</span>
                        </div>
                      )}

                      <div className="mt-2 flex items-center gap-1 text-[10px]" style={{ color: `${agent.color}80` }}>
                        View {agent.label} <ChevronRight className="w-2.5 h-2.5" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] text-slate-600 font-mono">
                Recap window: last 24h · {new Date(recap.generated_at).toLocaleTimeString()}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => refetch()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all hover:bg-white/5"
                  style={{ border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}>
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
                <button
                  onClick={() => sendMutation.mutate()}
                  disabled={sendMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
                  style={{ background: 'rgba(249,214,92,0.1)', border: '1px solid rgba(249,214,92,0.3)', color: '#f9d65c' }}>
                  {sendMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                  Email Recap
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}