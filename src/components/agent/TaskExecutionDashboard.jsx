import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Play, Pause, AlertCircle, CheckCircle2, Clock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import TaskQueue from '@/components/agent/TaskQueue';
import ExecutionStats from '@/components/agent/ExecutionStats';

export default function TaskExecutionDashboard() {
  const [autoExecute, setAutoExecute] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5000);

  // Fetch execution stats
  const { data: statsData, refetch: refetchStats } = useQuery({
    queryKey: ['execution_stats'],
    queryFn: async () => {
      const res = await base44.functions.invoke('agentWorker', {
        action: 'get_execution_stats'
      });
      return res.data?.stats || {};
    },
    refetchInterval: 10000
  });

  // Fetch queued tasks
  const { data: tasksData, refetch: refetchTasks } = useQuery({
    queryKey: ['task_queue'],
    queryFn: async () => {
      const res = await base44.entities.TaskExecutionQueue.list('-priority', 50);
      return res || [];
    },
    refetchInterval: refreshInterval
  });

  // Execute next task mutation
  const executeNextMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('agentWorker', {
        action: 'execute_next_task'
      });
      return res.data;
    },
    onSuccess: () => {
      refetchTasks();
      refetchStats();
    }
  });

  // Auto-execute loop
  React.useEffect(() => {
    if (!autoExecute) return;

    const interval = setInterval(() => {
      const queuedTasks = tasksData?.filter(t => t.status === 'queued') || [];
      if (queuedTasks.length > 0) {
        executeNextMutation.mutate();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [autoExecute, tasksData]);

  const queuedCount = tasksData?.filter(t => t.status === 'queued').length || 0;
  const processingCount = tasksData?.filter(t => ['processing', 'navigating', 'filling'].includes(t.status)).length || 0;
  const needsReviewCount = tasksData?.filter(t => t.status === 'needs_review').length || 0;
  const completedCount = tasksData?.filter(t => t.status === 'completed').length || 0;

  return (
    <div className="space-y-6">
      {/* Control Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            onClick={() => executeNextMutation.mutate()}
            disabled={executeNextMutation.isPending || queuedCount === 0}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Play className={`w-4 h-4 mr-2 ${executeNextMutation.isPending ? 'animate-spin' : ''}`} />
            Execute Next
          </Button>
          <Button
            variant={autoExecute ? 'default' : 'outline'}
            onClick={() => setAutoExecute(!autoExecute)}
            className={autoExecute ? 'bg-blue-600' : ''}
          >
            <Zap className="w-4 h-4 mr-2" />
            {autoExecute ? 'Auto Executing' : 'Auto Execute'}
          </Button>
        </div>

        <div className="text-xs text-slate-400">
          Interval: {refreshInterval}ms
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-slate-900/50 border-slate-800 p-3">
          <p className="text-xs text-slate-500">Queued</p>
          <p className="text-2xl font-bold text-white mt-1">{queuedCount}</p>
        </Card>
        <Card className="bg-blue-950/20 border-blue-900/30 p-3">
          <p className="text-xs text-slate-500">Processing</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{processingCount}</p>
        </Card>
        <Card className="bg-amber-950/20 border-amber-900/30 p-3">
          <p className="text-xs text-slate-500">Needs Review</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{needsReviewCount}</p>
        </Card>
        <Card className="bg-emerald-950/20 border-emerald-900/30 p-3">
          <p className="text-xs text-slate-500">Completed</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{completedCount}</p>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800 p-3">
          <p className="text-xs text-slate-500">Success Rate</p>
          <p className="text-2xl font-bold text-white mt-1">{statsData?.success_rate || 0}%</p>
        </Card>
      </div>

      {/* Needs Review Alert */}
      {needsReviewCount > 0 && (
        <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-400">{needsReviewCount} Task(s) Need Manual Review</p>
            <p className="text-xs text-amber-300/70 mt-1">Some applications require manual completion or have encountered errors.</p>
          </div>
        </div>
      )}

      {/* Task Queue List */}
      <TaskQueue tasks={tasksData || []} onRefresh={refetchTasks} />

      {/* Execution Stats */}
      {statsData && <ExecutionStats stats={statsData} />}
    </div>
  );
}