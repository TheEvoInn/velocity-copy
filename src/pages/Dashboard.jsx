import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Target, Zap, TrendingUp, BarChart3, Plus, Search, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

import WalletCard from '../components/dashboard/WalletCard';
import MetricCard from '../components/dashboard/MetricCard';
import OpportunityCard from '../components/dashboard/OpportunityCard';
import ActivityFeed from '../components/dashboard/ActivityFeed';
import UserDataPersistenceMonitor from '../components/persistence/UserDataPersistenceMonitor';
import DailyGoalTracker from '../components/dashboard/DailyGoalTracker';
import ProfitChart from '../components/dashboard/ProfitChart';
import OpportunityDetail from '../components/opportunity/OpportunityDetail';
import TransactionForm from '../components/wallet/TransactionForm';
import OnboardingModal from '../components/onboarding/OnboardingModal';
import DualStreamCard from '../components/autopilot/DualStreamCard';
import AutopilotPanel from '../components/autopilot/AutopilotPanel';
import FinancialOverview from '../components/dashboard/FinancialOverview';
import RealTimeAlertSystem from '../components/scanning/RealTimeAlertSystem';
import OpportunityAnalysisPanel from '../components/scanning/OpportunityAnalysisPanel';
import FinancialDashboard from '../components/financial/FinancialDashboard';
import RiskComplianceDashboard from '../components/risk/RiskComplianceDashboard';
import { usePersistentUserData } from '../hooks/usePersistentUserData';

