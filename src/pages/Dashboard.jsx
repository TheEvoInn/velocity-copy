/**
 * COMMAND CENTER — Cross-department hub
 * Shows unified real-time status from all 4 departments.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { useDepartmentSync } from '@/hooks/useDepartmentSync';
import { LayoutDashboard, Telescope, Cpu, Landmark, SlidersHorizontal, Zap, Target, TrendingUp, Bot, Activity, ChevronRight, Plus, DollarSign, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
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

const DEPT_CARDS = [
  {
    path: '/Discovery',
    icon: Telescope,
    label: 'Discovery',
    subtitle: 'Intelligence & scanning',
    color: 'text-amber-400',
    border: 'border-amber-500/25',
    bg: 'bg-amber-950/20 hover:bg-amber-950/30',
    badge: 'bg-amber-500',
    statsKey: 'discovery',
  },
  {
    path: '/Execution',
    icon: Cpu,
    label: 'Execution',
    subtitle: 'Automation & tasks',
    color: 'text-blue-400',
    border: 'border-blue-500/25',
    bg: 'bg-blue-950/20 hover:bg-blue-950/30',
    badge: 'bg-blue-500',
    statsKey: 'execution',
  },
  {
    path: '/Finance',
    icon: Landmark,
    label: 'Finance',
    subtitle: 'Wallet & compliance',
    color: 'text-emerald-400',
    border: 'border-emerald-500/25',
    bg: 'bg-emerald-950/20 hover:bg-emerald-950/30',
    badge: 'bg-emerald-500',
    statsKey: 'finance',
  },
  {
    path: '/Control',
    icon: SlidersHorizontal,
    label: 'Control',
    subtitle: 'Identities & settings',
    color: 'text-purple-400',
    border: 'border-purple-500/25',
    bg: 'bg-purple-950/20 hover:bg-purple-950/30',
    badge: 'bg-purple-500',
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

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showTxForm, setShowTxForm] = useState(false);

  const hasOnboarded = userGoals.id || userGoals.onboarded;
  const today = new Date().toDateString();
  const completedToday = opportunities.filter(o => o.status === 'completed' && new Date(o.updated_date).toDateString() === today).length;
  const failedTasks = tasks.filter(t => t.status === 'failed').length;
  const reviewTasks = tasks.filter(t => t.status === 'needs_review').length;

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

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/30 to-blue-500/30 border border-slate-700 flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Command Center</h1>
            <p className="text-xs text-slate-500">All departments · Real-time sync</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setShowTxForm(true)}
            className="bg-slate-800 hover:bg-slate-700 text-white text-xs h-8 gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Log Transaction
          </Button>
          <Link to="/Chat">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 gap-1.5">
              <Zap className="w-3.5 h-3.5" /> AI Assistant
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
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-950/30 border border-red-500/25 rounded-lg text-xs text-red-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                {failedTasks} failed task{failedTasks > 1 ? 's' : ''} — click to review
              </div>
            </Link>
          )}
          {reviewTasks > 0 && (
            <Link to="/Execution">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-950/30 border border-amber-500/25 rounded-lg text-xs text-amber-400">
                <Clock className="w-3.5 h-3.5" />
                {reviewTasks} task{reviewTasks > 1 ? 's' : ''} need review
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Department Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {DEPT_CARDS.map(({ path, icon: Icon, label, subtitle, color, border, bg, statsKey }) => {
          const stat = deptStats[statsKey];
          return (
            <Link key={path} to={path}>
              <div className={`${bg} border ${border} rounded-xl p-4 transition-all cursor-pointer group`}>
                <div className="flex items-center justify-between mb-3">
                  <Icon className={`w-5 h-5 ${color}`} />
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                </div>
                <p className={`text-2xl font-bold ${color} mb-0.5`}>{stat.main}</p>
                <p className="text-xs text-white font-medium">{stat.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{stat.sub}</p>
                <div className="mt-3 pt-3 border-t border-slate-800/50">
                  <p className="text-xs font-semibold text-slate-300">{label}</p>
                  <p className="text-xs text-slate-500">{subtitle}</p>
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
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-400" />
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
                  <Link to="/Chat">
                    <Button size="sm" className="bg-amber-600 hover:bg-amber-500 text-white text-xs h-7 gap-1">
                      <Zap className="w-3 h-3" /> Scan Now
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Active Tasks */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-blue-400" />
                Execution Pipeline
              </h2>
              <Link to="/Execution" className="text-xs text-blue-400/70 hover:text-blue-400 transition-colors flex items-center gap-1">
                Execution dept <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {tasks.slice(0, 5).map(task => (
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
                  {task.estimated_value > 0 && (
                    <span className="text-xs text-emerald-400 font-medium">${task.estimated_value}</span>
                  )}
                </div>
              ))}
              {tasks.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-4">No tasks in queue.</p>
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
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-400" />
              Live Activity
            </h3>
            <ActivityFeed logs={activityLogs} />
          </div>
          <N8nMcpPanel />
        </div>
      </div>
    </div>
  );
}