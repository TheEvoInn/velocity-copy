import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Clock, TrendingUp, Activity, AlertTriangle, Zap } from 'lucide-react';

export default function PlatformReadinessDashboard() {
  const [timeRange, setTimeRange] = useState('24h'); // 24h, 7d, 30d

  // Fetch platform state
  const { data: platformState } = useQuery({
    queryKey: ['platformState'],
    queryFn: async () => {
      const states = await base44.asServiceRole.entities.PlatformState.list().catch(() => []);
      return states[0] || null;
    },
    refetchInterval: 30000 // Refresh every 30s
  });

  // Fetch system metrics
  const { data: metrics = [] } = useQuery({
    queryKey: ['systemMetrics', timeRange],
    queryFn: async () => {
      const cutoff = new Date();
      if (timeRange === '24h') cutoff.setHours(cutoff.getHours() - 24);
      else if (timeRange === '7d') cutoff.setDate(cutoff.getDate() - 7);
      else if (timeRange === '30d') cutoff.setDate(cutoff.getDate() - 30);

      const allMetrics = await base44.asServiceRole.entities.SystemMetrics.filter(
        { timestamp: { $gte: cutoff.toISOString() } },
        '-timestamp',
        500
      ).catch(() => []);
      return Array.isArray(allMetrics) ? allMetrics : [];
    },
    refetchInterval: 30000
  });

  // Fetch automations
  const { data: automations = [] } = useQuery({
    queryKey: ['automations'],
    queryFn: async () => {
      const list = await base44.asServiceRole.entities.Automation.list().catch(() => []);
      return Array.isArray(list) ? list : [];
    },
    refetchInterval: 60000
  });

  // Calculate metrics summary
  const healthMetrics = metrics.filter(m => m.metric_type === 'health_check');
  const apiMetrics = metrics.filter(m => m.metric_type === 'api_status');
  const taskMetrics = metrics.filter(m => m.metric_type === 'task_execution');
  const credentialMetrics = metrics.filter(m => m.metric_type === 'credential_health');

  const healthyApis = apiMetrics.filter(m => m.status === 'healthy').length;
  const totalApis = apiMetrics.length;
  const apiReliability = totalApis > 0 ? ((healthyApis / totalApis) * 100).toFixed(0) : 'N/A';

  const avgTaskSuccess = taskMetrics.length > 0
    ? (taskMetrics.reduce((sum, m) => sum + (m.success_rate || 0), 0) / taskMetrics.length).toFixed(0)
    : 'N/A';

  const activeAutomations = automations.filter(a => a.is_active && !a.is_archived).length;
  const failedAutomations = automations.filter(a => a.last_run_status === 'failed').length;

  const getStatusColor = (status) => {
    if (status === 'healthy') return 'bg-emerald-500/20 text-emerald-700';
    if (status === 'degraded') return 'bg-amber-500/20 text-amber-700';
    if (status === 'failed') return 'bg-red-500/20 text-red-700';
    return 'bg-slate-500/20 text-slate-700';
  };

  const getStatusIcon = (status) => {
    if (status === 'healthy') return <CheckCircle className="w-5 h-5 text-emerald-600" />;
    if (status === 'degraded') return <AlertTriangle className="w-5 h-5 text-amber-600" />;
    if (status === 'failed') return <AlertCircle className="w-5 h-5 text-red-600" />;
    return <Clock className="w-5 h-5 text-slate-600" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-orbitron font-bold text-cyber-cyan mb-2">Platform Readiness Dashboard</h1>
          <p className="text-slate-400">Real-time system health, API reliability, automation status, and performance metrics</p>
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-400">System Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-cyber-cyan">
                  {platformState?.system_health === 'healthy' ? '✓' : '⚠'}
                </div>
                <Badge className={getStatusColor(platformState?.system_health || 'unknown')}>
                  {platformState?.system_health || 'Unknown'}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {platformState?.emergency_stop_engaged ? '🛑 EMERGENCY STOP' : 'Autopilot ' + (platformState?.autopilot_enabled ? 'Active' : 'Paused')}
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-400">API Reliability</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-cyber-magenta">{apiReliability}%</div>
              <p className="text-xs text-slate-400 mt-2">{healthyApis}/{totalApis} APIs healthy</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-400">Task Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-cyber-gold">{avgTaskSuccess}%</div>
              <p className="text-xs text-slate-400 mt-2">{taskMetrics.length} metrics</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-400">Automations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-cyber-teal">{activeAutomations}</div>
              <p className="text-xs text-slate-400 mt-2">{failedAutomations} failed</p>
            </CardContent>
          </Card>
        </div>

        {/* Time Range Selector */}
        <div className="mb-6 flex gap-2">
          {['24h', '7d', '30d'].map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded text-sm font-semibold transition ${
                timeRange === range
                  ? 'bg-cyber-cyan text-black'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {range}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Automation Status */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-cyber-cyan" />
                Automation Status
              </CardTitle>
              <CardDescription>9 scheduled and entity-based automations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {automations.slice(0, 9).map(auto => (
                <div key={auto.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded border border-slate-700">
                  <div className="flex items-center gap-3 flex-1">
                    {auto.last_run_status === 'success' ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    ) : auto.last_run_status === 'failed' ? (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    ) : (
                      <Clock className="w-4 h-4 text-slate-500" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-200">{auto.name}</p>
                      <p className="text-xs text-slate-400">{auto.function_name}</p>
                    </div>
                  </div>
                  <Badge
                    variant={auto.last_run_status === 'success' ? 'default' : 'destructive'}
                    className="text-xs"
                  >
                    {auto.last_run_status === 'success' ? '✓ Success' : auto.last_run_status === 'failed' ? '✗ Failed' : 'Pending'}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* API Health Matrix */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyber-magenta" />
                API Health Status
              </CardTitle>
              <CardDescription>Latest health checks for verified APIs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {apiMetrics.slice(0, 8).map(metric => (
                <div key={metric.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded border border-slate-700">
                  <div className="flex items-center gap-3 flex-1">
                    {getStatusIcon(metric.status)}
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-200">{metric.data?.api_name || 'Unknown'}</p>
                      <p className="text-xs text-slate-400">{metric.duration_seconds}s response time</p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(metric.status)} variant="outline">
                    {metric.data?.http_status || metric.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Task Execution Trends */}
          <Card className="glass-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-cyber-gold" />
                Task Execution Trends
              </CardTitle>
              <CardDescription>Performance metrics over selected time range</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-800/50 rounded border border-slate-700">
                  <p className="text-xs text-slate-400 mb-2">Total Tasks</p>
                  <p className="text-2xl font-bold text-cyber-cyan">
                    {taskMetrics.reduce((sum, m) => sum + (m.data?.total_in_flight || 0), 0)}
                  </p>
                </div>
                <div className="p-4 bg-slate-800/50 rounded border border-slate-700">
                  <p className="text-xs text-slate-400 mb-2">Queued</p>
                  <p className="text-2xl font-bold text-slate-300">
                    {taskMetrics[0]?.data?.queued_count || 0}
                  </p>
                </div>
                <div className="p-4 bg-slate-800/50 rounded border border-slate-700">
                  <p className="text-xs text-slate-400 mb-2">Processing</p>
                  <p className="text-2xl font-bold text-cyber-magenta">
                    {taskMetrics[0]?.data?.processing_count || 0}
                  </p>
                </div>
                <div className="p-4 bg-slate-800/50 rounded border border-slate-700">
                  <p className="text-xs text-slate-400 mb-2">Failed</p>
                  <p className="text-2xl font-bold text-red-500">
                    {taskMetrics[0]?.data?.failed_count || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}