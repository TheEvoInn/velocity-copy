import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, DollarSign, Zap, User } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

export default function FinancialOverview({ goals = {}, transactions = [] }) {
  const { data: identities = [] } = useQuery({
    queryKey: ['all_identities'],
    queryFn: () => base44.functions.invoke('identityEngine', { action: 'get_all' }),
    select: (res) => res.data?.all_identities || [],
  });

  // Aggregate earnings by identity
  const identityEarnings = identities.reduce((acc, identity) => {
    acc[identity.id] = identity.total_earned || 0;
    return acc;
  }, {});

  // Calculate streams breakdown
  const totalEarned = goals.total_earned || 0;
  const aiEarned = goals.ai_total_earned || 0;
  const userEarned = goals.user_total_earned || 0;

  const streamData = [
    { name: 'AI Autopilot', value: aiEarned, color: '#10b981' },
    { name: 'Manual/User', value: userEarned, color: '#3b82f6' },
  ].filter(s => s.value > 0);

  // Category breakdown from transactions
  const categoryEarnings = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => {
      const cat = t.category || 'Other';
      acc[cat] = (acc[cat] || 0) + (t.amount || 0);
      return acc;
    }, {});

  const categoryData = Object.entries(categoryEarnings)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Projected growth vs targets
  const dailyTarget = goals.daily_target || 1000;
  const today = new Date().toDateString();
  const todayTxs = transactions.filter(t => t.type === 'income' && new Date(t.created_date).toDateString() === today);
  const todayEarned = todayTxs.reduce((sum, t) => sum + (t.amount || 0), 0);
  const progressPct = Math.min((todayEarned / dailyTarget) * 100, 100);

  // Monthly projection
  const thisMonth = new Date().getMonth();
  const thisYear = new Date().getFullYear();
  const monthlyTxs = transactions.filter(t => {
    const d = new Date(t.created_date);
    return t.type === 'income' && d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });
  const monthlyEarned = monthlyTxs.reduce((sum, t) => sum + (t.amount || 0), 0);
  const daysInMonth = new Date(thisYear, thisMonth + 1, 0).getDate();
  const daysPassed = new Date().getDate();
  const projectedMonthly = (monthlyEarned / daysPassed) * daysInMonth;
  const monthlyTarget = dailyTarget * daysInMonth;

  return (
    <div className="space-y-4">
      {/* Total Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl bg-gradient-to-br from-emerald-950/40 to-slate-900/40 border border-emerald-900/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Total Earned</span>
          </div>
          <div className="text-2xl font-bold text-emerald-400">${totalEarned.toFixed(2)}</div>
          <p className="text-xs text-slate-500 mt-1">All time earnings</p>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-violet-950/40 to-slate-900/40 border border-violet-900/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-violet-400" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">AI Generated</span>
          </div>
          <div className="text-2xl font-bold text-violet-400">${aiEarned.toFixed(2)}</div>
          <p className="text-xs text-slate-500 mt-1">{((aiEarned / (totalEarned || 1)) * 100).toFixed(0)}% of total</p>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-blue-950/40 to-slate-900/40 border border-blue-900/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-blue-400" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Manual Earnings</span>
          </div>
          <div className="text-2xl font-bold text-blue-400">${userEarned.toFixed(2)}</div>
          <p className="text-xs text-slate-500 mt-1">{((userEarned / (totalEarned || 1)) * 100).toFixed(0)}% of total</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Stream Breakdown Pie */}
        {streamData.length > 0 && (
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
            <h3 className="text-xs font-semibold text-white mb-3">Income Streams</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={streamData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {streamData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Target Progress */}
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 flex flex-col">
          <h3 className="text-xs font-semibold text-white mb-3">Today's Progress vs Target</h3>
          <div className="flex-1 flex flex-col justify-center">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">Today</span>
                <span className="text-sm font-bold text-emerald-400">${todayEarned.toFixed(2)}</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-slate-500">Target: ${dailyTarget}</span>
                <span className="text-[10px] text-emerald-400 font-semibold">{progressPct.toFixed(0)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Projection */}
      <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-semibold text-white">Monthly Projection</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <div>
            <p className="text-[10px] text-slate-500 mb-1">Earned This Month</p>
            <p className="text-lg font-bold text-amber-400">${monthlyEarned.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 mb-1">Projected Total</p>
            <p className="text-lg font-bold text-blue-400">${projectedMonthly.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 mb-1">Target (${dailyTarget}/day)</p>
            <p className="text-lg font-bold text-slate-300">${monthlyTarget.toFixed(0)}</p>
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Pace vs Target</span>
            <span className="text-xs font-bold text-white">
              {((projectedMonthly / monthlyTarget) * 100).toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all ${
                projectedMonthly >= monthlyTarget
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                  : 'bg-gradient-to-r from-amber-500 to-amber-400'
              }`}
              style={{ width: `${Math.min((projectedMonthly / monthlyTarget) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      {categoryData.length > 0 && (
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
          <h3 className="text-xs font-semibold text-white mb-3">Top Income Categories</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={categoryData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.1)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#64748b" />
              <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
              <Tooltip formatter={(value) => `$${value.toFixed(2)}`} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
              <Bar dataKey="value" fill="#10b981" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}