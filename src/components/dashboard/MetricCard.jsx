import React from 'react';

export default function MetricCard({ icon: Icon, label, value, sublabel, color = "emerald" }) {
  const colors = {
    emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", icon: "text-emerald-400" },
    blue: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400", icon: "text-blue-400" },
    amber: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400", icon: "text-amber-400" },
    rose: { bg: "bg-rose-500/10", border: "border-rose-500/20", text: "text-rose-400", icon: "text-rose-400" },
    violet: { bg: "bg-violet-500/10", border: "border-violet-500/20", text: "text-violet-400", icon: "text-violet-400" },
  };
  
  const c = colors[color] || colors.emerald;
  
  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 hover:border-slate-700 transition-colors">
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1.5 rounded-lg ${c.bg} ${c.border} border`}>
          <Icon className={`w-3.5 h-3.5 ${c.icon}`} />
        </div>
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${c.text}`}>{value}</div>
      {sublabel && <div className="text-xs text-slate-500 mt-1">{sublabel}</div>}
    </div>
  );
}