/**
 * PROACTIVE SCOUT — Forward-Looking Market Gap Discovery
 * Parses external signals to draft Pre-Opportunity strategies for user approval
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Telescope, Zap, CheckCircle, XCircle, RefreshCw, TrendingUp,
  Clock, AlertTriangle, Sparkles, Bot, PlayCircle, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const URGENCY_META = {
  immediate: { label: '24h', color: '#ef4444' },
  hours:     { label: '72h', color: '#f97316' },
  days:      { label: '1 week', color: '#f9d65c' },
  weeks:     { label: 'Ongoing', color: '#10b981' },
  ongoing:   { label: 'Ongoing', color: '#10b981' },
};

function ScoreBar({ label, value, color }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-slate-600">{label}</span>
        <span style={{ color }}>{value}</span>
      </div>
      <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

function PreOppCard({ opp, onApprove, onReject, approving, rejecting }) {
  const [expanded, setExpanded] = useState(false);
  const urgency = URGENCY_META[opp.time_sensitivity] || URGENCY_META.days;

  return (
    <div className="rounded-2xl overflow-hidden transition-all duration-200"
      style={{ background: 'rgba(10,15,42,0.8)', border: '1px solid rgba(0,232,255,0.15)', backdropFilter: 'blur(20px)' }}>

      {/* Top accent */}
      <div className="h-0.5 w-full"
        style={{ background: `linear-gradient(90deg, transparent, ${urgency.color}80, transparent)` }} />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-orbitron px-2 py-0.5 rounded-full"
                style={{ background: `${urgency.color}15`, border: `1px solid ${urgency.color}40`, color: urgency.color }}>
                ⏱ {urgency.label}
              </span>
              <span className="text-[10px] text-slate-600 capitalize">{opp.category} · {opp.platform}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
                🔭 SCOUTED
              </span>
            </div>
            <h3 className="text-sm font-semibold text-white leading-tight">{opp.title}</h3>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-orbitron font-bold text-emerald-400">
              ${opp.profit_estimate_low}–${opp.profit_estimate_high}
            </div>
            <div className="text-[10px] text-slate-600">/day est.</div>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-slate-400 leading-relaxed mb-3">{opp.description}</p>

        {/* Market signal */}
        {opp.notes && (
          <div className="flex items-start gap-2 p-2 rounded-lg mb-3"
            style={{ background: 'rgba(0,232,255,0.05)', border: '1px solid rgba(0,232,255,0.15)' }}>
            <Sparkles className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-cyan-300/80">{opp.notes}</p>
          </div>
        )}

        {/* Scores */}
        <div className="space-y-1.5 mb-4">
          <ScoreBar label="Velocity" value={opp.velocity_score || 50} color="#00e8ff" />
          <ScoreBar label="Risk" value={opp.risk_score || 50} color="#ef4444" />
          <ScoreBar label="Overall Score" value={opp.overall_score || 50} color="#a855f7" />
        </div>

        {/* Execution steps (expandable) */}
        {(opp.execution_steps || []).length > 0 && (
          <button onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition-colors mb-3">
            <Eye className="w-3 h-3" />
            {expanded ? 'Hide' : 'View'} execution steps ({opp.execution_steps.length})
          </button>
        )}
        {expanded && (
          <div className="space-y-1.5 mb-3">
            {(opp.execution_steps || []).map((step, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                <span className="text-[10px] font-orbitron text-slate-600 shrink-0 mt-0.5">{String(i + 1).padStart(2, '0')}</span>
                <span>{step.action}</span>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => onApprove(opp.id)}
            disabled={approving || rejecting}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-orbitron tracking-wide transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.08))', border: '1px solid rgba(16,185,129,0.4)', color: '#10b981' }}>
            {approving ? <><div className="w-3 h-3 border border-emerald-400 border-t-transparent rounded-full animate-spin" /> APPROVING</> : <><PlayCircle className="w-3.5 h-3.5" /> APPROVE & DEPLOY</>}
          </button>
          <button
            onClick={() => onReject(opp.id)}
            disabled={approving || rejecting}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-orbitron tracking-wide transition-all disabled:opacity-50"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>
            <XCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProactiveScout() {
  const qc = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [actionId, setActionId] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['preOpportunities'],
    queryFn: () => base44.functions.invoke('proactiveScoutingEngine', { action: 'get_pre_opportunities' }).then(r => r.data),
    refetchInterval: 60000,
  });

  const preOpps = data?.pre_opportunities || [];

  async function handleScan() {
    setScanning(true);
    try {
      const res = await base44.functions.invoke('proactiveScoutingEngine', { action: 'run_scout' });
      toast.success(`Scout complete: ${res.data?.created || 0} pre-opportunities found!`);
      refetch();
    } catch (e) {
      toast.error(e.message);
    }
    setScanning(false);
  }

  async function handleApprove(oppId) {
    setActionId(oppId + '_approve');
    try {
      await base44.functions.invoke('proactiveScoutingEngine', { action: 'approve_pre_opportunity', opportunity_id: oppId });
      toast.success('Pre-opportunity approved and queued for execution!');
      qc.invalidateQueries({ queryKey: ['preOpportunities'] });
      qc.invalidateQueries({ queryKey: ['aiTasks'] });
    } catch (e) { toast.error(e.message); }
    setActionId(null);
  }

  async function handleReject(oppId) {
    setActionId(oppId + '_reject');
    try {
      await base44.functions.invoke('proactiveScoutingEngine', { action: 'reject_pre_opportunity', opportunity_id: oppId });
      toast.success('Pre-opportunity dismissed.');
      refetch();
    } catch (e) { toast.error(e.message); }
    setActionId(null);
  }

  async function handleApproveAll() {
    for (const opp of preOpps) {
      await handleApprove(opp.id);
    }
  }

  return (
    <div className="min-h-screen galaxy-bg">
      <div className="max-w-7xl mx-auto p-4 md:p-6">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(0,232,255,0.1)', border: '1px solid rgba(0,232,255,0.35)' }}>
              <Telescope className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="font-orbitron text-2xl font-bold text-white tracking-wider">PROACTIVE SCOUT</h1>
              <p className="text-xs text-slate-400">Forward-looking market gap detection · Pre-opportunity drafting · Approve to deploy</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {preOpps.length > 0 && (
              <Button onClick={handleApproveAll}
                className="gap-2 text-xs h-8 font-orbitron"
                style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)', color: '#000', fontWeight: 700 }}>
                <CheckCircle className="w-3.5 h-3.5" />
                Approve All ({preOpps.length})
              </Button>
            )}
            <Button onClick={handleScan} disabled={scanning}
              className="gap-2 text-xs h-8"
              style={{ background: 'rgba(0,232,255,0.12)', border: '1px solid rgba(0,232,255,0.4)', color: '#00e8ff' }}>
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
              {scanning ? 'Scanning…' : 'Run Scout'}
            </Button>
          </div>
        </div>

        {/* How it works banner */}
        <div className="flex items-start gap-4 p-4 rounded-2xl mb-6"
          style={{ background: 'rgba(0,232,255,0.04)', border: '1px solid rgba(0,232,255,0.15)' }}>
          <Bot className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 text-xs text-slate-400">
            {[
              { icon: TrendingUp, title: '1. Signal Detection', desc: 'Scans live market APIs, job boards, and trend data for emerging gaps' },
              { icon: Sparkles, title: '2. Strategy Drafting', desc: 'AI drafts actionable Pre-Opportunity strategies tailored to your profile' },
              { icon: Zap, title: '3. Approve & Deploy', desc: 'One click approves and immediately queues to Autopilot for execution' },
            ].map(step => (
              <div key={step.title} className="flex items-start gap-2">
                <step.icon className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-300 mb-0.5">{step.title}</div>
                  <div>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'PENDING REVIEW', value: preOpps.length, color: '#00e8ff' },
            { label: 'HIGH URGENCY', value: preOpps.filter(o => o.time_sensitivity === 'immediate' || o.time_sensitivity === 'hours').length, color: '#ef4444' },
            { label: 'HIGH VALUE', value: preOpps.filter(o => (o.profit_estimate_high || 0) > 200).length, color: '#10b981' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-4 text-center"
              style={{ background: 'rgba(10,15,42,0.75)', border: `1px solid ${s.color}20` }}>
              <div className="text-[10px] font-orbitron tracking-widest mb-1" style={{ color: `${s.color}70` }}>{s.label}</div>
              <div className="text-2xl font-orbitron font-bold" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Pre-opportunity grid */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : preOpps.length === 0 ? (
          <div className="text-center py-20 rounded-2xl"
            style={{ background: 'rgba(10,15,42,0.5)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <Telescope className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <h3 className="text-slate-400 font-orbitron text-sm mb-2">No Pre-Opportunities Yet</h3>
            <p className="text-slate-600 text-xs mb-6 max-w-sm mx-auto">
              Run the scout to analyze live market signals and generate personalized pre-opportunity strategies for approval.
            </p>
            <Button onClick={handleScan} disabled={scanning}
              className="btn-cosmic gap-2 text-xs">
              <Telescope className="w-3.5 h-3.5" />
              {scanning ? 'Scanning markets…' : 'Start Proactive Scout'}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {preOpps.map(opp => (
              <PreOppCard
                key={opp.id}
                opp={opp}
                onApprove={handleApprove}
                onReject={handleReject}
                approving={actionId === opp.id + '_approve'}
                rejecting={actionId === opp.id + '_reject'}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}