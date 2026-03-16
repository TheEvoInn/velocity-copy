import React from 'react';
import { Trophy, Clock, AlertTriangle, DollarSign, Radar, CheckCircle2 } from 'lucide-react';

export default function PrizeStatsBar({ stats }) {
  if (!stats) return null;
  const items = [
    { icon: Radar, label: 'Discovered', value: stats.by_status?.discovered || 0, color: 'text-violet-400' },
    { icon: Clock, label: 'Applied', value: (stats.by_status?.applied || 0) + (stats.by_status?.pending_verification || 0), color: 'text-blue-400' },
    { icon: Trophy, label: 'Won', value: (stats.by_status?.won || 0) + (stats.by_status?.claimed || 0), color: 'text-amber-400' },
    { icon: DollarSign, label: 'Value Won', value: `$${(stats.total_won || 0).toLocaleString()}`, color: 'text-emerald-400' },
    { icon: Clock, label: 'Pending Value', value: `$${(stats.total_pending || 0).toLocaleString()}`, color: 'text-amber-400' },
    { icon: AlertTriangle, label: 'Action Needed', value: stats.needs_action?.length || 0, color: 'text-rose-400' },
  ];

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-2xl bg-slate-900/60 border border-slate-800 p-3 text-center">
          <item.icon className={`w-4 h-4 mx-auto mb-1 ${item.color}`} />
          <div className={`text-lg font-bold ${item.color}`}>{item.value}</div>
          <div className="text-[9px] text-slate-600 mt-0.5">{item.label}</div>
        </div>
      ))}
    </div>
  );
}