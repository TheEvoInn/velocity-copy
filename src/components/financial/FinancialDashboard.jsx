import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, BarChart3, PieChart, Download, Eye } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart as RechartsPI, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function FinancialDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [showDetail, setShowDetail] = useState(false);
  const queryClient = useQueryClient();

  // Fetch financial report
  const { data: report, refetch: refetchReport } = useQuery({
    queryKey: ['financialReport'],
    queryFn: async () => {
      const res = await base44.functions.invoke('financialIntelligenceEngine', {
        action: 'generate_financial_report',
        payload: {}
      });
      return res.data;
    },
    refetchInterval: 30000
  });

  // Fetch revenue metrics
  const { data: metrics } = useQuery({
    queryKey: ['revenueMetrics'],
    queryFn: async () => {
      const res = await base44.functions.invoke('financialIntelligenceEngine', {
        action: 'get_revenue_metrics',
        payload: {}
      });
      return res.data?.metrics || {};
    },
    refetchInterval: 60000
  });

  // Fetch platform breakdown
  const { data: breakdown } = useQuery({
    queryKey: ['platformBreakdown'],
    queryFn: async () => {
      const res = await base44.functions.invoke('financialIntelligenceEngine', {
        action: 'get_platform_breakdown',
        payload: {}
      });
      return res.data?.breakdown || {};
    },
    refetchInterval: 60000
  });

  if (!report) {
    return (
      <Card className="bg-slate-900/50 border-slate-700">
        <CardContent className="p-6">
          <p className="text-xs text-slate-500">Loading financial data...</p>
        </CardContent>
      </Card>
    );
  }

  // Prepare chart data
  const platformData = Object.entries(breakdown || {})
    .slice(0, 5)
    .map(([platform, data]) => ({
      name: platform.toUpperCase(),
      value: data.total
    }));

  const streamData = [
    { name: 'AI Earned', value: report.summary.ai_total_earned, color: '#10b981' },
    { name: 'User Earned', value: report.summary.user_total_earned, color: '#3b82f6' }
  ];

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-4">
      {/* Top Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="rounded-lg bg-emerald-950/30 border border-emerald-500/30 p-3">
          <div className="text-emerald-400">Wallet Balance</div>
          <div className="text-xl font-bold text-white mt-1">${report.summary.wallet_balance}</div>
        </div>
        <div className="rounded-lg bg-blue-950/30 border border-blue-500/30 p-3">
          <div className="text-blue-400">Today</div>
          <div className="text-xl font-bold text-white mt-1">${report.today.earned}</div>
        </div>
        <div className="rounded-lg bg-purple-950/30 border border-purple-500/30 p-3">
          <div className="text-purple-400">This Month</div>
          <div className="text-xl font-bold text-white mt-1">${report.month.earned}</div>
        </div>
        <div className="rounded-lg bg-amber-950/30 border border-amber-500/30 p-3">
          <div className="text-amber-400">All Time</div>
          <div className="text-xl font-bold text-white mt-1">${report.summary.total_earned}</div>
        </div>
      </div>

      {/* Revenue Metrics */}
      {metrics && (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Velocity Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-slate-500">Hourly Rate</span>
                <div className="font-bold text-emerald-400">${metrics.velocity?.hourly_rate || 0}/hr</div>
              </div>
              <div>
                <span className="text-slate-500">Daily Rate</span>
                <div className="font-bold text-blue-400">${metrics.velocity?.daily_rate || 0}/day</div>
              </div>
              <div>
                <span className="text-slate-500">Weekly Rate</span>
                <div className="font-bold text-purple-400">${metrics.velocity?.weekly_rate || 0}/week</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Platform Breakdown */}
        {platformData.length > 0 && (
          <Card className="bg-slate-900/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                Earnings by Platform
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={platformData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" style={{ fontSize: '11px' }} />
                  <YAxis stroke="#94a3b8" style={{ fontSize: '11px' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  <Bar dataKey="value" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* AI vs User Stream */}
        {streamData[0].value > 0 || streamData[1].value > 0 ? (
          <Card className="bg-slate-900/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <PieChart className="w-4 h-4 text-emerald-400" />
                Earnings Stream
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <RechartsPI>
                  <Pie data={streamData} dataKey="value" cx="50%" cy="50%" outerRadius={60} label>
                    {streamData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${value}`} />
                </RechartsPI>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1 text-xs">
                {streamData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-400">{item.name}</span>
                    </div>
                    <span className="font-bold">${item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* Category Performance */}
      {Object.keys(report.by_category || {}).length > 0 && (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Performance by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-xs max-h-48 overflow-y-auto">
              {Object.entries(report.by_category)
                .sort((a, b) => b[1].earned - a[1].earned)
                .slice(0, 10)
                .map(([category, data]) => (
                  <div key={category} className="flex items-center justify-between p-2 rounded bg-slate-800/50 border border-slate-700">
                    <div>
                      <div className="capitalize font-medium text-slate-300">{category}</div>
                      <div className="text-slate-500 text-[10px]">{data.count} transactions</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-400">${data.earned}</div>
                      <div className="text-slate-500 text-[10px]">Avg: ${Math.round(data.earned / data.count)}</div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-slate-500">This Week</span>
            <div className="font-bold text-emerald-400">${report.week.earned}</div>
            <div className="text-slate-600 text-[10px]">Avg: ${Math.round(report.week.average_daily)}/day</div>
          </div>
          <div>
            <span className="text-slate-500">Pending Payouts</span>
            <div className="font-bold text-amber-400">${report.pending_payouts}</div>
            <div className="text-slate-600 text-[10px]">In transit</div>
          </div>
          <div>
            <span className="text-slate-500">Tax Liability</span>
            <div className="font-bold text-red-400">${report.tax_liability}</div>
            <div className="text-slate-600 text-[10px]">Estimated</div>
          </div>
          <div>
            <span className="text-slate-500">Transactions</span>
            <div className="font-bold text-blue-400">{report.today.transactions_count}</div>
            <div className="text-slate-600 text-[10px]">Today</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}