export default function Dashboard() {
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [showTxForm, setShowTxForm] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { userData } = usePersistentUserData();
  const queryClient = useQueryClient();

  const { data: userGoals = [], isLoading: goalsLoading } = useQuery({
    queryKey: ['userGoals'],
    queryFn: () => base44.entities.UserGoals.list(),
    initialData: [],
  });

  const { data: opportunities = [] } = useQuery({
    queryKey: ['opportunities'],
    queryFn: () => base44.entities.Opportunity.list('-overall_score', 10),
    initialData: [],
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.Transaction.list('-created_date', 50),
    initialData: [],
  });

  const { data: autopilotLogs = [] } = useQuery({
    queryKey: ['autopilotLogs'],
    queryFn: () => base44.entities.ActivityLog.filter({
      action_type: { $in: ['scan', 'opportunity_found', 'alert'] }
    }, '-created_date', 20),
    initialData: [],
  });

  const goals = userGoals[0] || {};
  // Check both database (UserGoals) and persistent user data for onboarding completion
  const hasCompletedOnboarding = userGoals.length > 0 || userData?.onboarding_completed === true;
  const needsOnboarding = !goalsLoading && !hasCompletedOnboarding;

  // Calculate today's earnings split by stream
  const today = new Date().toDateString();
  const todayTxs = transactions.filter(t => t.type === 'income' && new Date(t.created_date).toDateString() === today);
  const todayEarned = todayTxs.reduce((sum, t) => sum + (t.amount || 0), 0);
  const aiEarnedToday = todayTxs.filter(t => t.description?.startsWith('[AI Autopilot]')).reduce((sum, t) => sum + (t.amount || 0), 0);
  const userEarnedToday = todayTxs.filter(t => !t.description?.startsWith('[AI Autopilot]')).reduce((sum, t) => sum + (t.amount || 0), 0);

  const activeOpps = opportunities.filter(o => o.status === 'new' || o.status === 'executing');
  const completedToday = opportunities.filter(o => o.status === 'completed' && new Date(o.updated_date).toDateString() === today).length;

  useEffect(() => {
    if (needsOnboarding) setShowOnboarding(true);
  }, [needsOnboarding]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    // Invalidate query to refresh dashboard with new user data
    queryClient.invalidateQueries({ queryKey: ['userGoals'] });
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {showOnboarding && <OnboardingModal onComplete={handleOnboardingComplete} />}
      {selectedOpp && <OpportunityDetail opportunity={selectedOpp} onClose={() => setSelectedOpp(null)} />}
      {showTxForm && <TransactionForm onClose={() => setShowTxForm(false)} currentBalance={goals.wallet_balance || 0} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Command Center</h1>
          <p className="text-xs text-slate-500 mt-0.5">Real-time profit intelligence</p>
        </div>
        <div className="flex gap-2">
          <Button 
            size="sm" 
            onClick={() => setShowTxForm(true)}
            className="bg-slate-800 hover:bg-slate-700 text-white text-xs h-8"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Log Transaction
          </Button>
          <Link to="/Chat">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8">
              <Zap className="w-3.5 h-3.5 mr-1" /> Ask AI
            </Button>
          </Link>
        </div>
      </div>

      {/* Top Row: Wallet + Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="md:col-span-2 lg:col-span-1">
          <WalletCard 
            balance={goals.wallet_balance || 0} 
            totalEarned={goals.total_earned || 0}
            todayEarned={todayEarned}
          />
        </div>
        <MetricCard icon={Target} label="Active Opps" value={activeOpps.length} sublabel="being tracked" color="amber" />
        <MetricCard icon={TrendingUp} label="Completed Today" value={completedToday} sublabel="opportunities" color="emerald" />
        <MetricCard icon={BarChart3} label="Total Scanned" value={opportunities.length} sublabel="all time" color="blue" />
      </div>

      {/* Dual Stream Progress */}
      {(aiEarnedToday > 0 || userEarnedToday > 0) && (
        <div className="mb-4">
          <DualStreamCard
            aiEarned={aiEarnedToday}
            userEarned={userEarnedToday}
            aiTarget={goals.ai_daily_target || 500}
            userTarget={goals.user_daily_target || 500}
          />
        </div>
      )}

      {/* Autopilot Panel */}
      {goals.id && (
        <div className="mb-4">
          <AutopilotPanel goals={goals} />
        </div>
      )}

      {/* Financial Overview */}
      <div className="mb-4">
        <FinancialOverview goals={goals} transactions={transactions} />
      </div>

      {/* User Data Persistence Monitor */}
      <div className="mb-4">
        <UserDataPersistenceMonitor />
      </div>

      {/* Real-Time Alert System */}
      <div className="mb-4">
        <RealTimeAlertSystem />
      </div>

      {/* Deep Opportunity Analysis */}
      <div className="mb-4">
        <OpportunityAnalysisPanel />
      </div>

      {/* Financial Intelligence Dashboard */}
      <div className="mb-4">
        <FinancialDashboard />
      </div>

      {/* Phase 7: Risk & Compliance Dashboard */}
      <div className="mb-4">
        <RiskComplianceDashboard />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: Chart + Opportunities */}
        <div className="lg:col-span-2 space-y-4">
          <ProfitChart transactions={transactions} />
          
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-400" />
                Top Opportunities
              </h2>
              <Link to="/Opportunities" className="text-xs text-slate-500 hover:text-emerald-400 transition-colors">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeOpps.slice(0, 4).map(opp => (
                <OpportunityCard key={opp.id} opportunity={opp} onClick={() => setSelectedOpp(opp)} />
              ))}
              {activeOpps.length === 0 && (
                <div className="col-span-2 rounded-xl bg-slate-900/60 border border-slate-800 p-8 text-center">
                  <Search className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">No opportunities yet.</p>
                  <p className="text-xs text-slate-600 mt-1">Ask the AI to scan for opportunities.</p>
                  <Link to="/Chat">
                    <Button size="sm" className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs">
                      <Zap className="w-3.5 h-3.5 mr-1" /> Start Scanning
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Goal + Autopilot Activity */}
         <div className="space-y-4">
           <DailyGoalTracker target={goals.daily_target || 1000} earned={todayEarned} />
           <div>
             <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
               <Activity className="w-4 h-4 text-slate-400" />
               Autopilot Activity
             </h3>
             <ActivityFeed logs={autopilotLogs} />
           </div>
         </div>
      </div>
    </div>
  );
}