import React from 'react';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Clock, DollarSign } from 'lucide-react';

const PLATFORM_COLORS = {
  upwork: 'text-green-400 bg-green-400/10 border-green-500/20',
  fiverr: 'text-emerald-400 bg-emerald-400/10 border-emerald-500/20',
  freelancer: 'text-blue-400 bg-blue-400/10 border-blue-500/20',
  peopleperhour: 'text-orange-400 bg-orange-400/10 border-orange-500/20',
  toptal: 'text-purple-400 bg-purple-400/10 border-purple-500/20',
  guru: 'text-pink-400 bg-pink-400/10 border-pink-500/20',
  other: 'text-slate-400 bg-slate-400/10 border-slate-500/20'
};

const PAYOUT_STATUS_COLORS = {
  available: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  in_transit: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  processing: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  cleared: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
};

function fmt(n) {
  return (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PlatformBreakdown({ byPlatform = {}, byAccount = [] }) {
  const platforms = Object.entries(byPlatform).filter(([, d]) => d.gross > 0);
  if (platforms.length === 0) return null;

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          Platform Breakdown
        </h2>
        <span className="text-xs text-slate-500">{platforms.length} platforms</span>
      </div>

      <div className="divide-y divide-slate-800/50">
        {platforms.map(([platform, data]) => {
          const feeRate = data.gross > 0 ? ((data.fees / data.gross) * 100).toFixed(0) : 0;
          const colorClass = PLATFORM_COLORS[platform] || PLATFORM_COLORS.other;
          return (
            <div key={platform} className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${colorClass}`}>
                    {platform}
                  </span>
                  <span className="text-xs text-slate-500">{data.transactions} transactions</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-white">${fmt(data.net)}</div>
                  <div className="text-[10px] text-slate-500">net</div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Gross</div>
                  <div className="text-xs font-medium text-slate-300">${fmt(data.gross)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Fees ({feeRate}%)</div>
                  <div className="text-xs font-medium text-rose-400">-${fmt(data.fees)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Tax Est.</div>
                  <div className="text-xs font-medium text-amber-400">-${fmt(data.tax)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Pending</div>
                  <div className="text-xs font-medium text-blue-400">${fmt(data.pending)}</div>
                </div>
              </div>
              {/* Fee bar */}
              <div className="mt-3 h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                <div className="h-full bg-emerald-500/60" style={{ width: `${data.gross > 0 ? (data.net / data.gross) * 100 : 0}%` }} />
                <div className="h-full bg-rose-500/60" style={{ width: `${feeRate}%` }} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-slate-600">net retained</span>
                <span className="text-[10px] text-slate-600">{feeRate}% platform fee</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Account-level breakdown */}
      {byAccount.length > 0 && (
        <div className="border-t border-slate-800 px-5 py-4">
          <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-3">By Account</div>
          <div className="space-y-2">
            {byAccount.map(acc => (
              <div key={acc.account_id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${PLATFORM_COLORS[acc.platform] || PLATFORM_COLORS.other}`}>
                    {acc.platform}
                  </span>
                  <span className="text-xs text-slate-400">@{acc.username}</span>
                  {acc.label && <span className="text-[10px] text-slate-600">{acc.label}</span>}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-500">{acc.transactions} jobs</span>
                  <span className="text-rose-400">-${fmt(acc.fees)}</span>
                  <span className="font-bold text-emerald-400">${fmt(acc.net)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}