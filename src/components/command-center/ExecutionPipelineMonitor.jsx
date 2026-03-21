import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, CheckCircle2, AlertTriangle, Clock, ChevronRight } from 'lucide-react';

export default function ExecutionPipelineMonitor({ tasks = [] }) {
  const tasksByStatus = {
    queued: tasks.filter(t => t.status === 'queued'),
    processing: tasks.filter(t => t.status === 'processing' || t.status === 'executing'),
    completed: tasks.filter(t => t.status === 'completed'),
    failed: tasks.filter(t => t.status === 'failed'),
    needs_review: tasks.filter(t => t.status === 'needs_review'),
  };

  const totalValue = tasks.reduce((sum, t) => sum + (t.estimated_value || 0), 0);

  return (
    <div className="glass-card rounded-2xl p-4 border border-blue-500/20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-orbitron text-sm font-bold text-blue-300 tracking-widest flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          EXECUTION PIPELINE
        </h3>
        <Link to="/Execution" className="text-xs text-blue-400/70 hover:text-blue-400 transition-colors flex items-center gap-1">
          Full Monitor <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Pipeline Status Overview */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {[
          { key: 'queued', label: 'Queued', color: 'text-slate-400', count: tasksByStatus.queued.length },
          { key: 'processing', label: 'Active', color: 'text-blue-400', count: tasksByStatus.processing.length },
          { key: 'completed', label: 'Done', color: 'text-emerald-400', count: tasksByStatus.completed.length },
          { key: 'needs_review', label: 'Review', color: 'text-amber-400', count: tasksByStatus.needs_review.length },
          { key: 'failed', label: 'Failed', color: 'text-red-400', count: tasksByStatus.failed.length },
        ].map(status => (
          <div key={status.key} className="text-center p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 transition-colors">
            <p className={`font-orbitron font-bold text-lg ${status.color}`}>
              {status.count}
            </p>
            <p className="text-xs text-slate-500 mt-1">{status.label}</p>
          </div>
        ))}
      </div>

      {/* Total Value */}
      {totalValue > 0 && (
        <div className="p-3 rounded-lg bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 mb-4">
          <p className="text-xs text-slate-400 mb-1 font-mono">TOTAL PIPELINE VALUE</p>
          <p className="font-orbitron text-xl font-bold text-emerald-400">${totalValue.toFixed(0)}</p>
        </div>
      )}

      {/* Active Tasks List */}
      {tasksByStatus.processing.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 font-mono mb-2">CURRENTLY EXECUTING</p>
          {tasksByStatus.processing.slice(0, 5).map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/40 border border-blue-500/20 hover:border-blue-500/40 transition-all"
            >
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white font-medium truncate">
                  {task.platform || task.opportunity_type || 'Task'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {task.status === 'executing' ? 'Running...' : 'Processing'}
                </p>
              </div>
              {task.estimated_value && (
                <span className="text-xs text-emerald-400 font-semibold shrink-0">
                  ${task.estimated_value}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6">
          <Activity className="w-6 h-6 text-slate-500 mx-auto mb-2 opacity-50" />
          <p className="text-xs text-slate-500">No active tasks</p>
        </div>
      )}

      {/* Critical alerts */}
      {(tasksByStatus.failed.length > 0 || tasksByStatus.needs_review.length > 0) && (
        <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-2">
          {tasksByStatus.failed.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-300 bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="w-3.5 h-3.5" />
              {tasksByStatus.failed.length} failed task{tasksByStatus.failed.length > 1 ? 's' : ''}
            </div>
          )}
          {tasksByStatus.needs_review.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20">
              <Clock className="w-3.5 h-3.5" />
              {tasksByStatus.needs_review.length} need{tasksByStatus.needs_review.length > 1 ? '' : 's'} review
            </div>
          )}
        </div>
      )}
    </div>
  );
}