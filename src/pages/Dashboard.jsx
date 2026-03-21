/**
 * COMMAND CENTER — Cross-department hub
 * Shows unified real-time status from all 4 departments.
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import {
  useUserGoalsV2,
  useOpportunitiesV2,
  useTasksV2,
  useTransactionsV2,
  useActivityLogsV2,
  useAIIdentitiesV2,
  useWorkflowsV2
} from '@/lib/velocityHooks';
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
  const { goals: userGoals } = useUserGoalsV2();
  const { opportunities } = useOpportunitiesV2();
  const { tasks } = useTasksV2();
  const { transactions } = useTransactionsV2();
  const { logs: activityLogs } = useActivityLogsV2(20);
  const { identities } = useAIIdentitiesV2();
  const { workflows } = useWorkflowsV2();
  
  // Calculate derived metrics
  const todayEarned = transactions
    .filter(t => new Date(t.timestamp || 0).toDateString() === new Date().toDateString())
    .reduce((s, t) => s + (t.value_usd || 0), 0);
  const totalEarned = userGoals.total_earned || 0;
  const walletBalance = userGoals.wallet_balance || 0;
  const activeOpps = opportunities.filter(o => ['new', 'reviewing', 'queued', 'executing'].includes(o.status));
  const activeTasks = tasks.filter(t => ['queued', 'processing', 'navigating', 'filling', 'submitting'].includes(t.status));
  const activeIdentity = identities.find(i => i.is_active);
  const queryClient = useQueryClient();
  useRealtimeNotifications();

  const [showTxForm, setShowTxForm] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Scan market opportunities mutation
  const scanMutation = useMutation({
    mutationFn: async () => {
      setIsScanning(true);
      try {
        const res = await base44.functions.invoke('scanOpportunities', {
          action: 'scan',
          max_results: 10
        });
        return res?.data || {};
      } catch (error) {
        console.error('Scan error:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      setIsScanning(false);
      if (data?.scan?.found > 0) {
        invalidateAll();
        queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      }
    },
    onError: (error) => {
      setIsScanning(false);
      console.error('Scan failed:', error.message);
    }
  });

  // Trigger scan manually when needed
  const handleScan = async () => {
    await scanMutation.mutateAsync();
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries();
  };

  const hasOnboarded = userGoals?.id || userGoals?.onboarded;
  // Auto-show onboarding for new users
  const [showOnboarding, setShowOnboarding] = useState(false);
  React.useEffect(() => {
    if (!hasOnboarded && Object.keys(userGoals).length === 0) {
      const timer = setTimeout(() => setShowOnboarding(true), 800);
      return () => clearTimeout(timer);
    }
  }, [hasOnboarded, userGoals]);
  const today = new Date().toDateString();
  const completedToday = opportunities.filter(o => o.status === 'completed' && new Date(o.updated_date || 0).toDateString() === today).length;
  const failedTasks = tasks.filter(t => t.status === 'failed').length;
  const reviewTasks = tasks.filter(t => t.status === 'needs_review').length;

  // Per-department stat summaries (real-time synced)
  const deptStats = {
    discovery: { 
      main: activeOpps.length, 
      label: 'active opportunities', 
      sub: `${opportunities.length} total discovered` 
    },
    execution: { 
      main: activeTasks.length, 
      label: 'tasks executing', 
      sub: `${completedToday} completed today` 
    },
    finance: { 
      main: `$${todayEarned.toFixed(0)}`, 
      label: 'earned today', 
      sub: `$${walletBalance.toFixed(0)} available` 
    },
    control: { 
      main: identities.length, 
      label: `active identities`, 
      sub: activeIdentity ? `Running: ${activeIdentity.name}` : 'None active' 
    },
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

      {/* ── Planetary Navigation System (with Deep Space) ── */}
      <div className="mt-6">
        <PlanetaryNavWithDeepSpace stats={deptStats} />
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