import React from 'react';
import { Target, Wallet, DollarSign } from 'lucide-react';

export default function DailyGoalTracker({ target = 1000, earned = 0, totalEarned = 0, walletBalance = 0 }) {
  const pct = Math.min(100, (earned / Math.max(target, 1)) * 100);
  const remaining = Math.max(0, target - earned);

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-4">
      {/* Daily Goal */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Target className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Daily Goal</span>
          </div>
          <span className="text-xs font-bold text-amber-400">{pct.toFixed(0)}%</span>
        </div>
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">
            <span className="text-emerald-400 font-semibold">${earned.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> earned
          </span>
          <span className="text-slate-500">${remaining.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} to go</span>
        </div>
        <div className="mt-2 text-center">
          <span className="text-lg font-bold text-white">${target.toLocaleString()}</span>
          <span className="text-xs text-slate-500 ml-1">/day target</span>
        </div>
      </div>

      {/* Wallet Balance */}
      <div className="border-t border-slate-800 pt-3 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-emerald-950/30 border border-emerald-900/30 p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Wallet className="w-3 h-3 text-emerald-400" />
            <span className="text-[10px] text-slate-500">Wallet</span>
          </div>
          <div className="text-base font-bold text-emerald-400">
            ${walletBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="rounded-lg bg-blue-950/30 border border-blue-900/30 p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="w-3 h-3 text-blue-400" />
            <span className="text-[10px] text-slate-500">All Time</span>
          </div>
          <div className="text-base font-bold text-blue-400">
            ${totalEarned.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </div>
  );
}