import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Wallet, Clock, Play, CheckCircle2, AlertCircle, TrendingUp, DollarSign, Zap } from 'lucide-react';

export default function LiveMetricsBar({ goals = {} }) {
  const { data: transactions = [] } = useQuery({
    queryKey: ['live_metrics_transactions'],
    queryFn: () => base44.entities.Transaction.list('-created_date', 200),
    refetchInterval: 10000,
  });

  const { data: opportunities = [] } = useQuery({
    queryKey: ['live_metrics_opportunities'],
    queryFn: () => base44.entities.Opportunity.list('-created_date', 300),
    refetchInterval: 8000,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['live_metrics_tasks'],
    queryFn: () => base44.entities.TaskExecutionQueue.list('-created_date', 200),
    refetchInterval: 8000,
  });

  // Earnings
  const incomeTxs = transactions.filter(t => t.type === 'income');
  const totalEarned = incomeTxs.reduce((sum, t) => sum + (t.net_amount ?? t.amount ?? 0), 0);
  const walletBalance = goals.wallet_balance ?? totalEarned;

  const today = new Date().toDateString();
  const todayEarned = incomeTxs
    .filter(t => new Date(t.created_date).toDateString() === today)
    .reduce((sum, t) => sum + (t.net_amount ?? t.amount ?? 0), 0);

  // Opportunities pipeline
  const oppQueued    = opportunities.filter(o => o.status === 'queued').length;
  const oppExecuting = opportunities.filter(o => ['executing', 'reviewing'].includes(o.status)).length;
  const oppSubmitted = opportunities.filter(o => o.status === 'submitted').length;
  const oppCompleted = opportunities.filter(o => o.status === 'completed').length;
  const oppFailed    = opportunities.filter(o => ['failed', 'expired', 'dismissed'].includes(o.status)).length;

  // Task queue
  const taskQueued     = tasks.filter(t => t.status === 'queued').length;
  const taskProcessing = tasks.filter(t => ['processing', 'navigating', 'filling', 'submitting', 'understanding'].includes(t.status)).length;
  const taskCompleted  = tasks.filter(t => t.status === 'completed').length;
  const taskFailed     = tasks.filter(t => ['failed', 'needs_review'].includes(t.status)).length;

  const metrics = [
    {
      label: 'Wallet Balance',
      value: `$${walletBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sublabel: `+$${todayEarned.toFixed(2)} today`,
      icon: Wallet,
      color: 'text-emerald-400',
      bg: 'from-emerald-950/50 to-slate-900/40 border-emerald-900/30',
      pulse: false,
    },
    {
      label: 'Total Earned',
      value: `$${totalEarned.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sublabel: `${incomeTxs.length} transactions`,
      icon: DollarSign,
      color: 'text-blue-400',
      bg: 'from-blue-950/50 to-slate-900/40 border-blue-900/30',
      pulse: false,
    },
    {
      label: 'Opps Queued',
      value: oppQueued,
      sublabel: `${taskQueued} tasks waiting`,
      icon: Clock,
      color: 'text-slate-300',
      bg: 'from-slate-800/50 to-slate-900/40 border-slate-700/50',
      pulse: false,
    },
    {
      label: 'In Execution',
      value: oppExecuting + oppSubmitted,
      sublabel: `${taskProcessing} tasks active`,
      icon: Play,
      color: 'text-amber-400',
      bg: 'from-amber-950/50 to-slate-900/40 border-amber-900/30',
      pulse: taskProcessing > 0,
    },
    {
      label: 'Completed',
      value: oppCompleted,
      sublabel: `${taskCompleted} tasks done`,
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'from-emerald-950/40 to-slate-900/40 border-emerald-900/20',
      pulse: false,
    },
    {
      label: 'Failed / Review',
      value: oppFailed,
      sublabel: `${taskFailed} needs review`,
      icon: AlertCircle,
      color: 'text-red-400',
      bg: 'from-red-950/40 to-slate-900/40 border-red-900/20',
      pulse: taskFailed > 0,
    },
    {
      label: 'Today\'s Profit',
      value: `$${todayEarned.toFixed(2)}`,
      sublabel: `${goals.daily_target ? Math.min(((todayEarned / goals.daily_target) * 100), 100).toFixed(0) : 0}% of daily target`,
      icon: TrendingUp,
      color: 'text-violet-400',
      bg: 'from-violet-950/50 to-slate-900/40 border-violet-900/30',
      pulse: false,
    },
    {
      label: 'Pipeline Value',
      value: `$${opportunities
        .filter(o => ['queued', 'executing', 'reviewing', 'submitted'].includes(o.status))
        .reduce((sum, o) => sum + ((o.profit_estimate_low + o.profit_estimate_high) / 2 || 0), 0)
        .toFixed(0)}`,
      sublabel: 'estimated in queue',
      icon: Zap,
      color: 'text-cyan-400',
      bg: 'from-cyan-950/40 to-slate-900/40 border-cyan-900/20',
      pulse: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
      {metrics.map(({ label, value, sublabel, icon: Icon, color, bg, pulse }) => (
        <div
          key={label}
          className={`rounded-xl bg-gradient-to-br ${bg} border p-3 relative overflow-hidden`}
        >
          {pulse && (
            <span className="absolute top-2 right-2 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
          )}
          <div className="flex items-center gap-1.5 mb-1">
            <Icon className={`w-3 h-3 ${color}`} />
            <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold truncate">{label}</span>
          </div>
          <div className={`text-lg font-bold ${color} leading-tight`}>{value}</div>
          <p className="text-[9px] text-slate-600 mt-0.5 truncate">{sublabel}</p>
        </div>
      ))}
    </div>
  );
}