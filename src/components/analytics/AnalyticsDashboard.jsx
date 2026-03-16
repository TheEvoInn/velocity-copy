import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, Target, Zap, PieChart as PieIcon } from 'lucide-react';
import { toast } from 'sonner';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState(30);
  const [selectedMetric, setSelectedMetric] = useState('earnings');

  // Fetch earnings summary
  const { data: summaryData = {} } = useQuery({
    queryKey: ['earningsSummary', timeRange],
    queryFn: async () => {
      const res = await base44.functions.invoke('analyticsIntelligenceEngine', {
        action: 'get_earnings_summary',
        payload: { days: timeRange }
      });
      return res.data || {};
    },
    refetchInterval: 120000
  });

  // Fetch platform analytics
  const { data: platformData = {} } = useQuery({
    queryKey: ['platformAnalytics', timeRange],
    queryFn: async () => {
      const res = await base44.functions.invoke('analyticsIntelligenceEngine', {
        action: 'get_platform_analytics',
        payload: { days: timeRange, limit: 8 }
      });
      return res.data || {};
    }
  });

  // Fetch trend analysis
  const { data: trendData = {} } = useQuery({
    queryKey: ['trendAnalysis', timeRange],
    queryFn: async () => {
      const res = await base44.functions.invoke('analyticsIntelligenceEngine', {
        action: 'get_trend_analysis',
        payload: { days: timeRange }
      });
      return res.data || {};
    }
  });

  // Fetch ROI metrics
  const { data: roiData = {} } = useQuery({
    queryKey: ['roiMetrics', timeRange],
    queryFn: async () => {
      const res = await base44.functions.invoke('analyticsIntelligenceEngine', {
        action: 'get_roi_metrics',
        payload: { days: timeRange, limit: 10 }
      });
      return res.data || {};
    }
  });

  // Fetch performance attribution
  const { data: attributionData = {} } = useQuery({
    queryKey: ['performanceAttribution', timeRange],
    queryFn: async () => {
      const res = await base44.functions.invoke('analyticsIntelligenceEngine', {
        action: 'get_performance_attribution',
        payload: { days: timeRange }
      });
      return res.data || {};
    }
  });

  // Fetch anomalies
  const { data: anomalyData = {} } = useQuery({
    queryKey: ['anomalies', timeRange],
    queryFn: async () => {
      const res = await base44.functions.invoke('analyticsIntelligenceEngine', {
        action: 'detect_anomalies',
        payload: { days: timeRange, sensitivity: 'medium' }
      });
      return res.data || {};
    }
  });

  // Fetch velocity metrics
  const { data: velocityData = {} } = useQuery({
    queryKey: ['velocityMetrics', timeRange],
    queryFn: async () => {
      const res = await base44.functions.invoke('analyticsIntelligenceEngine', {
        action: 'get_velocity_metrics',
        payload: { window_days: Math.min(timeRange, 7) }
      });
      return res.data || {};
    }
  });

  const attributionChartData = attributionData.total_earnings ? [
    { name: 'AI Autopilot', value: attributionData.ai_earnings, fill: '#3b82f6' },
    { name: 'Manual Work', value: attributionData.user_earnings, fill: '#10b981' }
  ] : [];

  return (
    <div className="space-y-4">
      {/* Header with Time Range */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Analytics & Intelligence</h2>
        <div className="flex gap-2">
          {[7, 14, 30, 90].map(days => (
            <button
              key={days}
              onClick={() => setTimeRange(days)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                timeRange === days
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="text-emerald-400 text-xs mb-1">Total Earnings</div>
            <div className="text-2xl font-bold text-white">${summaryData.total_earnings?.toFixed(0)}</div>
            <div className="text-slate-500 text-[10px] mt-1">{summaryData.transaction_count || 0} transactions</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="text-blue-400 text-xs mb-1">Daily Average</div>
            <div className="text-2xl font-bold text-white">${summaryData.daily_average?.toFixed(0)}</div>
            <div className="text-slate-500 text-[10px] mt-1">Last {timeRange} days</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="text-purple-400 text-xs mb-1">Consistency Score</div>
            <div className="text-2xl font-bold text-white">{summaryData.consistency_score?.toFixed(0)}%</div>
            <div className="text-slate-500 text-[10px] mt-1">Days with income</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-6">
            <div className={`text-xs mb-1 ${trendData.trend_direction === 'upward' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {trendData.trend_direction === 'upward' ? '📈' : '📉'} Trend
            </div>
            <div className="text-2xl font-bold text-white">{trendData.trend_magnitude_pct?.toFixed(1)}%</div>
            <div className="text-slate-500 text-[10px] mt-1">{trendData.trend_direction || 'stable'}</div>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      {trendData.daily_trends && trendData.daily_trends.length > 0 && (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Earnings Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData.daily_trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: '12px' }} />
                <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                  formatter={(value) => `$${value?.toFixed(0)}`}
                />
                <Line 
                  type="monotone" 
                  dataKey="earnings" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Platform Performance + AI vs User Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Platform Analytics */}
        {platformData.platforms && platformData.platforms.length > 0 && (
          <Card className="bg-slate-900/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Top Platforms</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={platformData.platforms}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="platform" stroke="#94a3b8" style={{ fontSize: '11px' }} />
                  <YAxis stroke="#94a3b8" style={{ fontSize: '11px' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                    formatter={(value) => `$${value?.toFixed(0)}`}
                  />
                  <Bar dataKey="total_earnings" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* AI vs User Attribution */}
        {attributionChartData.length > 0 && (
          <Card className="bg-slate-900/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Performance Attribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={attributionChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${(entry.value / attributionData.total_earnings * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {attributionChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${value?.toFixed(0)}`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">AI Autopilot</span>
                  <span className="font-bold text-blue-400">${attributionData.ai_earnings?.toFixed(0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Manual Work</span>
                  <span className="font-bold text-emerald-400">${attributionData.user_earnings?.toFixed(0)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ROI Analysis */}
      {roiData.opportunities && roiData.opportunities.length > 0 && (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-400" />
              ROI Analysis - Top Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {roiData.opportunities.slice(0, 8).map((opp, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30 border border-slate-700/50">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white truncate">{opp.title}</div>
                    <div className="text-[10px] text-slate-500">${opp.capital_required?.toFixed(0)} invested → ${opp.estimated_profit?.toFixed(0)} profit</div>
                  </div>
                  <div className={`text-sm font-bold tabular-nums ${opp.roi_pct > 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {opp.roi_pct.toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Velocity & Anomalies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Velocity Metrics */}
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              Velocity Score
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-400">Weekly Velocity</span>
                <span className="text-lg font-bold text-yellow-400">{velocityData.velocity_score?.toFixed(0)}/100</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-500 transition-all" 
                  style={{ width: `${Math.min(velocityData.velocity_score || 0, 100)}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/30 p-2 rounded-lg">
                <div className="text-slate-500 mb-0.5">Txns/Day</div>
                <div className="font-bold text-white">{velocityData.transactions_per_day?.toFixed(1)}</div>
              </div>
              <div className="bg-slate-800/30 p-2 rounded-lg">
                <div className="text-slate-500 mb-0.5">$/Day</div>
                <div className="font-bold text-emerald-400">${velocityData.earnings_per_day?.toFixed(0)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Anomalies Detected */}
        {anomalyData.anomalies && anomalyData.anomalies.length > 0 && (
          <Card className="bg-slate-900/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                Anomalies ({anomalyData.anomalies_detected || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-40 overflow-y-auto text-xs">
                {anomalyData.anomalies.slice(0, 5).map((anom, idx) => (
                  <div key={idx} className="p-2 rounded-lg bg-red-950/20 border border-red-900/30">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-white font-medium">${anom.amount?.toFixed(0)}</span>
                      <span className="text-red-400">{anom.severity?.toFixed(1)}σ</span>
                    </div>
                    <div className="text-slate-500 text-[9px]">{anom.platform} • {new Date(anom.date).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}