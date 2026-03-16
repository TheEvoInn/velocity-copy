import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ChevronDown, AlertCircle, CheckCircle2, Clock, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const statusConfig = {
  queued: { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-950/20', label: 'Queued' },
  processing: { icon: Clock, color: 'text-blue-400', bg: 'bg-blue-950/20', label: 'Processing' },
  navigating: { icon: Clock, color: 'text-blue-400', bg: 'bg-blue-950/20', label: 'Navigating' },
  understanding: { icon: Clock, color: 'text-blue-400', bg: 'bg-blue-950/20', label: 'Analyzing' },
  filling: { icon: Clock, color: 'text-blue-400', bg: 'bg-blue-950/20', label: 'Filling' },
  submitting: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-950/20', label: 'Submitting' },
  completed: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-950/20', label: 'Completed' },
  needs_review: { icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-950/20', label: 'Review' },
  failed: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-950/20', label: 'Failed' }
};

export default function TaskQueue({ tasks, onRefresh }) {
  const [expandedId, setExpandedId] = useState(null);

  const groupedByStatus = {};
  tasks.forEach(task => {
    const status = task.status || 'queued';
    if (!groupedByStatus[status]) groupedByStatus[status] = [];
    groupedByStatus[status].push(task);
  });

  return (
    <div className="space-y-4">
      {Object.entries(groupedByStatus).map(([status, statusTasks]) => {
        const config = statusConfig[status];
        const Icon = config?.icon || Clock;

        return (
          <div key={status}>
            <h3 className="text-sm font-semibold text-white mb-2 px-4 py-2 bg-slate-900/50 rounded-lg flex items-center gap-2">
              <Icon className={`w-4 h-4 ${config?.color}`} />
              {config?.label} ({statusTasks.length})
            </h3>

            <div className="space-y-2">
              {statusTasks.map((task) => {
                const config = statusConfig[task.status];
                const isExpanded = expandedId === task.id;

                return (
                  <div key={task.id}>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : task.id)}
                      className={`w-full rounded-lg border transition-all text-left p-3 flex items-center justify-between hover:border-slate-600 ${config?.bg} border-slate-800`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{task.opportunity_type}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {task.platform} • {task.identity_name || 'Unknown'} • Est. ${(task.estimated_value || 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4 shrink-0">
                        {task.execution_time_seconds && (
                          <span className="text-xs text-slate-400">{task.execution_time_seconds}s</span>
                        )}
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="bg-slate-950/50 border border-t-0 border-slate-800 rounded-b-lg p-3 space-y-2 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-slate-500 font-medium">URL</p>
                            <p className="text-slate-400 truncate mt-0.5">{task.url}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 font-medium">Status</p>
                            <p className="text-slate-400 mt-0.5 capitalize">{task.status}</p>
                          </div>
                        </div>

                        {task.submission_success !== undefined && (
                          <div className="bg-slate-900 rounded p-2">
                            <p className="font-medium">
                              {task.submission_success ? '✅ Submitted' : '❌ Failed'}
                            </p>
                            {task.confirmation_number && (
                              <p className="text-slate-400 mt-1">Confirmation: {task.confirmation_number}</p>
                            )}
                            {task.error_message && (
                              <p className="text-red-400 mt-1">{task.error_message}</p>
                            )}
                          </div>
                        )}

                        {task.form_data_submitted && (
                          <div>
                            <p className="text-slate-500 font-medium">Fields Submitted</p>
                            <p className="text-slate-400 mt-1">{Object.keys(task.form_data_submitted).length} fields</p>
                          </div>
                        )}

                        {task.execution_log && task.execution_log.length > 0 && (
                          <div>
                            <p className="text-slate-500 font-medium">Execution Log</p>
                            <div className="space-y-1 mt-1">
                              {task.execution_log.slice(-3).map((log, idx) => (
                                <p key={idx} className="text-slate-400">
                                  • {log.step}: {log.details}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}

                        {task.needs_manual_review && (
                          <div className="bg-amber-950/30 border border-amber-900/30 rounded p-2">
                            <p className="text-amber-400 font-medium">Manual Review Needed</p>
                            <p className="text-amber-300/70 mt-1">{task.manual_review_reason}</p>
                            <a
                              href={task.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 mt-2"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Open URL
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {tasks.length === 0 && (
        <Card className="bg-slate-900/50 border-slate-800 p-8 text-center">
          <p className="text-slate-400">No tasks in queue. Add opportunities to get started.</p>
        </Card>
      )}
    </div>
  );
}