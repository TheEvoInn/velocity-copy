import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, TrendingUp, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_COLORS = {
  new: 'bg-blue-500/20 text-blue-400',
  reviewing: 'bg-amber-500/20 text-amber-400',
  queued: 'bg-violet-500/20 text-violet-400',
  executing: 'bg-cyan-500/20 text-cyan-400',
  submitted: 'bg-teal-500/20 text-teal-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  expired: 'bg-slate-500/20 text-slate-400',
  dismissed: 'bg-slate-600/20 text-slate-500',
  failed: 'bg-red-500/20 text-red-400',
};

export default function AdminOpportunities() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-opportunities'],
    queryFn: async () => {
      const res = await base44.functions.invoke('adminService', { action: 'list_opportunities' });
      return res.data;
    },
  });

  const opportunities = data?.opportunities || [];
  const statuses = ['all', 'new', 'queued', 'executing', 'completed', 'failed'];

  const filtered = opportunities.filter(o => {
    const matchSearch = !search || o.title?.toLowerCase().includes(search.toLowerCase()) || o.platform?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalValue = opportunities.filter(o => o.status === 'completed').reduce((s, o) => s + (o.profit_estimate_high || 0), 0);

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-slate-700 border-t-violet-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{opportunities.length}</p>
            <p className="text-xs text-slate-500">Total</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-cyan-400">{opportunities.filter(o => ['queued','executing'].includes(o.status)).length}</p>
            <p className="text-xs text-slate-500">Active</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">${totalValue.toFixed(0)}</p>
            <p className="text-xs text-slate-500">Est. Completed Value</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="pl-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500" />
        </div>
        {statuses.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${statusFilter === s ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800">
                <th className="text-left p-3 font-medium">Title</th>
                <th className="text-left p-3 font-medium">Platform</th>
                <th className="text-left p-3 font-medium">Category</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Score</th>
                <th className="text-left p-3 font-medium">Profit Est.</th>
                <th className="text-left p-3 font-medium">Created</th>
                <th className="text-left p-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="p-6 text-center text-slate-500">No opportunities found.</td></tr>
              ) : filtered.map(o => (
                <tr key={o.id} className="text-slate-300 hover:bg-slate-800/30 transition-colors">
                  <td className="p-3 max-w-48 truncate font-medium text-white">{o.title}</td>
                  <td className="p-3 text-slate-400">{o.platform || '—'}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 capitalize">{o.category || '—'}</span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full ${STATUS_COLORS[o.status] || 'bg-slate-700 text-slate-400'}`}>{o.status}</span>
                  </td>
                  <td className="p-3">
                    <span className={`font-bold ${o.overall_score >= 70 ? 'text-emerald-400' : o.overall_score >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                      {o.overall_score || '—'}
                    </span>
                  </td>
                  <td className="p-3 text-emerald-400">
                    {o.profit_estimate_low || o.profit_estimate_high ? `$${o.profit_estimate_low || 0}–$${o.profit_estimate_high || 0}` : '—'}
                  </td>
                  <td className="p-3 text-slate-500">{format(new Date(o.created_date), 'MMM d')}</td>
                  <td className="p-3">
                    {o.url && <a href={o.url} target="_blank" rel="noreferrer"><ExternalLink className="w-3.5 h-3.5 text-slate-500 hover:text-violet-400" /></a>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}