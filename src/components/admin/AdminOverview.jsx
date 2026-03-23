import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, TrendingUp, DollarSign, Shield, CheckCircle2, Clock, Activity, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { format } from 'date-fns';

export default function AdminOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const res = await base44.functions.invoke('adminService', { action: 'get_stats' });
      return res.data;
    },
    refetchInterval: 30000,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-slate-700 border-t-violet-500 rounded-full animate-spin" />
    </div>
  );

  const stats = data?.stats || {};

  const statCards = [
    { label: 'Total Users', value: stats.total_users || 0, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Active Opportunities', value: stats.active_opportunities || 0, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Completed', value: stats.completed_opportunities || 0, icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Total Revenue', value: `$${(stats.total_revenue || 0).toFixed(2)}`, icon: DollarSign, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'AI Identities', value: stats.total_identities || 0, icon: Zap, color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { label: 'KYC Pending', value: stats.kyc_pending || 0, icon: Clock, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: 'KYC Approved', value: stats.kyc_approved || 0, icon: Shield, color: 'text-teal-400', bg: 'bg-teal-500/10' },
    { label: 'Total Opportunities', value: stats.total_opportunities || 0, icon: Activity, color: 'text-pink-400', bg: 'bg-pink-500/10' },
  ];

  const recentActivity = stats.recent_activity || [];

  // Build user growth chart from users
  const usersByDay = {};
  (stats.users || []).forEach(u => {
    const day = format(new Date(u.created_date), 'MMM d');
    usersByDay[day] = (usersByDay[day] || 0) + 1;
  });
  const userChartData = Object.entries(usersByDay).slice(-7).map(([day, count]) => ({ day, count }));

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Card key={s.label} className="bg-slate-900 border-slate-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-xs text-slate-500">{s.label}</p>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">User Registrations (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={userChartData}>
                <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' }} />
                <Bar dataKey="count" fill="#7c3aed" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">Recent System Activity</CardTitle>
          </CardHeader>
          <CardContent className="max-h-52 overflow-y-auto space-y-2">
            {recentActivity.length === 0 ? (
              <p className="text-xs text-slate-500">No recent activity.</p>
            ) : recentActivity.map((log, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                  log.severity === 'critical' ? 'bg-red-500' :
                  log.severity === 'warning' ? 'bg-amber-500' :
                  log.severity === 'success' ? 'bg-emerald-500' : 'bg-blue-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-slate-300 truncate">{log.message}</p>
                  <p className="text-slate-600">{format(new Date(log.created_date), 'MMM d, HH:mm')}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Users Table Preview */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-300">Registered Users</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800">
                <th className="text-left pb-2 font-medium">Name</th>
                <th className="text-left pb-2 font-medium">Email</th>
                <th className="text-left pb-2 font-medium">Role</th>
                <th className="text-left pb-2 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {(stats.users || []).slice(0, 10).map(u => (
                <tr key={u.id} className="text-slate-300">
                  <td className="py-2">{u.full_name || '—'}</td>
                  <td className="py-2">{u.email}</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${u.role === 'admin' ? 'bg-violet-500/20 text-violet-400' : 'bg-slate-700 text-slate-400'}`}>
                      {u.role || 'user'}
                    </span>
                  </td>
                  <td className="py-2 text-slate-500">{format(new Date(u.created_date), 'MMM d, yyyy')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}