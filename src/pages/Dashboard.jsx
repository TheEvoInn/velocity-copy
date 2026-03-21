/**
 * COMMAND CENTER — Cross-department hub
 * Shows unified real-time status from all 4 departments.
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useDepartmentSync } from '@/hooks/useDepartmentSync';
import { Zap, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import OnboardingModal from '@/components/onboarding/OnboardingModal';
import LiveMetricsBar from '@/components/dashboard/LiveMetricsBar';
import DailyGoalTracker from '@/components/dashboard/DailyGoalTracker';
import ActivityFeed from '@/components/dashboard/ActivityFeed';
import TransactionForm from '@/components/wallet/TransactionForm';
import NotificationPermissionBanner from '@/components/notifications/NotificationPermissionBanner';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import N8nMcpPanel from '@/components/n8n/N8nMcpPanel';
import SystemAuditChecker from '@/components/audit/SystemAuditChecker';
import GalaxyCommandHUD from '@/components/command-center/GalaxyCommandHUD';
import PlanetaryNav from '@/components/command-center/PlanetaryNav';
import DepartmentActivityRings from '@/components/command-center/DepartmentActivityRings';
import RealtimeOpportunitiesViewer from '@/components/command-center/RealtimeOpportunitiesViewer';
import ExecutionPipelineMonitor from '@/components/command-center/ExecutionPipelineMonitor';
import AIInsightsPanel from '@/components/command-center/AIInsightsPanel';

const DEPT_CARDS = [
  {
    path: '/Discovery',
    icon: Telescope,
    label: 'Observatory',
    subtitle: 'Intelligence & Scanning',
    color: '#f59e0b',
    textColor: 'text-amber-400',
    glow: 'rgba(245,158,11,0.4)',
    planet: '🔭',
    statsKey: 'discovery',
  },
  {
    path: '/Execution',
    icon: Cpu,
    label: 'Command Deck',
    subtitle: 'Automation & Tasks',
    color: '#3b82f6',
    textColor: 'text-blue-400',
    glow: 'rgba(59,130,246,0.4)',
    planet: '🚀',
    statsKey: 'execution',
  },
  {
    path: '/Finance',
    icon: Landmark,
    label: 'Treasury Station',
    subtitle: 'Wallet & Compliance',
    color: '#10b981',
    textColor: 'text-emerald-400',
    glow: 'rgba(16,185,129,0.4)',
    planet: '💎',
    statsKey: 'finance',
  },
  {
    path: '/Control',
    icon: SlidersHorizontal,
    label: 'Core Hub',
    subtitle: 'Identities & Settings',
    color: '#a855f7',
    textColor: 'text-purple-400',
    glow: 'rgba(168,85,247,0.4)',
    planet: '⚙️',
    statsKey: 'control',
  },
];

export default function Dashboard() {
  const {
    userGoals, opportunities, transactions, tasks, identities, activityLogs,
    todayEarned, totalEarned, walletBalance, activeOpps, activeTasks, activeIdentity,
    invalidateAll,
  } = useDepartmentSync();
  const queryClient = useQueryClient();
  useRealtimeNotifications();

  const [showTxForm, setShowTxForm] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Scan market opportunities mutation
  const scanMutation = useMutation({
    mutationFn: async () => {
      setIsScanning(true);
      const res = await base44.functions.invoke('scanOpportunities', {
        action: 'scan',
        max_results: 10
      });
      return res.data || {};
    },
    onSuccess: (data) => {
      setIsScanning(false);
      invalidateAll(); // Refresh all department data including opportunities
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    },
    onError: () => {
      setIsScanning(false);
    }
  });

  const hasOnboarded = userGoals.id || userGoals.onboarded;
  // Auto-show onboarding for new users once goals data has loaded (not loading = no record = first visit)
  const [showOnboarding, setShowOnboarding] = useState(false);
  React.useEffect(() => {
    if (!hasOnboarded && userGoals !== undefined) {
      const timer = setTimeout(() => setShowOnboarding(true), 800);
      return () => clearTimeout(timer);
    }
  }, [hasOnboarded]);
  const today = new Date().toDateString();
  const completedToday = opportunities.filter(o => o.id && o.status === 'completed' && o.updated_date && new Date(o.updated_date).toDateString() === today).length;
  const failedTasks = tasks.filter(t => t.id && t.status === 'failed').length;
  const reviewTasks = tasks.filter(t => t.id && t.status === 'needs_review').length;

  // Per-department stat summaries
  const deptStats = {
    discovery: { main: activeOpps.length, label: 'active opps', sub: `${opportunities.length} total found` },
    execution: { main: activeTasks.length, label: 'running tasks', sub: `${completedToday} completed today` },
    finance: { main: `$${todayEarned.toFixed(0)}`, label: 'earned today', sub: `$${walletBalance.toFixed(0)} wallet` },
    control: { main: identities.length, label: 'identities', sub: activeIdentity ? `Active: ${activeIdentity.name}` : 'None active' },
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {!hasOnboarded && showOnboarding && (
        <OnboardingModal onComplete={() => { setShowOnboarding(false); invalidateAll(); }} />
      )}
      {showTxForm && (
        <TransactionForm
          onClose={() => { setShowTxForm(false); queryClient.invalidateQueries({ queryKey: ['transactions'] }); }}
          currentBalance={userGoals.wallet_balance || 0}
        />
      )}

      {/* ── Galaxy Header ── */}
      <div className="flex items-center justify-between mb-6 gap-3 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(6,182,212,0.25), rgba(124,58,237,0.25))',
                border: '1px solid rgba(6,182,212,0.4)',
                boxShadow: '0 0 20px rgba(6,182,212,0.3)',
              }}
            >
              <span className="text-2xl">🌐</span>
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan-400 border-2 border-slate-950"
              style={{ boxShadow: '0 0 8px #06b6d4', animation: 'pulse-glow 2s ease-in-out infinite' }} />
          </div>
          <div>
            <h1 className="font-orbitron text-base sm:text-xl font-bold tracking-widest text-white text-glow-cyan truncate">VELOCITY</h1>
            <p className="text-xs text-slate-500 tracking-wide">PROFIT ENGINE · Real-time sync</p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" onClick={() => setShowTxForm(true)}
            className="bg-slate-800/80 hover:bg-slate-700 text-white text-xs h-8 gap-1.5 border border-slate-700/60">
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Log Transaction</span>
          </Button>
          <Link to="/Chat">
            <Button size="sm" className="btn-cosmic text-white text-xs h-8 gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">VELOCITY AI</span>
            </Button>
          </Link>
        </div>
      </div>

      <NotificationPermissionBanner />

      {/* Live Metrics */}
      <LiveMetricsBar goals={userGoals} transactions={transactions} opportunities={opportunities} tasks={tasks} />

      {/* Alerts Row */}
      {(failedTasks > 0 || reviewTasks > 0) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {failedTasks > 0 && (
            <Link to="/Execution">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-red-300"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', boxShadow: '0 0 12px rgba(239,68,68,0.2)' }}>
                <AlertTriangle className="w-3.5 h-3.5" />
                {failedTasks} failed task{failedTasks > 1 ? 's' : ''} — click to review
              </div>
            </Link>
          )}
          {reviewTasks > 0 && (
            <Link to="/Execution">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-amber-300"
                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', boxShadow: '0 0 12px rgba(245,158,11,0.2)' }}>
                <Clock className="w-3.5 h-3.5" />
                {reviewTasks} task{reviewTasks > 1 ? 's' : ''} need review
              </div>
            </Link>
          )}
        </div>
      )}

      {/* ── Planet Department Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {DEPT_CARDS.map(({ path, icon: Icon, label, subtitle, color, textColor, glow, planet, statsKey }) => {
          const stat = deptStats[statsKey];
          return (
            <Link key={path} to={path}>
              <div
                className="tilt-card relative rounded-2xl p-4 transition-all cursor-pointer group overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${color}12, ${color}06, rgba(5,7,20,0.8))`,
                  border: `1px solid ${color}25`,
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 30px ${glow}, 0 0 60px ${glow.replace('0.4','0.15')}`; e.currentTarget.style.borderColor = color + '50'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = color + '25'; }}
              >
                {/* Subtle background grid */}
                <div className="absolute inset-0 opacity-5"
                  style={{ backgroundImage: `radial-gradient(circle, ${color} 1px, transparent 1px)`, backgroundSize: '20px 20px' }} />

                <div className="relative">
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                      style={{ background: `${color}18`, border: `1px solid ${color}30` }}
                    >
                      {planet}
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 ${textColor} opacity-0 group-hover:opacity-100 transition-all`} />
                  </div>
                  <p className={`text-2xl font-orbitron font-bold ${textColor} mb-0.5`}
                    style={{ textShadow: `0 0 20px ${color}` }}>
                    {stat.main}
                  </p>
                  <p className="text-xs text-slate-300 font-medium">{stat.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{stat.sub}</p>
                  <div className="mt-3 pt-2.5 border-t" style={{ borderColor: color + '20' }}>
                    <p className={`text-xs font-orbitron font-semibold tracking-wide ${textColor}`}>{label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{subtitle}</p>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Recent Opportunities */}
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2 font-orbitron tracking-wide">
                <span className="text-base">🔭</span>
                Top Active Opportunities
              </h2>
              <Link to="/Discovery" className="text-xs text-amber-400/70 hover:text-amber-400 transition-colors flex items-center gap-1">
                Discovery dept <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {activeOpps.slice(0, 5).map(opp => (
                <Link key={opp.id} to="/Discovery">
                  <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-800/50 transition-colors cursor-pointer">
                    <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white font-medium truncate">{opp.title}</p>
                      <p className="text-xs text-slate-500">{opp.platform} · {opp.category}</p>
                    </div>
                    <span className="text-xs text-emerald-400 font-medium shrink-0">
                      ${opp.profit_estimate_high || 0}
                    </span>
                  </div>
                </Link>
              ))}
              {activeOpps.length === 0 && (
                <div className="text-center py-5">
                  <p className="text-xs text-slate-500 mb-2">No active opportunities</p>
                  <Button
                    size="sm"
                    onClick={() => scanMutation.mutate()}
                    disabled={isScanning}
                    className="bg-amber-600 hover:bg-amber-500 text-white text-xs h-7 gap-1"
                  >
                    <Zap className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
                    {isScanning ? 'Scanning...' : 'Scan Now'}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Active Tasks */}
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2 font-orbitron tracking-wide">
                <span className="text-base">🚀</span>
                Execution Pipeline
              </h2>
              <Link to="/Execution" className="text-xs text-blue-400/70 hover:text-blue-400 transition-colors flex items-center gap-1">
                Execution dept <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {activeTasks.slice(0, 5).map(task => (
                <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/30">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    task.status === 'completed' ? 'bg-emerald-500' :
                    task.status === 'failed' ? 'bg-red-500' :
                    task.status === 'queued' ? 'bg-amber-500' : 'bg-blue-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white font-medium truncate">{task.platform || task.opportunity_type || 'Task'}</p>
                    <p className="text-xs text-slate-500 capitalize">{task.status}</p>
                  </div>
                  {task.estimated_value && task.estimated_value > 0 && (
                    <span className="text-xs text-emerald-400 font-medium">${task.estimated_value}</span>
                  )}
                </div>
              ))}
              {activeTasks.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-4">No active tasks in queue.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <DailyGoalTracker
            target={userGoals.daily_target || 1000}
            earned={todayEarned}
            totalEarned={totalEarned}
            walletBalance={walletBalance}
          />
          <SystemAuditChecker />
          <div className="glass-card rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2 font-orbitron tracking-wide">
              <span className="text-base">✦</span>
              Live Activity
            </h3>
            <ActivityFeed logs={activityLogs} />
          </div>
          <Link to="/GlobalTaskOrchestrator">
            <div className="glass-card rounded-2xl p-4 hover:border-cyan-500/50 transition-colors cursor-pointer">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2 font-orbitron tracking-wide">
                <Workflow className="w-4 h-4 text-cyan-400" />
                Task Orchestration
              </h3>
              <p className="text-xs text-slate-400 mb-3">Create cross-department task dependencies</p>
              <Button size="sm" className="w-full bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/30 text-xs">
                Manage Rules
              </Button>
            </div>
          </Link>
          <N8nMcpPanel />
        </div>
      </div>
    </div>
  );
}