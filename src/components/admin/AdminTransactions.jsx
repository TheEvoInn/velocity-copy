import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminTransactions() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-transactions'],
    queryFn: async () => {
      const res = await base44.functions.invoke('adminService', { action: 'list_transactions' });
      return res.data;
    },
  });

  const transactions = data?.transactions || [];

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
  const netProfit = totalIncome - totalExpense;

  const filtered = transactions.filter(t => {
    const matchSearch = !search || t.description?.toLowerCase().includes(search.toLowerCase()) || t.platform?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || t.type === typeFilter;
    return matchSearch && matchType;
  });

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
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-slate-500">Total Income</span>
            </div>
            <p className="text-2xl font-bold text-emerald-400">${totalIncome.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownCircle className="w-4 h-4 text-red-400" />
              <span className="text-xs text-slate-500">Total Expenses</span>
            </div>
            <p className="text-2xl font-bold text-red-400">${totalExpense.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-slate-500">Net Profit</span>
            </div>
            <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>${netProfit.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transactions..." className="pl-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500" />
        </div>
        {['all','income','expense','transfer','investment'].map(t => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${typeFilter === t ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800">
                <th className="text-left p-3 font-medium">Type</th>
                <th className="text-left p-3 font-medium">Amount</th>
                <th className="text-left p-3 font-medium">Net</th>
                <th className="text-left p-3 font-medium">Platform</th>
                <th className="text-left p-3 font-medium">Category</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Description</th>
                <th className="text-left p-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="p-6 text-center text-slate-500">No transactions found.</td></tr>
              ) : filtered.map(t => (
                <tr key={t.id} className="text-slate-300 hover:bg-slate-800/30 transition-colors">
                  <td className="p-3">
                    <span className={`flex items-center gap-1 ${t.type === 'income' ? 'text-emerald-400' : t.type === 'expense' ? 'text-red-400' : 'text-blue-400'}`}>
                      {t.type === 'income' ? <ArrowUpCircle className="w-3 h-3" /> : <ArrowDownCircle className="w-3 h-3" />}
                      {t.type}
                    </span>
                  </td>
                  <td className="p-3 font-bold text-white">${(t.amount || 0).toFixed(2)}</td>
                  <td className="p-3 text-emerald-400">${(t.net_amount || t.amount || 0).toFixed(2)}</td>
                  <td className="p-3 text-slate-400">{t.platform || '—'}</td>
                  <td className="p-3"><span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 capitalize">{t.category || '—'}</span></td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${t.payout_status === 'cleared' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {t.payout_status || 'available'}
                    </span>
                  </td>
                  <td className="p-3 max-w-40 truncate text-slate-400">{t.description || '—'}</td>
                  <td className="p-3 text-slate-500">{format(new Date(t.created_date), 'MMM d, yyyy')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}