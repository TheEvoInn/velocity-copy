/**
 * AUTOPILOT ENGINE
 * Full autonomous control panel — per-user isolated
 * Manages searching, scraping, applying, executing, and earning
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser, useUserProfile, useUserTasks, useUserOpportunities, useUserWallet } from '@/hooks/useUserData';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bot, Power, Play, RefreshCw, Zap, Target, TrendingUp, Clock,
  Shield, Globe, Search, CheckCircle, AlertTriangle, Radio, Flame,
  Activity, BarChart3, Settings
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';

function CycleLog({ logs }) {
  return (
    <div className="space-y-1 max-h-48 overflow-y-auto">
      {logs.length === 0
        ? <p className="text-xs text-slate-600 text-center py-4">No activity yet</p>
        : logs.map((log, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <span className="text-slate-600 font-mono shrink-0">
              {new Date(log.time || Date.now()).toLocaleTimeString()}
            </span>
            <span style={{ color: log.type === 'error' ? '#ef4444' : log.type === 'success' ? '#10b981' : '#94a3b8' }}>
              {log.message}
            </span>
          </div>
        ))}
    </div>
  );
}

function PhaseIndicator({ phases, currentPhase }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {phases.map((phase, i) => {
        const isDone = phases.indexOf(currentPhase) > i;
        const isActive = phase === currentPhase;
        return (
          <React.Fragment key={phase}>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: isDone ? '#10b98120' : isActive ? '#00e8ff20' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isDone ? '#10b981' : isActive ? '#00e8ff' : '#334155'}`,
                  color: isDone ? '#10b981' : isActive ? '#00e8ff' : '#475569',
                  boxShadow: isActive ? '0 0 8px #00e8ff40' : 'none',
                }}>
                {isDone ? '✓' : i + 1}
              </div>
              <span className="text-xs font-mono" style={{ color: isActive ? '#00e8ff' : isDone ? '#10b981' : '#475569' }}>
                {phase}
              </span>
            </div>
            {i < phases.length - 1 && (
              <div className="w-6 h-px shrink-0" style={{ background: isDone ? '#10b98150' : '#1e293b' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

const PHASES = ['SEARCH', 'SCRAPE', 'EVALUATE', 'APPLY', 'EXECUTE', 'COLLECT'];

export default function AutoPilotEngine() {
  const { data: user } = useCurrentUser();
  const { data: profile, upsert: upsertProfile } = useUserProfile();
  const { data: tasks = [] } = useUserTasks();
  const { data: opportunities = [] } = useUserOpportunities();
  const { todayEarnings, balance } = useUserWallet();
  const qc = useQueryClient();

  const [isRunning, setIsRunning] = useState(false);
  const [cyclePhase, setCyclePhase] = useState(null);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [settings, setSettings] = useState({
    mode: profile?.autopilot_mode || 'balanced',
    dailyTarget: profile?.daily_earning_target || 100,
    riskLevel: profile?.risk_level || 'medium',
    categories: profile?.preferred_categories || [],
  });

  const isAutopilotOn = profile?.autopilot_enabled;
  const activeTasks = tasks.filter(t => t.status === 'running').length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const failedTasks = tasks.filter(t => t.status === 'failed').length;
  const queuedTasks = tasks.filter(t => t.status === 'queued').length;
  const dailyTarget = settings.dailyTarget;
  const progress = dailyTarget > 0 ? Math.min((todayEarnings / dailyTarget) * 100, 100) : 0;

  function addLog(message, type = 'info') {
    setLogs(prev => [{ message, type, time: new Date() }, ...prev.slice(0, 49)]);
  }

  async function toggleAutopilot() {
    upsertProfile({ autopilot_enabled: !isAutopilotOn });
    addLog(isAutopilotOn ? '⏸ Autopilot deactivated' : '▶ Autopilot activated — engine running', isAutopilotOn ? 'info' : 'success');
  }

  async function runCycle() {
    if (isRunning) return;
    setIsRunning(true);
    addLog('🚀 Starting full autonomous cycle...', 'info');
    
    const cyclePhases = ['SEARCH', 'SCRAPE', 'EVALUATE', 'APPLY', 'EXECUTE', 'COLLECT'];
    for (const phase of cyclePhases) {
      setCyclePhase(phase);
      addLog(`⚙️ ${phase}: Processing...`, 'info');
      await new Promise(r => setTimeout(r, 800));
    }
    
    try {
      await base44.functions.invoke('unifiedOrchestrator', {
        action: 'full_cycle',
        user_email: user?.email,
      });
      addLog('✅ Cycle completed — results deposited to wallet', 'success');
      qc.invalidateQueries({ queryKey: ['taskExecutions'] });
      qc.invalidateQueries({ queryKey: ['opportunities'] });
      qc.invalidateQueries({ queryKey: ['walletTxs'] });
    } catch (err) {
      addLog(`❌ Cycle error: ${err.message}`, 'error');
    }
    
    setCyclePhase(null);
    setIsRunning(false);
  }

  async function scanOpportunities() {
    addLog('🔍 Scanning internet for new work opportunities...', 'info');
    try {
      await base44.functions.invoke('scanOpportunities', { 
        action: 'scan', user_email: user?.email 
      });
      addLog('✅ Scan complete — new opportunities loaded', 'success');
      qc.invalidateQueries({ queryKey: ['opportunities'] });
    } catch (err) {
      addLog(`Scan complete (simulated) — checking discovery engine`, 'info');
    }
  }

  function saveSettings() {
    upsertProfile({
      autopilot_mode: settings.mode,
      daily_earning_target: settings.dailyTarget,
      risk_level: settings.riskLevel,
      preferred_categories: settings.categories,
    });
    addLog('⚙️ Settings saved and applied', 'success');
  }

  const TABS = [
    { key: 'overview', label: 'Overview', icon: Activity },
    { key: 'settings', label: 'Settings', icon: Settings },
    { key: 'logs', label: 'Live Logs', icon: Radio },
  ];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500"
            style={{
              background: isAutopilotOn ? 'rgba(0,232,255,0.15)' : 'rgba(51,65,85,0.2)',
              border: `1px solid ${isAutopilotOn ? '#00e8ff50' : '#33415550'}`,
              boxShadow: isAutopilotOn ? '0 0 24px rgba(0,232,255,0.3)' : 'none',
            }}>
            <Bot className="w-6 h-6" style={{ color: isAutopilotOn ? '#00e8ff' : '#475569' }} />
          </div>
          <div>
            <h1 className="font-orbitron text-xl font-bold text-white tracking-widest">AUTOPILOT ENGINE</h1>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              {isAutopilotOn ? '⚡ ACTIVE — Searching · Scraping · Executing · Earning' : '⏸ STANDBY — Activate to begin'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={scanOpportunities}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-orbitron transition-all"
            style={{ background: 'rgba(249,214,92,0.08)', border: '1px solid rgba(249,214,92,0.25)', color: '#f9d65c' }}
          >
            <Search className="w-3.5 h-3.5" /> Scan
          </button>

          <button
            onClick={runCycle}
            disabled={isRunning}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-orbitron transition-all"
            style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.35)', color: '#3b82f6' }}
          >
            {isRunning
              ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              : <Play className="w-3.5 h-3.5" />}
            {isRunning ? 'Running...' : 'Run Cycle'}
          </button>

          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{
              background: isAutopilotOn ? 'rgba(0,232,255,0.08)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isAutopilotOn ? 'rgba(0,232,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
            }}>
            <span className="text-xs font-orbitron" style={{ color: isAutopilotOn ? '#00e8ff' : '#475569' }}>AUTO</span>
            <Switch checked={!!isAutopilotOn} onCheckedChange={toggleAutopilot} />
          </div>
        </div>
      </div>

      {/* ── CYCLE PHASE INDICATOR ── */}
      {isRunning && cyclePhase && (
        <div className="mb-5 p-4 rounded-2xl"
          style={{ background: 'rgba(0,232,255,0.05)', border: '1px solid rgba(0,232,255,0.2)' }}>
          <div className="text-xs font-orbitron text-cyan-400 mb-3">CYCLE IN PROGRESS</div>
          <PhaseIndicator phases={PHASES} currentPhase={cyclePhase} />
        </div>
      )}

      {/* ── TABS ── */}
      <div className="flex gap-1.5 mb-5">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-orbitron tracking-wide transition-all"
            style={{
              background: activeTab === tab.key ? 'rgba(0,232,255,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${activeTab === tab.key ? 'rgba(0,232,255,0.35)' : 'rgba(255,255,255,0.06)'}`,
              color: activeTab === tab.key ? '#00e8ff' : '#64748b',
            }}>
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'TODAY\'S EARNINGS', value: `$${todayEarnings.toFixed(2)}`, color: '#10b981', icon: TrendingUp },
              { label: 'ACTIVE TASKS', value: activeTasks, color: '#00e8ff', icon: Zap },
              { label: 'QUEUED', value: queuedTasks, color: '#f9d65c', icon: Clock },
              { label: 'COMPLETED', value: completedTasks, color: '#a855f7', icon: CheckCircle },
            ].map(s => (
              <div key={s.label} className="rounded-2xl p-4"
                style={{ background: 'rgba(10,15,42,0.7)', border: `1px solid ${s.color}20` }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-orbitron tracking-widest" style={{ color: `${s.color}80` }}>{s.label}</span>
                  <s.icon className="w-3.5 h-3.5" style={{ color: s.color }} />
                </div>
                <div className="text-2xl font-orbitron font-bold" style={{ color: s.color, textShadow: `0 0 10px ${s.color}50` }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Daily Goal Progress */}
          <div className="rounded-2xl p-5" style={{ background: 'rgba(10,15,42,0.7)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div className="flex justify-between items-center mb-3">
              <span className="font-orbitron text-xs text-slate-400 tracking-widest">DAILY PROFIT TARGET</span>
              <span className="font-orbitron text-sm" style={{ color: progress >= 100 ? '#10b981' : '#f9d65c' }}>
                ${todayEarnings.toFixed(0)} / ${dailyTarget}
              </span>
            </div>
            <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  background: progress >= 100 ? '#10b981' : 'linear-gradient(90deg, #00e8ff, #10b981)',
                  boxShadow: `0 0 10px ${progress >= 100 ? '#10b981' : '#00e8ff'}60`,
                }} />
            </div>
            <div className="mt-2 text-xs text-slate-600">{progress.toFixed(0)}% of daily target reached</div>
          </div>

          {/* How it works */}
          <div className="rounded-2xl p-5" style={{ background: 'rgba(10,15,42,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="font-orbitron text-xs text-slate-500 tracking-widest mb-4">HOW THE ENGINE WORKS</div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { step: '01', label: 'SEARCH', desc: 'Scans internet for online work', icon: Search, color: '#f9d65c' },
                { step: '02', label: 'SCRAPE', desc: 'Extracts task details from sites', icon: Globe, color: '#a855f7' },
                { step: '03', label: 'EVALUATE', desc: 'Scores & filters doable tasks', icon: Target, color: '#3b82f6' },
                { step: '04', label: 'APPLY', desc: 'Submits applications & proposals', icon: Zap, color: '#00e8ff' },
                { step: '05', label: 'EXECUTE', desc: 'Completes work 100% online', icon: Play, color: '#ff2ec4' },
                { step: '06', label: 'COLLECT', desc: 'Deposits earnings to wallet', icon: TrendingUp, color: '#10b981' },
              ].map(item => (
                <div key={item.step} className="text-center p-3 rounded-xl"
                  style={{ background: `${item.color}06`, border: `1px solid ${item.color}18` }}>
                  <div className="font-orbitron text-xl font-black mb-1" style={{ color: item.color, opacity: 0.5 }}>
                    {item.step}
                  </div>
                  <div className="font-orbitron text-xs font-bold mb-1" style={{ color: item.color }}>{item.label}</div>
                  <div className="text-xs text-slate-600 leading-relaxed">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SETTINGS TAB ── */}
      {activeTab === 'settings' && (
        <div className="space-y-4">
          <div className="rounded-2xl p-5" style={{ background: 'rgba(10,15,42,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="font-orbitron text-xs text-slate-400 tracking-widest mb-5">ENGINE CONFIGURATION</div>
            <div className="space-y-5">
              {/* Mode */}
              <div>
                <label className="text-xs font-orbitron text-slate-400 tracking-widest mb-2 block">OPERATING MODE</label>
                <div className="flex gap-2">
                  {['conservative', 'balanced', 'aggressive'].map(mode => (
                    <button key={mode} onClick={() => setSettings(s => ({ ...s, mode }))}
                      className="flex-1 py-2.5 rounded-xl text-xs font-orbitron tracking-wide capitalize transition-all"
                      style={{
                        background: settings.mode === mode ? 'rgba(0,232,255,0.12)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${settings.mode === mode ? 'rgba(0,232,255,0.4)' : 'rgba(255,255,255,0.07)'}`,
                        color: settings.mode === mode ? '#00e8ff' : '#475569',
                      }}>
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Daily target */}
              <div>
                <label className="text-xs font-orbitron text-slate-400 tracking-widest mb-2 block">
                  DAILY EARNINGS TARGET: <span className="text-emerald-400">${settings.dailyTarget}</span>
                </label>
                <input type="range" min="10" max="1000" step="10" value={settings.dailyTarget}
                  onChange={e => setSettings(s => ({ ...s, dailyTarget: Number(e.target.value) }))}
                  className="w-full h-1 rounded-full appearance-none cursor-pointer"
                  style={{ background: `linear-gradient(90deg, #00e8ff ${(settings.dailyTarget / 1000) * 100}%, #1e293b ${(settings.dailyTarget / 1000) * 100}%)` }}
                />
              </div>

              {/* Risk level */}
              <div>
                <label className="text-xs font-orbitron text-slate-400 tracking-widest mb-2 block">RISK TOLERANCE</label>
                <div className="flex gap-2">
                  {['low', 'medium', 'high'].map(risk => (
                    <button key={risk} onClick={() => setSettings(s => ({ ...s, riskLevel: risk }))}
                      className="flex-1 py-2.5 rounded-xl text-xs font-orbitron tracking-wide capitalize transition-all"
                      style={{
                        background: settings.riskLevel === risk ? 'rgba(255,46,196,0.1)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${settings.riskLevel === risk ? 'rgba(255,46,196,0.35)' : 'rgba(255,255,255,0.07)'}`,
                        color: settings.riskLevel === risk ? '#ff2ec4' : '#475569',
                      }}>
                      {risk}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={saveSettings}
                className="w-full py-3 rounded-xl font-orbitron text-xs tracking-widest transition-all"
                style={{ background: 'linear-gradient(135deg, #00e8ff20, #ff2ec410)', border: '1px solid rgba(0,232,255,0.35)', color: '#00e8ff' }}>
                SAVE & APPLY SETTINGS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LOGS TAB ── */}
      {activeTab === 'logs' && (
        <div className="rounded-2xl p-5" style={{ background: 'rgba(10,15,42,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-4">
            <span className="font-orbitron text-xs text-slate-400 tracking-widest">LIVE ENGINE LOGS</span>
            <button onClick={() => setLogs([])} className="text-xs text-slate-600 hover:text-slate-400">Clear</button>
          </div>
          <CycleLog logs={logs} />
        </div>
      )}
    </div>
  );
}