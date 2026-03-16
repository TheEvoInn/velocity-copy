import React from 'react';
import { AlertCircle, CheckCircle2, Clock, TrendingUp } from 'lucide-react';

export default function PayoutTimeline({ payouts }) {
  if (!payouts?.timeline || payouts.timeline.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">No payouts scheduled yet</p>
      </div>
    );
  }

  const now = new Date();
  const groupedByMonth = {};

  payouts.timeline.forEach(item => {
    const date = new Date(item.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!groupedByMonth[monthKey]) groupedByMonth[monthKey] = [];
    groupedByMonth[monthKey].push({ ...item, date });
  });

  const statusConfig = {
    discovered: { icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-950/20' },
    applying: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-950/20' },
    applied: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-950/20' },
    pending_verification: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-950/20' },
    won: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-950/20' },
    claimed: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-950/20' },
    expired: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-950/20' }
  };

  return (
    <div className="space-y-8">
      {Object.entries(groupedByMonth)
        .sort()
        .map(([monthKey, items]) => (
          <div key={monthKey}>
            <h3 className="text-sm font-semibold text-slate-300 mb-4 px-4 py-2 bg-slate-900/50 rounded-lg">
              {new Date(`${monthKey}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>

            <div className="space-y-3">
              {items
                .sort((a, b) => a.date - b.date)
                .map((item, idx) => {
                  const config = statusConfig[item.status] || statusConfig.discovered;
                  const Icon = config.icon;
                  const isOverdue = item.date < now;

                  return (
                    <div key={`${item.prize_id}-${idx}`} className={`rounded-lg border ${config.bg} border-slate-800 p-4 flex items-start gap-4 transition-all hover:border-slate-700`}>
                      <div className={`${config.color} mt-1`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{item.title}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Expected: {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        {isOverdue && (
                          <p className="text-xs text-red-400 mt-1">
                            ⚠️ {Math.floor((now - item.date) / (1000 * 60 * 60 * 24))} days overdue
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-emerald-400">${item.value.toLocaleString()}</p>
                        <p className="text-xs text-slate-500 mt-1 capitalize">{item.status}</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
    </div>
  );
}