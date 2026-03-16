import React from 'react';
import { Clock, CheckCircle2, ArrowRight, Banknote, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_CONFIG = {
  available: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Available' },
  cleared:   { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Cleared' },
  pending:   { icon: Clock,        color: 'text-amber-400',   bg: 'bg-amber-500/10',   label: 'Pending' },
  in_transit:{ icon: ArrowRight,   color: 'text-blue-400',    bg: 'bg-blue-500/10',    label: 'In Transit' },
  processing:{ icon: AlertCircle,  color: 'text-violet-400',  bg: 'bg-violet-500/10',  label: 'Processing' },
};

function fmt(n) {
  return (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PayoutStatusPanel({ transactions = [], availableFunds, pendingPayouts }) {
  const pendingTxs = transactions
    .filter(t => t.type === 'income' && (t.payout_status === 'pending' || t.payout_status === 'in_transit' || t.payout_status === 'processing'))
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    .slice(0, 8);

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Banknote className="w-4 h-4 text-blue-400" />
          Funds Status
        </h2>
      </div>

      {/* Available vs Pending */}
      <div className="grid grid-cols-2 divide-x divide-slate-800">
        <div className="px-5 py-4">
          <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Available Now</div>
          <div className="text-2xl font-bold text-emerald-400">${fmt(availableFunds)}</div>
          <div className="text-[10px] text-slate-500 mt-1">After fees &amp; tax withheld</div>
        </div>
        <div className="px-5 py-4">
          <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Pending Payouts</div>
          <div className="text-2xl font-bold text-amber-400">${fmt(pendingPayouts)}</div>
          <div className="text-[10px] text-slate-500 mt-1">Awaiting platform release</div>
        </div>
      </div>

      {/* Pending transactions list */}
      {pendingTxs.length > 0 && (
        <div className="border-t border-slate-800">
          <div className="px-5 py-2 text-[10px] text-slate-600 uppercase tracking-wider">Pending Transactions</div>
          <div className="divide-y divide-slate-800/50">
            {pendingTxs.map(tx => {
              const cfg = STATUS_CONFIG[tx.payout_status] || STATUS_CONFIG.pending;
              const Icon = cfg.icon;
              return (
                <div key={tx.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${cfg.bg}`}>
                      <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                    </div>
                    <div>
                      <p className="text-xs text-white truncate max-w-[160px]">{tx.description || tx.category || 'Income'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {tx.platform && (
                          <span className="text-[10px] text-slate-600">{tx.platform}</span>
                        )}
                        {tx.payout_date && (
                          <span className="text-[10px] text-blue-400">
                            Due {format(new Date(tx.payout_date), 'MMM d')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-white">${fmt(tx.net_amount || tx.amount)}</div>
                    <div className={`text-[10px] ${cfg.color}`}>{cfg.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pendingTxs.length === 0 && (
        <div className="border-t border-slate-800 px-5 py-5 text-center">
          <CheckCircle2 className="w-6 h-6 text-emerald-500/40 mx-auto mb-1" />
          <p className="text-xs text-slate-600">All payouts cleared</p>
        </div>
      )}
    </div>
  );
}