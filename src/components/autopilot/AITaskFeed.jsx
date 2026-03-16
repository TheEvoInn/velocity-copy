import React, { useState } from 'react';
import { format } from 'date-fns';
import { Bot, ChevronDown, ChevronUp, CheckCircle2, Loader2, DollarSign } from 'lucide-react';

const categoryColors = {
  arbitrage: 'text-emerald-400', service: 'text-blue-400', lead_gen: 'text-violet-400',
  digital_flip: 'text-amber-400', freelance: 'text-indigo-400', resale: 'text-pink-400',
  content: 'text-cyan-400', market_scan: 'text-slate-400', trend_analysis: 'text-orange-400'
};

function TaskCard({ task }) {
  const [expanded, setExpanded] = useState(false);
  const catColor = categoryColors[task.category] || 'text-slate-400';

  return (
    <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden">
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Bot className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-white truncate">{task.title}</p>
            <p className={`text-[10px] ${catColor}`}>{task.category?.replace('_', ' ')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <div className="text-sm font-bold text-emerald-400">
              +${(task.revenue_generated || 0).toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-600">
              {task.created_date && format(new Date(task.created_date), 'h:mm a')}
            </div>
          </div>
          {task.execution_log?.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 rounded text-slate-600 hover:text-slate-400 transition-colors"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {expanded && task.execution_log?.length > 0 && (
        <div className="border-t border-slate-800/50 p-3 space-y-2">
          {task.ai_reasoning && (
            <p className="text-[10px] text-slate-500 italic mb-2">"{task.ai_reasoning}"</p>
          )}
          {task.execution_log.map((entry, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle2 className="w-3 h-3 text-emerald-500/60 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-300">{entry.action}</p>
                {entry.result && (
                  <p className="text-[10px] text-slate-500 mt-0.5">→ {entry.result}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AITaskFeed({ tasks = [], isRunning = false }) {
  const completed = tasks.filter(t => t.status === 'completed');
  const running = tasks.filter(t => t.status === 'running' || t.status === 'queued');

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-white">AI Tasks</span>
        </div>
        {isRunning && (
          <span className="flex items-center gap-1.5 text-[10px] text-emerald-400">
            <Loader2 className="w-3 h-3 animate-spin" /> Running
          </span>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-6">
          <Bot className="w-8 h-8 text-slate-700 mx-auto mb-2" />
          <p className="text-xs text-slate-500">AI hasn't run yet.</p>
          <p className="text-[10px] text-slate-600 mt-0.5">Autopilot runs every 30 minutes.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {tasks.slice(0, 15).map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}