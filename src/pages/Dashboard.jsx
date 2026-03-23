/**
 * VELOCITY MASTER COMMAND CENTER
 * The main hub — per-user isolated, real-time autonomous profit engine
 */
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCurrentUser, useUserProfile, useUserWallet, useUserTasks, useUserOpportunities } from '@/hooks/useUserData';
import {
  Bot, Target, Wallet, Search, Play, Shield, Workflow,
  TrendingUp, Radio, ChevronRight, Cpu, Settings,
  Power, Rocket, Lock
} from 'lucide-react';

function StatusPulse({ active, size = 3 }) {
  return (
    <span
      className="inline-block rounded-full"
      style={{
        width: size * 4, height: size * 4,
        background: active ? '#00e8ff' : '#334155',
        boxShadow: active ? '0 0 8px #00e8ff, 0 0 16px #00e8ff60' : 'none',
        animation: active ? 'pulse-glow 1.5s ease-in-out infinite' : 'none',
      }}
    />
  );
}

function ModuleCard({ to, icon: Icon, title, subtitle, color, stat, statLabel, active }) {
  return (
    <Link to={to}>
      <div
        className="group relative rounded-2xl p-5 h-full cursor-pointer transition-all duration-300"
        style={{
          background: 'rgba(10,15,42,0.7)',
          border: `1px solid ${color}30`,
          backdropFilter: 'blur(20px)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.border = `1px solid ${color}80`;
          e.currentTarget.style.boxShadow = `0 0 30px ${color}20, 0 0 60px ${color}10`;
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.border = `1px solid ${color}30`;
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        {/* Glow bg */}
        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at top left, ${color}08, transparent 60%)` }} />

        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-px rounded-t-2xl"
          style={{ background: `linear-gradient(90deg, transparent, ${color}60, transparent)` }} />

        <div className="relative">
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div className="flex items-center gap-1.5">
              <StatusPulse active={active} size={2} />
              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color }} />
            </div>
          </div>

          <div className="font-orbitron text-sm font-bold text-white mb-1">{title}</div>
          <div className="text-xs text-slate-500 mb-4 leading-relaxed">{subtitle}</div>

          {stat !== undefined && (
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-orbitron font-bold" style={{ color, textShadow: `0 0 10px ${color}60` }}>
                {stat}
              </span>
              <span className="text-xs text-slate-600">{statLabel}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const { data: profile, upsert: upsertProfile } = useUserProfile();
  const { balance, totalEarned, todayEarnings, weekEarnings } = useUserWallet();
  const { data: tasks = [] } = useUserTasks();
  const { data: opportunities = [] } = useUserOpportunities();

  const [warpTarget, setWarpTarget] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const activeTasks = tasks.filter(t => t.status === 'running').length;
  const queuedTasks = tasks.filter(t => t.status === 'queued').length;
  const completedToday = tasks.filter(t =>
    t.status === 'completed' && new Date(t.created_date).toDateString() === new Date().toDateString()
  ).length;
  const newOpps = opportunities.filter(o => o.status === 'discovered').length;
  const isAutopilotOn = profile?.autopilot_enabled;

  function handleWarp(path, name) {
    setWarpTarget(name);
    setTimeout(() => navigate(path), 600);
  }

  async function toggleAutopilot() {
    upsertProfile({ autopilot_enabled: !isAutopilotOn });
  }

  const MODULES = [
    {
      to: '/AutoPilot', icon: Bot, title: 'AUTOPILOT ENGINE',
      subtitle: 'Autonomous 24/7 profit engine — searches, applies, executes, and earns',
      color: '#00e8ff', stat: activeTasks > 0 ? activeTasks : (isAutopilotOn ? 'ON' : 'OFF'),
      statLabel: activeTasks > 0 ? 'active tasks' : 'status', active: isAutopilotOn
    },
    {
      to: '/Discovery', icon: Search, title: 'WORK DISCOVERY',
      subtitle: 'AI-powered internet scanner — finds gigs, tasks, and hidden opportunities',
      color: '#f9d65c', stat: newOpps, statLabel: 'new found', active: newOpps > 0
    },
    {
      to: '/Execution', icon: Play, title: 'TASK EXECUTION',
      subtitle: 'Browser automation — fills forms, submits work, delivers results',
      color: '#3b82f6', stat: queuedTasks, statLabel: 'in queue', active: activeTasks > 0
    },
    {
      to: '/Finance', icon: Wallet, title: 'WALLET & EARNINGS',
      subtitle: 'Real-time balance, transaction history, and payout management',
      color: '#10b981', stat: `$${todayEarnings.toFixed(0)}`, statLabel: 'today', active: todayEarnings > 0
    },
    {
      to: '/IdentityManager', icon: Shield, title: 'IDENTITY VAULT',
      subtitle: 'Manage AI personas, credentials, and external platform profiles',
      color: '#a855f7', stat: null, statLabel: '', active: false
    },
    {
      to: '/Control', icon: Workflow, title: 'WORKFLOW ARCHITECT',
      subtitle: 'Build automation chains, triggers, and multi-step execution flows',
      color: '#ff2ec4', stat: null, statLabel: '', active: false
    },
    {
      to: '/StarshipBridge', icon: Rocket, title: 'STARSHIP BRIDGE',
      subtitle: 'Immersive 3D cockpit — the full cinematic control experience',
      color: '#b537f2', stat: null, statLabel: '', active: false
    },
    {
      to: '/admin', icon: Settings, title: 'ADMIN PANEL',
      subtitle: 'User management, verification, approvals, and full platform control',
      color: '#64748b', stat: null, statLabel: '', active: false
    },
  ];

  return (
    <div className="min-h-screen galaxy-bg relative overflow-x-hidden">
      {/* Warp transition */}
      {warpTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          style={{ background: 'rgba(5,7,20,0.9)', animation: 'warp-jump 0.6s ease-in forwards' }}>
          <div className="text-center">
            <div className="font-orbitron text-xs tracking-[0.4em] text-cyan-400 mb-2 animate-pulse">WARPING TO</div>
            <div className="font-orbitron text-3xl text-white tracking-widest">{warpTarget.toUpperCase()}</div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">

        {/* ── TOP BAR ── */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-2 h-8 rounded-full" style={{ background: 'linear-gradient(to bottom, #00e8ff, #ff2ec4)' }} />
              <h1 className="font-orbitron text-3xl md:text-4xl font-black text-white tracking-wider"
                style={{ textShadow: '0 0 30px rgba(0,232,255,0.4)' }}>
                VELOCITY
              </h1>
            </div>
            <p className="text-xs text-slate-500 ml-5 font-mono tracking-widest">
              AUTONOMOUS PROFIT ENGINE · {currentTime.toLocaleTimeString()}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Autopilot master switch */}
            <button
              onClick={toggleAutopilot}
              className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300"
              style={{
                background: isAutopilotOn ? 'rgba(0,232,255,0.1)' : 'rgba(51,65,85,0.3)',
                border: `1px solid ${isAutopilotOn ? '#00e8ff50' : '#33415550'}`,
                boxShadow: isAutopilotOn ? '0 0 20px rgba(0,232,255,0.2)' : 'none',
              }}
            >
              <Power className="w-4 h-4" style={{ color: isAutopilotOn ? '#00e8ff' : '#64748b' }} />
              <span className="font-orbitron text-xs tracking-widest"
                style={{ color: isAutopilotOn ? '#00e8ff' : '#64748b' }}>
                AUTOPILOT {isAutopilotOn ? 'ON' : 'OFF'}
              </span>
              <StatusPulse active={isAutopilotOn} size={2} />
            </button>

            {/* User indicator */}
            {user && (
              <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: 'rgba(10,15,42,0.6)', border: '1px solid rgba(0,232,255,0.15)' }}>
                <Lock className="w-3 h-3 text-slate-500" />
                <span className="text-xs text-slate-400 font-mono">{user.email?.split('@')[0]}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── KEY METRICS STRIP ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'WALLET BALANCE', value: `$${balance.toFixed(2)}`, color: '#10b981', icon: Wallet },
            { label: 'TODAY\'S EARNINGS', value: `$${todayEarnings.toFixed(2)}`, color: '#f9d65c', icon: TrendingUp },
            { label: 'TASKS ACTIVE', value: activeTasks, color: '#00e8ff', icon: Cpu, pulse: activeTasks > 0 },
            { label: 'OPPORTUNITIES', value: newOpps, color: '#a855f7', icon: Target },
          ].map(item => (
            <div key={item.label}
              className="relative rounded-2xl p-4 overflow-hidden"
              style={{
                background: 'rgba(10,15,42,0.7)',
                border: `1px solid ${item.color}25`,
                backdropFilter: 'blur(20px)',
              }}
            >
              <div className="absolute inset-0 pointer-events-none opacity-5"
                style={{ background: `radial-gradient(ellipse at top left, ${item.color}, transparent 70%)` }} />
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-orbitron tracking-widest" style={{ color: `${item.color}99` }}>
                    {item.label}
                  </span>
                  <item.icon className="w-3.5 h-3.5" style={{ color: item.color }} />
                </div>
                <div className="text-2xl font-orbitron font-bold" style={{ color: item.color, textShadow: `0 0 12px ${item.color}60` }}>
                  {item.value}
                  {item.pulse && (
                    <span className="inline-block w-2 h-2 rounded-full ml-1.5" style={{
                      background: item.color, animation: 'pulse-glow 1.5s ease-in-out infinite',
                    }} />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── STATUS BANNER ── */}
        <div className="mb-8 px-5 py-3 rounded-2xl flex items-center justify-between"
          style={{
            background: isAutopilotOn
              ? 'rgba(0,232,255,0.05)'
              : 'rgba(51,65,85,0.2)',
            border: `1px solid ${isAutopilotOn ? '#00e8ff25' : '#33415530'}`,
          }}>
          <div className="flex items-center gap-3">
            <Radio className={`w-4 h-4 ${isAutopilotOn ? 'text-cyan-400 animate-pulse' : 'text-slate-600'}`} />
            <div>
              <span className="font-orbitron text-xs tracking-widest"
                style={{ color: isAutopilotOn ? '#00e8ff' : '#475569' }}>
                {isAutopilotOn
                  ? `ENGINE ACTIVE — Scanning, executing, and earning for ${user?.full_name || 'you'}`
                  : 'ENGINE STANDBY — Activate Autopilot to begin autonomous profit generation'}
              </span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4 text-xs font-mono text-slate-600">
            <span>{completedToday} completed today</span>
            <span>·</span>
            <span>${weekEarnings.toFixed(0)} this week</span>
          </div>
        </div>

        {/* ── MODULE GRID ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {MODULES.map(mod => (
            <ModuleCard key={mod.to} {...mod} />
          ))}
        </div>

        {/* ── BOTTOM: ACTIVITY + QUICK ACTIONS ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Recent Tasks */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(10,15,42,0.65)', border: '1px solid rgba(0,232,255,0.12)', backdropFilter: 'blur(20px)' }}>
            <div className="px-5 py-3 border-b" style={{ borderColor: 'rgba(0,232,255,0.1)' }}>
              <span className="font-orbitron text-xs tracking-widest text-cyan-400/70">RECENT EXECUTION</span>
            </div>
            <div className="p-4 space-y-2 max-h-56 overflow-y-auto">
              {tasks.slice(0, 8).length === 0 ? (
                <div className="text-center py-6 text-slate-600 text-xs">No tasks yet — activate Autopilot to begin</div>
              ) : tasks.slice(0, 8).map(task => (
                <div key={task.id} className="flex items-center justify-between p-2.5 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{
                      background: task.status === 'completed' ? '#10b981' : task.status === 'running' ? '#00e8ff' : task.status === 'failed' ? '#ef4444' : '#f59e0b'
                    }} />
                    <span className="text-xs text-slate-400 truncate max-w-[180px]">{task.task_type || 'Task'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {task.earnings > 0 && (
                      <span className="text-xs font-mono text-emerald-400">+${task.earnings.toFixed(2)}</span>
                    )}
                    <span className="text-xs text-slate-600 capitalize">{task.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(10,15,42,0.65)', border: '1px solid rgba(255,46,196,0.12)', backdropFilter: 'blur(20px)' }}>
            <div className="px-5 py-3 border-b" style={{ borderColor: 'rgba(255,46,196,0.1)' }}>
              <span className="font-orbitron text-xs tracking-widest text-pink-400/70">QUICK ACTIONS</span>
            </div>
            <div className="p-4 space-y-2.5">
              {[
                { to: '/AutoPilot', label: 'Configure Autopilot Engine', color: '#00e8ff', icon: Bot },
                { to: '/Discovery', label: 'Scan for New Work', color: '#f9d65c', icon: Search },
                { to: '/Finance', label: 'View Wallet & Earnings', color: '#10b981', icon: Wallet },
                { to: '/IdentityManager', label: 'Manage AI Identities', color: '#a855f7', icon: Shield },
                { to: '/StarshipBridge', label: 'Enter 3D Cockpit', color: '#b537f2', icon: Rocket },
              ].map(action => (
                <Link key={action.to} to={action.to}>
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 group"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = `${action.color}40`;
                      e.currentTarget.style.background = `${action.color}08`;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                      e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                    }}>
                    <div className="flex items-center gap-3">
                      <action.icon className="w-4 h-4" style={{ color: action.color }} />
                      <span className="text-sm text-slate-300">{action.label}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div className="mt-8 flex items-center justify-between text-xs font-mono text-slate-700">
          <span>VELOCITY ENGINE v2.0 · Multi-User Isolated · Per-User Autonomous</span>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>ALL SYSTEMS OPERATIONAL</span>
          </div>
        </div>
      </div>
    </div>
  );
}