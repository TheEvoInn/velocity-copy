import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { TrendingUp, Activity, AlertCircle, CheckCircle2, Clock, DollarSign } from 'lucide-react';

export default function RealTimeTestingMonitor() {
  const queryClient = useQueryClient();
  const [selectedMetric, setSelectedMetric] = useState('income');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Real user data: fetch live
  const { data: userGoals } = useQuery({
    queryKey: ['userGoals'],
    queryFn: async () => {
      const result = await base44.entities.UserGoals.list('-created_date', 1);
      return result?.[0] || null;
    },
    refetchInterval: autoRefresh ? 5000 : false,
    staleTime: 0,
  });

  const { data: recentTransactions } = useQuery({
    queryKey: ['recentTransactions'],
    queryFn: async () => {
      return await base44.entities.WalletTransaction.filter(
        {},
        '-created_date',
        20
      );
    },
    refetchInterval: autoRefresh ? 10000 : false,
    staleTime: 0,
  });

  const { data: activeOpportunities } = useQuery({
    queryKey: ['activeOpportunities'],
    queryFn: async () => {
      return await base44.entities.Opportunity.filter(
        { status: { $in: ['queued', 'executing', 'submitted'] } },
        '-created_date',
        10
      );
    },
    refetchInterval: autoRefresh ? 8000 : false,
    staleTime: 0,
  });

  const { data: recentActivities } = useQuery({
    queryKey: ['recentActivities'],
    queryFn: async () => {
      return await base44.entities.ActivityLog.filter(
        {},
        '-created_date',
        15
      );
    },
    refetchInterval: autoRefresh ? 7000 : false,
    staleTime: 0,
  });

  const { data: taskQueue } = useQuery({
    queryKey: ['taskQueue'],
    queryFn: async () => {
      return await base44.entities.TaskExecutionQueue.filter(
        { status: { $in: ['queued', 'processing'] } },
        '-priority',
        10
      );
    },
    refetchInterval: autoRefresh ? 6000 : false,
    staleTime: 0,
  });

  const { data: interventions } = useQuery({
    queryKey: ['interventions'],
    queryFn: async () => {
      return await base44.entities.UserIntervention.filter(
        { status: 'pending' },
        '-created_date',
        5
      );
    },
    refetchInterval: autoRefresh ? 10000 : false,
    staleTime: 0,
  });

  // Live metrics calculation
  const metrics = {
    walletBalance: userGoals?.wallet_balance || 0,
    todayEarnings: recentTransactions?.filter(t => {
      const txDate = new Date(t.created_date);
      const today = new Date();
      return txDate.toDateString() === today.toDateString() && t.type === 'earning';
    }).reduce((sum, t) => sum + (t.amount || 0), 0) || 0,
    activeTaskCount: taskQueue?.length || 0,
    completedToday: activeOpportunities?.filter(o => 
      o.status === 'submitted' && 
      new Date(o.submission_timestamp).toDateString() === new Date().toDateString()
    ).length || 0,
    dailyTarget: userGoals?.daily_target || 1000,
    pendingInterventions: interventions?.length || 0,
  };

  const progressPercent = (metrics.todayEarnings / metrics.dailyTarget) * 100;
  const txArray = Array.isArray(recentTransactions) ? recentTransactions : [];
  const oppArray = Array.isArray(activeOpportunities) ? activeOpportunities : [];
  const actArray = Array.isArray(recentActivities) ? recentActivities : [];
  const taskArray = Array.isArray(taskQueue) ? taskQueue : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="font-orbitron text-4xl font-bold text-cyan-300 tracking-wider">
              REAL-TIME TESTING MONITOR
            </h1>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                Auto-Refresh (5s)
              </label>
              <div className={`w-3 h-3 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`} />
            </div>
          </div>
          <p className="text-slate-400 text-sm">Live user execution data • Income tracking • Task monitoring</p>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Today's Income */}
          <div className="glass-card-bright p-6 rounded-xl">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Today's Income</p>
                <p className="text-3xl font-bold text-cyan-300">${metrics.todayEarnings.toFixed(2)}</p>
              </div>
              <DollarSign className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="w-full bg-slate-700/40 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                style={{ width: `${Math.min(progressPercent, 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">${metrics.dailyTarget}/day target • {progressPercent.toFixed(0)}%</p>
          </div>

          {/* Wallet Balance */}
          <div className="glass-card-bright p-6 rounded-xl">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Wallet Balance</p>
                <p className="text-3xl font-bold text-emerald-300">${metrics.walletBalance.toFixed(2)}</p>
              </div>
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-xs text-slate-500 mt-4">Real-time sync enabled</p>
          </div>

          {/* Active Tasks */}
          <div className="glass-card-bright p-6 rounded-xl">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Queued Tasks</p>
                <p className="text-3xl font-bold text-amber-300">{metrics.activeTaskCount}</p>
              </div>
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-xs text-slate-500 mt-4">Awaiting execution</p>
          </div>

          {/* Interventions Pending */}
          <div className="glass-card-bright p-6 rounded-xl">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Pending Actions</p>
                <p className={`text-3xl font-bold ${metrics.pendingInterventions > 0 ? 'text-orange-300' : 'text-green-300'}`}>
                  {metrics.pendingInterventions}
                </p>
              </div>
              {metrics.pendingInterventions > 0 ? (
                <AlertCircle className="w-5 h-5 text-orange-400" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              )}
            </div>
            <p className="text-xs text-slate-500 mt-4">User interventions</p>
          </div>
        </div>

        {/* Main Content Tabs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Task Execution Queue */}
          <div className="lg:col-span-1">
            <div className="glass-card-bright p-6 rounded-xl h-full">
              <h2 className="font-orbitron text-lg font-bold text-cyan-300 mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Execution Queue
              </h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {taskArray.length > 0 ? (
                  taskArray.map(task => (
                    <div key={task.id} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                      <p className="text-sm font-mono text-slate-300 truncate">{task.platform}</p>
                      <p className="text-xs text-slate-500">Priority: {task.priority}</p>
                      <p className="text-xs text-cyan-400 mt-1">Status: {task.status}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 text-center py-4">No queued tasks</p>
                )}
              </div>
            </div>
          </div>

          {/* Middle: Active Opportunities */}
          <div className="lg:col-span-1">
            <div className="glass-card-bright p-6 rounded-xl h-full">
              <h2 className="font-orbitron text-lg font-bold text-amber-300 mb-4">In Progress</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {oppArray.length > 0 ? (
                  oppArray.map(opp => (
                    <div key={opp.id} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                      <p className="text-sm font-medium text-slate-200 truncate">{opp.title}</p>
                      <p className="text-xs text-slate-500">{opp.platform}</p>
                      <div className="flex justify-between mt-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          opp.status === 'submitted' ? 'bg-green-500/20 text-green-300' : 
                          'bg-amber-500/20 text-amber-300'
                        }`}>
                          {opp.status}
                        </span>
                        <span className="text-xs text-cyan-400">${opp.profit_estimate_high}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 text-center py-4">No active opportunities</p>
                )}
              </div>
            </div>
          </div>

          {/* Right: Recent Income */}
          <div className="lg:col-span-1">
            <div className="glass-card-bright p-6 rounded-xl h-full">
              <h2 className="font-orbitron text-lg font-bold text-emerald-300 mb-4">Income Log</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {txArray.length > 0 ? (
                  txArray.map(tx => (
                    <div key={tx.id} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-sm font-medium text-slate-200">{tx.type}</p>
                        <span className={`text-sm font-bold ${tx.type === 'earning' ? 'text-green-400' : 'text-red-400'}`}>
                          {tx.type === 'earning' ? '+' : '-'}${tx.amount?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{tx.source}</p>
                      <p className="text-[10px] text-slate-600 mt-1">
                        {new Date(tx.created_date).toLocaleTimeString()}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 text-center py-4">No income yet</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Activity Log */}
        <div className="mt-6 glass-card-bright p-6 rounded-xl">
          <h2 className="font-orbitron text-lg font-bold text-violet-300 mb-4">Activity Stream</h2>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {actArray.length > 0 ? (
              actArray.map(log => (
                <div key={log.id} className="flex items-start gap-3 p-2 hover:bg-slate-800/20 rounded transition-colors">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    log.severity === 'success' ? 'bg-green-400' :
                    log.severity === 'warning' ? 'bg-orange-400' :
                    log.severity === 'critical' ? 'bg-red-400' :
                    'bg-blue-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300">{log.message}</p>
                    <p className="text-xs text-slate-600">
                      {new Date(log.created_date).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 text-center py-4">No activity yet</p>
            )}
          </div>
        </div>

        {/* Testing Instructions */}
        <div className="mt-8 border border-cyan-500/20 rounded-xl p-6 bg-cyan-500/5">
          <h3 className="font-orbitron text-sm font-bold text-cyan-300 uppercase mb-3">Live Testing Protocol</h3>
          <ul className="text-xs text-slate-300 space-y-2">
            <li>✓ Real user credentials active in Credential Vault</li>
            <li>✓ Live opportunities scanning every 15 minutes (discoveryEngine)</li>
            <li>✓ Income tracking synced in real-time to wallet</li>
            <li>✓ All transactions confirmed with platform records</li>
            <li>✓ Error recovery active (rate-limit, auth, transient)</li>
            <li>✓ User interventions auto-resolve after data submission</li>
            <li className="text-orange-400">⚠ Monitor for rate-limiting → identity rotation triggers</li>
          </ul>
        </div>
      </div>
    </div>
  );
}