import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserGoals, useCryptoWallets, useAITasks, useActivityLogs, useOpportunities } from '@/hooks/useQueryHooks';
import { base44 } from '@/api/base44Client';
import {
  Zap, Radio, Target, TrendingUp, Activity, Bell, Map, AlertTriangle,
  ChevronRight, Power, Navigation, Cpu, Database, Shield, Settings,
  User, Wallet, BarChart2, Layers, GitBranch, Radar
} from 'lucide-react';

// ── Panel primitives ──────────────────────────────────────────────────────────

function GlassPanel({ children, className = '' }) {
  return (
    <div className={`bg-slate-950/80 border border-cyan-400/25 backdrop-blur-md rounded-lg shadow-lg shadow-cyan-900/20 ${className}`}>
      {children}
    </div>
  );
}

function PanelLabel({ icon: Icon, label, color = 'text-cyan-400' }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <Icon className={`w-3.5 h-3.5 ${color}`} />
      <span className={`font-orbitron text-[10px] tracking-widest ${color} opacity-80`}>{label}</span>
    </div>
  );
}

function PulsingDot({ color = 'bg-cyan-400' }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${color} animate-pulse`} />;
}

function EnergyBar({ value, color = 'from-cyan-400 to-cyan-600', max = 100 }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-full bg-slate-800/60 rounded-full h-1.5 overflow-hidden">
      <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Autopilot Throttle ────────────────────────────────────────────────────────
function AutopilotThrottle({ mode, onChange, loading }) {
  const modes = [
    { id: 'manual',    label: 'MANUAL',     color: 'border-slate-600 text-slate-400 hover:border-slate-400' },
    { id: 'assisted',  label: 'ASSISTED',   color: 'border-amber-500 text-amber-400 hover:border-amber-300' },
    { id: 'auto',      label: 'FULL AUTO',  color: 'border-cyan-400 text-cyan-300 hover:border-cyan-200' },
  ];
  return (
    <GlassPanel className="p-3">
      <PanelLabel icon={Radio} label="AUTOPILOT MODE" />
      <div className="flex flex-col gap-1.5">
        {modes.map(m => (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            disabled={loading}
            className={`w-full px-2 py-1.5 rounded text-[10px] font-orbitron border transition-all tracking-widest disabled:opacity-40 ${
              mode === m.id ? m.color + ' bg-white/5' : 'border-slate-800 text-slate-600 hover:border-slate-600 hover:text-slate-400'
            }`}
          >
            {m.id === mode && <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />}
            {m.label}
          </button>
        ))}
      </div>
    </GlassPanel>
  );
}

// ── Engine Status (Left Console) ─────────────────────────────────────────────
function EngineStatusPanel({ navigate }) {
  const engines = [
    { name: 'AUTOPILOT',   EngineIcon: Radio,     color: 'text-cyan-400',    route: '/AutoPilot',    bar: 'from-cyan-400 to-cyan-600' },
    { name: 'VIPZ',        EngineIcon: Zap,       color: 'text-pink-400',    route: '/VIPZ',         bar: 'from-pink-500 to-pink-700' },
    { name: 'NED CRYPTO',  EngineIcon: Cpu,       color: 'text-amber-400',   route: '/NED',          bar: 'from-amber-400 to-amber-600' },
    { name: 'WORKFLOWS',   EngineIcon: GitBranch, color: 'text-violet-400',  route: '/WorkflowArchitect', bar: 'from-violet-400 to-violet-600' },
    { name: 'DISCOVERY',   EngineIcon: Radar,     color: 'text-emerald-400', route: '/Discovery',    bar: 'from-emerald-400 to-emerald-600' },
    { name: 'IDENTITY',    EngineIcon: User,      color: 'text-blue-400',    route: '/IdentityManager', bar: 'from-blue-400 to-blue-600' },
  ];
  const [vals] = useState(() => engines.map(() => 40 + Math.random() * 55));

  return (
    <div className="space-y-2">
      <div className="font-orbitron text-[9px] text-slate-500 tracking-widest mb-3 text-center">◈ SYSTEMS PANEL ◈</div>
      {engines.map((e, i) => (
        <button key={e.name} onClick={() => navigate(e.route)} className="w-full text-left group">
          <GlassPanel className="p-2.5 hover:border-cyan-400/50 transition-all">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <e.EngineIcon className={`w-3 h-3 ${e.color}`} />
                <span className={`font-orbitron text-[9px] tracking-wider ${e.color}`}>{e.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <PulsingDot />
                <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-slate-400 transition-colors" />
              </div>
            </div>
            <EnergyBar value={vals[i]} color={e.bar} />
          </GlassPanel>
        </button>
      ))}
    </div>
  );
}

// ── Navigation Panel (Right Console) ─────────────────────────────────────────
function NavigationPanel({ navigate, hoveredModule }) {
  const navItems = [
    { label: 'GALAXY MAP',          icon: Map,        route: '/StarshipBridge',  color: 'text-cyan-400' },
    { label: 'CONTROL CENTER',      icon: Shield,     route: '/Control',         color: 'text-violet-400' },
    { label: 'OPPORTUNITY SCANNER', icon: Radar,      route: '/Discovery',       color: 'text-amber-400' },
    { label: 'FINANCE CORE',        icon: Wallet,     route: '/Finance',         color: 'text-emerald-400' },
    { label: 'DEEP SPACE DATA',     icon: Database,   route: '/Execution',       color: 'text-blue-400' },
    { label: 'ANALYTICS',           icon: BarChart2,  route: '/AnalyticsDashboard', color: 'text-pink-400' },
    { label: 'PLATFORM MODULES',    icon: Layers,     route: '/Dashboard',       color: 'text-slate-400' },
    { label: 'SETTINGS',            icon: Settings,   route: '/AccountManager',  color: 'text-slate-500' },
  ];

  return (
    <div className="space-y-2">
      <div className="font-orbitron text-[9px] text-slate-500 tracking-widest mb-3 text-center">◈ NAVIGATION ◈</div>
      {hoveredModule && (
        <GlassPanel className="p-2 border-cyan-400/50 mb-2">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-cyan-300 font-orbitron text-[9px] tracking-wider">TARGETING: {hoveredModule.toUpperCase()}</span>
          </div>
        </GlassPanel>
      )}
      {navItems.map(n => (
        <button key={n.route} onClick={() => navigate(n.route)} className="w-full text-left group">
          <GlassPanel className="p-2.5 hover:border-cyan-400/40 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <n.icon className={`w-3 h-3 ${n.color}`} />
                <span className={`font-orbitron text-[9px] tracking-wider ${n.color} group-hover:text-white transition-colors`}>{n.label}</span>
              </div>
              <ChevronRight className="w-3 h-3 text-slate-700 group-hover:text-cyan-400 transition-colors" />
            </div>
          </GlassPanel>
        </button>
      ))}
    </div>
  );
}

// ── Main Holographic Display (Center) ────────────────────────────────────────
function MainDisplay({ goals, tasks, wallets, logs, opportunities }) {
  const goal = goals?.[0] || {};
  const activeTasks = tasks?.filter(t => ['executing','processing','navigating'].includes(t.status))?.length || 0;
  const totalBalance = wallets?.reduce((s, w) => s + (w?.balance?.total_balance_usd || 0), 0) || 0;
  const dailyTarget = goal?.daily_target || 1000;
  const progress = Math.min(100, (totalBalance / dailyTarget) * 100);
  const recentLogs = logs?.slice(0, 4) || [];
  const topOpp = opportunities?.filter(o => o.status === 'new')?.length || 0;

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1800);
    return () => clearInterval(id);
  }, []);

  const alerts = recentLogs.filter(l => l.severity === 'warning' || l.severity === 'critical');

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Top status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-orbitron text-[9px] text-emerald-400 tracking-widest">VELOCITY ONLINE</span>
        </div>
        <span className="font-mono text-[9px] text-slate-500">{new Date().toISOString().slice(11,19)} UTC</span>
      </div>

      {/* Core metrics row */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'WALLET', val: `$${totalBalance.toFixed(0)}`, color: 'text-amber-400', icon: Zap, bar: 'from-amber-400 to-amber-600', pct: Math.min(100, totalBalance/10) },
          { label: 'TASKS',  val: activeTasks,                   color: 'text-cyan-400',  icon: Activity, bar: 'from-cyan-400 to-cyan-600', pct: Math.min(100, activeTasks*10) },
          { label: 'TARGET', val: `$${dailyTarget}`,             color: 'text-emerald-400', icon: Target, bar: 'from-emerald-400 to-emerald-600', pct: progress },
          { label: 'OPPS',   val: topOpp,                        color: 'text-violet-400', icon: TrendingUp, bar: 'from-violet-400 to-violet-600', pct: Math.min(100, topOpp*5) },
        ].map(m => (
          <GlassPanel key={m.label} className="p-2 text-center">
            <m.icon className={`w-3.5 h-3.5 ${m.color} mx-auto mb-1`} />
            <div className={`font-orbitron text-sm font-bold ${m.color}`}>{m.val}</div>
            <div className="text-[8px] text-slate-500 font-orbitron tracking-widest">{m.label}</div>
            <EnergyBar value={m.pct} color={m.bar} />
          </GlassPanel>
        ))}
      </div>

      {/* Autopilot status */}
      <GlassPanel className="p-2 border-cyan-400/30">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-orbitron text-[10px] text-cyan-400 tracking-widest">AUTOPILOT STATUS</span>
          </div>
          <span className={`font-orbitron text-[9px] px-2 py-0.5 rounded ${goal?.autopilot_enabled ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700' : 'bg-red-900/50 text-red-400 border border-red-800'}`}>
            {goal?.autopilot_enabled ? '● ACTIVE' : '○ IDLE'}
          </span>
        </div>
        <EnergyBar value={goal?.autopilot_enabled ? 80 : 20} color="from-cyan-400 to-cyan-600" />
      </GlassPanel>

      {/* Daily goal progress */}
      <GlassPanel className="p-2 border-emerald-400/20">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-orbitron text-[9px] text-emerald-400 tracking-widest">DAILY MISSION PROGRESS</span>
          <span className="font-mono text-[9px] text-emerald-400">{progress.toFixed(0)}%</span>
        </div>
        <EnergyBar value={progress} color="from-emerald-400 to-emerald-600" />
      </GlassPanel>

      {/* Alert feed */}
      {alerts.length > 0 && (
        <GlassPanel className="p-2 border-amber-500/30">
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span className="font-orbitron text-[9px] text-amber-400 tracking-widest">ALERTS</span>
          </div>
          {alerts.slice(0,2).map((a, i) => (
            <div key={i} className="text-[9px] text-slate-400 truncate">{a.message}</div>
          ))}
        </GlassPanel>
      )}

      {/* Recent activity */}
      <GlassPanel className="p-2 flex-1 overflow-hidden">
        <div className="flex items-center gap-1.5 mb-2">
          <Activity className="w-3 h-3 text-violet-400" />
          <span className="font-orbitron text-[9px] text-violet-400 tracking-widest">ACTIVITY LOG</span>
        </div>
        <div className="space-y-1 overflow-hidden">
          {recentLogs.map((l, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[9px]">
              <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                l.severity === 'critical' ? 'bg-red-400' :
                l.severity === 'warning' ? 'bg-amber-400' :
                l.severity === 'success' ? 'bg-emerald-400' : 'bg-slate-500'
              }`} />
              <span className="text-slate-400 truncate leading-tight">{l.message}</span>
            </div>
          ))}
          {recentLogs.length === 0 && (
            <div className="text-slate-600 text-[9px] font-orbitron">AWAITING TRANSMISSIONS...</div>
          )}
        </div>
      </GlassPanel>
    </div>
  );
}

// ── Notifications panel ───────────────────────────────────────────────────────
function NotificationsWidget({ logs }) {
  const unread = logs?.filter(l => !l.is_read)?.length || 0;
  return (
    <div className="flex items-center gap-1.5 relative">
      <button className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors">
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 flex items-center justify-center text-[8px] font-bold text-white">{unread}</span>
        )}
      </button>
    </div>
  );
}

// ── Identity Badge ────────────────────────────────────────────────────────────
function IdentityBadge({ navigate }) {
  const [user, setUser] = useState(null);
  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);
  return (
    <button onClick={() => navigate('/IdentityManager')} className="flex items-center gap-2 group">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-violet-600 flex items-center justify-center text-[10px] font-bold text-white">
        {user?.full_name?.[0] || 'V'}
      </div>
      <div className="hidden sm:block">
        <div className="font-orbitron text-[9px] text-slate-300 group-hover:text-white transition-colors leading-none">{user?.full_name || 'PILOT'}</div>
        <div className="font-orbitron text-[8px] text-cyan-400/60 leading-none mt-0.5">VELOCITY COMMANDER</div>
      </div>
    </button>
  );
}

// ── Lower Control Strip ───────────────────────────────────────────────────────
function LowerControlStrip({ navigate, wallets, logs, goals, onAutopilotChange, autopilotMode }) {
  const totalBalance = wallets?.reduce((s, w) => s + (w?.balance?.total_balance_usd || 0), 0) || 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-slate-950/90 border-t border-cyan-400/20 backdrop-blur-md px-4 py-2">
      <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-3">
        {/* Identity */}
        <IdentityBadge navigate={navigate} />

        {/* Separator */}
        <div className="w-px h-8 bg-cyan-400/15" />

        {/* Wallet pulse */}
        <button onClick={() => navigate('/Finance')} className="flex items-center gap-2 group">
          <Zap className="w-4 h-4 text-amber-400" />
          <div>
            <div className="font-orbitron text-xs text-amber-400 group-hover:text-amber-300">${totalBalance.toFixed(0)}</div>
            <div className="font-orbitron text-[8px] text-slate-500">ENERGY CORE</div>
          </div>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        </button>

        <div className="w-px h-8 bg-cyan-400/15" />

        {/* Autopilot quick toggle */}
        <div className="flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5 text-cyan-400" />
          <div className="flex gap-1">
            {['manual','assisted','auto'].map(m => (
              <button key={m} onClick={() => onAutopilotChange(m)}
                className={`px-2 py-1 rounded text-[9px] font-orbitron tracking-widest transition-all ${
                  autopilotMode === m ? 'bg-cyan-400/20 border border-cyan-400 text-cyan-400' : 'border border-slate-700 text-slate-600 hover:text-slate-400'
                }`}>
                {m === 'manual' ? 'MAN' : m === 'assisted' ? 'AST' : 'AUT'}
              </button>
            ))}
          </div>
        </div>

        <div className="w-px h-8 bg-cyan-400/15" />

        {/* Mission AI */}
        <button onClick={() => navigate('/AutoPilot')} className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-violet-500/50 text-violet-400 hover:border-violet-400 hover:text-violet-300 transition-all font-orbitron text-[9px] tracking-widest">
          <Power className="w-3.5 h-3.5" />
          MISSION AI
        </button>

        <div className="flex-1" />

        {/* Notifications */}
        <NotificationsWidget logs={logs} />

        <div className="w-px h-8 bg-cyan-400/15" />

        {/* Quick tools */}
        {[
          { icon: Navigation, route: '/StarshipBridge', tip: 'Bridge' },
          { icon: Settings,   route: '/AccountManager', tip: 'Settings' },
          { icon: Activity,   route: '/CentralEventLog', tip: 'Logs' },
        ].map(t => (
          <button key={t.route} onClick={() => navigate(t.route)}
            className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded hover:bg-slate-800/50" title={t.tip}>
            <t.icon className="w-4 h-4" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main HUD export ───────────────────────────────────────────────────────────
export default function CockpitHUD({ hoveredModule }) {
  const navigate = useNavigate();
  const { data: goals = [] }         = useUserGoals();
  const { data: wallets = [] }       = useCryptoWallets();
  const { data: tasks = [] }         = useAITasks();
  const { data: logs = [] }          = useActivityLogs(20);
  const { data: opportunities = [] } = useOpportunities();

  const [autopilotMode, setAutopilotMode] = useState('auto');

  const handleAutopilotChange = async (mode) => {
    setAutopilotMode(mode);
    try {
      await base44.functions.invoke('unifiedOrchestrator', { action: 'set_autopilot_mode', mode });
    } catch (_) {}
  };

  return (
    <>
      {/* ── Overlay HUD grid ─────────────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none z-20" style={{ paddingBottom: '52px' }}>
        <div className="h-full grid grid-cols-[220px_1fr_220px] gap-0">

          {/* ── LEFT CONSOLE ──────────────────────────────────────────────────── */}
          <div className="h-full flex flex-col justify-start pt-4 pl-4 pr-2 pointer-events-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 100px)' }}>
            <EngineStatusPanel navigate={navigate} />
          </div>

          {/* ── CENTER DISPLAY (top only, 3D shows through bottom) ──────────── */}
          <div className="flex flex-col pt-4 px-3 pointer-events-auto" style={{ maxHeight: '60vh' }}>
            <MainDisplay goals={goals} tasks={tasks} wallets={wallets} logs={logs} opportunities={opportunities} />
          </div>

          {/* ── RIGHT CONSOLE ─────────────────────────────────────────────────── */}
          <div className="h-full flex flex-col justify-start pt-4 pl-2 pr-4 pointer-events-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 100px)' }}>
            <NavigationPanel navigate={navigate} hoveredModule={hoveredModule} />
          </div>
        </div>
      </div>

      {/* ── Autopilot throttle floating (below main display) ─────────────────── */}
      <div className="absolute left-1/2 -translate-x-1/2 z-20 pointer-events-auto" style={{ top: 'calc(60vh + 8px)', width: '200px' }}>
        <AutopilotThrottle mode={autopilotMode} onChange={handleAutopilotChange} />
      </div>

      {/* ── Lower control strip ──────────────────────────────────────────────── */}
      <LowerControlStrip
        navigate={navigate}
        wallets={wallets}
        logs={logs}
        goals={goals}
        onAutopilotChange={handleAutopilotChange}
        autopilotMode={autopilotMode}
      />
    </>
  );
}