import React from 'react';
import { User, Bot, TrendingUp } from 'lucide-react';

export default function DualStreamCard({
  aiEarned = 0,
  userEarned = 0,
  aiTarget = 500,
  userTarget = 500,
  aiTotalEarned = 0,
  userTotalEarned = 0,
}) {
  const aiPct = Math.min(100, (aiEarned / Math.max(aiTarget, 1)) * 100);
  const userPct = Math.min(100, (userEarned / Math.max(userTarget, 1)) * 100);
  const totalEarned = aiEarned + userEarned;
  const totalTarget = aiTarget + userTarget;
  const totalPct = Math.min(100, (totalEarned / Math.max(totalTarget, 1)) * 100);

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-white uppercase tracking-wider">Revenue Streams — Today</span>
        </div>
        <span className="text-xs text-slate-500">
          All time: <span className="text-white font-semibold">${(aiTotalEarned + userTotalEarned).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </span>
      </div>

      {/* Total Bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5 text-xs">
          <span className="text-slate-400">Combined Progress Today</span>
          <span className="font-bold text-white">{totalPct.toFixed(0)}%</span>
        </div>
        <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-emerald-500 to-emerald-400 transition-all duration-700"
            style={{ width: `${totalPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-600 mt-1">
          <span>${totalEarned.toFixed(2)} earned today</span>
          <span>${totalTarget.toLocaleString()} daily target</span>
        </div>
      </div>

      {/* Two Streams */}
      <div className="grid grid-cols-2 gap-3">
        {/* AI Stream */}
        <div className="rounded-xl bg-emerald-950/20 border border-emerald-800/20 p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] text-emerald-400 font-medium">AI Stream</span>
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-400 mb-1">
            ${aiEarned.toFixed(2)}
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-1.5">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-700"
              style={{ width: `${aiPct}%` }}
            />
          </div>
          <div className="text-[10px] text-slate-600">of ${aiTarget} target</div>
          {aiTotalEarned > 0 && (
            <div className="text-[10px] text-emerald-600 mt-1">Total: ${aiTotalEarned.toFixed(2)}</div>
          )}
        </div>

        {/* User Stream */}
        <div className="rounded-xl bg-blue-950/20 border border-blue-800/20 p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[10px] text-blue-400 font-medium">Your Stream</span>
            </div>
          </div>
          <div className="text-xl font-bold text-blue-400 mb-1">
            ${userEarned.toFixed(2)}
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-1.5">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-700"
              style={{ width: `${userPct}%` }}
            />
          </div>
          <div className="text-[10px] text-slate-600">of ${userTarget} target</div>
          {userTotalEarned > 0 && (
            <div className="text-[10px] text-blue-600 mt-1">Total: ${userTotalEarned.toFixed(2)}</div>
          )}
        </div>
      </div>
    </div>
  );
}