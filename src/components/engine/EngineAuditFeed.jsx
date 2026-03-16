import React, { useState } from 'react';
import { FileText, CheckCircle2, XCircle, Clock, AlertTriangle, TrendingUp, TrendingDown, Download, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';

const ACTION_CONFIG = {
  withdrawal_triggered:    { icon: TrendingDown, color: 'text-blue-400',    bg: 'bg-blue-500/10',    label: 'Withdrawal Triggered' },
  withdrawal_completed:    { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Withdrawal Complete' },
  withdrawal_failed:       { icon: XCircle,      color: 'text-rose-400',    bg: 'bg-rose-500/10',    label: 'Withdrawal Failed' },
  withdrawal_retried:      { icon: Clock,        color: 'text-amber-400',   bg: 'bg-amber-500/10',   label: 'Withdrawal Retry' },
  reinvestment_triggered:  { icon: TrendingUp,   color: 'text-violet-400',  bg: 'bg-violet-500/10',  label: 'Reinvestment Triggered' },
  reinvestment_completed:  { icon: CheckCircle2, color: 'text-violet-400',  bg: 'bg-violet-500/10',  label: 'Reinvestment Complete' },
  reinvestment_failed:     { icon: XCircle,      color: 'text-rose-400',    bg: 'bg-rose-500/10',    label: 'Reinvestment Failed' },
  payout_cleared:          { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Payout Cleared' },
  payout_delayed:          { icon: AlertTriangle,color: 'text-amber-400',   bg: 'bg-amber-500/10',   label: 'Payout Delayed' },
  payout_disputed:         { icon: AlertTriangle,color: 'text-rose-400',    bg: 'bg-rose-500/10',    label: 'Payout Disputed' },
  fraud_flag:              { icon: AlertTriangle,color: 'text-rose-400',    bg: 'bg-rose-500/10',    label: 'Fraud Flag' },
  emergency_stop:          { icon: XCircle,      color: 'text-rose-400',    bg: 'bg-rose-500/10',    label: 'Emergency Stop' },
  engine_cycle:            { icon: Clock,        color: 'text-slate-400',   bg: 'bg-slate-500/10',   label: 'Engine Cycle' },
  threshold_check:         { icon: FileText,     color: 'text-blue-400',    bg: 'bg-blue-500/10',    label: 'Policy Update' },
  credential_access:       { icon: FileText,     color: 'text-amber-400',   bg: 'bg-amber-500/10',   label: 'Credential Access' },
  account_health_alert:    { icon: AlertTriangle,color: 'text-amber-400',   bg: 'bg-amber-500/10',   label: 'Health Alert' },
  override_applied:        { icon: CheckCircle2, color: 'text-blue-400',    bg: 'bg-blue-500/10',    label: 'Override Applied' },
};

function fmt(n) { return (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

const STATUS_COLORS = {
  success: 'text-emerald-400', pending: 'text-amber-400',
  failed: 'text-rose-400', skipped: 'text-slate-500', flagged: 'text-rose-400'
};

const FILTER_OPTS = ['all', 'withdrawal', 'reinvestment', 'payout', 'fraud_flag', 'engine_cycle'];

export default function EngineAuditFeed({ logs = [] }) {
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);

  const filtered = logs.filter(l => {
    if (filter === 'all') return true;
    if (filter === 'withdrawal') return l.action_type?.startsWith('withdrawal');
    if (filter === 'reinvestment') return l.action_type?.startsWith('reinvestment');
    if (filter === 'payout') return l.action_type?.startsWith('payout');
    return l.action_type === filter;
  });

  const exportCSV = () => {
    const rows = [
      ['Timestamp', 'Action', 'Amount', 'Source', 'Destination', 'Status', 'Reasoning'],
      ...filtered.map(l => [
        l.created_date, l.action_type, l.amount || '', l.source_account || '',
        l.destination_account || '', l.status, (l.ai_reasoning || '').replace(/,/g, ';')
      ])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'engine_audit_log.csv'; a.click();
  };

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-400" />
          Audit Log
          <span className="text-[10px] text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">{logs.length} events</span>
        </h3>
        <div className="flex items-center gap-2">
          <Button onClick={exportCSV} variant="outline" size="sm"
            className="border-slate-700 text-slate-500 hover:text-white text-xs h-7 gap-1">
            <Download className="w-3 h-3" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-5 py-2.5 border-b border-slate-800/50 flex gap-1.5 flex-wrap">
        {FILTER_OPTS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${
              filter === f ? 'bg-slate-700 border-slate-600 text-white' : 'border-slate-800 text-slate-600 hover:text-slate-400'
            }`}>
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Logs */}
      <div className="divide-y divide-slate-800/50 max-h-96 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="px-5 py-8 text-center">
            <FileText className="w-6 h-6 text-slate-700 mx-auto mb-1" />
            <p className="text-xs text-slate-600">No audit events yet</p>
          </div>
        )}
        {filtered.map((log, i) => {
          const cfg = ACTION_CONFIG[log.action_type] || { icon: FileText, color: 'text-slate-400', bg: 'bg-slate-500/10', label: log.action_type };
          const Icon = cfg.icon;
          const isExpanded = expanded === i;
          return (
            <div key={i} className="px-5 py-3 hover:bg-slate-800/20 transition-colors cursor-pointer"
              onClick={() => setExpanded(isExpanded ? null : i)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg}`}>
                    <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white">{cfg.label}</span>
                      {log.amount > 0 && (
                        <span className={`text-xs font-bold ${cfg.color}`}>${fmt(log.amount)}</span>
                      )}
                      <span className={`text-[10px] ${STATUS_COLORS[log.status] || 'text-slate-500'}`}>{log.status}</span>
                    </div>
                    <div className="text-[10px] text-slate-600 mt-0.5">
                      {log.created_date && format(new Date(log.created_date), 'MMM d, h:mm:ss a')}
                      {log.source_account && ` · From: ${log.source_account}`}
                      {log.destination_account && ` · To: ${log.destination_account}`}
                    </div>
                  </div>
                </div>
              </div>
              {isExpanded && (
                <div className="mt-3 ml-10 space-y-1.5 text-[10px]">
                  {log.ai_reasoning && (
                    <div className="bg-slate-800/40 rounded-lg p-2.5">
                      <span className="text-slate-500">AI Reasoning: </span>
                      <span className="text-slate-300">{log.ai_reasoning}</span>
                    </div>
                  )}
                  {log.wallet_balance_before != null && (
                    <div className="text-slate-600">
                      Balance: ${fmt(log.wallet_balance_before)} → ${fmt(log.wallet_balance_after)}
                    </div>
                  )}
                  {log.retry_count > 0 && <div className="text-amber-400">Retries: {log.retry_count}</div>}
                  {log.error_message && <div className="text-rose-400">Error: {log.error_message}</div>}
                  {log.thresholds_at_time && (
                    <div className="text-slate-600">
                      Thresholds: Buffer ${fmt(log.thresholds_at_time.safety_buffer)} · Min ${fmt(log.thresholds_at_time.min_threshold)}
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
}