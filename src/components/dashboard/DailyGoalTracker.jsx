import React from 'react';
import { Target } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function DailyGoalTracker({ target = 1000, earned = 0 }) {
  const pct = Math.min(100, (earned / target) * 100);
  const remaining = Math.max(0, target - earned);
  
  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Target className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Daily Goal</span>
        </div>
        <span className="text-xs font-bold text-amber-400">{pct.toFixed(0)}%</span>
      </div>
      
      <div className="mb-3">
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div 
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">
          <span className="text-emerald-400 font-semibold">${earned.toLocaleString()}</span> earned
        </span>
        <span className="text-slate-500">
          ${remaining.toLocaleString()} to go
        </span>
      </div>
      
      <div className="mt-3 text-center">
        <span className="text-lg font-bold text-white">${target.toLocaleString()}</span>
        <span className="text-xs text-slate-500 ml-1">/day target</span>
      </div>
    </div>
  );
}