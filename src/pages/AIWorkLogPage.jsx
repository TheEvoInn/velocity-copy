import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { FileText, Mail, MessageSquare, Key, CheckCircle2, AlertTriangle, Send, Inbox, Download, Filter } from 'lucide-react';
import { format } from 'date-fns';

const LOG_CONFIG = {
  email_sent: { icon: Send, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Email Sent' },
  email_received: { icon: Inbox, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Email Received' },
  proposal_submitted: { icon: FileText, color: 'text-violet-400', bg: 'bg-violet-500/10', label: 'Proposal Submitted' },
  message_sent: { icon: MessageSquare, color: 'text-sky-400', bg: 'bg-sky-500/10', label: 'Message Sent' },
  message_received: { icon: MessageSquare, color: 'text-teal-400', bg: 'bg-teal-500/10', label: 'Message Received' },
  file_created: { icon: FileText, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'File Created' },
  task_decision: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Task Decision' },
  account_action: { icon: Key, color: 'text-orange-400', bg: 'bg-orange-500/10', label: 'Account Action' },
  error: { icon: AlertTriangle, color: 'text-rose-400', bg: 'bg-rose-500/10', label: 'Error' },
  credential_access: { icon: Key, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Credential Access' },
  payment_collected: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Payment' },
  job_completed: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Job Completed' },
};

const ALL_TYPES = Object.keys(LOG_CONFIG);

function LogEntry({ log, expanded, onToggle }) {
  const cfg = LOG_CONFIG[log.log_type] || LOG_CONFIG.task_decision;
  const Icon = cfg.icon;

  return (
    <div className={`rounded-xl border transition-colors ${expanded ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'}`}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-3 text-left">
        <div className={`p-1.5 rounded-lg ${cfg.bg} shrink-0`}>
          <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-[10px] font-semibold ${cfg.color}`}>{cfg.label}</span>
            {log.platform && <span className="text-[10px] text-slate-500 capitalize">{log.platform}</span>}
            {log.revenue_associated > 0 && (
              <span className="text-[10px] text-emerald-400 font-medium">+${log.revenue_associated.toFixed(2)}</span>
            )}
          </div>
          <p className="text-xs text-slate-300 truncate">{log.subject || log.ai_decision_context || 'No subject'}</p>
        </div>
        <span className="text-[10px] text-slate-600 shrink-0 hidden md:block">
          {log.created_date ? format(new Date(log.created_date), 'MMM d, HH:mm') : ''}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-slate-700/50 pt-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
            {log.recipient && <div><span className="text-slate-500">To: </span><span className="text-slate-300">{log.recipient}</span></div>}
            {log.sender && <div><span className="text-slate-500">From: </span><span className="text-slate-300">{log.sender}</span></div>}
            {log.status && <div><span className="text-slate-500">Status: </span><span className="text-slate-300">{log.status}</span></div>}
            {log.task_id && <div><span className="text-slate-500">Task: </span><span className="text-slate-300 font-mono">{log.task_id.slice(0, 8)}...</span></div>}
          </div>

          {log.content_preview && (
            <div className="rounded-lg bg-slate-900 p-3">
              <p className="text-[10px] text-slate-500 mb-1">Content Preview</p>
              <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{log.content_preview}</p>
            </div>
          )}

          {log.full_content && log.full_content !== log.content_preview && (
            <div className="rounded-lg bg-slate-900 p-3 max-h-48 overflow-y-auto">
              <p className="text-[10px] text-slate-500 mb-1">Full Content</p>
              <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{log.full_content}</p>
            </div>
          )}

          {log.outcome && (
            <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-2">
              <p className="text-[10px] text-emerald-400">Outcome: {log.outcome}</p>
            </div>
          )}

          {log.ai_decision_context && (
            <div className="rounded-lg bg-slate-800 p-2">
              <p className="text-[10px] text-slate-500 mb-0.5">AI Reasoning</p>
              <p className="text-xs text-slate-400">{log.ai_decision_context}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AIWorkLogPage() {
  const [expandedId, setExpandedId] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: logs = [] } = useQuery({
    queryKey: ['aiWorkLogs'],
    queryFn: () => base44.entities.AIWorkLog.list('-created_date', 100),
    initialData: [],
    refetchInterval: 15000,
  });

  const filtered = logs.filter(log => {
    const matchType = filterType === 'all' || log.log_type === filterType;
    const matchSearch = !searchQuery ||
      log.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.platform?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.outcome?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchType && matchSearch;
  });

  const stats = ALL_TYPES.reduce((acc, t) => {
    acc[t] = logs.filter(l => l.log_type === t).length;
    return acc;
  }, {});

  const totalRevenue = logs.reduce((s, l) => s + (l.revenue_associated || 0), 0);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-violet-400" />
            AI Work Log
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Complete audit trail of all AI actions, communications, and decisions</p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-emerald-400">${totalRevenue.toFixed(2)}</div>
          <div className="text-[10px] text-slate-500">revenue in logs</div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {[
          { key: 'proposal_submitted', label: 'Proposals' },
          { key: 'email_sent', label: 'Emails Sent' },
          { key: 'job_completed', label: 'Jobs Done' },
          { key: 'payment_collected', label: 'Payments' },
          { key: 'credential_access', label: 'Cred Access' },
          { key: 'error', label: 'Errors' },
        ].map(s => {
          const cfg = LOG_CONFIG[s.key];
          return (
            <button key={s.key} onClick={() => setFilterType(filterType === s.key ? 'all' : s.key)}
              className={`rounded-xl p-3 text-center border transition-colors ${filterType === s.key ? 'bg-slate-700 border-slate-600' : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'}`}>
              <div className={`text-lg font-bold ${cfg.color}`}>{stats[s.key] || 0}</div>
              <div className="text-[9px] text-slate-500 mt-0.5">{s.label}</div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search logs..."
          className="flex-1 min-w-40 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
        />
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none">
          <option value="all">All Types</option>
          {ALL_TYPES.map(t => <option key={t} value={t}>{LOG_CONFIG[t]?.label || t}</option>)}
        </select>
      </div>

      {/* Log Entries */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 rounded-xl bg-slate-900/40 border border-slate-800">
            <FileText className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No work logs yet.</p>
            <p className="text-xs text-slate-600 mt-1">All AI actions will be logged here automatically.</p>
          </div>
        ) : (
          filtered.map(log => (
            <LogEntry
              key={log.id}
              log={log}
              expanded={expandedId === log.id}
              onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}