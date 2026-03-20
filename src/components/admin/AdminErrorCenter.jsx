/**
 * Admin Error Center — Real-time error detection, failed workflows, retry controls
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, XCircle, RefreshCw, Play, ChevronDown, ChevronUp,
  Activity, Cpu, Wifi, WifiOff, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const ERROR_TYPE_CFG = {
  captcha:           { color: '#f59e0b', label: 'CAPTCHA' },
  authentication:    { color: '#ef4444', label: 'Auth Error' },
  geo_blocked:       { color: '#a855f7', label: 'Geo Block' },
  form_error:        { color: '#3b82f6', label: 'Form Error' },
  submission_failed: { color: '#ef4444', label: 'Submission Failed' },
  page_load_timeout: { color: '#f59e0b', label: 'Timeout' },
  unsupported_form:  { color: '#64748b', label: 'Unsupported' },
  other:             { color: '#94a3b8', label: 'Other' },
};

function TaskErrorCard({ task }) {
  const [expanded, setExpanded] = useState(false);
  const qc = useQueryClient();

  const retryMutation = useMutation({
    mutationFn: () => base44.entities.TaskExecutionQueue.update(task.id, {
      status: 'queued',
      retry_count: (task.retry_count || 0) + 1,
      last_retry_at: new Date().toISOString(),
      error_message: null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin_failed_tasks'] }); toast.success('Task re-queued'); },
    onError:   err => toast.error(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: () => base44.entities.TaskExecutionQueue.update(task.id, { status: 'cancelled' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin_failed_tasks'] }); toast.success('Task cancelled'); },
  });

  const errCfg = ERROR_TYPE_CFG[task.error_type] || ERROR_TYPE_CFG.other;

  return (
    <div className="border border-red-500/20 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 p-3 bg-red-500/5 cursor-pointer hover:bg-red-500/10 transition-colors"
        onClick={() => setExpanded(p => !p)}>
        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{task.platform || task.opportunity_type || 'Task'}</p>
          <p className="text-xs text-slate-500 truncate">{task.url || task.identity_name}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2 py-0.5 rounded text-[10px] font-medium"
            style={{ background: `${errCfg.color}15`, border: `1px solid ${errCfg.color}30`, color: errCfg.color }}>
            {errCfg.label}
          </span>
          {task.retry_count > 0 && (
            <span className="text-[10px] text-slate-500">{task.retry_count}x retried</span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </div>

      {expanded && (
        <div className="p-4 border-t border-red-500/15 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            {[
              { label: 'Status',     value: task.status },
              { label: 'Error Type', value: task.error_type?.replace('_', ' ') || '—' },
              { label: 'Retries',    value: `${task.retry_count || 0} / ${task.max_retries || 2}` },
              { label: 'Priority',   value: task.priority || '—' },
              { label: 'Identity',   value: task.identity_name || '—' },
              { label: 'Value',      value: task.estimated_value ? `$${task.estimated_value}` : '—' },
              { label: 'Queued At',  value: task.queue_timestamp ? new Date(task.queue_timestamp).toLocaleString() : '—' },
              { label: 'Started At', value: task.start_timestamp ? new Date(task.start_timestamp).toLocaleString() : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="p-2 rounded-lg bg-slate-800/40">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">{label}</p>
                <p className="text-white capitalize">{value || '—'}</p>
              </div>
            ))}
          </div>

          {task.error_message && (
            <div className="p-2.5 rounded-lg bg-red-500/8 border border-red-500/20">
              <p className="text-[10px] text-red-400 uppercase tracking-wide mb-1">Error Message</p>
              <p className="text-xs text-red-200">{task.error_message}</p>
            </div>
          )}

          {task.manual_review_reason && (
            <div className="p-2.5 rounded-lg bg-amber-500/8 border border-amber-500/20">
              <p className="text-[10px] text-amber-400 uppercase tracking-wide mb-1">Manual Review Reason</p>
              <p className="text-xs text-amber-200">{task.manual_review_reason}</p>
              {task.deep_link_for_manual && (
                <a href={task.deep_link_for_manual} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:underline mt-1 block">
                  Open task link →
                </a>
              )}
            </div>
          )}

          {/* Execution log preview */}
          {task.execution_log?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-white mb-1.5">Execution Log (last 5)</p>
              <div className="space-y-1">
                {task.execution_log.slice(-5).map((entry, i) => (
                  <div key={i} className="flex items-start gap-2 text-[10px]">
                    <span className="text-slate-600 shrink-0">{entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '—'}</span>
                    <span className={`shrink-0 px-1 rounded ${entry.status === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
                      [{entry.status}]
                    </span>
                    <span className="text-slate-400">{entry.step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button size="sm" onClick={() => retryMutation.mutate()} disabled={retryMutation.isPending || task.retry_count >= task.max_retries}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-8 gap-1.5">
              <Play className="w-3.5 h-3.5" /> Retry Task
            </Button>
            <Button size="sm" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}
              variant="outline" className="border-red-500/40 text-red-400 text-xs h-8 gap-1.5">
              <XCircle className="w-3.5 h-3.5" /> Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminErrorCenter() {
  const [tab, setTab] = useState('failed');

  const { data: failedTasks = [], isLoading, refetch } = useQuery({
    queryKey: ['admin_failed_tasks'],
    queryFn: () => base44.entities.TaskExecutionQueue.filter({ status: 'failed' }, '-created_date', 100),
    refetchInterval: 15000,
  });

  const { data: reviewTasks = [] } = useQuery({
    queryKey: ['admin_review_tasks'],
    queryFn: () => base44.entities.TaskExecutionQueue.filter({ status: 'needs_review' }, '-created_date', 50),
    refetchInterval: 15000,
  });

  const { data: retryHistory = [] } = useQuery({
    queryKey: ['admin_retry_history'],
    queryFn: () => base44.entities.RetryHistory.list('-created_date', 50),
    refetchInterval: 30000,
  });

  const { data: activityErrors = [] } = useQuery({
    queryKey: ['admin_activity_errors'],
    queryFn: () => base44.entities.ActivityLog.filter({ severity: 'error' }, '-created_date', 50),
    refetchInterval: 10000,
  });

  const qc = useQueryClient();

  const retryAllMutation = useMutation({
    mutationFn: async () => {
      const eligible = failedTasks.filter(t => (t.retry_count || 0) < (t.max_retries || 2));
      await Promise.all(eligible.map(t =>
        base44.entities.TaskExecutionQueue.update(t.id, {
          status: 'queued',
          retry_count: (t.retry_count || 0) + 1,
          last_retry_at: new Date().toISOString(),
        })
      ));
      return eligible.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ['admin_failed_tasks'] });
      toast.success(`${count} tasks re-queued`);
    },
  });

  const errorByType = failedTasks.reduce((acc, t) => {
    const type = t.error_type || 'other';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const TABS = [
    { id: 'failed',  label: 'Failed Tasks',     count: failedTasks.length },
    { id: 'review',  label: 'Needs Review',     count: reviewTasks.length },
    { id: 'retries', label: 'Retry History',    count: retryHistory.length },
    { id: 'system',  label: 'System Errors',    count: activityErrors.length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-orbitron text-base font-bold text-red-400 tracking-wide flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Error Center
        </h2>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => retryAllMutation.mutate()} disabled={retryAllMutation.isPending || failedTasks.length === 0}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-7 gap-1.5">
            <RefreshCw className={`w-3 h-3 ${retryAllMutation.isPending ? 'animate-spin' : ''}`} />
            Retry All
          </Button>
          <Button size="sm" variant="outline" onClick={refetch}
            className="border-slate-700 text-slate-400 text-xs h-7 gap-1.5">
            <RefreshCw className="w-3 h-3" /> Refresh
          </Button>
        </div>
      </div>

      {/* Error type breakdown */}
      {Object.keys(errorByType).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(errorByType).map(([type, count]) => {
            const cfg = ERROR_TYPE_CFG[type] || ERROR_TYPE_CFG.other;
            return (
              <div key={type} className="px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5"
                style={{ background: `${cfg.color}15`, border: `1px solid ${cfg.color}30`, color: cfg.color }}>
                {cfg.label}: {count}
              </div>
            );
          })}
        </div>
      )}

      {/* Tab nav */}
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
              tab === t.id
                ? 'bg-red-500/15 border-red-500/40 text-red-300'
                : 'bg-slate-800/50 border-slate-700 text-slate-500 hover:text-slate-300'
            }`}>
            {t.label}
            {t.count > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-2">
        {tab === 'failed' && (
          isLoading ? (
            <div className="text-center py-8 text-slate-500 text-sm">Loading failed tasks...</div>
          ) : failedTasks.length === 0 ? (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <p className="text-sm text-emerald-300">No failed tasks — all systems running smoothly.</p>
            </div>
          ) : (
            failedTasks.map(t => <TaskErrorCard key={t.id} task={t} />)
          )
        )}

        {tab === 'review' && (
          reviewTasks.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">No tasks pending review.</div>
          ) : (
            reviewTasks.map(t => <TaskErrorCard key={t.id} task={t} />)
          )
        )}

        {tab === 'retries' && (
          <div className="glass-card rounded-2xl p-4">
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {retryHistory.length === 0
                ? <p className="text-center text-slate-500 text-sm py-6">No retry history.</p>
                : retryHistory.map(r => (
                  <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/30 text-xs">
                    <div className={`w-2 h-2 rounded-full ${r.status === 'completed' ? 'bg-emerald-500' : r.status === 'abandoned' ? 'bg-red-500' : 'bg-amber-500'}`} />
                    <span className="text-slate-300">{r.platform}</span>
                    <span className="text-slate-500">{r.error_type?.replace('_', ' ')}</span>
                    <span className="text-slate-600">{r.retry_count}x</span>
                    <span className="text-slate-500 ml-auto capitalize">{r.status}</span>
                    <span className="text-slate-600">{new Date(r.created_date).toLocaleString()}</span>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {tab === 'system' && (
          <div className="glass-card rounded-2xl p-4">
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {activityErrors.length === 0
                ? <p className="text-center text-slate-500 text-sm py-6">No system errors logged.</p>
                : activityErrors.map(e => (
                  <div key={e.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-red-500/5 border border-red-500/15">
                    <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-red-200">{e.message}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">{e.created_by} · {new Date(e.created_date).toLocaleString()}</p>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
}