import React from 'react';
import { useActiveIdentity } from '@/hooks/useUserData';
import { User, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';

const TONE_BADGE = {
  professional: 'text-blue-400',
  friendly: 'text-emerald-400',
  authoritative: 'text-violet-400',
  casual: 'text-amber-400',
  technical: 'text-cyan-400',
  persuasive: 'text-rose-400',
  empathetic: 'text-pink-400',
};

export default function ActiveIdentityBanner() {
  const { activeIdentity } = useActiveIdentity();

  if (!activeIdentity) return null;

  const color = activeIdentity.color || '#10b981';
  const toneColor = TONE_BADGE[activeIdentity.communication_tone] || 'text-blue-400';

  return (
    <Link
      to="/VeloIdentityHub"
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition-colors cursor-pointer group"
    >
      <div
        className="w-6 h-6 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center"
        style={{ background: `${color}22`, border: `1px solid ${color}44` }}
      >
        {activeIdentity.avatar_url ? (
          <img src={activeIdentity.avatar_url} className="w-full h-full object-cover" alt="" />
        ) : (
          <User className="w-3 h-3" style={{ color }} />
        )}
      </div>
      <div className="hidden sm:block">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-white">{activeIdentity.name}</span>
          <span className="flex items-center gap-0.5">
            <Radio className="w-2 h-2 text-emerald-400 animate-pulse" />
          </span>
        </div>
        <div className={`text-[9px] ${toneColor}`}>{activeIdentity.communication_tone}</div>
      </div>
    </Link>
  );
}
