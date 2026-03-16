import React, { useMemo } from 'react';
import { TrendingUp, AlertCircle, CheckCircle2, Clock, Target, BarChart3, X } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Button } from '@/components/ui/button';

export default function AdvancedAnalyticsOverlay({ opportunities = [], transactions = [], onClose }) {
  const analytics = useMemo(() => {
    if (!opportunities.length) return { byCategory: {}, overall: {} };

    // Group opportunities by category
    const byCategory = {};
    opportunities.forEach(opp => {
      const cat = opp.category || 'Other';
      if (!byCategory[cat]) {
        byCategory[cat] = {
          total: 0,
          completed: 0,
          failed: 0,
          executing: 0,
          timeToClose: [],
          profitEstimates: [],
          opportunities: []
        };
      }
      byCategory[cat].total++;
      byCategory[cat].opportunities.push(opp);

      if (opp.status === 'completed') {
        byCategory[cat].completed++;
        // Calculate time-to-close
        if (opp.created_date && opp.updated_date) {
          const created = new Date(opp.created_date);
          const updated = new Date(opp.updated_date);
          const hours = (updated - created) / (1000 * 60 * 60);
          if (hours > 0) byCategory[cat].timeToClose.push(hours);
        }
      } else if (opp.status === 'failed' || opp.status === 'expired') {
        byCategory[cat].failed++;
      } else if (opp.status === 'executing') {
        byCategory[cat].executing++;
      }

      // Collect profit estimates
      const profitMid = ((opp.profit_estimate_low || 0) + (opp.profit_estimate_high || 0)) / 2;
      if (profitMid > 0) byCategory[cat].profitEstimates.push(profitMid);
    });

    // Calculate metrics per category
    const categoryMetrics = Object.entries(byCategory).map(([name, data]) => {
      const conversionRate = data.total > 0 ? (data.completed / data.total) * 100 : 0;
      const avgTimeToClose = data.timeToClose.length > 0
        ? data.timeToClose.reduce((a, b) => a + b, 0) / data.timeToClose.length
        : null;
      const avgProfit = data.profitEstimates.length > 0
        ? data.profitEstimates.reduce((a, b) => a + b, 0) / data.profitEstimates.length
        : 0;

      // Success probability scoring: conversion rate (50%), execution rate (30%), profit potential (20%)
      const executionRate = data.total > 0 ? ((data.completed + data.executing) / data.total) * 100 : 0;
      const profitScore = Math.min((avgProfit / 1000) * 100, 100); // normalize to 100
      const successProbability = (conversionRate * 0.5) + (executionRate * 0.3) + (profitScore * 0.2);

      return {
        name,
        total: data.total,
        completed: data.completed,
        failed: data.failed,
        executing: data.executing,
        conversionRate: parseFloat(conversionRate.toFixed(1)),
        avgTimeToClose: avgTimeToClose ? parseFloat(avgTimeToClose.toFixed(1)) : null,
        avgProfit: parseFloat(avgProfit.toFixed(2)),
        successProbability: parseFloat(successProbability.toFixed(1)),
        executionRate: parseFloat(executionRate.toFixed(1)),
        count: data.opportunities.length
      };
    }).sort((a, b) => b.successProbability - a.successProbability);

    // Overall metrics
    const totalOpps = opportunities.length;
    const totalCompleted = opportunities.filter(o => o.status === 'completed').length;
    const overallConversionRate = totalOpps > 0 ? (totalCompleted / totalOpps) * 100 : 0;
    const allTimeToClose = opportunities
      .filter(o => o.status === 'completed' && o.created_date && o.updated_date)
      .map(o => (new Date(o.updated_date) - new Date(o.created_date)) / (1000 * 60 * 60));
    const overallAvgTimeToClose = allTimeToClose.length > 0
      ? allTimeToClose.reduce((a, b) => a + b, 0) / allTimeToClose.length
      : null;

    return {
      byCategory: categoryMetrics,
      overall: {
        total: totalOpps,
        completed: totalCompleted,
        conversionRate: overallConversionRate,
        avgTimeToClose: overallAvgTimeToClose
      }
    };
  }, [opportunities]);

  const chartData = analytics.byCategory.slice(0, 8);

  const getScoreColor = (score) => {
    if (score >= 75) return 'text-emerald-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  const getScoreBg = (score) => {
    if (score >= 75) return 'bg-emerald-950/30 border-emerald-900/30';
    if (score >= 50) return 'bg-amber-950/30 border-amber-900/30';
    return 'bg-red-950/30 border-red-900/30';
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              Advanced Opportunity Analytics
            </h2>
            <p className="text-xs text-slate-500 mt-1">Category performance, conversion history & success probability scoring</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Overall Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-blue-400" />
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Total Opportunities</span>
              </div>
              <p className="text-2xl font-bold text-white">{analytics.overall.total}</p>
            </div>
            <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Completed</span>
              </div>
              <p className="text-2xl font-bold text-emerald-400">{analytics.overall.completed}</p>
              <p className="text-xs text-slate-500 mt-1">{analytics.overall.conversionRate.toFixed(1)}% conversion</p>
            </div>
            <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Avg Time-to-Close</span>
              </div>
              <p className="text-2xl font-bold text-amber-400">
                {analytics.overall.avgTimeToClose ? `${analytics.overall.avgTimeToClose.toFixed(1)}h` : 'N/A'}
              </p>
            </div>
            <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Categories</span>
              </div>
              <p className="text-2xl font-bold text-blue-400">{analytics.byCategory.length}</p>
            </div>
          </div>

          {/* Category Performance Table */}
          <div className="rounded-xl bg-slate-800/30 border border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-white">Category Performance Rankings</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-800/50 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">Completed</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">Conversion %</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">Avg Time-to-Close</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">Avg Profit</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400">Success Score</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.byCategory.map((cat, idx) => (
                    <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-white capitalize">{cat.name}</td>
                      <td className="px-4 py-3 text-slate-400">{cat.total}</td>
                      <td className="px-4 py-3 text-emerald-400 font-semibold">{cat.completed}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1">
                          <span className="text-white font-semibold">{cat.conversionRate}%</span>
                          {cat.conversionRate >= 50 && <TrendingUp className="w-3 h-3 text-emerald-400" />}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-amber-400">
                        {cat.avgTimeToClose ? `${cat.avgTimeToClose}h` : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-blue-400">${cat.avgProfit}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${getScoreColor(cat.successProbability)}`}>
                            {cat.successProbability}
                          </span>
                          <div className="w-16 bg-slate-700 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                cat.successProbability >= 75
                                  ? 'bg-emerald-500'
                                  : cat.successProbability >= 50
                                  ? 'bg-amber-500'
                                  : 'bg-red-500'
                              }`}
                              style={{ width: `${cat.successProbability}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Conversion Rate by Category */}
            <div className="rounded-xl bg-slate-800/30 border border-slate-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Conversion Rate by Category</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.1)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#64748b" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
                  <Tooltip
                    formatter={(value) => `${value.toFixed(1)}%`}
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                  />
                  <Bar dataKey="conversionRate" fill="#10b981" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Success Probability Score */}
            <div className="rounded-xl bg-slate-800/30 border border-slate-800 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Success Probability Score</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.1)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#64748b" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#64748b" domain={[0, 100]} />
                  <Tooltip
                    formatter={(value) => `${value.toFixed(1)}`}
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                  />
                  <Bar dataKey="successProbability" fill="#3b82f6" radius={[8, 8, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.successProbability >= 75
                            ? '#10b981'
                            : entry.successProbability >= 50
                            ? '#f59e0b'
                            : '#ef4444'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Time-to-Close Distribution */}
          <div className="rounded-xl bg-slate-800/30 border border-slate-800 p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Average Time-to-Close (Hours)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.filter(c => c.avgTimeToClose)}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.1)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
                <Tooltip
                  formatter={(value) => `${value.toFixed(1)}h`}
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                />
                <Bar dataKey="avgTimeToClose" fill="#f59e0b" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Insights */}
          <div className="rounded-xl bg-blue-950/20 border border-blue-900/30 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-300 mb-2">AI Filtering Recommendations</p>
                <ul className="space-y-1 text-xs text-blue-200/80">
                  <li>
                    • Prioritize <strong>{analytics.byCategory.slice(0, 3).map(c => c.name).join(', ')}</strong> (highest success scores)
                  </li>
                  <li>
                    • Focus on opportunities with <strong>&gt;50% conversion rate</strong> for faster execution
                  </li>
                  <li>
                    • Average time-to-close across all categories: <strong>{analytics.overall.avgTimeToClose ? `${analytics.overall.avgTimeToClose.toFixed(1)}h` : 'N/A'}</strong>
                  </li>
                  <li>
                    • Current overall conversion rate: <strong>{analytics.overall.conversionRate.toFixed(1)}%</strong>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}