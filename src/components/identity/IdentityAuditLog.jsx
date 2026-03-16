import React, { useState } from 'react';
import { FileText, User, Key, Bot, ArrowLeftRight, Plus, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

const EVENT_CONFIG = {
  account_action: { icon: Bot, color: 'text-violet-400', bg: 'bg-violet-500/10' },
  credential_access: { icon: Key, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  proposal_submitted: { icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  email_sent: { icon: FileText, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  task_decision: { icon: Bot, color: 'text-slate-400', bg: 'bg-slate-500/10' },
  error: { icon: AlertTriangle, color: 'text-rose-400', bg: 'bg-rose-500/10' },
};

export default function IdentityAuditLog({ logs = [], identityId }) {
  const [filterType, setFilterType] = useState('all');

  const filtered = logs.filter(l => {
    if (filterType === 'all') return true;
    return l.log_type === filterType;
  });

  const FILTER_TYPES = ['all', 'account_action', 'credential_access', 'proposal_submitted', 'email_sent'];

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-400" />
          Identity Audit Log
          <span className="text-[10px] text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">{logs.length} events</span>
        </h3>
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_TYPES.map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`text-[10px] px-2 py-0.5 rounded-lg border transition-colors ${
                filterType === t ? 'bg-slate-700 border-slate-600 text-white' : 'border-slate-800 text-slate-600 hover:text-slate-400'
              }`}>
              {t.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-slate-800/50 max-h-80 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="px-5 py-8 text-center">
            <FileText className="w-6 h-6 text-slate-700 mx-auto mb-1" />
            <p className="text-xs text-slate-600">No events for this identity yet</p>
          </div>
        )}
        {filtered.map((log, i) => {
          const cfg = EVENT_CONFIG[log.log_type] || { icon: FileText, color: 'text-slate-400', bg: 'bg-slate-500/10' };
          const Icon = cfg.icon;
          return (
            <div key={i} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-800/20 transition-colors">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${cfg.bg}`}>
                <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-white truncate">{log.subject || log.log_type}</div>
                {log.content_preview && (
                  <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{log.content_preview}</div>
                )}
                <div className="text-[9px] text-slate-700 mt-0.5">
                  {log.created_date && format(new Date(log.created_date), 'MMM d, h:mm:ss a')}
                  {log.platform && <span className="ml-2 text-slate-600">{log.platform}</span>}
                </div>
              </div>
              {log.revenue_associated > 0 && (
                <div className="text-xs font-bold text-emerald-400 shrink-0">${log.revenue_associated.toFixed(2)}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}