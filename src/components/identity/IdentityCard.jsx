import React from 'react';
import { User, Star, Zap, CheckCircle2, Clock, TrendingUp, ExternalLink, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TONE_COLORS = {
  professional: 'text-blue-400 bg-blue-500/10',
  friendly: 'text-emerald-400 bg-emerald-500/10',
  authoritative: 'text-violet-400 bg-violet-500/10',
  casual: 'text-amber-400 bg-amber-500/10',
  technical: 'text-cyan-400 bg-cyan-500/10',
  persuasive: 'text-rose-400 bg-rose-500/10',
  empathetic: 'text-pink-400 bg-pink-500/10',
};

const DEFAULT_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

function fmt(n) { return (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function IdentityCard({ identity, onEdit, onSwitch, onDelete, isSwitching }) {
  const color = identity.color || DEFAULT_COLORS[0];
  const toneClass = TONE_COLORS[identity.communication_tone] || TONE_COLORS.professional;
  const isActive = identity.is_active;

  return (
    <div className={`rounded-2xl border p-4 transition-all ${
      isActive
        ? 'bg-slate-900 border-emerald-500/40 shadow-lg shadow-emerald-500/5'
        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${color}33, ${color}11)`, border: `1.5px solid ${color}44` }}>
            {identity.avatar_url ? (
              <img src={identity.avatar_url} alt={identity.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-5 h-5" style={{ color }} />
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white">{identity.name}</span>
              {isActive && (
                <span className="flex items-center gap-0.5 text-[9px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">
                  <Radio className="w-2 h-2" /> ACTIVE
                </span>
              )}
            </div>
            {identity.role_label && (
              <div className="text-[10px] text-slate-500 mt-0.5">{identity.role_label}</div>
            )}
          </div>
        </div>
      </div>

      {/* Identity details */}
      <div className="space-y-1.5 mb-3">
        {identity.email && (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-slate-600 w-12">Email</span>
            <span className="text-slate-300 truncate">{identity.email}</span>
          </div>
        )}
        {identity.tagline && (
          <div className="text-[11px] text-slate-500 italic leading-relaxed line-clamp-2">{identity.tagline}</div>
        )}
      </div>

      {/* Tone + skills */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${toneClass}`}>
          {identity.communication_tone}
        </span>
        {(identity.skills || []).slice(0, 3).map((s, i) => (
          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{s}</span>
        ))}
        {(identity.skills || []).length > 3 && (
          <span className="text-[10px] text-slate-600">+{identity.skills.length - 3}</span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        <div className="text-center bg-slate-800/50 rounded-lg p-2">
          <div className="text-[9px] text-slate-600">Tasks</div>
          <div className="text-xs font-bold text-white">{identity.tasks_executed || 0}</div>
        </div>
        <div className="text-center bg-slate-800/50 rounded-lg p-2">
          <div className="text-[9px] text-slate-600">Earned</div>
          <div className="text-xs font-bold text-emerald-400">${fmt(identity.total_earned)}</div>
        </div>
        <div className="text-center bg-slate-800/50 rounded-lg p-2">
          <div className="text-[9px] text-slate-600">Accounts</div>
          <div className="text-xs font-bold text-blue-400">{(identity.linked_account_ids || []).length}</div>
        </div>
      </div>

      {/* Platforms */}
      {identity.preferred_platforms?.length > 0 && (
        <div className="flex gap-1 mb-3 flex-wrap">
          {identity.preferred_platforms.map((p, i) => (
            <span key={i} className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded capitalize">{p}</span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-1.5 pt-2 border-t border-slate-800">
        {!isActive && (
          <Button onClick={() => onSwitch(identity.id)} disabled={isSwitching} size="sm"
            className="flex-1 text-xs h-7 gap-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30">
            <Zap className="w-3 h-3" /> {isSwitching ? 'Switching...' : 'Activate'}
          </Button>
        )}
        <Button onClick={() => onEdit(identity)} variant="outline" size="sm"
          className="flex-1 text-xs h-7 border-slate-700 text-slate-400 hover:text-white">
          Edit
        </Button>
        {!isActive && (
          <button onClick={() => onDelete(identity.id)}
            className="px-2 py-1 text-[10px] rounded text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
            ✕
          </button>
        )}
      </div>
    </div>
  );
}