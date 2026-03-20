import React from 'react';
import { Activity, Zap, Target, TrendingUp, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

const HEALTH_CONFIG = {
  healthy: { color: '#10b981', label: 'NOMINAL', glow: 'rgba(16,185,129,0.5)' },
  warning: { color: '#f59e0b', label: 'WARNING', glow: 'rgba(245,158,11,0.5)' },
  critical: { color: '#ef4444', label: 'CRITICAL', glow: 'rgba(239,68,68,0.5)' },
};

function HUDMetric({ label, value, color = '#06b6d4', icon: Icon, sub }) {
  return (
    <div className="relative rounded-xl p-3 overflow-hidden"
      style={{ background: `${color}08`, border: `1px solid ${color}25` }}>
      <div className="absolute inset-0 opacity-5"
        style={{ backgroundImage: `repeating-linear-gradient(0deg, ${color} 0px, ${color} 1px, transparent 1px, transparent 20px)` }} />
      <div className="relative">
        <div className="flex items-center gap-1.5 mb-1">
          {Icon && <Icon className="w-3 h-3" style={{ color }} />}
          <span className="text-[9px] uppercase tracking-widest font-orbitron" style={{ color: color + 'aa' }}>{label}</span>
        </div>
        <div className="font-orbitron text-xl font-bold" style={{ color, textShadow: `0 0 20px ${color}` }}>
          {value}
        </div>
        {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export default function MissionControlHUD({ platformState, aiEarnedToday, userEarnedToday, totalAITasks, goals }) {
  const health = HEALTH_CONFIG[platformState?.system_health || 'healthy'];
  const isActive = platformState?.autopilot_enabled;
  const queueCount = platformState?.current_queue_count || 0;
  const cyclesCount = platformState?.cycle_count_today || 0;
  const revenue = platformState?.revenue_generated_today || 0;
  const aiTarget = goals?.ai_daily_target || 500;
  const progressPct = Math.min(100, (aiEarnedToday / aiTarget) * 100);

  return (
    <div className="glass-card rounded-2xl p-5 relative overflow-hidden">
      {/* Scanline effect */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,1) 2px, rgba(255,255,255,1) 4px)' }} />

      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: isActive ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)',
                border: `1px solid ${isActive ? '#10b98150' : '#64748b30'}`,
                boxShadow: isActive ? '0 0 16px rgba(16,185,129,0.3)' : 'none',
              }}>
              <Activity className="w-5 h-5" style={{ color: isActive ? '#10b981' : '#64748b' }} />
            </div>
            {isActive && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-950"
                style={{ animation: 'pulse-glow 1.5s ease-in-out infinite', boxShadow: '0 0 6px #10b981' }} />
            )}
          </div>
          <div>
            <h2 className="font-orbitron text-sm font-bold tracking-widest text-white">MISSION CONTROL HUD</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: health.color, boxShadow: `0 0 6px ${health.glow}` }} />
              <span className="text-[10px] font-orbitron tracking-widest" style={{ color: health.color }}>
                SYSTEM {health.label}
              </span>
            </div>
          </div>
        </div>

        {/* Live clock / cycle info */}
        <div className="text-right">
          <div className="font-orbitron text-xs text-slate-500 tracking-wider">
            {platformState?.last_cycle_timestamp
              ? `LAST CYCLE ${new Date(platformState.last_cycle_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'AWAITING CYCLE'}
          </div>
          {isActive && (
            <div className="flex items-center gap-1 justify-end mt-0.5">
              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400 font-orbitron">AUTONOMOUS</span>
            </div>
          )}
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <HUDMetric label="AI Earned Today" value={`$${aiEarnedToday.toFixed(0)}`} color="#10b981" icon={TrendingUp} sub={`Target: $${aiTarget}`} />
        <HUDMetric label="Queue Depth" value={queueCount} color="#3b82f6" icon={Clock} sub={`${cyclesCount} cycles today`} />
        <HUDMetric label="Tasks Complete" value={totalAITasks} color="#a855f7" icon={CheckCircle2} sub="all time" />
        <HUDMetric label="Revenue Today" value={`$${revenue.toFixed(0)}`} color="#f59e0b" icon={Zap} sub={`User: $${userEarnedToday.toFixed(0)}`} />
      </div>

      {/* AI Daily Progress Bar */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[10px] font-orbitron tracking-widest text-slate-500">AI DAILY PROGRESS</span>
          <span className="text-[10px] font-orbitron text-emerald-400">{progressPct.toFixed(0)}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${progressPct}%`,
              background: 'linear-gradient(90deg, #10b981, #06b6d4)',
              boxShadow: '0 0 12px rgba(16,185,129,0.6)',
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-slate-600">${aiEarnedToday.toFixed(2)}</span>
          <span className="text-[10px] text-slate-600">${aiTarget}</span>
        </div>
      </div>

      {/* Error alert */}
      {platformState?.last_error && (
        <div className="mt-3 flex items-start gap-2 p-2.5 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-red-300">{platformState.last_error}</p>
        </div>
      )}
    </div>
  );
}