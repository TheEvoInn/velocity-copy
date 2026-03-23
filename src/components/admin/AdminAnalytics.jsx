import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, DollarSign, Target, BarChart3, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function AdminAnalytics() {
  const [period, setPeriod] = useState('today');

  const { data: analyticsData = {}, refetch, isLoading } = useQuery({
    queryKey: ['profitabilityAnalytics', period],
    queryFn: async () => {
      const res = await base44.functions.invoke('profitabilityAnalyticsEngine', { period });
      return res.data?.analytics || {};
    },
    refetchInterval: 60000 // 1 minute
  });

  const {
    totals = {},
    breakdown_by_category = {},
    top_opportunities = [],
    modules = {},
    performance_metrics = {}
  } = analyticsData;

  const chartData = Object.entries(breakdown_by_category).map(([category, amount]) => ({
    name: category.replace('_', ' ').toUpperCase(),
    value: Math.round(amount),
    amount
  }));

  const COLORS = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex gap-2">
        {['today', 'week', 'month', 'all'].map(p => (
          <Button
            key={p}
            size="sm"
            variant={period === p ? 'default' : 'outline'}
            onClick={() => setPeriod(p)}
            className="capitalize"
          >
            {p}
          </Button>
        ))}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => refetch()}
          disabled={isLoading}
          className="gap-1 ml-auto"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500 mb-1">Gross Revenue</p>
            <p className="text-2xl font-bold text-cyan-400">
              ${(totals.gross_revenue || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500 mb-1">Net Revenue</p>
            <p className="text-2xl font-bold text-emerald-400">
              ${(totals.net_revenue || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500 mb-1">Tasks Completed</p>
            <p className="text-2xl font-bold text-violet-400">{totals.completed_tasks || 0}</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500 mb-1">ROI</p>
            <p className={`text-2xl font-bold ${parseFloat(performance_metrics.roi_percentage) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {performance_metrics.roi_percentage || '0'}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue by Category */}
        {chartData.length > 0 && (
          <Card className="bg-slate-900/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> Revenue by Category
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Performance Metrics */}
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4" /> Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-700">
              <p className="text-sm text-slate-400">Avg Task Value</p>
              <p className="font-bold text-cyan-400">${(totals.average_task_value || 0).toFixed(2)}</p>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-700">
              <p className="text-sm text-slate-400">Tasks per Day</p>
              <p className="font-bold text-violet-400">{performance_metrics.tasks_per_day || '0'}</p>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-700">
              <p className="text-sm text-slate-400">Revenue per Task</p>
              <p className="font-bold text-emerald-400">${performance_metrics.revenue_per_task || '0'}</p>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-sm text-slate-400">Expense Ratio</p>
              <p className="font-bold text-orange-400">{performance_metrics.expense_ratio || '0'}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Module Performance */}
      {Object.keys(modules).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Module Performance</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(modules).map(([module, data]) => (
              <Card key={module} className="bg-slate-900/50 border-slate-700">
                <CardContent className="pt-4">
                  <p className="text-xs text-slate-500 mb-2 capitalize font-medium">{module}</p>
                  <div className="space-y-2">
                    {module === 'autopilot' && (
                      <>
                        <p className="text-xs text-slate-400">
                          Tasks: <span className="text-cyan-400 font-bold">{data.completed_tasks}</span>
                        </p>
                        <p className="text-xs text-slate-400">
                          Rate: <span className="text-violet-400 font-bold">{data.execution_rate}%</span>
                        </p>
                      </>
                    )}
                    {module === 'discovery' && (
                      <>
                        <p className="text-xs text-slate-400">
                          Found: <span className="text-cyan-400 font-bold">{data.opportunities_found}</span>
                        </p>
                        <p className="text-xs text-slate-400">
                          Conv: <span className="text-emerald-400 font-bold">{data.conversion_rate}%</span>
                        </p>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Top Opportunities */}
      {top_opportunities.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Top Opportunities</h3>
          <div className="space-y-2">
            {top_opportunities.map((opp) => (
              <Card key={opp.id} className="bg-slate-900/30 border-slate-700">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{opp.title}</p>
                      <p className="text-xs text-slate-500 mt-1 capitalize">{opp.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-400">
                        ${opp.estimated_value.toLocaleString()}
                      </p>
                      <Badge className="mt-1 text-xs bg-violet-600 text-white">
                        {opp.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}