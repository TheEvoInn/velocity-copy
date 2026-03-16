import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCw, ListChecks, Zap, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function ExecutionDashboard() {
  const [selectedTask, setSelectedTask] = useState(null);
  const [isAutoExecuting, setIsAutoExecuting] = useState(false);
  const queryClient = useQueryClient();

  // Fetch queued and executing tasks
  const { data: tasks = [], refetch: refetchTasks } = useQuery({
    queryKey: ['executionTasks'],
    queryFn: async () => {
      const queued = await base44.entities.TaskExecutionQueue.filter(
        { status: { $in: ['queued', 'processing', 'executing'] } },
        '-priority',
        50
      );
      return queued || [];
    },
    refetchInterval: 10000
  });

  // Execute single task
  const executeMutation = useMutation({
    mutationFn: async (taskId) => {
      const res = await base44.functions.invoke('intelligentExecutionEngine', {
        action: 'execute_task',
        payload: { task_id: taskId }
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`✓ Task ${data.status === 'submitted' ? 'completed' : 'processed'}`);
      queryClient.invalidateQueries({ queryKey: ['executionTasks'] });
    },
    onError: (error) => {
      toast.error(`Execution failed: ${error.message}`);
    }
  });

  // Batch execute tasks
  const batchExecuteMutation = useMutation({
    mutationFn: async (taskIds) => {
      const res = await base44.functions.invoke('intelligentExecutionEngine', {
        action: 'batch_execute_tasks',
        payload: {
          opportunity_ids: taskIds.map(t => t.opportunity_id),
          identity_id: 'default_identity',
          max_concurrent: 3
        }
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`✓ Batch: ${data.executed.length}/${data.total} executed`);
      queryClient.invalidateQueries({ queryKey: ['executionTasks'] });
    },
    onError: (error) => {
      toast.error(`Batch execution failed: ${error.message}`);
    }
  });

  const queuedCount = tasks.filter(t => t.status === 'queued').length;
  const processingCount = tasks.filter(t => t.status === 'processing').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;

  const handleExecuteAll = () => {
    if (queuedCount === 0) {
      toast.info('No queued tasks');
      return;
    }
    batchExecuteMutation.mutate(tasks.filter(t => t.status === 'queued'));
  };

  const statusColors = {
    queued: 'text-blue-400',
    processing: 'text-amber-400',
    executing: 'text-purple-400',
    completed: 'text-emerald-400',
    failed: 'text-red-400'
  };

  const statusIcons = {
    queued: Clock,
    processing: Zap,
    executing: Play,
    completed: CheckCircle,
    failed: AlertCircle
  };

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg bg-blue-950/30 border border-blue-500/30 p-3">
          <div className="text-blue-400">Queued</div>
          <div className="text-2xl font-bold text-white mt-1">{queuedCount}</div>
        </div>
        <div className="rounded-lg bg-amber-950/30 border border-amber-500/30 p-3">
          <div className="text-amber-400">Processing</div>
          <div className="text-2xl font-bold text-white mt-1">{processingCount}</div>
        </div>
        <div className="rounded-lg bg-emerald-950/30 border border-emerald-500/30 p-3">
          <div className="text-emerald-400">Completed</div>
          <div className="text-2xl font-bold text-white mt-1">{completedCount}</div>
        </div>
      </div>

      {/* Control Panel */}
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-emerald-400" />
            Execution Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Button
              onClick={handleExecuteAll}
              disabled={queuedCount === 0 || batchExecuteMutation.isPending}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm h-9"
            >
              {batchExecuteMutation.isPending ? (
                <>
                  <div className="w-3 h-3 border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin mr-2" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 mr-2" />
                  Execute All ({queuedCount})
                </>
              )}
            </Button>
            <Button
              onClick={() => refetchTasks()}
              variant="outline"
              className="text-sm h-9"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Task List */}
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            Active Tasks ({tasks.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="text-center py-6">
              <ListChecks className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No active tasks</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {tasks.map((task) => {
                const StatusIcon = statusIcons[task.status];
                return (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-slate-600 cursor-pointer transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <StatusIcon className={`w-3.5 h-3.5 ${statusColors[task.status]}`} />
                          <span className="text-xs font-medium text-white">
                            {task.platform?.toUpperCase()}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded bg-slate-700 ${statusColors[task.status]}`}>
                            {task.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-1">
                          {task.opportunity_id}
                        </p>
                        {task.estimated_value && (
                          <p className="text-[10px] text-emerald-400 mt-1">
                            Est. Value: ${task.estimated_value}
                          </p>
                        )}
                      </div>
                      {task.status === 'queued' && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            executeMutation.mutate(task.id);
                          }}
                          disabled={executeMutation.isPending}
                          size="sm"
                          variant="ghost"
                          className="text-emerald-400 hover:text-emerald-300 h-7 text-xs"
                        >
                          <Play className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task Details Modal */}
      {selectedTask && (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Task Details</CardTitle>
              <Button
                onClick={() => setSelectedTask(null)}
                variant="ghost"
                className="h-6 w-6 p-0 text-slate-500"
              >
                ✕
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500">Platform</span>
                <div className="font-medium">{selectedTask.platform}</div>
              </div>
              <div>
                <span className="text-slate-500">Status</span>
                <div className="font-medium">{selectedTask.status}</div>
              </div>
              <div>
                <span className="text-slate-500">Priority</span>
                <div className="font-medium">{selectedTask.priority}/100</div>
              </div>
              <div>
                <span className="text-slate-500">Est. Value</span>
                <div className="font-medium text-emerald-400">${selectedTask.estimated_value || 0}</div>
              </div>
            </div>

            {selectedTask.execution_log && selectedTask.execution_log.length > 0 && (
              <div>
                <span className="text-slate-500 block mb-2">Execution Log</span>
                <div className="space-y-1 bg-slate-800/50 rounded p-2 max-h-40 overflow-y-auto">
                  {selectedTask.execution_log.map((log, idx) => (
                    <div key={idx} className="text-[10px] text-slate-400">
                      <span className="text-slate-500">{log.step}</span>: {log.details}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedTask.confirmation_number && (
              <div className="p-2 rounded bg-emerald-950/30 border border-emerald-500/30">
                <span className="text-slate-500">Confirmation</span>
                <div className="font-mono text-emerald-400 text-[10px] mt-1">
                  {selectedTask.confirmation_number}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}