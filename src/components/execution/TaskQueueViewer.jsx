import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ChevronDown, ChevronUp, CheckCircle, XCircle, Pause, Play,
  Clock, AlertCircle, TrendingUp, DollarSign, Zap, Filter
} from 'lucide-react';

const statusColors = {
  queued: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', icon: Clock },
  processing: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', icon: Zap },
  needs_review: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', icon: AlertCircle },
};

const opportunityTypeColors = {
  job: '#3b82f6',
  grant: '#10b981',
  contest: '#f59e0b',
  giveaway: '#8b5cf6',
  survey: '#06b6d4',
};

export default function TaskQueueViewer() {
  const [expandedTask, setExpandedTask] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const queryClient = useQueryClient();

  // Fetch queued tasks (status = 'queued' or 'processing')
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['taskQueue'],
    queryFn: async () => {
      const queued = await base44.asServiceRole.entities.TaskExecutionQueue.filter({
        status: { $in: ['queued', 'processing', 'needs_review'] }
      }, '-priority -queue_timestamp', 100);
      return queued;
    }
  });

  // Mutations for task actions
  const approveMutation = useMutation({
    mutationFn: async (taskId) => {
      return base44.entities.TaskExecutionQueue.update(taskId, {
        status: 'processing'
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['taskQueue'] })
  });

  const rejectMutation = useMutation({
    mutationFn: async (taskId) => {
      return base44.entities.TaskExecutionQueue.update(taskId, {
        status: 'cancelled'
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['taskQueue'] })
  });

  const pauseMutation = useMutation({
    mutationFn: async (taskId) => {
      return base44.entities.TaskExecutionQueue.update(taskId, {
        status: 'queued'
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['taskQueue'] })
  });

  const filteredTasks = filterStatus === 'all'
    ? tasks
    : tasks.filter(t => t.status === filterStatus);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin">
          <Zap className="w-6 h-6 text-cyan-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-orbitron font-bold text-white">Task Queue Approval</h2>
          <p className="text-sm text-slate-400 mt-1">Review and control AI-generated opportunities</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-cyan-400">{filteredTasks.length}</p>
          <p className="text-xs text-slate-400">Pending Tasks</p>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2">
        {['all', 'queued', 'processing', 'needs_review'].map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all border ${
              filterStatus === status
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-white hover:border-slate-600'
            }`}
          >
            {status.replace('_', ' ').toUpperCase()}
          </button>
        ))}
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <Card className="glass-card border-slate-800/60">
            <CardContent className="p-8 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-500/30 mx-auto mb-3" />
              <p className="text-slate-400">No pending tasks. Queue is clear!</p>
            </CardContent>
          </Card>
        ) : (
          filteredTasks.map(task => {
            const isExpanded = expandedTask === task.id;
            const statusConfig = statusColors[task.status] || statusColors.queued;
            const StatusIcon = statusConfig.icon;

            return (
              <Card
                key={task.id}
                className={`glass-card border transition-all ${
                  isExpanded
                    ? 'border-cyan-500/50 bg-cyan-500/5'
                    : 'border-slate-800/60 hover:border-slate-700/80'
                }`}
              >
                <CardContent className="p-0">
                  {/* Task Header */}
                  <button
                    onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                    className="w-full px-6 py-4 flex items-center gap-4 hover:bg-white/5 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-slate-500 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-500 flex-shrink-0" />
                    )}

                    {/* Status Badge */}
                    <div
                      className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 ${statusConfig.bg} ${statusConfig.border}`}
                    >
                      <StatusIcon className={`w-3.5 h-3.5 ${statusConfig.text}`} />
                      <span className={`text-xs font-medium ${statusConfig.text}`}>
                        {task.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>

                    {/* Task Title & Details */}
                    <div className="flex-1 text-left min-w-0">
                      <h3 className="font-semibold text-white truncate">
                        {task.opportunity_type?.toUpperCase()} • {task.platform}
                      </h3>
                      <p className="text-sm text-slate-400 truncate mt-0.5">
                        {task.url?.substring(0, 60)}...
                      </p>
                    </div>

                    {/* Quick Stats */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                      {task.estimated_value && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-sm font-medium text-emerald-400">
                            ${task.estimated_value}
                          </span>
                        </div>
                      )}
                      {task.priority && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                          <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                          <span className="text-sm font-medium text-blue-400">
                            P{task.priority}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-slate-800/60 px-6 py-4 space-y-4">
                      {/* Task Info Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wide">Type</p>
                          <p className="text-sm font-medium text-white mt-1">
                            {task.opportunity_type}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wide">Platform</p>
                          <p className="text-sm font-medium text-white mt-1">
                            {task.platform}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wide">Identity</p>
                          <p className="text-sm font-medium text-white mt-1">
                            {task.identity_name || 'Default'}
                          </p>
                        </div>
                        {task.deadline && (
                          <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wide">Deadline</p>
                            <p className="text-sm font-medium text-white mt-1">
                              {new Date(task.deadline).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                        {task.success_rate_for_platform && (
                          <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wide">Success Rate</p>
                            <p className="text-sm font-medium text-white mt-1">
                              {task.success_rate_for_platform}%
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Task URL */}
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">URL</p>
                        <a
                          href={task.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 text-sm break-all underline"
                        >
                          {task.url}
                        </a>
                      </div>

                      {/* Notes */}
                      {task.notes && (
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Notes</p>
                          <p className="text-sm text-slate-300">{task.notes}</p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-3 pt-2">
                        {task.status === 'queued' && (
                          <>
                            <Button
                              onClick={() => approveMutation.mutate(task.id)}
                              disabled={approveMutation.isPending}
                              className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Approve & Execute
                            </Button>
                            <Button
                              onClick={() => rejectMutation.mutate(task.id)}
                              disabled={rejectMutation.isPending}
                              className="flex-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 hover:text-red-200"
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Reject
                            </Button>
                          </>
                        )}
                        {task.status === 'processing' && (
                          <Button
                            onClick={() => pauseMutation.mutate(task.id)}
                            disabled={pauseMutation.isPending}
                            className="flex-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 hover:text-amber-200"
                          >
                            <Pause className="w-4 h-4 mr-2" />
                            Pause Execution
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}