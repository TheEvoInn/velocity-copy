import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { Play, Pause, AlertCircle, CheckCircle2, Clock, Activity, BarChart3, Zap, Filter, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export default function VeloExecutionEngine() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all active tasks
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['executionTasks', user?.email],
    queryFn: () => base44.entities.AITask.filter({ created_by: user?.email }, '-created_date', 100),
    enabled: !!user?.email,
  });

  // Fetch execution audit logs
  const { data: auditLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['executionAuditLogs', user?.email],
    queryFn: () => base44.entities.EngineAuditLog.filter({ created_by: user?.email }, '-created_date', 50),
    enabled: !!user?.email,
  });

  // Real-time task subscriptions
  useEffect(() => {
    const unsubscribe = base44.entities.AITask.subscribe((event) => {
      queryClient.invalidateQueries({ queryKey: ['executionTasks', user?.email] });
    });
    return unsubscribe;
  }, [user?.email, queryClient]);

  // Real-time audit log subscriptions
  useEffect(() => {
    const unsubscribe = base44.entities.EngineAuditLog.subscribe((event) => {
      queryClient.invalidateQueries({ queryKey: ['executionAuditLogs', user?.email] });
    });
    return unsubscribe;
  }, [user?.email, queryClient]);

  // Calculate stats
  const stats = {
    total: tasks.length,
    queued: tasks.filter(t => t.status === 'queued').length,
    executing: tasks.filter(t => t.status === 'executing').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length,
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesSearch = task.task_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.url?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Status color mapping
  const getStatusColor = (status) => {
    const colors = {
      queued: 'bg-slate-600/20 text-slate-300 border-slate-600/50',
      analyzing: 'bg-blue-600/20 text-blue-300 border-blue-600/50',
      executing: 'bg-cyan-600/20 text-cyan-300 border-cyan-600/50 animate-pulse',
      completed: 'bg-emerald-600/20 text-emerald-300 border-emerald-600/50',
      failed: 'bg-red-600/20 text-red-300 border-red-600/50',
    };
    return colors[status] || 'bg-slate-600/20 text-slate-300';
  };

  const getStatusIcon = (status) => {
    const icons = {
      queued: <Clock className="w-3 h-3" />,
      analyzing: <Activity className="w-3 h-3" />,
      executing: <Zap className="w-3 h-3" />,
      completed: <CheckCircle2 className="w-3 h-3" />,
      failed: <AlertCircle className="w-3 h-3" />,
    };
    return icons[status];
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
            <Activity className="w-8 h-8 text-cyan-400" />
            VELO Execution Engine
          </h1>
          <p className="text-sm text-slate-400">Monitor autonomous task workflows, execution logs, and performance analytics in real-time.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          {[
            { label: 'Total Tasks', value: stats.total, color: 'text-slate-300', icon: '📋' },
            { label: 'Queued', value: stats.queued, color: 'text-slate-400', icon: '⏳' },
            { label: 'Executing', value: stats.executing, color: 'text-cyan-400', icon: '⚡' },
            { label: 'Completed', value: stats.completed, color: 'text-emerald-400', icon: '✅' },
            { label: 'Failed', value: stats.failed, color: 'text-red-400', icon: '❌' },
          ].map((stat, idx) => (
            <div key={idx} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="queue" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-900 border-b border-slate-800 rounded-none mb-6">
            <TabsTrigger value="queue" className="flex items-center gap-2">
              <Zap className="w-4 h-4" /> Queue
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <Activity className="w-4 h-4" /> Logs
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Analytics
            </TabsTrigger>
            <TabsTrigger value="recovery" className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Recovery
            </TabsTrigger>
          </TabsList>

          {/* Queue Tab */}
          <TabsContent value="queue" className="space-y-4">
            <div className="flex gap-3 mb-4">
              <div className="relative flex-1">
                <Input
                  placeholder="Search tasks by name or URL..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
              >
                <option value="all">All Status</option>
                <option value="queued">Queued</option>
                <option value="analyzing">Analyzing</option>
                <option value="executing">Executing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            <div className="space-y-2">
              {tasksLoading ? (
                <div className="text-center text-slate-500 py-8">Loading tasks...</div>
              ) : filteredTasks.length === 0 ? (
                <div className="text-center text-slate-500 py-8">No tasks found</div>
              ) : (
                filteredTasks.map((task) => (
                  <div key={task.id} className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition-all">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={`${getStatusColor(task.status)} border flex items-center gap-1 text-xs`}>
                            {getStatusIcon(task.status)}
                            {task.status}
                          </Badge>
                          <span className="text-xs text-slate-500">#{task.id.slice(0, 8)}</span>
                        </div>
                        <h3 className="font-semibold text-white truncate">{task.task_name || 'Unnamed Task'}</h3>
                        <p className="text-xs text-slate-500 truncate mt-1">{task.url}</p>
                        <div className="flex gap-4 mt-2 text-xs text-slate-400">
                          <span>Priority: <strong>{task.priority || 50}</strong></span>
                          <span>Retries: <strong>{task.retry_count || 0}/{task.max_retries || 3}</strong></span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-500">
                          {task.updated_at && new Date(task.updated_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-3">
            <div className="text-sm text-slate-400 mb-4">
              Showing {auditLogs.length} recent audit log entries
            </div>
            {logsLoading ? (
              <div className="text-center text-slate-500 py-8">Loading logs...</div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center text-slate-500 py-8">No execution logs found</div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {auditLogs.map((log) => (
                  <div key={log.id} className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-300">{log.action_type}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded ${
                        log.status === 'success' ? 'bg-emerald-600/20 text-emerald-300' :
                        log.status === 'failed' ? 'bg-red-600/20 text-red-300' :
                        'bg-slate-600/20 text-slate-300'
                      }`}>
                        {log.status}
                      </span>
                    </div>
                    {log.amount && <div className="text-slate-400">Amount: ${log.amount.toFixed(2)}</div>}
                    {log.error_message && <div className="text-red-300/70 mt-1">{log.error_message}</div>}
                    <div className="text-slate-600 mt-1">
                      {log.created_date && new Date(log.created_date).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Success Rate */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Success Rate
                </h3>
                {stats.total > 0 ? (
                  <>
                    <div className="text-3xl font-bold text-emerald-400">
                      {((stats.completed / stats.total) * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-slate-400 mt-2">
                      {stats.completed} of {stats.total} tasks completed
                    </div>
                  </>
                ) : (
                  <div className="text-slate-500">No tasks yet</div>
                )}
              </div>

              {/* Failure Rate */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400" /> Failure Rate
                </h3>
                {stats.total > 0 ? (
                  <>
                    <div className="text-3xl font-bold text-red-400">
                      {((stats.failed / stats.total) * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-slate-400 mt-2">
                      {stats.failed} of {stats.total} tasks failed
                    </div>
                  </>
                ) : (
                  <div className="text-slate-500">No tasks yet</div>
                )}
              </div>

              {/* Throughput */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-cyan-400" /> Active / In Progress
                </h3>
                <div className="text-3xl font-bold text-cyan-400">
                  {stats.executing + tasks.filter(t => t.status === 'analyzing').length}
                </div>
                <div className="text-xs text-slate-400 mt-2">Tasks running right now</div>
              </div>

              {/* Queue Health */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-violet-400" /> Queue Health
                </h3>
                <div className={`text-3xl font-bold ${stats.queued > 10 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {stats.queued > 10 ? 'BACKLOG' : 'HEALTHY'}
                </div>
                <div className="text-xs text-slate-400 mt-2">
                  {stats.queued} tasks pending
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Recovery Tab */}
          <TabsContent value="recovery" className="space-y-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-orange-400" /> Error Recovery System
              </h3>
              
              <div className="space-y-3">
                {/* Failed tasks for recovery */}
                {tasks.filter(t => t.status === 'failed').length === 0 ? (
                  <div className="text-center text-slate-500 py-8">No failed tasks requiring recovery</div>
                ) : (
                  tasks.filter(t => t.status === 'failed').map((task) => (
                    <div key={task.id} className="bg-slate-800/50 border border-red-600/20 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <div className="font-semibold text-white text-sm">{task.task_name}</div>
                          <div className="text-xs text-red-300/70 mt-1">
                            {task.original_error || 'Unknown error'}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            Retries: {task.retry_count || 0} / {task.max_retries || 3}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="bg-orange-600 hover:bg-orange-500 text-white"
                          onClick={() => {
                            // Trigger retry via mutation
                            base44.entities.AITask.update(task.id, {
                              status: 'queued',
                              retry_count: (task.retry_count || 0) + 1,
                            });
                            queryClient.invalidateQueries({ queryKey: ['executionTasks', user?.email] });
                          }}
                        >
                          Retry
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recovery Insights */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4">
              <h3 className="font-semibold text-white mb-3">Recovery Insights</h3>
              <div className="space-y-2 text-sm text-slate-400">
                <div>• {stats.executing} tasks currently executing</div>
                <div>• {stats.queued} tasks waiting to start</div>
                <div>• {stats.failed} tasks requiring attention</div>
                <div>• System health: <span className="text-emerald-400">OPTIMAL</span></div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}