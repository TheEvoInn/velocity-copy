import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PlayCircle, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

export default function ExecutionStreamDashboard() {
  const [executions, setExecutions] = useState([]);

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard_metrics'],
    queryFn: async () => {
      const res = await base44.functions.invoke('liveDashboardStreaming', {
        action: 'get_dashboard_metrics',
        payload: {}
      });
      return res.data;
    },
    refetchInterval: 2000 // Poll every 2 seconds for real-time feel
  });

  const { data: activeExecs } = useQuery({
    queryKey: ['active_executions'],
    queryFn: async () => {
      const res = await base44.functions.invoke('executionStatusStreaming', {
        action: 'get_active_executions',
        payload: {}
      });
      return res.data?.executions || [];
    },
    refetchInterval: 1500
  });

  useEffect(() => {
    if (activeExecs) {
      setExecutions(activeExecs);
    }
  }, [activeExecs]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading real-time metrics...</p>
        </div>
      </div>
    );
  }

  const metrics = dashboardData?.metrics;

  return (
    <div className="space-y-6 p-6">
      {/* Financial Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Wallet Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyber-cyan">
              ${metrics?.financial.wallet_balance?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Account balance</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyber-gold">
              ${metrics?.financial.today_earnings?.toFixed(2) || '0.00'}
            </div>
            <Progress value={metrics?.financial.daily_progress_percent || 0} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {metrics?.financial.daily_progress_percent || 0}% of ${metrics?.financial.daily_target || 0} goal
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Opportunities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyber-magenta">
              {metrics?.execution.active_opportunities || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Currently executing</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyber-teal">
              {metrics?.execution.success_rate || 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Task completion</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Executions Stream */}
      {executions.length > 0 && (
        <Card className="glass-card-bright">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="w-5 h-5 text-cyber-cyan" />
              Live Execution Stream ({executions.length} active)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {executions.map((exec) => (
              <div key={exec.id} className="border border-border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {exec.status === 'running' && (
                      <div className="w-2 h-2 bg-cyber-cyan rounded-full animate-pulse"></div>
                    )}
                    {exec.status === 'completed' && (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    )}
                    {exec.status === 'failed' && (
                      <AlertCircle className="w-4 h-4 text-destructive" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{exec.task_id}</p>
                      <p className="text-xs text-muted-foreground">ID: {exec.id}</p>
                    </div>
                  </div>
                  <Badge variant={
                    exec.status === 'running' ? 'default' :
                    exec.status === 'completed' ? 'secondary' :
                    'destructive'
                  }>
                    {exec.status}
                  </Badge>
                </div>
                
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="text-muted-foreground">{exec.progress}%</span>
                  </div>
                  <Progress value={exec.progress} />
                </div>

                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {exec.duration_seconds}s
                  </span>
                  <span>Priority: {exec.priority}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Notifications */}
      {metrics?.notifications && metrics.notifications.unread_count > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-sm">
              Notifications ({metrics.notifications.unread_count} unread)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {metrics.notifications.recent.map((notif) => (
              <div key={notif.id} className="flex items-start gap-3 p-2 rounded border border-border">
                <Badge variant={notif.severity === 'critical' ? 'destructive' : 'secondary'}>
                  {notif.severity}
                </Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium">{notif.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(notif.created).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}