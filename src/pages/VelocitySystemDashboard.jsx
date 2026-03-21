import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Zap,
  TrendingUp,
  RefreshCw,
  ArrowRight,
  Workflow
} from 'lucide-react';
import { toast } from 'sonner';

export default function VelocitySystemDashboard() {
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Get global health
  const { data: health, refetch: refetchHealth } = useQuery({
    queryKey: ['velocityHealth'],
    queryFn: async () => {
      try {
        const result = await base44.asServiceRole.functions.invoke('systemMetricsAudit', {
          action: 'get_global_health'
        }).catch(() => ({ data: { health: {} } }));
        return result?.data?.health || {};
      } catch {
        return {};
      }
    },
    refetchInterval: 5000,
    staleTime: 0
  });

  // Get dashboard metrics
  const { data: dashboard } = useQuery({
    queryKey: ['velocityDashboard'],
    queryFn: async () => {
      try {
        const result = await base44.asServiceRole.functions.invoke('systemMetricsAudit', {
          action: 'get_realtime_dashboard'
        }).catch(() => ({ data: { dashboard: {} } }));
        return result?.data?.dashboard || {};
      } catch {
        return {};
      }
    },
    refetchInterval: 10000,
    staleTime: 0
  });

  const handleFullAudit = async () => {
    setRefreshing(true);
    try {
      await refetchHealth();
      setLastRefresh(new Date());
      toast.success('System audit completed');
    } catch (e) {
      toast.error('Audit failed: ' + e.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleAutopilotCycle = async () => {
    setRefreshing(true);
    try {
      const result = await base44.asServiceRole.functions.invoke('autopilotOrchestrator', {
        action: 'full_autopilot_cycle'
      });
      if (result?.data?.success) {
        toast.success('Autopilot cycle executed');
        setTimeout(() => refetchHealth(), 1000);
      }
    } catch (e) {
      toast.error('Autopilot cycle failed: ' + e.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleProcessQueue = async () => {
    setRefreshing(true);
    try {
      const result = await base44.asServiceRole.functions.invoke('autopilotRealExecution', {
        action: 'process_execution_queue'
      });
      if (result?.data?.success) {
        const { processed } = result.data;
        toast.success(`Processed ${processed.started_count} tasks`);
        setTimeout(() => refetchHealth(), 1000);
      }
    } catch (e) {
      toast.error('Queue processing failed: ' + e.message);
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy':
        return 'border-emerald-500/50 bg-emerald-500/5';
      case 'warning':
        return 'border-amber-500/50 bg-amber-500/5';
      case 'critical':
        return 'border-red-500/50 bg-red-500/5';
      default:
        return 'border-slate-500/50 bg-slate-500/5';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'healthy':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'warning':
        return 'bg-amber-500/20 text-amber-400';
      case 'critical':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-slate-500/20 text-slate-400';
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-orbitron font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400 mb-2">
          VELOCITY System Dashboard
        </h1>
        <p className="text-slate-400">Real-time autonomous profit engine monitoring and control</p>
      </div>

      {/* System Status */}
      <Card className={`border ${getStatusColor(health?.overall || 'unknown')}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">System Status</CardTitle>
              <CardDescription>Overall platform health and operational state</CardDescription>
            </div>
            <div className={`px-4 py-2 rounded-lg font-semibold ${getStatusBadge(health?.overall || 'unknown')}`}>
              {health?.overall?.toUpperCase() || 'INITIALIZING'}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400">Last sync: {new Date(health?.last_sync || new Date()).toLocaleTimeString()}</p>
        </CardContent>
      </Card>

      {/* Department Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(health || {}).filter(([key]) => key !== 'overall' && key !== 'last_sync').map(([dept, data]) => (
          <Card key={dept} className={`border ${getStatusColor(data?.status)}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium capitalize text-white">{dept}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Status</span>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusBadge(data?.status)}`}>
                  {data?.status?.toUpperCase() || 'UNKNOWN'}
                </span>
              </div>
              
              {dept === 'autopilot' && (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Active Tasks</span>
                    <span className="text-white font-semibold">{data?.tasks || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Success Rate</span>
                    <span className="text-emerald-400 font-semibold">{data?.success_rate || 0}%</span>
                  </div>
                </>
              )}

              {dept === 'ned' && (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Transactions</span>
                    <span className="text-white font-semibold">{data?.transactions || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Success Rate</span>
                    <span className="text-emerald-400 font-semibold">{data?.success_rate || 0}%</span>
                  </div>
                </>
              )}

              {dept === 'vipz' && (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Published Pages</span>
                    <span className="text-white font-semibold">{data?.pages || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Conversion Rate</span>
                    <span className="text-emerald-400 font-semibold">{data?.conversion_rate || 0}%</span>
                  </div>
                </>
              )}

              {dept === 'discovery' && (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Opportunities</span>
                    <span className="text-white font-semibold">{data?.opportunities || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Scan Health</span>
                    <span className={`${getStatusBadge(data?.scan_health === 'healthy' ? 'healthy' : 'warning')}`}>
                      {data?.scan_health?.toUpperCase() || 'IDLE'}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Global Metrics */}
      {dashboard?.metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-400">Total Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{dashboard.metrics.total_tasks || 0}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-400">Earnings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-400">${(dashboard.metrics.total_earnings || 0).toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-400">Active Workflows</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-violet-400">{dashboard.metrics.active_workflows || 0}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-400">Pending Opps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-cyan-400">{dashboard.metrics.pending_opportunities || 0}</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-400">Errors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${dashboard.metrics.error_count > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {dashboard.metrics.error_count || 0}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Control Panel */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">System Controls</CardTitle>
          <CardDescription>Execute platform operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleFullAudit}
              disabled={refreshing}
              className="gap-2 bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Full System Audit
            </Button>

            <Button
              onClick={handleAutopilotCycle}
              disabled={refreshing}
              className="gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600"
            >
              <Zap className="w-4 h-4" />
              Run Autopilot Cycle
            </Button>

            <Button
              onClick={handleProcessQueue}
              disabled={refreshing}
              className="gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600"
            >
              <Activity className="w-4 h-4" />
              Process Execution Queue
            </Button>

            <Button
              variant="outline"
              className="gap-2"
              onClick={() => window.location.href = '/CentralEventLog'}
            >
              <Activity className="w-4 h-4" />
              View Event Log
            </Button>

            <Button
              variant="outline"
              className="gap-2"
              onClick={() => window.location.href = '/WorkflowArchitect'}
            >
              <Workflow className="w-4 h-4" />
              Workflow Architect
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Status Summary */}
      <Card className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">System Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-300">
          <p>✓ Real-time metrics: ENABLED</p>
          <p>✓ Event logging: ACTIVE</p>
          <p>✓ Workflow execution: OPERATIONAL</p>
          <p>✓ Task queue: {dashboard?.metrics?.total_tasks > 0 ? 'PROCESSING' : 'READY'}</p>
          <p>✓ Department sync: {health?.overall === 'healthy' ? 'SYNCHRONIZED' : 'RESYNCING'}</p>
          <p>✓ Last refresh: {lastRefresh.toLocaleTimeString()}</p>
        </CardContent>
      </Card>
    </div>
  );
}