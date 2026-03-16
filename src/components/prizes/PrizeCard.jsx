import React from 'react';
import { Clock, ExternalLink, Zap, Trophy, AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

const TYPE_CONFIG = {
  grant:        { emoji: '🏛️', color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
  raffle:       { emoji: '🎟️', color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20' },
  giveaway:     { emoji: '🎁', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  contest:      { emoji: '🏆', color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  free_item:    { emoji: '📦', color: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20' },
  sweepstakes:  { emoji: '🎰', color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20' },
  beta_reward:  { emoji: '🔬', color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20' },
  promo_credit: { emoji: '💳', color: 'text-indigo-400',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20' },
  loyalty_bonus:{ emoji: '⭐', color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  first_come:   { emoji: '⚡', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  hidden_prize: { emoji: '🔮', color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20' },
  other:        { emoji: '💡', color: 'text-slate-400',   bg: 'bg-slate-500/10',   border: 'border-slate-500/20' },
};

const STATUS_CONFIG = {
  discovered:           { label: 'Discovered',     color: 'text-slate-400',   dot: 'bg-slate-400' },
  evaluating:           { label: 'Evaluating',     color: 'text-amber-400',   dot: 'bg-amber-400' },
  applying:             { label: 'Applying...',    color: 'text-blue-400',    dot: 'bg-blue-400 animate-pulse' },
  applied:              { label: 'Applied',        color: 'text-blue-400',    dot: 'bg-blue-400' },
  pending_verification: { label: 'Pending',        color: 'text-amber-400',   dot: 'bg-amber-400 animate-pulse' },
  confirmed:            { label: 'Confirmed',      color: 'text-emerald-400', dot: 'bg-emerald-400' },
  won:                  { label: '🏆 WON!',         color: 'text-emerald-400', dot: 'bg-emerald-400' },
  claimed:              { label: 'Claimed ✓',      color: 'text-emerald-400', dot: 'bg-emerald-400' },
  lost:                 { label: 'Not selected',   color: 'text-slate-500',   dot: 'bg-slate-500' },
  expired:              { label: 'Expired',        color: 'text-slate-600',   dot: 'bg-slate-600' },
  dismissed:            { label: 'Dismissed',      color: 'text-slate-600',   dot: 'bg-slate-600' },
};

function ScoreBar({ label, value, color }) {
  return (
    <div>
      <div className="flex justify-between text-[9px] mb-0.5">
        <span className="text-slate-600">{label}</span>
        <span className={color}>{value}</span>
      </div>
      <div className="h-1 rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${color.replace('text-', 'bg-')}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default function PrizeCard({ opp, onApply, onClaim, onDismiss, onMarkWon, applying }) {
  const tc = TYPE_CONFIG[opp.type] || TYPE_CONFIG.other;
  const sc = STATUS_CONFIG[opp.status] || STATUS_CONFIG.discovered;
  const isActionable = ['discovered', 'evaluating'].includes(opp.status);
  const isWon = opp.status === 'won';
  const isClaimed = opp.status === 'claimed';
  const isApplied = ['applied', 'pending_verification', 'confirmed'].includes(opp.status);

  return (
    <div className={`rounded-2xl border p-4 transition-all ${
      isWon ? 'bg-emerald-950/20 border-emerald-500/30 shadow-lg shadow-emerald-500/5' :
      opp.requires_user_action ? 'bg-amber-950/10 border-amber-500/20' :
      'bg-slate-900/60 border-slate-800 hover:border-slate-700'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-start gap-2 min-w-0">
          <span className="text-lg shrink-0 mt-0.5">{tc.emoji}</span>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white leading-tight line-clamp-2">{opp.title}</div>
            {opp.source_name && <div className="text-[10px] text-slate-500 mt-0.5">{opp.source_name}</div>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
          <span className={`text-[10px] font-medium ${sc.color}`}>{sc.label}</span>
        </div>
      </div>

      {/* Value badge */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className={`text-sm font-bold ${opp.estimated_value > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
          {opp.estimated_value > 0 ? `$${opp.estimated_value.toLocaleString()}` : 'Value TBD'}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${tc.bg} ${tc.border} ${tc.color}`}>
          {opp.type?.replace('_', ' ')}
        </span>
        {opp.application_complexity && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border text-slate-500 bg-slate-800 border-slate-700`}>
            {opp.application_complexity}
          </span>
        )}
      </div>

      {opp.description && (
        <p className="text-[11px] text-slate-500 mb-3 line-clamp-2 leading-relaxed">{opp.description}</p>
      )}

      {/* Scores */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <ScoreBar label="Legit" value={opp.legitimacy_score || 0} color="text-emerald-400" />
        <ScoreBar label="Difficulty" value={opp.difficulty_score || 0} color="text-amber-400" />
        <ScoreBar label="Risk" value={opp.risk_score || 0} color="text-rose-400" />
      </div>

      {/* Identity used */}
      {opp.identity_name && (
        <div className="text-[10px] text-slate-500 mb-2">
          Identity: <span className="text-slate-300">{opp.identity_name}</span>
          {opp.email_used && <span className="ml-2 text-slate-600">· {opp.email_used}</span>}
        </div>
      )}

      {/* Deadline */}
      {opp.deadline && (
        <div className="flex items-center gap-1 text-[10px] text-amber-500 mb-2">
          <Clock className="w-3 h-3" />
          Deadline: {format(new Date(opp.deadline), 'MMM d, yyyy')}
        </div>
      )}

      {/* User action required */}
      {opp.requires_user_action && opp.user_action_description && (
        <div className="rounded-lg bg-amber-950/20 border border-amber-500/20 px-3 py-2 mb-3">
          <p className="text-[10px] text-amber-400 font-semibold mb-0.5">⚠️ Action Required</p>
          <p className="text-[10px] text-amber-300">{opp.user_action_description}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-1.5 mt-auto">
        {isActionable && (
          <Button onClick={() => onApply(opp)} disabled={applying} size="sm"
            className="flex-1 bg-violet-600 hover:bg-violet-500 text-white text-xs h-7 gap-1">
            {applying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            {applying ? 'Applying...' : 'Auto-Apply'}
          </Button>
        )}
        {isWon && (
          <Button onClick={() => onClaim(opp)} size="sm"
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-7 gap-1">
            <Trophy className="w-3 h-3" /> Claim Prize
          </Button>
        )}
        {isApplied && (
          <Button onClick={() => onMarkWon(opp)} variant="outline" size="sm"
            className="flex-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-xs h-7 gap-1">
            <CheckCircle2 className="w-3 h-3" /> Mark Won
          </Button>
        )}
        {opp.source_url && (
          <a href={opp.source_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center px-2 h-7 rounded-lg border border-slate-700 text-slate-500 hover:text-white text-xs transition-colors">
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
        {isActionable && (
          <button onClick={() => onDismiss(opp.id)}
            className="flex items-center px-2 h-7 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors text-xs">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}