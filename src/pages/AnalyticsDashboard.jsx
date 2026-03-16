import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { BarChart2, TrendingUp, Target, Users, Award, Clock, Zap, ArrowUp, ArrowDown } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];

function MetricCard({ label, value, sub, color = 'text-white', icon: Icon, trend }) {
  return (
    <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-4">
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon className={`w-3.5 h-3.5 ${color}`} />}
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
      {trend !== undefined && (
        <div className={`flex items-center gap-0.5 text-[10px] mt-1 ${trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {trend >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
          {Math.abs(trend)}% vs last period
        </div>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs">
      <div className="text-slate-400 mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' && p.name?.toLowerCase().includes('revenue') ? '$' : ''}{p.value}</div>
      ))}
    </div>
  );
};

export default function AnalyticsDashboard() {
  const { data: logsData } = useQuery({
    queryKey: ['aiWorkLogs_analytics'],
    queryFn: () => base44.entities.AIWorkLog.list('-created_date', 500),
    initialData: []
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions_analytics'],
    queryFn: () => base44.entities.Transaction.list('-created_date', 200),
    initialData: []
  });

  const { data: identityData } = useQuery({
    queryKey: ['active_identity'],
    queryFn: () => base44.functions.invoke('identityEngine', { action: 'get_active' }),
    staleTime: 30000
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['linkedAccounts'],
    queryFn: () => base44.entities.LinkedAccount.list(),
    initialData: []
  });

  const logs = logsData || [];
  const allIdentities = identityData?.data?.all_identities || [];

  // ── Core metrics ─────────────────────────────────────────────────────────────
  const proposals = logs.filter(l => l.log_type === 'proposal_submitted');
  const won = proposals.filter(l => l.outcome?.toLowerCase().includes('win') || l.outcome?.toLowerCase().includes('hired'));
  const conversionRate = proposals.length ? ((won.length / proposals.length) * 100).toFixed(1) : 0;
  const totalRevenue = logs.reduce((s, l) => s + (l.revenue_associated || 0), 0)
    + transactions.filter(t => t.type === 'income').reduce((s, t) => s + (t.net_amount || t.amount || 0), 0);
  const jobsDone = logs.filter(l => l.log_type === 'job_completed').length;

  // ── Daily revenue trend (last 14 days) ───────────────────────────────────────
  const revenueByDay = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = subDays(new Date(), 13 - i);
      return { date: format(d, 'MMM d'), start: startOfDay(d).getTime(), revenue: 0, proposals: 0 };
    });
    logs.forEach(l => {
      if (!l.created_date) return;
      const t = new Date(l.created_date).getTime();
      const day = days.find((d, i) => t >= d.start && (i === days.length - 1 || t < days[i + 1].start));
      if (day) {
        day.revenue += l.revenue_associated || 0;
        if (l.log_type === 'proposal_submitted') day.proposals++;
      }
    });
    return days;
  }, [logs]);

  // ── Platform breakdown ────────────────────────────────────────────────────────
  const platformBreakdown = useMemo(() => {
    const map = {};
    logs.forEach(l => {
      const p = l.platform || 'unknown';
      if (!map[p]) map[p] = { platform: p, proposals: 0, revenue: 0, won: 0 };
      if (l.log_type === 'proposal_submitted') map[p].proposals++;
      if (l.log_type === 'proposal_submitted' && l.outcome?.includes('win')) map[p].won++;
      map[p].revenue += l.revenue_associated || 0;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [logs]);

  // ── Identity breakdown ────────────────────────────────────────────────────────
  const identityBreakdown = useMemo(() => {
    return allIdentities.map(id => ({
      name: id.name,
      earned: id.total_earned || 0,
      tasks: id.tasks_executed || 0,
      accounts: (id.linked_account_ids || []).length,
      color: id.color || COLORS[0]
    }));
  }, [allIdentities]);

  // ── Category performance ──────────────────────────────────────────────────────
  const categoryPerf = useMemo(() => {
    const map = {};
    logs.forEach(l => {
      const c = l.metadata?.category || 'other';
      if (!map[c]) map[c] = { category: c, revenue: 0, count: 0 };
      map[c].revenue += l.revenue_associated || 0;
      map[c].count++;
    });
    return Object.values(map).filter(c => c.revenue > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [logs]);

  // ── Account health ────────────────────────────────────────────────────────────
  const healthCounts = useMemo(() => {
    const c = { healthy: 0, warning: 0, cooldown: 0, suspended: 0, limited: 0 };
    accounts.forEach(a => { if (c[a.health_status] !== undefined) c[a.health_status]++; });
    return c;
  }, [accounts]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-blue-400" />
          Performance Analytics
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">Unified metrics across all identities, accounts & platforms</p>
      </div>

      {/* Core metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} color="text-emerald-400" icon={TrendingUp} />
        <MetricCard label="Conversion Rate" value={`${conversionRate}%`} sub={`${won.length}/${proposals.length} proposals won`} color="text-violet-400" icon={Target} />
        <MetricCard label="Jobs Completed" value={jobsDone} color="text-blue-400" icon={Award} />
        <MetricCard label="Active Identities" value={allIdentities.length} sub={`${accounts.length} linked accounts`} color="text-amber-400" icon={Users} />
      </div>

      {/* Revenue trend */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Revenue & Proposals — Last 14 Days</h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={revenueByDay}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="revenue" name="Revenue ($)" stroke="#10b981" fill="url(#revGrad)" strokeWidth={2} />
            <Bar dataKey="proposals" name="Proposals" fill="#8b5cf6" opacity={0.6} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Platform breakdown */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Platform Performance</h3>
          {platformBreakdown.length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-8">No platform data yet</p>
          ) : (
            <div className="space-y-3">
              {platformBreakdown.map((p, i) => {
                const cr = p.proposals ? ((p.won / p.proposals) * 100).toFixed(0) : 0;
                return (
                  <div key={p.platform} className="flex items-center gap-3">
                    <div className="w-20 text-xs text-slate-400 capitalize shrink-0">{p.platform}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] text-slate-500">{p.proposals} proposals · {cr}% CR</span>
                        <span className="text-[10px] text-emerald-400 font-semibold">${p.revenue.toFixed(0)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-800">
                        <div className="h-full rounded-full" style={{
                          width: `${Math.min(100, (p.revenue / (platformBreakdown[0]?.revenue || 1)) * 100)}%`,
                          background: COLORS[i % COLORS.length]
                        }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Identity breakdown */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Identity Performance</h3>
          {identityBreakdown.length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-8">No identities yet</p>
          ) : (
            <div className="space-y-3">
              {identityBreakdown.map(id => (
                <div key={id.name} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full shrink-0" style={{ background: id.color }} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-white">{id.name}</span>
                      <span className="text-xs text-emerald-400 font-semibold">${id.earned.toFixed(2)}</span>
                    </div>
                    <div className="text-[10px] text-slate-500">{id.tasks} tasks · {id.accounts} accounts</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Category heatmap */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Top Revenue Categories</h3>
          {categoryPerf.length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-8">No category data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={categoryPerf} layout="vertical">
                <XAxis type="number" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="category" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="revenue" name="Revenue ($)" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Account health */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Account Health Summary</h3>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { key: 'healthy', label: 'Healthy', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
              { key: 'warning', label: 'Warning', color: 'text-amber-400', bg: 'bg-amber-500/10' },
              { key: 'cooldown', label: 'Cooldown', color: 'text-blue-400', bg: 'bg-blue-500/10' },
              { key: 'suspended', label: 'Suspended', color: 'text-rose-400', bg: 'bg-rose-500/10' },
            ].map(h => (
              <div key={h.key} className={`rounded-xl p-3 ${h.bg} border border-transparent`}>
                <div className={`text-xl font-bold ${h.color}`}>{healthCounts[h.key]}</div>
                <div className="text-[10px] text-slate-500">{h.label}</div>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            {accounts.slice(0, 5).map(a => (
              <div key={a.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-400 capitalize">{a.platform} <span className="text-slate-600">@{a.username}</span></span>
                <span className={`font-medium ${
                  a.health_status === 'healthy' ? 'text-emerald-400' :
                  a.health_status === 'warning' ? 'text-amber-400' : 'text-rose-400'
                }`}>{a.health_status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Proposal conversion insights */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Proposal Intelligence</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Proposals', value: proposals.length, color: 'text-white' },
            { label: 'Won', value: won.length, color: 'text-emerald-400' },
            { label: 'Conversion Rate', value: `${conversionRate}%`, color: 'text-violet-400' },
            { label: 'Revenue from Wins', value: `$${won.reduce((s, l) => s + (l.revenue_associated || 0), 0).toFixed(0)}`, color: 'text-emerald-400' },
          ].map((m, i) => (
            <div key={i} className="text-center">
              <div className={`text-2xl font-bold ${m.color}`}>{m.value}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{m.label}</div>
            </div>
          ))}
        </div>

        {/* Winning proposal patterns */}
        {won.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-800">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Recent Wins</p>
            <div className="space-y-1.5">
              {won.slice(0, 3).map((w, i) => (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-400 shrink-0">✓</span>
                  <span className="text-slate-300 flex-1 truncate">{w.subject || 'Proposal'}</span>
                  <span className="text-slate-500 shrink-0 capitalize">{w.platform || '—'}</span>
                  {w.revenue_associated > 0 && <span className="text-emerald-400 shrink-0">${w.revenue_associated}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}