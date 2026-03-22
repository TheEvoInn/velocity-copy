/**
 * DiscoveryScanStatus — live scan progress panel
 * Shows phased scan progress with platform hops, keyword expansion,
 * category counts, and AI-filter stats in real time.
 */
import React from 'react';
import { RefreshCw, Globe, Cpu, Shield, Target, CheckCircle, Sparkles } from 'lucide-react';

const PHASES = [
  { icon: Sparkles, label: 'Expanding keywords', color: '#f9d65c', detail: '30+ categories · 200+ search terms' },
  { icon: Globe, label: 'Scanning internet', color: '#00e8ff', detail: 'Upwork · Fiverr · Rev · Appen · MTurk · Scale.ai · Outlier.ai + more' },
  { icon: Cpu, label: 'Running AI intelligence', color: '#a855f7', detail: 'LLM-powered live internet discovery' },
  { icon: Shield, label: 'Filtering online-only', color: '#10b981', detail: 'Removing physical, phone-required, and in-person tasks' },
  { icon: Target, label: 'Scoring opportunities', color: '#f97316', detail: 'Pay rate · speed · AI-fit · platform trust' },
  { icon: CheckCircle, label: 'Syncing to your dashboard', color: '#10b981', detail: 'Per-user isolated · Autopilot ready' },
];

export default function DiscoveryScanStatus({ isScanning, progress, currentStep, lastResult, onDismiss }) {
  const phaseIndex = Math.min(Math.floor((progress / 100) * PHASES.length), PHASES.length - 1);

  if (!isScanning && !lastResult) return null;

  return (
    <div className="mb-5 rounded-2xl overflow-hidden"
      style={{ background: 'rgba(10,15,42,0.85)', border: '1px solid rgba(249,214,92,0.2)', backdropFilter: 'blur(20px)' }}>

      {/* Header */}
      <div className="px-5 py-3 flex items-center justify-between border-b" style={{ borderColor: 'rgba(249,214,92,0.1)' }}>
        <div className="flex items-center gap-2">
          {isScanning
            ? <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
            : <CheckCircle className="w-4 h-4 text-emerald-400" />}
          <span className="font-orbitron text-xs tracking-widest" style={{ color: isScanning ? '#f9d65c' : '#10b981' }}>
            {isScanning ? 'DISCOVERY IN PROGRESS' : 'SCAN COMPLETE'}
          </span>
        </div>
        {!isScanning && onDismiss && (
          <button onClick={onDismiss} className="text-slate-600 hover:text-slate-400 text-xs font-orbitron">
            DISMISS ×
          </button>
        )}
      </div>

      {isScanning && (
        <div className="p-5">
          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-mono text-amber-400/70">{currentStep}</span>
              <span className="font-orbitron text-xs text-amber-400">{progress}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #f9d65c, #ff2ec4, #00e8ff)' }} />
            </div>
          </div>

          {/* Phase steps */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {PHASES.map((phase, i) => {
              const Icon = phase.icon;
              const done = i < phaseIndex;
              const active = i === phaseIndex;
              return (
                <div key={i}
                  className="flex items-start gap-2 p-2.5 rounded-xl transition-all duration-300"
                  style={{
                    background: active ? `${phase.color}08` : done ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${active ? `${phase.color}30` : done ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)'}`,
                  }}>
                  <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: done ? '#10b981' : active ? phase.color : '#334155' }} />
                  <div>
                    <div className="text-xs font-orbitron leading-tight" style={{ color: done ? '#10b981' : active ? phase.color : '#334155' }}>
                      {done ? '✓ ' : active ? '▶ ' : ''}{phase.label}
                    </div>
                    {active && <div className="text-[9px] text-slate-600 mt-0.5 leading-tight">{phase.detail}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Results summary */}
      {lastResult && !isScanning && (
        <div className="p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'FOUND', value: lastResult.found || 0, color: '#f9d65c' },
              { label: 'NEW IMPORTED', value: lastResult.created || 0, color: '#10b981' },
              { label: 'AI-COMPATIBLE', value: lastResult.ai_compatible || 0, color: '#a855f7' },
              { label: 'LIVE SCAN', value: lastResult.live_scan_count || 0, color: '#00e8ff', suffix: ' live' },
            ].map(s => (
              <div key={s.label} className="text-center p-3 rounded-xl"
                style={{ background: `${s.color}08`, border: `1px solid ${s.color}20` }}>
                <div className="text-xl font-orbitron font-bold" style={{ color: s.color }}>
                  {s.value}{s.suffix || ''}
                </div>
                <div className="text-[9px] font-orbitron tracking-widest mt-0.5" style={{ color: `${s.color}70` }}>{s.label}</div>
              </div>
            ))}
          </div>
          {lastResult.categories && Object.keys(lastResult.categories).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {Object.entries(lastResult.categories).slice(0, 12).map(([cat, count]) => (
                <span key={cat} className="text-xs px-2 py-0.5 rounded-full font-mono"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}>
                  {cat.replace(/_/g, ' ')} ({count})
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}