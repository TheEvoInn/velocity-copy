import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, DollarSign, Zap, User, Clock, Play, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

export default function FinancialOverview({ goals = {} }) {
  // Live transactions
  const { data: transactions = [], refetch: refetchTx } = useQuery({
    queryKey: ['financial_overview_transactions'],
    queryFn: () => base44.entities.Transaction.list('-created_date', 500),
    refetchInterval: 15000,
  });

  // Live opportunities across all statuses
  const { data: opportunities = [] } = useQuery({
    queryKey: ['financial_overview_opportunities'],
    queryFn: () => base44.entities.Opportunity.list('-created_date', 200),
    refetchInterval: 10000,
  });

  // Live task execution queue
  const { data: tasks = [] } = useQuery({
    queryKey: ['financial_overview_tasks'],
    queryFn: () => base44.entities.TaskExecutionQueue.list('-created_date', 200),
    refetchInterval: 10000,
  });

  // ---- Earnings aggregations ----
  const incomeTransactions = transactions.filter(t => t.type === 'income');
  const totalEarned = incomeTransactions.reduce((sum, t) => sum + (t.net_amount ?? t.amount ?? 0), 0);

  const today = new Date().toDateString();
  const todayEarned = incomeTransactions
    .filter(t => new Date(t.created_date).toDateString() === today)
    .reduce((sum, t) => sum + (t.net_amount ?? t.amount ?? 0), 0);

  const thisMonth = new Date().getMonth();
  const thisYear = new Date().getFullYear();
  const monthlyEarned = incomeTransactions
    .filter(t => {
      const d = new Date(t.created_date);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    })
    .reduce((sum, t) => sum + (t.net_amount ?? t.amount ?? 0), 0);

  const daysPassed = new Date().getDate();
  const daysInMonth = new Date(thisYear, thisMonth + 1, 0).getDate();
  const projectedMonthly = daysPassed > 0 ? (monthlyEarned / daysPassed) * daysInMonth : 0;

  const dailyTarget = goals.daily_target || 1000;
  const monthlyTarget = dailyTarget * daysInMonth;
  const progressPct = Math.min((todayEarned / dailyTarget) * 100, 100);

  // AI vs Manual split (use goals data, fallback to platform split)
  const aiEarned = goals.ai_total_earned || 0;
  const userEarned = goals.user_total_earned || 0;

  // ---- Opportunity pipeline ----
  const oppQueued = opportunities.filter(o => o.status === 'queued').length;
  const oppExecuting = opportunities.filter(o => ['executing', 'reviewing'].includes(o.status)).length;
  const oppSubmitted = opportunities.filter(o => o.status === 'submitted').length;
  const oppCompleted = opportunities.filter(o => o.status === 'completed').length;
  const oppFailed = opportunities.filter(o => ['failed', 'expired', 'dismissed'].includes(o.status)).length;

  // Estimated pipeline value (queued + executing)
  const pipelineValue = opportunities
    .filter(o => ['queued', 'executing', 'reviewing', 'submitted'].includes(o.status))
    .reduce((sum, o) => sum + ((o.profit_estimate_low + o.profit_estimate_high) / 2 || 0), 0);

  // ---- Task execution queue ----
  const taskQueued = tasks.filter(t => t.status === 'queued').length;
  const taskProcessing = tasks.filter(t => ['processing', 'navigating', 'filling', 'submitting'].includes(t.status)).length;
  const taskCompleted = tasks.filter(t => t.status === 'completed').length;
  const taskFailed = tasks.filter(t => ['failed', 'needs_review'].includes(t.status)).length;

  // ---- Charts ----
  const streamData = [
    { name: 'AI Autopilot', value: aiEarned, color: '#10b981' },
    { name: 'Manual', value: userEarned, color: '#3b82f6' },
  ].filter(s => s.value > 0);

  const categoryEarnings = incomeTransactions.reduce((acc, t) => {
    const cat = t.category || 'Other';
    acc[cat] = (acc[cat] || 0) + (t.net_amount ?? t.amount ?? 0);
    return acc;
  }, {});
  const categoryData = Object.entries(categoryEarnings)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const pipelineData = [
    { name: 'Queued', value: oppQueued, color: '#3b82f6' },
    { name: 'Executing', value: oppExecuting, color: '#a78bfa' },
    { name: 'Submitted', value: oppSubmitted, color: '#f59e0b' },
    { name: 'Completed', value: oppCompleted, color: '#10b981' },
    { name: 'Failed', value: oppFailed, color: '#f87171' },
  ].filter(s => s.value > 0);

  return (
    <div className="space-y-4">
      {/* Top Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl bg-gradient-to-br from-emerald-950/40 to-slate-900/40 border border-emerald-900/30 p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Total Earned</span>
          </div>
          <div className="text-2xl font-bold text-emerald-400">${totalEarned.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <p className="text-xs text-slate-500 mt-1">{incomeTransactions.length} transactions</p>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-blue-950/40 to-slate-900/40 border border-blue-900/30 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Today</span>
          </div>
          <div className="text-2xl font-bold text-blue-400">${todayEarned.toFixed(2)}</div>
          <div className="mt-2">
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div className="bg-blue-500 h-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">{progressPct.toFixed(0)}% of ${dailyTarget} target</p>
          </div>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-violet-950/40 to-slate-900/40 border border-violet-900/30 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">This Month</span>
          </div>
          <div className="text-2xl font-bold text-violet-400">${monthlyEarned.toFixed(2)}</div>
          <p className="text-xs text-slate-500 mt-1">Proj: ${projectedMonthly.toFixed(0)}</p>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-amber-950/40 to-slate-900/40 border border-amber-900/30 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Play className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Pipeline Value</span>
          </div>
          <div className="text-2xl font-bold text-amber-400">${pipelineValue.toFixed(0)}</div>
          <p className="text-xs text-slate-500 mt-1">in active queue</p>
        </div>
      </div>

      {/* Opportunity Pipeline Status */}
      <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
        <h3 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          Opportunity Pipeline — Live
        </h3>
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: 'Queued', count: oppQueued, icon: Clock, color: 'text-blue-400', bg: 'bg-blue-950/30 border-blue-900/30' },
            { label: 'Executing', count: oppExecuting, icon: Play, color: 'text-purple-400', bg: 'bg-purple-950/30 border-purple-900/30' },
            { label: 'Submitted', count: oppSubmitted, icon: Zap, color: 'text-amber-400', bg: 'bg-amber-950/30 border-amber-900/30' },
            { label: 'Completed', count: oppCompleted, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-950/30 border-emerald-900/30' },
            { label: 'Failed', count: oppFailed, icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-950/30 border-red-900/30' },
          ].map(({ label, count, icon: Icon, color, bg }) => (
            <div key={label} className={`rounded-lg border p-3 text-center ${bg}`}>
              <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
              <div className={`text-xl font-bold ${color}`}>{count}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Task Execution Queue Status */}
      <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
        <h3 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-slate-400" />
          Task Execution Queue — Live
        </h3>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Queued', count: taskQueued, color: 'text-blue-400', bar: 'bg-blue-500' },
            { label: 'Processing', count: taskProcessing, color: 'text-amber-400', bar: 'bg-amber-500' },
            { label: 'Completed', count: taskCompleted, color: 'text-emerald-400', bar: 'bg-emerald-500' },
            { label: 'Review / Failed', count: taskFailed, color: 'text-red-400', bar: 'bg-red-500' },
          ].map(({ label, count, color, bar }) => {
            const total = taskQueued + taskProcessing + taskCompleted + taskFailed || 1;
            return (
              <div key={label} className="rounded-lg bg-slate-800/50 border border-slate-700 p-3">
                <div className={`text-2xl font-bold ${color}`}>{count}</div>
                <div className="text-[10px] text-slate-500 mb-2">{label}</div>
                <div className="w-full bg-slate-700 rounded-full h-1 overflow-hidden">
                  <div className={`${bar} h-full transition-all`} style={{ width: `${(count / total) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pipelineData.length > 0 && (
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
            <h3 className="text-xs font-semibold text-white mb-3">Opportunity Status Mix</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pipelineData} cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={2} dataKey="value">
                  {pipelineData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => v} />
                <Legend wrapperStyle={{ paddingTop: '8px', fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {streamData.length > 0 && (
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
            <h3 className="text-xs font-semibold text-white mb-3">Income Streams</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={streamData} cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={2} dataKey="value">
                  {streamData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `$${v.toFixed(2)}`} />
                <Legend wrapperStyle={{ paddingTop: '8px', fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Category Breakdown */}
      {categoryData.length > 0 && (
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
          <h3 className="text-xs font-semibold text-white mb-3">Earnings by Category</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={categoryData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.1)" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#64748b" />
              <YAxis tick={{ fontSize: 10 }} stroke="#64748b" tickFormatter={(v) => `$${v}`} />
              <Tooltip
                formatter={(v) => `$${v.toFixed(2)}`}
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', fontSize: 11 }}
              />
              <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Monthly Projection */}
      <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-semibold text-white">Monthly Projection</h3>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <p className="text-[10px] text-slate-500 mb-1">Earned This Month</p>
            <p className="text-lg font-bold text-amber-400">${monthlyEarned.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 mb-1">Projected Total</p>
            <p className="text-lg font-bold text-blue-400">${projectedMonthly.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 mb-1">Monthly Target</p>
            <p className="text-lg font-bold text-slate-300">${monthlyTarget.toFixed(0)}</p>
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Pace vs Target</span>
            <span className="text-xs font-bold text-white">
              {monthlyTarget > 0 ? ((projectedMonthly / monthlyTarget) * 100).toFixed(0) : 0}%
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all ${projectedMonthly >= monthlyTarget ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-amber-500 to-amber-400'}`}
              style={{ width: `${Math.min((projectedMonthly / (monthlyTarget || 1)) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}