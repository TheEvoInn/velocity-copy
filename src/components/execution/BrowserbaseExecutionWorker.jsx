import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Chrome, Play, Loader2, CheckCircle2, XCircle, AlertCircle, Monitor, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function BrowserbaseExecutionWorker() {
  const [selectedTask, setSelectedTask] = useState(null);
  const [expandedLogs, setExpandedLogs] = useState(null);

  // Get queued tasks
  const { data: tasks = [], refetch, isLoading } = useQuery({
    queryKey: ['queued_tasks'],
    queryFn: async () => {
      const res = await base44.entities.TaskExecutionQueue.filter({
        status: 'queued',
      }, '-priority', 10);
      return res || [];
    },
    refetchInterval: 15000,
  });

  // Execute single task
  const executeMutation = useMutation({
    mutationFn: async (taskId) => {
      const task = tasks.find(t => t.id === taskId) || selectedTask;
      const res = await base44.functions.invoke('agentWorker', {
        action: 'execute_task',
        payload: {
          task_id: taskId,
          url: task?.url,
          opportunity_id: task?.opportunity_id,
          identity_id: task?.identity_id,
          platform: task?.platform,
        }
      });
      return res.data;
    },
    onSuccess: (data) => {
      refetch();
      if (data?.success) {
        toast.success('✅ Task completed');
      } else {
        toast.warning('⚠️ Task needs manual review');
      }
      setSelectedTask(null);
    },
    onError: (err) => {
      toast.error(`Failed: ${err.message || 'Unknown error'}`);
    },
  });

  // Batch execute
  const batchMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('agentWorker', {
        action: 'execute_next_task',
      });
      return res.data;
    },
    onSuccess: (data) => {
      refetch();
      if (data?.success) {
        toast.success('✅ Next task executed');
      } else {
        toast.info('All tasks processed');
      }
    },
    onError: (err) => {
      toast.error(`Failed: ${err.message || 'Unknown error'}`);
    },
  });

  if (isLoading) {
    return (
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-blue-400 mr-2" />
          Loading tasks...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Chrome className="w-5 h-5 text-blue-400" />
              <CardTitle className="text-white">Browserbase Execution Worker</CardTitle>
            </div>
            <Button
              onClick={() => batchMutation.mutate()}
              disabled={batchMutation.isPending || tasks.length === 0}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs"
            >
              {batchMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Executing...
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 mr-1.5" />
                  Batch Execute
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Info Box */}
          <div className="bg-blue-950/30 border border-blue-800/30 rounded-lg p-3">
            <p className="text-xs text-blue-200">
              Uses Browserbase to automatically navigate to URLs, identify form fields, fill with pre-generated data, and click submit buttons.
            </p>
          </div>

          {/* Task List */}
          {tasks.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No queued tasks available for execution</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`border rounded-lg p-3 cursor-pointer transition-all ${
                    selectedTask?.id === task.id
                      ? 'bg-blue-900/30 border-blue-600'
                      : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                  }`}
                  onClick={() => setSelectedTask(selectedTask?.id === task.id ? null : task)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Monitor className="w-4 h-4 text-blue-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{task.opportunity_type}</p>
                        <p className="text-xs text-slate-400 truncate">{task.url}</p>
                      </div>
                    </div>
                    <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded shrink-0">
                      ${task.estimated_value}
                    </span>
                  </div>

                  {selectedTask?.id === task.id && (
                    <div className="space-y-2 border-t border-slate-700 pt-2 mt-2">
                      {/* Task Details */}
                      <div className="text-xs space-y-1">
                        <p className="text-slate-400">
                          <span className="text-slate-500">Platform:</span>{' '}
                          <span className="text-white">{task.platform}</span>
                        </p>
                        <p className="text-slate-400">
                          <span className="text-slate-500">Priority:</span>{' '}
                          <span className="text-white">{task.priority}</span>
                        </p>
                        {task.form_data_submitted && (
                          <p className="text-slate-400">
                            <span className="text-slate-500">Form Fields:</span>{' '}
                            <span className="text-white">{Object.keys(task.form_data_submitted).length}</span>
                          </p>
                        )}
                      </div>

                      {/* Execution Log */}
                      {task.execution_log && task.execution_log.length > 0 && (
                        <div className="bg-slate-900/50 rounded p-2 max-h-32 overflow-y-auto">
                          <p className="text-xs text-slate-500 mb-1 font-semibold">Execution Log:</p>
                          <div className="space-y-0.5">
                            {task.execution_log.slice(-5).map((log, idx) => (
                              <p key={idx} className="text-xs text-slate-400">
                                <span className="text-slate-600">{log.step}:</span>{' '}
                                <span className={log.status === 'completed' ? 'text-emerald-400' : 'text-red-400'}>
                                  {log.status}
                                </span>
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action Button */}
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          executeMutation.mutate(task.id);
                        }}
                        disabled={executeMutation.isPending}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs mt-2"
                        size="sm"
                      >
                        {executeMutation.isPending ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                            Executing...
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 mr-1.5" />
                            Execute This Task
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Status Summary */}
          <div className="bg-slate-800/50 rounded-lg p-2 text-xs text-slate-400">
            <p>Queue Status: <span className="text-white font-semibold">{tasks.length} queued</span></p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}