/**
 * Auto Execution Monitor — Real-time monitoring of background task execution
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, Play, Pause, TrendingUp, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

export default function AutoExecutionMonitor() {
  const [isRunning, setIsRunning] = useState(false);
  const [lastRun, setLastRun] = useState(null);

  // Fetch queued auto-execute tasks
  const { data: queuedTasks = [], refetch: refetchTasks } = useQuery({
    queryKey: ['queued_auto_tasks'],
    queryFn: async () => {
      const tasks = await base44.entities.TaskExecutionQueue.filter({ status: 'queued' });
      return tasks.filter(t => t.auto_execute !== false);
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  // Fetch recent execution logs
  const { data: logs = [] } = useQuery({
    queryKey: ['execution_logs'],
    queryFn: async () => {
      const activities = await base44.entities.ActivityLog.filter({ action_type: 'auto_execution' });
      return activities.slice(0, 10);
    },
    refetchInterval: 30000,
  });

  const handleManualTrigger = async () => {
    setIsRunning(true);
    try {
      const result = await base44.functions.invoke('autoExecutionWorker', {
        max_concurrent: 5,
        max_daily_spend: 500,
      });
      
      setLastRun({
        timestamp: new Date().toISOString(),
        executed: result.data?.executed || 0,
        earned: result.data?.total_value || 0,
      });

      refetchTasks();
    } catch (error) {
      console.error('Execution error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const totalQueuedValue = queuedTasks.reduce((sum, t) => sum + (t.estimated_value || 0), 0);

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <CardTitle className="text-sm">Auto Execution Service</CardTitle>
            </div>
            <Badge variant={isRunning ? 'default' : 'outline'} className="text-xs">
              {isRunning ? 'Running' : 'Idle'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2 bg-slate-800/50 rounded">
              <p className="text-slate-400">Queued Tasks</p>
              <p className="text-lg font-semibold text-white">{queuedTasks.length}</p>
            </div>
            <div className="p-2 bg-slate-800/50 rounded">
              <p className="text-slate-400">Total Value</p>
              <p className="text-lg font-semibold text-emerald-400">${totalQueuedValue}</p>
            </div>
            <div className="p-2 bg-slate-800/50 rounded">
              <p className="text-slate-400">Last Run</p>
              <p className="text-xs text-slate-300">
                {lastRun ? new Date(lastRun.timestamp).toLocaleTimeString() : 'Never'}
              </p>
            </div>
          </div>

          <Button
            onClick={handleManualTrigger}
            disabled={isRunning || queuedTasks.length === 0}
            className="w-full h-8 text-xs gap-2 bg-emerald-600 hover:bg-emerald-500"
          >
            {isRunning ? (
              <>
                <Clock className="w-3.5 h-3.5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                Trigger Execution
              </>
            )}
          </Button>

          {lastRun && (
            <div className="p-2 bg-emerald-950/30 border border-emerald-500/20 rounded text-xs text-emerald-300">
              <p>Last run: {lastRun.executed} tasks executed, ${lastRun.earned} earned</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Logs */}
      {logs.length > 0 && (
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-40 overflow-y-auto text-xs">
              {logs.map((log, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-slate-800/30 rounded">
                  {log.severity === 'success' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-300 line-clamp-2">{log.message}</p>
                    <p className="text-slate-500 text-xs mt-1">
                      {new Date(log.created_date).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}