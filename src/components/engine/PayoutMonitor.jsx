import React from 'react';
import { Clock, CheckCircle2, AlertTriangle, ArrowRight, TrendingUp, Users } from 'lucide-react';
import { format } from 'date-fns';

function fmt(n) { return (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

const PLATFORM_COLORS = {
  upwork: 'text-green-400 bg-green-400/10',
  fiverr: 'text-emerald-400 bg-emerald-400/10',
  freelancer: 'text-blue-400 bg-blue-400/10',
  other: 'text-slate-400 bg-slate-400/10'
};

const STATUS_CONFIG = {
  available: { icon: CheckCircle2, color: 'text-emerald-400', label: 'Available' },
  cleared:   { icon: CheckCircle2, color: 'text-emerald-400', label: 'Cleared' },
  pending:   { icon: Clock,        color: 'text-amber-400',   label: 'Pending' },
  in_transit:{ icon: ArrowRight,   color: 'text-blue-400',    label: 'In Transit' },
  processing:{ icon: AlertTriangle,color: 'text-violet-400',  label: 'Processing' },
};

export default function PayoutMonitor({ payoutsData, walletData }) {
  const accounts = payoutsData?.by_account || [];
  const pendingCount = payoutsData?.pending_count || 0;
  const pendingTotal = payoutsData?.pending_total || 0;

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          Payout Monitor
        </h3>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30">
              {pendingCount} pending
            </span>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 divide-x divide-slate-800">
        <div className="px-4 py-3">
          <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Available Now</div>
          <div className="text-lg font-bold text-emerald-400">${fmt(walletData?.eligible_for_withdrawal)}</div>
        </div>
        <div className="px-4 py-3">
          <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Pending Payouts</div>
          <div className="text-lg font-bold text-amber-400">${fmt(pendingTotal)}</div>
        </div>
        <div className="px-4 py-3">
          <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Safety Buffer</div>
          <div className="text-lg font-bold text-slate-400">${fmt(walletData?.safety_buffer)}</div>
        </div>
      </div>

      {/* Per-account payout breakdown */}
      {accounts.length > 0 && (
        <div className="border-t border-slate-800">
          <div className="px-5 py-2 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">By Account</span>
          </div>
          <div className="divide-y divide-slate-800/50">
            {accounts.map((acc, i) => {
              const colorClass = PLATFORM_COLORS[acc.platform] || PLATFORM_COLORS.other;
              return (
                <div key={i} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${colorClass}`}>{acc.platform}</span>
                    <div>
                      <div className="text-xs text-white">@{acc.username}</div>
                      {acc.label && <div className="text-[10px] text-slate-600">{acc.label}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    {acc.pending_count > 0 && (
                      <div>
                        <div className="text-[10px] text-slate-600">Pending</div>
                        <div className="text-xs font-bold text-amber-400">${fmt(acc.pending_amount)}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-[10px] text-slate-600">Earned</div>
                      <div className="text-xs font-bold text-emerald-400">${fmt(acc.total_earned)}</div>
                    </div>
                    <div className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      acc.health_status === 'healthy' ? 'bg-emerald-500/20 text-emerald-400' :
                      acc.health_status === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-rose-500/20 text-rose-400'
                    }`}>{acc.health_status || 'unknown'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {accounts.length === 0 && (
        <div className="px-5 py-6 text-center">
          <TrendingUp className="w-6 h-6 text-slate-700 mx-auto mb-1" />
          <p className="text-xs text-slate-600">No account payouts tracked yet</p>
        </div>
      )}
    </div>
  );
}