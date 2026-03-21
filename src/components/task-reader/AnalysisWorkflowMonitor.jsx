import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2, Clock, AlertCircle, Zap, RefreshCw,
  ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react';

export default function AnalysisWorkflowMonitor({ recentTasks, stats, onRefresh }) {
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh?.();
    setIsRefreshing(false);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      completed: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Completed' },
      analyzing: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Analyzing' },
      queued: { bg: 'bg-slate-500/20', text: 'text-slate-400', label: 'Queued' },
      executing: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Executing' },
      credentials_ready: { bg: 'bg-teal-500/20', text: 'text-teal-400', label: 'Credentials Ready' },
      captcha_solving_completed: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'CAPTCHA Solved' },
      failed: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Failed' },
      manual_review_required: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Needs Review' }
    };

    const config = statusConfig[status] || statusConfig.queued;
    return <Badge className={`${config.bg} ${config.text}`}>{config.label}</Badge>;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
      case 'credentials_ready':
      case 'captcha_solving_completed':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'queued':
      case 'analyzing':
      case 'executing':
        return <Clock className="w-5 h-5 text-amber-500 animate-spin" />;
      case 'failed':
      case 'manual_review_required':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Zap className="w-5 h-5 text-slate-400" />;
    }
  };

  const getTaskTypeLabel = (taskType) => {
    const labels = {
      url_analysis: 'URL Analysis',
      captcha_solve: 'CAPTCHA Solve',
      form_fill_execute: 'Form Filling',
      credential_injection: 'Credential Injection',
      manual_review: 'Manual Review',
      error_recovery_retry: 'Error Recovery'
    };
    return labels[taskType] || taskType;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-4">
      {/* Control Bar */}
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-white">Active Workflows</h3>
          <p className="text-sm text-slate-400">Real-time monitoring of analysis tasks and follow-up executions</p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isRefreshing}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Tasks List */}
      <div className="space-y-2">
        {recentTasks.length === 0 ? (
          <Card className="p-8 text-center border-slate-700">
            <Zap className="w-12 h-12 mx-auto text-slate-600 mb-3 opacity-50" />
            <p className="text-slate-400">No active workflows. Tasks will appear here as they're received via webhook.</p>
          </Card>
        ) : (
          recentTasks.map((task) => (
            <Card
              key={task.id}
              className="border-slate-700 bg-slate-900/50 hover:bg-slate-900/70 transition"
            >
              <div
                onClick={() =>
                  setExpandedTaskId(expandedTaskId === task.id ? null : task.id)
                }
                className="p-4 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Icon and Status */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {getStatusIcon(task.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <p className="font-semibold text-white truncate">
                          {task.task_name || task.url?.slice(0, 50) || 'Unnamed Task'}
                        </p>
                        {getStatusBadge(task.status)}
                      </div>
                      <p className="text-xs text-slate-400 truncate">
                        {getTaskTypeLabel(task.task_type)}
                      </p>
                    </div>
                  </div>

                  {/* Right: Timing and Toggle */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-slate-400">
                        {formatDate(task.created_at)}
                      </p>
                      {task.priority && (
                        <p className="text-xs text-amber-400 font-medium">
                          Priority: {task.priority}
                        </p>
                      )}
                    </div>
                    {expandedTaskId === task.id ? (
                      <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedTaskId === task.id && (
                <div className="border-t border-slate-700 p-4 space-y-3">
                  {/* URL */}
                  {task.url && (
                    <div>
                      <p className="text-xs text-slate-400 mb-1">URL</p>
                      <div className="flex items-center gap-2">
                        <a
                          href={task.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 truncate text-sm"
                        >
                          {task.url}
                        </a>
                        <ExternalLink className="w-3 h-3 text-slate-500 flex-shrink-0" />
                      </div>
                    </div>
                  )}

                  {/* Analysis Results */}
                  {task.analysis_results?.data && (
                    <div className="bg-slate-800/50 rounded p-3 space-y-2">
                      <p className="text-xs font-semibold text-slate-300">Analysis Results</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {task.analysis_results.data.page_type && (
                          <div>
                            <span className="text-slate-400">Page Type:</span>
                            <p className="text-slate-200 font-medium">
                              {task.analysis_results.data.page_type}
                            </p>
                          </div>
                        )}
                        {task.analysis_results.data.captcha_detected !== undefined && (
                          <div>
                            <span className="text-slate-400">CAPTCHA:</span>
                            <p className="text-slate-200 font-medium">
                              {task.analysis_results.data.captcha_detected ? 'Detected' : 'None'}
                            </p>
                          </div>
                        )}
                        {task.analysis_results.data.automation_feasibility !== undefined && (
                          <div>
                            <span className="text-slate-400">Automation:</span>
                            <p className="text-slate-200 font-medium">
                              {task.analysis_results.data.automation_feasibility}/10
                            </p>
                          </div>
                        )}
                        {task.analysis_results.data.risk_score !== undefined && (
                          <div>
                            <span className="text-slate-400">Risk:</span>
                            <p className="text-slate-200 font-medium">
                              {task.analysis_results.data.risk_score}/10
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Blockers */}
                      {task.analysis_results.data.blockers?.length > 0 && (
                        <div className="border-t border-slate-700 pt-2">
                          <p className="text-xs text-red-400 font-semibold mb-1">Blockers</p>
                          <ul className="text-xs text-slate-300 space-y-1">
                            {task.analysis_results.data.blockers.map((blocker, idx) => (
                              <li key={idx} className="flex gap-2">
                                <span className="text-red-500 flex-shrink-0">•</span>
                                <span>{blocker}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Recommendations */}
                      {task.analysis_results.data.recommendations?.length > 0 && (
                        <div className="border-t border-slate-700 pt-2">
                          <p className="text-xs text-emerald-400 font-semibold mb-1">Recommendations</p>
                          <ul className="text-xs text-slate-300 space-y-1">
                            {task.analysis_results.data.recommendations.map((rec, idx) => (
                              <li key={idx} className="flex gap-2">
                                <span className="text-emerald-500 flex-shrink-0">•</span>
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Follow-up Tasks */}
                  {task.parent_task_id && (
                    <div className="bg-blue-900/20 border border-blue-500/30 rounded p-2">
                      <p className="text-xs text-blue-300">
                        ↳ Follow-up task triggered by parent analysis
                      </p>
                    </div>
                  )}

                  {/* Timestamps */}
                  <div className="border-t border-slate-700 pt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-slate-400">Created</p>
                      <p className="text-slate-200">{formatDate(task.created_at)}</p>
                    </div>
                    {task.completed_at && (
                      <div>
                        <p className="text-slate-400">Completed</p>
                        <p className="text-slate-200">{formatDate(task.completed_at)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Info Panel */}
      <Card className="p-4 border-slate-700 bg-slate-900/30">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-slate-400 mb-1">Workflow Automation</p>
            <p className="text-slate-200">
              Triggers on webhook task receipt. AI analysis → Auto follow-ups → Result storage.
            </p>
          </div>
          <div>
            <p className="text-slate-400 mb-1">Follow-up Triggers</p>
            <p className="text-slate-200">
              CAPTCHA solving, form filling, credential injection, manual reviews, error recovery.
            </p>
          </div>
          <div>
            <p className="text-slate-400 mb-1">Integration Points</p>
            <p className="text-slate-200">
              Database storage, activity logging, task execution queues, workflow templates.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}