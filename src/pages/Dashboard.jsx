/**
 * COMMAND CENTER — Cross-department hub
 * Shows unified real-time status from all 4 departments.
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useDepartmentSync } from '@/hooks/useDepartmentSync';
import { Zap, Plus, AlertTriangle, Clock, Workflow } from 'lucide-react';
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
import PlanetaryNavWithDeepSpace from '@/components/command-center/PlanetaryNavWithDeepSpace';
import DepartmentActivityRings from '@/components/command-center/DepartmentActivityRings';
import RealtimeOpportunitiesViewer from '@/components/command-center/RealtimeOpportunitiesViewer';
import ExecutionPipelineMonitor from '@/components/command-center/ExecutionPipelineMonitor';
import AIInsightsPanel from '@/components/command-center/AIInsightsPanel';



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

      {/* ── Mission Control HUD ── */}
      <GalaxyCommandHUD
        todayEarned={todayEarned}
        walletBalance={walletBalance}
        activeTasks={activeTasks}
        activeOpps={activeOpps}
        failedTasks={failedTasks}
        reviewTasks={reviewTasks}
      />

      {/* ── Planetary Navigation System ── */}
      <div className="mt-6">
        <PlanetaryNav stats={deptStats} />
      </div>

      {/* ── Department Activity Vitals ── */}
      <div className="mt-6">
        <DepartmentActivityRings
          opportunities={opportunities}
          tasks={tasks}
          transactions={transactions}
          identities={identities}
        />
      </div>

      {/* ── Main Intelligence Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Realtime Opportunities */}
          <RealtimeOpportunitiesViewer opportunities={activeOpps} />

          {/* Execution Pipeline */}
          <ExecutionPipelineMonitor tasks={activeTasks} />
        </div>

        {/* Right Intelligence Column */}
        <div className="space-y-4">
          <DailyGoalTracker
            target={userGoals.daily_target || 1000}
            earned={todayEarned}
            totalEarned={totalEarned}
            walletBalance={walletBalance}
          />
          <SystemAuditChecker />
          <AIInsightsPanel />
          <div className="glass-card rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2 font-orbitron tracking-wide">
              <span className="text-base">✦</span>
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