import React from 'react';
import { Activity, Zap, TrendingUp, AlertCircle } from 'lucide-react';

export default function DepartmentActivityRings({ opportunities, tasks, transactions, identities }) {
  const departments = [
    {
      name: 'Observatory',
      color: 'from-amber-500 to-orange-600',
      icon: '🔭',
      activity: opportunities?.length || 0,
      metric: 'opportunities found',
      accentColor: 'text-amber-400',
      bgColor: 'bg-amber-500/20',
    },
    {
      name: 'Execution',
      color: 'from-blue-500 to-cyan-600',
      icon: '🚀',
      activity: tasks?.length || 0,
      metric: 'tasks processed',
      accentColor: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
    },
    {
      name: 'Treasury',
      color: 'from-emerald-500 to-teal-600',
      icon: '💎',
      activity: transactions?.length || 0,
      metric: 'transactions logged',
      accentColor: 'text-emerald-400',
      bgColor: 'bg-emerald-500/20',
    },
    {
      name: 'Core Hub',
      color: 'from-purple-500 to-pink-600',
      icon: '⚙️',
      activity: identities?.length || 0,
      metric: 'identities active',
      accentColor: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
    },
  ];

  return (
    <div className="space-y-3">
      <h3 className="font-orbitron text-sm font-bold text-cyan-300 tracking-widest flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        DEPARTMENT VITALS
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {departments.map((dept, idx) => (
          <div
            key={idx}
            className="glass-card rounded-xl p-3 border border-slate-700/50 relative overflow-hidden group hover:border-slate-600 transition-all"
          >
            {/* Background gradient */}
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity bg-gradient-to-r ${dept.color}`} />

            {/* Content */}
            <div className="relative z-10 flex items-center gap-3">
              {/* Icon */}
              <div className={`w-10 h-10 rounded-lg ${dept.bgColor} flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform`}>
                {dept.icon}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400 font-mono mb-0.5">{dept.name}</p>
                <div className="flex items-baseline gap-2">
                  <span className={`font-orbitron font-bold text-lg ${dept.accentColor}`}>
                    {dept.activity}
                  </span>
                  <span className="text-xs text-slate-500">{dept.metric}</span>
                </div>
              </div>

              {/* Activity indicator */}
              <div className={`w-3 h-3 rounded-full ${dept.bgColor} border border-current ${dept.accentColor} animate-pulse shrink-0`} />
            </div>

            {/* Progress bar */}
            <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${dept.color} transition-all duration-1000`}
                style={{ width: `${Math.min((dept.activity / 20) * 100, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}