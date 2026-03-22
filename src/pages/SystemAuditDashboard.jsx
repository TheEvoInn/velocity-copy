/**
 * SYSTEM AUDIT DASHBOARD
 * Live validation of all 9 audit phases — ADI verification, isolation checks, auto-fix
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Shield, CheckCircle, AlertTriangle, XCircle, RefreshCw, Zap, Activity } from 'lucide-react';

function PhaseCard({ name, checks = [], phaseKey }) {
  const errors = checks.filter(c => c.status === 'fail').length;
  const passes = checks.filter(c => c.status === 'pass').length;
  const color = errors > 0 ? '#ef4444' : '#10b981';

  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(10,15,42,0.7)', border: `1px solid ${color}20` }}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-orbitron text-xs tracking-widest" style={{ color }}>{name || phaseKey}</span>
        <div className="flex items-center gap-2">
          {passes > 0 && <span className="text-xs text-emerald-400 font-mono">{passes} ✓</span>}
          {errors > 0 && <span className="text-xs text-red-400 font-mono">{errors} ✗</span>}
        </div>
      </div>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {checks.map((c, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
            <span className="text-slate-400 leading-relaxed">{c.detail}</span>
          </div>
        ))}
        {checks.length === 0 && (
          <span className="text-xs text-slate-600">No checks run</span>
        )}
      </div>
    </div>
  );
}

export default function SystemAuditDashboard() {
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  async function runAudit() {
    setIsRunning(true);
    setError(null);
    setReport(null);
    try {
      const res = await base44.functions.invoke('systemAudit', { action: 'full_audit' });
      setReport(res.data?.audit);
    } catch (e) {
      setError(e.message);
    }
    setIsRunning(false);
  }

  const scoreColor = report
    ? report.score >= 80 ? '#10b981' : report.score >= 60 ? '#f9d65c' : '#ef4444'
    : '#64748b';

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)' }}>
            <Shield className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h1 className="font-orbitron text-xl font-bold text-white tracking-widest">SYSTEM AUDIT</h1>
            <p className="text-xs text-slate-500 font-mono">Phase 1-9 · ADI Validation · Auto-Fix · Multi-User Isolation Check</p>
          </div>
        </div>
        <button onClick={runAudit} disabled={isRunning}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-orbitron text-xs tracking-widest transition-all"
          style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.4)', color: '#a855f7' }}>
          {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {isRunning ? 'AUDITING...' : 'RUN FULL AUDIT'}
        </button>
      </div>

      {/* Score Hero */}
      {report && (
        <div className="rounded-2xl p-6 mb-6 relative overflow-hidden"
          style={{ background: 'rgba(10,15,42,0.8)', border: `1px solid ${scoreColor}30` }}>
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: `linear-gradient(90deg, transparent, ${scoreColor}60, transparent)` }} />
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-orbitron tracking-widest mb-1" style={{ color: `${scoreColor}80` }}>SYSTEM HEALTH SCORE</div>
              <div className="text-6xl font-orbitron font-black" style={{ color: scoreColor, textShadow: `0 0 30px ${scoreColor}40` }}>
                {report.score}<span className="text-2xl">/100</span>
              </div>
              <div className="text-xs font-orbitron mt-1" style={{ color: scoreColor }}>
                {report.summary?.status}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'CHECKS', value: report.summary?.total_checks, color: '#00e8ff' },
                { label: 'ERRORS', value: report.summary?.errors, color: '#ef4444' },
                { label: 'WARNINGS', value: report.summary?.warnings, color: '#f9d65c' },
                { label: 'AUTO-FIXED', value: report.summary?.fixes_applied, color: '#10b981' },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-3 text-center"
                  style={{ background: `${s.color}08`, border: `1px solid ${s.color}20` }}>
                  <div className="text-2xl font-orbitron font-bold" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-xs font-orbitron tracking-widest" style={{ color: `${s.color}70` }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Score bar */}
          <div className="mt-4 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${report.score}%`, background: `linear-gradient(90deg, ${scoreColor}, ${scoreColor}80)`, boxShadow: `0 0 10px ${scoreColor}50` }} />
          </div>
        </div>
      )}

      {/* Issues */}
      {report?.issues?.length > 0 && (
        <div className="rounded-2xl p-5 mb-5"
          style={{ background: 'rgba(10,15,42,0.7)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div className="font-orbitron text-xs text-red-400 tracking-widest mb-3">ISSUES FOUND</div>
          <div className="space-y-2">
            {report.issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl"
                style={{
                  background: issue.severity === 'error' ? 'rgba(239,68,68,0.06)' : 'rgba(249,214,92,0.06)',
                  border: `1px solid ${issue.severity === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(249,214,92,0.2)'}`,
                }}>
                {issue.severity === 'error'
                  ? <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  : <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
                <div>
                  <span className="text-xs font-orbitron text-slate-400">[{issue.phase}]</span>
                  <span className="text-xs text-slate-300 ml-2">{issue.issue}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fixes Applied */}
      {report?.fixes_applied?.length > 0 && (
        <div className="rounded-2xl p-5 mb-5"
          style={{ background: 'rgba(10,15,42,0.7)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <div className="font-orbitron text-xs text-emerald-400 tracking-widest mb-3">AUTO-FIXES APPLIED</div>
          <div className="space-y-1.5">
            {report.fixes_applied.map((fix, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-emerald-300">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> {fix}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phase Results Grid */}
      {report?.phases && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(report.phases).map(([key, phase]) => (
            <PhaseCard key={key} phaseKey={key} name={phase.name} checks={phase.checks || []} />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-2xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <p className="text-sm text-red-400 font-mono">{error}</p>
          <p className="text-xs text-slate-600 mt-1">Note: Audit requires admin role</p>
        </div>
      )}

      {/* Empty state */}
      {!report && !isRunning && !error && (
        <div className="text-center py-20">
          <Activity className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <p className="font-orbitron text-lg text-slate-600 mb-2">No Audit Run Yet</p>
          <p className="text-xs text-slate-700 max-w-sm mx-auto mb-6">
            Click Run Full Audit to validate all 9 phases: data integrity, multi-user isolation, autopilot loop, discovery engine, wallet, and more.
          </p>
          <div className="text-xs font-orbitron text-slate-700 space-y-1">
            {['Phase 1: Real-Time Data Integrity', 'Phase 2: Multi-User Isolation', 'Phase 3: Autopilot Functionality',
              'Phase 4: Discovery Engine', 'Phase 5: Workflow Architect', 'Phase 7: Wallet & Banking',
              'Phase 8: UI/UX & Cockpit', 'Phase 9: System Sync'].map(p => (
              <div key={p}>· {p}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}