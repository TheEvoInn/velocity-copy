import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DollarSign, TrendingUp, Wallet, ArrowUpRight, ArrowDownLeft, Zap, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function VeloFinanceCommand() {
  const { user } = useAuth();
  const qc = useQueryClient();
  // Note: real-time sync handled by useIdentitySyncAcrossApp in AppLayout — no duplicate needed here.

  const [filterType, setFilterType] = useState('all');

  // Fetch user goals (financial data + daily target + AI/user split)
  const { data: goals } = useQuery({
    queryKey: ['userGoals', user?.email],
    queryFn: () => base44.entities.UserGoals.filter({ created_by: user?.email }, '-created_date', 1).then(r => r[0]),
    enabled: !!user?.email,
  });

  // Fetch all transactions — sorted newest first
  const { data: transactions = [], isLoading: loadingTransactions } = useQuery({
    queryKey: ['transactions', user?.email],
    queryFn: () => base44.entities.Transaction.filter({ created_by: user?.email }, '-created_date', 200),
    enabled: !!user?.email,
  });

  // Fetch earning goals — active first
  const { data: earningGoals = [] } = useQuery({
    queryKey: ['earningGoals', user?.email],
    queryFn: () => base44.entities.EarningGoal.filter({ created_by: user?.email }, '-created_date', 20),
    enabled: !!user?.email,
  });

  // All derived financial metrics — memoized to avoid recalculating on every render
  const metrics = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income');
    const todayStr = new Date().toDateString();
    const totalIncome = income.reduce((sum, t) => sum + (t.net_amount || t.amount || 0), 0);
    const todayEarnings = income
      .filter(t => new Date(t.created_date).toDateString() === todayStr)
      .reduce((sum, t) => sum + (t.net_amount || t.amount || 0), 0);
    const dailyTarget = goals?.daily_target || 0;
    return {
      totalEarned: goals?.total_earned || 0,
      walletBalance: goals?.wallet_balance || 0,
      dailyTarget,
      aiTotalEarned: goals?.ai_total_earned || 0,
      userTotalEarned: goals?.user_total_earned || 0,
      totalIncome,
      todayEarnings,
      dailyProgress: dailyTarget > 0 ? Math.min(100, (todayEarnings / dailyTarget) * 100) : 0,
    };
  }, [transactions, goals]);

  const filteredTransactions = useMemo(() =>
    filterType === 'all' ? transactions : transactions.filter(t => t.type === filterType),
    [transactions, filterType]
  );

  const currentGoal = useMemo(() => earningGoals.find(g => g.status === 'active'), [earningGoals]);

  const { totalEarned, walletBalance, dailyTarget, aiTotalEarned, userTotalEarned, totalIncome, todayEarnings, dailyProgress } = metrics;

  // Real-time sync is handled globally by useIdentitySyncAcrossApp in AppLayout.
  // EarningGoal subscription is not covered there — add it here only.
  useEffect(() => {
    if (!user?.email) return;
    const unsub = base44.entities.EarningGoal.subscribe(() => {
      qc.invalidateQueries({ queryKey: ['earningGoals', user?.email] });
    });
    return unsub;
  }, [user?.email, qc]);

  return (
    <div className="min-h-screen pt-20 pb-8 px-4 md:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="space-y-2">
          <h1 className="font-orbitron text-4xl font-bold text-white flex items-center gap-3">
            <DollarSign className="w-10 h-10 text-emerald-400" />
            VELO Finance Command
          </h1>
          <p className="text-slate-400">Real-time financial dashboard, earnings, and transaction hub</p>
        </div>

        {/* Daily Target Progress */}
        {dailyTarget > 0 && (
          <Card className="glass-card border-amber-500/20">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Today's Progress vs Daily Target</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-amber-400">${todayEarnings.toFixed(2)}</span>
                    <span className="text-slate-500 text-sm">/ ${dailyTarget.toFixed(0)} target</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-orbitron font-bold" style={{ color: dailyProgress >= 100 ? '#10b981' : '#fbbf24' }}>
                    {dailyProgress.toFixed(0)}%
                  </div>
                </div>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${dailyProgress}%`, background: dailyProgress >= 100 ? 'linear-gradient(90deg, #10b981, #06b6d4)' : 'linear-gradient(90deg, #fbbf24, #f97316)' }} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Primary KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Wallet Balance */}
          <Card className="glass-card border-cyan-500/30 md:col-span-1">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Wallet Balance</div>
                  <div className="text-4xl font-bold text-cyan-400">${walletBalance.toFixed(2)}</div>
                </div>
                <Wallet className="w-8 h-8 text-cyan-400/50" />
              </div>
              <p className="text-xs text-slate-500">Immediately available for withdrawal or reinvestment</p>
            </CardContent>
          </Card>

          {/* Total Earned (All-time) */}
          <Card className="glass-card border-emerald-500/30">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Total Earned</div>
                  <div className="text-4xl font-bold text-emerald-400">${totalEarned.toFixed(2)}</div>
                </div>
                <TrendingUp className="w-8 h-8 text-emerald-400/50" />
              </div>
              <p className="text-xs text-slate-500">All-time lifetime earnings (VELO + Manual)</p>
            </CardContent>
          </Card>

          {/* Period Earnings */}
          <Card className="glass-card border-amber-500/30">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Period Earnings</div>
                  <div className="text-4xl font-bold text-amber-400">${totalIncome.toFixed(2)}</div>
                </div>
                <Zap className="w-8 h-8 text-amber-400/50" />
              </div>
              <p className="text-xs text-slate-500">Earnings this period (active transactions)</p>
            </CardContent>
          </Card>
        </div>

        {/* AI vs User Earnings Split */}
        {(aiTotalEarned > 0 || userTotalEarned > 0) && (
          <div className="grid grid-cols-2 gap-4">
            <Card className="glass-card border-cyan-500/20">
              <CardContent className="p-4">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">AI Generated</div>
                <div className="text-2xl font-bold text-cyan-400">${aiTotalEarned.toFixed(2)}</div>
                <div className="text-xs text-slate-600 mt-1">Autonomous — APEX engine</div>
              </CardContent>
            </Card>
            <Card className="glass-card border-violet-500/20">
              <CardContent className="p-4">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">User Generated</div>
                <div className="text-2xl font-bold text-violet-400">${userTotalEarned.toFixed(2)}</div>
                <div className="text-xs text-slate-600 mt-1">Manual completion</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Active Goal Status */}
        {currentGoal && (
          <Card className="glass-card border-violet-500/30">
            <CardHeader>
              <CardTitle className="text-violet-400">Active Earning Goal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white">{currentGoal.period}</span>
                  <span className="text-sm font-bold text-white">
                    ${currentGoal.current_amount || 0} / ${currentGoal.target_amount}
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-violet-500 to-cyan-500 h-full transition-all"
                    style={{ width: `${Math.min(100, ((currentGoal.current_amount || 0) / currentGoal.target_amount) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="text-slate-500 mb-1">Start Date</div>
                  <div className="text-white font-semibold">{currentGoal.start_date}</div>
                </div>
                <div>
                  <div className="text-slate-500 mb-1">End Date</div>
                  <div className="text-white font-semibold">{currentGoal.end_date}</div>
                </div>
                <div>
                  <div className="text-slate-500 mb-1">Status</div>
                  <div className="text-emerald-400 font-semibold">{currentGoal.status}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Tabs */}
        <Tabs defaultValue="transactions" className="space-y-4">
          <TabsList className="glass-card">
            <TabsTrigger value="transactions">Transactions ({transactions.length})</TabsTrigger>
            <TabsTrigger value="breakdown">Income Breakdown</TabsTrigger>
            <TabsTrigger value="goals">Earning Goals</TabsTrigger>
            <TabsTrigger value="payouts">Payouts & Withdrawals</TabsTrigger>
          </TabsList>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-4">
            <div className="flex gap-2 mb-4">
              {['all', 'income', 'expense', 'transfer'].map(type => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    filterType === type
                      ? 'bg-violet-500 text-white'
                      : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
                  }`}
                >
                  {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>

            {loadingTransactions ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
              </div>
            ) : filteredTransactions.length === 0 ? (
              <Card className="glass-card text-center py-12">
                <DollarSign className="w-12 h-12 text-slate-600 mx-auto mb-4 opacity-50" />
                <p className="text-slate-400">No transactions found.</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredTransactions.map(tx => (
                  <Card key={tx.id} className="glass-card hover:border-slate-600/50 transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            tx.type === 'income' ? 'bg-emerald-500/20' : 'bg-red-500/20'
                          }`}>
                            {tx.type === 'income' ? (
                              <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                            ) : (
                              <ArrowUpRight className="w-5 h-5 text-red-400" />
                            )}
                          </div>
                          <div>
                            <div className="text-white font-semibold">{tx.description || tx.category}</div>
                            <div className="text-xs text-slate-500">{tx.platform || '—'}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-bold ${
                            tx.type === 'income' ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {tx.type === 'income' ? '+' : '-'}${(tx.net_amount || tx.amount || 0).toFixed(2)}
                          </div>
                          <div className="text-xs text-slate-500">
                            {tx.payout_status && `[${tx.payout_status}]`}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Breakdown Tab */}
          <TabsContent value="breakdown" className="space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Income by Category</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {['arbitrage', 'service', 'lead_gen', 'digital_flip', 'freelance', 'resale', 'other'].map(category => {
                  const catIncome = transactions
                    .filter(t => t.type === 'income' && t.category === category)
                    .reduce((sum, t) => sum + (t.net_amount || t.amount || 0), 0);
                  
                  if (catIncome === 0) return null;
                  
                  return (
                    <div key={category}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-white capitalize">{category.replace('_', ' ')}</span>
                        <span className="text-sm font-bold text-cyan-400">${catIncome.toFixed(2)}</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-cyan-500 h-full transition-all"
                          style={{ width: `${(catIncome / totalIncome) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Goals Tab */}
          <TabsContent value="goals" className="space-y-4">
            {earningGoals.length === 0 ? (
              <Card className="glass-card text-center py-12">
                <p className="text-slate-400">No earning goals set.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {earningGoals.map(goal => (
                  <Card key={goal.id} className="glass-card">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-semibold text-white capitalize">{goal.period} Goal</div>
                          <div className="text-xs text-slate-500">${goal.current_amount || 0} / ${goal.target_amount}</div>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded ${
                          goal.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                          goal.status === 'active' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-slate-500/20 text-slate-400'
                        }`}>
                          {goal.status?.toUpperCase()}
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-full"
                          style={{ width: `${Math.min(100, ((goal.current_amount || 0) / goal.target_amount) * 100)}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Payouts Tab */}
          <TabsContent value="payouts" className="space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-400" />
                  Payout Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {transactions.filter(t => t.payout_status && t.payout_status !== 'cleared').length === 0 ? (
                  <p className="text-slate-400 text-sm">All payouts cleared.</p>
                ) : (
                  <div className="space-y-2">
                    {transactions
                      .filter(t => t.payout_status && t.payout_status !== 'cleared')
                      .map(tx => (
                        <div key={tx.id} className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
                          <div className="flex items-center justify-between">
                            <span className="text-white text-sm">{tx.description || tx.category}</span>
                            <span className={`text-xs font-bold ${
                              tx.payout_status === 'in_transit' ? 'text-cyan-400' : 'text-amber-400'
                            }`}>
                              {tx.payout_status?.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}