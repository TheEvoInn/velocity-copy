/**
 * DEPARTMENT 2: Execution & Automation
 * Executes tasks, manages autopilot, handles retries and workflows.
 * Communicates with: Discovery (receives tasks), Finance (deposits revenue),
 * Control (reads identity), Command Center (shows progress).
 */
import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDepartmentSync } from '@/hooks/useDepartmentSync';
import { Cpu, Play, Pause, RefreshCw, CheckCircle2, XCircle, Clock, Zap, Bot, Activity, AlertTriangle, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AutopilotPanel from '@/components/autopilot/AutopilotPanel';
import DualStreamCard from '@/components/autopilot/DualStreamCard';
import ActivityFeed from '@/components/dashboard/ActivityFeed';
import InstantTaskPanel from '@/components/execution/InstantTaskPanel';

const STATUS_CONFIG = {
  queued:     { color: 'text-amber-400',   bg: 'bg-amber-500/15 border-amber-500/25',   label: 'Queued' },
  processing: { color: 'text-blue-400',    bg: 'bg-blue-500/15 border-blue-500/25',     label: 'Processing' },
  navigating: { color: 'text-blue-400',    bg: 'bg-blue-500/15 border-blue-500/25',     label: 'Navigating' },
  filling:    { color: 'text-purple-400',  bg: 'bg-purple-500/15 border-purple-500/25', label: 'Filling' },
  submitting: { color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/25', label: 'Submitting' },
  completed:  { color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/25', label: 'Completed' },
  failed:     { color: 'text-red-400',     bg: 'bg-red-500/15 border-red-500/25',       label: 'Failed' },
  needs_review: { color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/25',   label: 'Review' },
  cancelled:  { color: 'text-slate-400',   bg: 'bg-slate-700/30 border-slate-700/30',   label: 'Cancelled' },
};

export default function Execution() {
  const { tasks, opportunities, userGoals, activityLogs, todayEarned, DeptBus, DEPT_EVENTS } = useDepartmentSync();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = statusFilter === 'all' ? tasks : tasks.filter(t => t.status === statusFilter);

  const stats = {
    active:    tasks.filter(t => ['queued','processing','navigating','filling','submitting'].includes(t.status)).length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed:    tasks.filter(t => t.status === 'failed').length,
    review:    tasks.filter(t => t.status === 'needs_review').length,
  };

  const handleRetry = async (task) => {
    await base44.entities.TaskExecutionQueue.update(task.id, {
      status: 'queued',
      retry_count: (task.retry_count || 0) + 1,
      last_retry_at: new Date().toISOString(),
    });
    queryClient.invalidateQueries({ queryKey: ['taskQueue'] });
  };

  const handleCancel = async (task) => {
    await base44.entities.TaskExecutionQueue.update(task.id, { status: 'cancelled' });
    if (task.opportunity_id) {
      await base44.entities.Opportunity.update(task.opportunity_id, { status: 'dismissed' });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    }
    queryClient.invalidateQueries({ queryKey: ['taskQueue'] });
  };

  const aiEarnedToday = 0;
  const userEarnedToday = todayEarned;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Execution & Automation</h1>
            <p className="text-xs text-slate-500">Task pipeline · Autopilot engine · Retry management</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Active Tasks',  value: stats.active,    icon: Zap,          color: 'text-blue-400' },
          { label: 'Completed',     value: stats.completed, icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'Failed',        value: stats.failed,    icon: XCircle,      color: 'text-red-400' },
          { label: 'Needs Review',  value: stats.review,    icon: AlertTriangle, color: 'text-amber-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              <span className="text-xs text-slate-500">{label}</span>
            </div>
            <div className={`text-xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Dual Stream */}
      <div className="mb-5">
        <DualStreamCard
          aiEarned={aiEarnedToday}
          userEarned={userEarnedToday}
          aiTarget={userGoals.ai_daily_target || 500}
          userTarget={userGoals.user_daily_target || 500}
          aiTotalEarned={userGoals.ai_total_earned || 0}
          userTotalEarned={userGoals.user_total_earned || 0}
        />
      </div>

      {/* Autopilot Panel */}
      {userGoals.id && (
        <div className="mb-5">
          <AutopilotPanel goals={userGoals} />
        </div>
      )}

      {/* Instant Task — Real browser automation */}
      <div className="mb-5">
        <InstantTaskPanel
          opportunities={opportunities || []}
          onTaskComplete={() => queryClient.invalidateQueries({ queryKey: ['taskQueue'] })}
        />
      </div>

      {/* Task Queue */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <List className="w-4 h-4 text-blue-400" />
            Task Execution Queue
          </h2>
          <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5">
            {['all', 'queued', 'processing', 'completed', 'failed', 'needs_review'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors capitalize ${
                  statusFilter === s ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}>{s === 'needs_review' ? 'review' : s}</button>
            ))}
          </div>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filtered.slice(0, 50).map(task => {
            const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.queued;
            return (
              <div key={task.id} className={`flex items-center justify-between p-3 rounded-lg border ${cfg.bg}`}>
                <div className="flex-1 min-w-0 mr-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <span className="text-xs text-white truncate font-medium">
                      {task.platform || task.opportunity_type || 'Task'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{task.url || task.notes || '—'}</p>
                  {task.identity_name && (
                    <p className="text-xs text-slate-600 mt-0.5">↳ {task.identity_name}</p>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {task.status === 'failed' && (
                    <button onClick={() => handleRetry(task)}
                      className="flex items-center gap-1 px-2 py-1 bg-blue-600/80 hover:bg-blue-500 text-white text-xs rounded-lg transition-colors">
                      <RefreshCw className="w-3 h-3" /> Retry
                    </button>
                  )}
                  {['queued', 'needs_review'].includes(task.status) && (
                    <button onClick={() => handleCancel(task)}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg transition-colors">
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-sm">
              <Bot className="w-8 h-8 mx-auto mb-2 text-slate-700" />
              No tasks in this view.
            </div>
          )}
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400" />
          Execution Activity
        </h2>
        <ActivityFeed logs={activityLogs} />
      </div>
    </div>
  );
}