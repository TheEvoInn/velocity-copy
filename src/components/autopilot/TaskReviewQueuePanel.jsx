import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ShieldCheck, ShieldX, Clock, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp, Zap, DollarSign, TrendingUp, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STATUS_CONFIG = {
  pending: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', label: 'Pending' },
  auto_approved: { icon: Zap, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Auto-Approved' },
  manually_approved: { icon: ShieldCheck, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', label: 'Approved' },
  rejected: { icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', label: 'Rejected' },
  executing: { icon: RefreshCw, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20', label: 'Executing' },
  completed: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Completed' },
  failed: { icon: AlertTriangle, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', label: 'Failed' },
  expired: { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20', label: 'Expired' },
};

const RISK_COLORS = { low: 'text-emerald-400', medium: 'text-amber-400', high: 'text-rose-400' };

function QueueItem({ item, onApprove, onReject, approving }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;

  return (
    <div className={`rounded-xl border p-3 ${cfg.bg}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={`w-3.5 h-3.5 shrink-0 ${cfg.color} ${item.status === 'executing' ? 'animate-spin' : ''}`} />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">{item.task_name}</p>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              <span className={`text-[10px] ${cfg.color}`}>{cfg.label}</span>
              <span className="text-[10px] text-slate-500">{item.category}</span>
              {item.risk_level && <span className={`text-[10px] font-medium ${RISK_COLORS[item.risk_level]}`}>{item.risk_level} risk</span>}
              {item.chain_depth > 0 && <span className="text-[10px] text-violet-400">chain #{item.chain_depth}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <p className="text-xs font-bold text-rose-400">-${item.required_spend?.toFixed(2)}</p>
            <p className="text-[10px] text-emerald-400">+${item.expected_return?.toFixed(2)}</p>
          </div>
          <button onClick={() => setExpanded(!expanded)} className="text-slate-500 hover:text-white p-0.5">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-slate-900/50 p-2 text-center">
              <p className="text-[9px] text-slate-500 mb-0.5">ROI</p>
              <p className="text-xs font-bold text-emerald-400">{item.expected_roi_pct?.toFixed(0)}%</p>
            </div>
            <div className="rounded-lg bg-slate-900/50 p-2 text-center">
              <p className="text-[9px] text-slate-500 mb-0.5">Limit</p>
              <p className="text-xs font-bold text-white">${item.category_spend_limit}</p>
            </div>
            <div className="rounded-lg bg-slate-900/50 p-2 text-center">
              <p className="text-[9px] text-slate-500 mb-0.5">Net</p>
              <p className={`text-xs font-bold ${(item.net_profit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ${item.net_profit?.toFixed(2) ?? '—'}
              </p>
            </div>
          </div>

          {item.ai_justification && (
            <div className="rounded-lg bg-slate-900/50 p-2">
              <p className="text-[9px] text-slate-500 mb-1">AI Justification</p>
              <p className="text-[11px] text-slate-300">{item.ai_justification}</p>
            </div>
          )}

          {item.rejection_reason && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2">
              <p className="text-[9px] text-rose-400 mb-1">Rejection Reason</p>
              <p className="text-[11px] text-rose-300">{item.rejection_reason}</p>
            </div>
          )}

          {item.alternative_strategies?.length > 0 && (
            <div className="rounded-lg bg-slate-900/50 p-2">
              <p className="text-[9px] text-slate-500 mb-1">Alternative Strategies</p>
              {item.alternative_strategies.map((s, i) => (
                <p key={i} className="text-[11px] text-slate-400 mb-0.5">• {s}</p>
              ))}
            </div>
          )}

          {item.execution_log?.length > 0 && (
            <div className="space-y-1">
              <p className="text-[9px] text-slate-500">Audit Trail</p>
              {item.execution_log.slice(-3).map((l, i) => (
                <div key={i} className="flex gap-2 text-[10px]">
                  <span className="text-slate-600 font-mono">{l.timestamp ? format(new Date(l.timestamp), 'HH:mm:ss') : ''}</span>
                  <span className="text-emerald-400">{l.event}</span>
                  <span className="text-slate-400 truncate">{l.detail}</span>
                </div>
              ))}
            </div>
          )}

          {item.status === 'pending' && (
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => onApprove(item.id)}
                disabled={approving === item.id}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-7"
              >
                <ShieldCheck className="w-3 h-3 mr-1" />
                {approving === item.id ? 'Approving...' : 'Approve'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReject(item.id)}
                disabled={approving === item.id}
                className="flex-1 border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs h-7"
              >
                <ShieldX className="w-3 h-3 mr-1" />
                Reject
              </Button>
            </div>
          )}

          {item.created_date && (
            <p className="text-[9px] text-slate-600">
              Submitted {format(new Date(item.created_date), 'MMM d, h:mm a')}
              {item.approved_by && item.approved_by !== 'auto_system' && ` · Approved by ${item.approved_by}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function TaskReviewQueuePanel() {
  const queryClient = useQueryClient();
  const [approving, setApproving] = useState(null);
  const [filter, setFilter] = useState('pending');

  const { data: queue = [], refetch } = useQuery({
    queryKey: ['taskReviewQueue'],
    queryFn: () => base44.entities.TaskReviewQueue.list('-created_date', 50),
    initialData: [],
    refetchInterval: 10000,
  });

  const pendingCount = queue.filter(q => q.status === 'pending').length;
  const filtered = filter === 'all' ? queue : queue.filter(q => q.status === filter);

  const handleApprove = async (queueId) => {
    setApproving(queueId);
    try {
      const res = await base44.functions.invoke('taskReviewEngine', { action: 'approve', queue_id: queueId });
      if (res.data?.status === 'manually_approved') {
        // Trigger execution
        await base44.functions.invoke('taskReviewEngine', { action: 'execute', queue_id: queueId });
      }
      queryClient.invalidateQueries({ queryKey: ['taskReviewQueue'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['userGoals'] });
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async (queueId) => {
    await base44.functions.invoke('taskReviewEngine', { action: 'reject', queue_id: queueId, reason: 'Manually rejected by user' });
    queryClient.invalidateQueries({ queryKey: ['taskReviewQueue'] });
  };

  const FILTERS = [
    { value: 'pending', label: `Pending${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
    { value: 'auto_approved', label: 'Auto-Approved' },
    { value: 'completed', label: 'Completed' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'all', label: 'All' },
  ];

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-white">Task Review Queue</span>
          {pendingCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
              {pendingCount}
            </span>
          )}
        </div>
        <button onClick={refetch} className="text-slate-500 hover:text-white">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-4 py-2 flex gap-1 flex-wrap border-b border-slate-800">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
              filter === f.value ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-8">
            <ShieldCheck className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-xs text-slate-500">No {filter === 'all' ? '' : filter} tasks in queue</p>
            <p className="text-[10px] text-slate-600 mt-1">Tasks requiring spend will appear here for review</p>
          </div>
        ) : (
          filtered.map(item => (
            <QueueItem key={item.id} item={item} onApprove={handleApprove} onReject={handleReject} approving={approving} />
          ))
        )}
      </div>
    </div>
  );
}