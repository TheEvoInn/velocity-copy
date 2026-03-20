import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, RotateCcw, Loader, Check, X } from 'lucide-react';
import { toast } from 'sonner';

export default function BackgroundTaskScheduler() {
  const [isSchedulerRunning, setIsSchedulerRunning] = useState(false);
  const [executionQueue, setExecutionQueue] = useState([]);
  const [executionHistory, setExecutionHistory] = useState([]);
  const queryClient = useQueryClient();

  // Fetch pending tasks
  const { data: pendingTasks = [] } = useQuery({
    queryKey: ['pendingTasks'],
    queryFn: async () => {
      const res = await base44.functions.invoke('credentialTaskExecutor', {
        action: 'list_pending_tasks'
      });
      return res.data?.tasks || [];
    },
    refetchInterval: 30000,
    enabled: isSchedulerRunning
  });

  // Execute task mutation
  const executeTaskMutation = useMutation({
    mutationFn: async (task) => {
      // Find a credential that can execute this task
      const credentials = await base44.entities.PlatformCredential.filter({
        platform: task.platform,
        is_active: true
      });

      if (!credentials || credentials.length === 0) {
        throw new Error(`No active credentials for ${task.platform}`);
      }

      const credential = credentials[0];
      
      const res = await base44.functions.invoke('credentialTaskExecutor', {
        action: 'execute_task',
        opportunity_id: task.id,
        credential_id: credential.id,
        action_type: 'apply_to_job',
        delay_ms: Math.random() * 10000
      });

      return res.data;
    },
    onSuccess: (result, task) => {
      setExecutionHistory(prev => [...prev, {
        task_id: task.id,
        status: 'completed',
        result,
        timestamp: new Date().toISOString()
      }]);
      toast.success(`Executed: ${task.title}`);
    },
    onError: (error, task) => {
      setExecutionHistory(prev => [...prev, {
        task_id: task.id,
        status: 'failed',
        error: error.message,
        timestamp: new Date().toISOString()
      }]);
      toast.error(`Failed: ${task.title}`);
    }
  });

  // Process queue when scheduler is running
  useEffect(() => {
    if (!isSchedulerRunning || executionQueue.length === 0) return;

    const timer = setTimeout(() => {
      const task = executionQueue[0];
      executeTaskMutation.mutate(task);
      setExecutionQueue(prev => prev.slice(1));
    }, 2000); // 2 second interval between executions

    return () => clearTimeout(timer);
  }, [isSchedulerRunning, executionQueue, executeTaskMutation]);

  // Add pending tasks to queue
  useEffect(() => {
    if (isSchedulerRunning && pendingTasks.length > 0) {
      const newTasks = pendingTasks.filter(
        t => !executionQueue.some(q => q.id === t.id) &&
             !executionHistory.some(h => h.task_id === t.id)
      );
      if (newTasks.length > 0) {
        setExecutionQueue(prev => [...prev, ...newTasks]);
      }
    }
  }, [pendingTasks, isSchedulerRunning, executionQueue, executionHistory]);

  const handleStartScheduler = () => {
    setIsSchedulerRunning(true);
    toast.success('Background scheduler started');
  };

  const handleStopScheduler = () => {
    setIsSchedulerRunning(false);
    toast.info('Background scheduler stopped');
  };

  const handleResetHistory = () => {
    setExecutionHistory([]);
    setExecutionQueue([]);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500/20 text-emerald-300';
      case 'failed': return 'bg-red-500/20 text-red-300';
      case 'pending': return 'bg-amber-500/20 text-amber-300';
      default: return 'bg-slate-500/20 text-slate-300';
    }
  };

  return (
    <div className="space-y-4">
      {/* Control Panel */}
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Loader className="w-4 h-4 text-purple-400 animate-spin" />
            Scheduler Control
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              onClick={handleStartScheduler}
              disabled={isSchedulerRunning}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Scheduler
            </Button>
            <Button
              onClick={handleStopScheduler}
              disabled={!isSchedulerRunning}
              variant="destructive"
              className="flex-1"
            >
              <Pause className="w-4 h-4 mr-2" />
              Stop Scheduler
            </Button>
            <Button
              onClick={handleResetHistory}
              variant="outline"
              className="flex-1"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
            <div className="text-sm">
              <div className="font-medium">Status</div>
              <div className="text-xs text-slate-500">
                {isSchedulerRunning ? 'Running' : 'Stopped'}
              </div>
            </div>
            <Badge className={isSchedulerRunning ? 'bg-emerald-500/30 text-emerald-400' : 'bg-slate-600/30 text-slate-400'}>
              {isSchedulerRunning ? '● Running' : '○ Stopped'}
            </Badge>
          </div>

          {/* Queue Status */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-amber-950/30 border border-amber-500/30">
              <div className="text-amber-400 font-bold">{executionQueue.length}</div>
              <div className="text-amber-600">Queued</div>
            </div>
            <div className="p-2 rounded-lg bg-blue-950/30 border border-blue-500/30">
              <div className="text-blue-400 font-bold">{pendingTasks.length}</div>
              <div className="text-blue-600">Pending</div>
            </div>
            <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/30">
              <div className="text-emerald-400 font-bold">{executionHistory.filter(h => h.status === 'completed').length}</div>
              <div className="text-emerald-600">Completed</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Queue Preview */}
      {executionQueue.length > 0 && (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-sm">Execution Queue ({executionQueue.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {executionQueue.slice(0, 5).map((task, idx) => (
                <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 border border-slate-700 text-xs">
                  <span className="text-slate-500 font-bold">{idx + 1}.</span>
                  <div className="flex-1">
                    <div className="font-medium text-white">{task.title}</div>
                    <div className="text-slate-500">{task.platform} • ${task.profit_estimate_high}</div>
                  </div>
                  <Loader className="w-4 h-4 text-amber-400 animate-spin" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Execution History */}
      {executionHistory.length > 0 && (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-sm">Execution History ({executionHistory.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {executionHistory.slice(-10).reverse().map((entry, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 border border-slate-700 text-xs">
                  {entry.status === 'completed' ? (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  <div className="flex-1">
                    <div className="text-slate-300">{entry.task_id}</div>
                    <div className="text-slate-600">{new Date(entry.timestamp).toLocaleTimeString()}</div>
                  </div>
                  <Badge className={getStatusColor(entry.status)}>
                    {entry.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}