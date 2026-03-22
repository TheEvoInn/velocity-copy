/**
 * IdentityMetricsPanel — Aggregate metrics across all identities
 * Live synced via useUserIdentities
 */
import React from 'react';
import { TrendingUp, Zap, Shield, Globe, Award, Users } from 'lucide-react';

export default function IdentityMetricsPanel({ identities = [], linkedAccounts = [] }) {
  const totalTasks = identities.reduce((s, i) => s + (i.tasks_executed || 0), 0);
  const totalEarned = identities.reduce((s, i) => s + (i.total_earned || 0), 0);
  const totalAccounts = identities.reduce((s, i) => s + (i.linked_account_ids?.length || 0), 0);
  const activeId = identities.find(i => i.is_active);
  const avgEarnPerTask = totalTasks > 0 ? totalEarned / totalTasks : 0;

  // Platform coverage
  const platforms = [...new Set(linkedAccounts.map(a => a.platform))];
  const healthyAccounts = linkedAccounts.filter(a => a.health_status === 'healthy').length;

  const stats = [
    { label: 'IDENTITIES', value: identities.length, color: '#a855f7', icon: Users },
    { label: 'TOTAL TASKS', value: totalTasks, color: '#00e8ff', icon: Zap, pulse: totalTasks > 0 },
    { label: 'TOTAL EARNED', value: `$${totalEarned.toFixed(0)}`, color: '#10b981', icon: TrendingUp },
    { label: 'PLATFORMS', value: platforms.length, color: '#f9d65c', icon: Globe },
    { label: 'ACCOUNTS', value: totalAccounts, color: '#3b82f6', icon: Shield },
    { label: 'AVG/TASK', value: `$${avgEarnPerTask.toFixed(2)}`, color: '#ff2ec4', icon: Award },
  ];

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
      {stats.map(s => (
        <div key={s.label} className="rounded-2xl p-3 relative overflow-hidden"
          style={{ background: 'rgba(10,15,42,0.7)', border: `1px solid ${s.color}18` }}>
          <div className="absolute inset-0 pointer-events-none opacity-5"
            style={{ background: `radial-gradient(ellipse at top left, ${s.color}, transparent 70%)` }} />
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-orbitron tracking-widest" style={{ color: `${s.color}70` }}>{s.label}</span>
              <s.icon className="w-3 h-3" style={{ color: s.color }} />
            </div>
            <div className="text-lg font-orbitron font-bold flex items-center gap-1" style={{ color: s.color }}>
              {s.value}
              {s.pulse && s.value > 0 && (
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: s.color }} />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}