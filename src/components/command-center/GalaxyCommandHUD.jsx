import React, { useState, useEffect } from 'react';
import { Activity, Zap, TrendingUp, AlertTriangle, Clock, CheckCircle2, Target } from 'lucide-react';

export default function GalaxyCommandHUD({ todayEarned, walletBalance, activeTasks, activeOpps, failedTasks, reviewTasks }) {
  const [animateValues, setAnimateValues] = useState(false);

  useEffect(() => {
    setAnimateValues(true);
  }, [todayEarned, activeTasks]);

  return (
    <div className="relative">
      {/* Main HUD Display */}
      <div className="glass-card-bright rounded-2xl p-6 border border-cyan-500/30 relative overflow-hidden">
        {/* Animated grid background */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'radial-gradient(circle, #06b6d4 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

        {/* HUD Header */}
        <div className="relative z-10 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
              <h2 className="font-orbitron text-lg font-bold text-cyan-300 tracking-widest">MISSION CONTROL HUD</h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">LIVE TELEMETRY</span>
          </div>
        </div>

        {/* Main Metrics Grid */}
        <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Earnings */}
          <div className="p-3 rounded-lg" style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            boxShadow: animateValues ? '0 0 20px rgba(16, 185, 129, 0.3)' : 'none',
          }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-mono">TODAY EARNINGS</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="font-orbitron text-2xl font-bold text-emerald-400">${todayEarned.toFixed(0)}</p>
            <p className="text-xs text-slate-500 mt-1">Real-time accumulation</p>
          </div>

          {/* Wallet */}
          <div className="p-3 rounded-lg" style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
          }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-mono">WALLET BALANCE</span>
              <Target className="w-4 h-4 text-blue-400" />
            </div>
            <p className="font-orbitron text-2xl font-bold text-blue-400">${walletBalance.toFixed(0)}</p>
            <p className="text-xs text-slate-500 mt-1">Available capital</p>
          </div>

          {/* Active Tasks */}
          <div className="p-3 rounded-lg" style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
          }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-mono">EXECUTION</span>
              <Activity className="w-4 h-4 text-amber-400" />
            </div>
            <p className="font-orbitron text-2xl font-bold text-amber-400">{activeTasks.length}</p>
            <p className="text-xs text-slate-500 mt-1">tasks running</p>
          </div>

          {/* Active Opps */}
          <div className="p-3 rounded-lg" style={{
            background: 'rgba(168, 85, 247, 0.1)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
          }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-mono">DISCOVERY</span>
              <Zap className="w-4 h-4 text-purple-400" />
            </div>
            <p className="font-orbitron text-2xl font-bold text-purple-400">{activeOpps.length}</p>
            <p className="text-xs text-slate-500 mt-1">opportunities</p>
          </div>
        </div>

        {/* Alert Status Bar */}
        {(failedTasks > 0 || reviewTasks > 0) && (
          <div className="relative z-10 mt-4 pt-4 border-t border-slate-700/50">
            <div className="flex flex-wrap gap-2">
              {failedTasks > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-red-300" style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                }}>
                  <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
                  {failedTasks} FAILED TASK{failedTasks > 1 ? 'S' : ''}
                </div>
              )}
              {reviewTasks > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-amber-300" style={{
                  background: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                }}>
                  <Clock className="w-3.5 h-3.5" />
                  {reviewTasks} AWAITING REVIEW
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Decorative corner elements */}
      <div className="absolute -top-2 -right-2 w-8 h-8 border-t-2 border-r-2 border-cyan-500/30 rounded-tr-xl" />
      <div className="absolute -bottom-2 -left-2 w-8 h-8 border-b-2 border-l-2 border-cyan-500/30 rounded-bl-xl" />
    </div>
  );
}