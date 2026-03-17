import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm font-bold text-emerald-400">${payload[0].value?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
      </div>
    );
  }
  return null;
};

export default function ProfitChart({ transactions = [] }) {
  const chartData = React.useMemo(() => {
    const income = transactions.filter(t => t.type === 'income');
    if (income.length === 0) return [];

    const grouped = {};
    let cumulative = 0;

    const sorted = [...income].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

    sorted.forEach(t => {
      const date = new Date(t.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      cumulative += (t.net_amount ?? t.amount ?? 0);
      grouped[date] = parseFloat(cumulative.toFixed(2));
    });

    return Object.entries(grouped).map(([date, amount]) => ({ date, amount }));
  }, [transactions]);

  const totalEarned = chartData.length > 0 ? chartData[chartData.length - 1].amount : 0;

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Cumulative Profit Curve</span>
        </div>
        {totalEarned > 0 && (
          <span className="text-sm font-bold text-emerald-400">
            ${totalEarned.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        )}
      </div>

      {chartData.length === 0 ? (
        <div className="h-48 flex items-center justify-center">
          <p className="text-xs text-slate-600">No income transactions yet. Log your first transaction to see the profit curve.</p>
        </div>
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#64748b' }}
                interval="preserveStartEnd"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickFormatter={v => `$${v}`}
                width={55}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#profitGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}