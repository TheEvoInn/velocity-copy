/**
 * OPPORTUNITIES PAGE
 * Comprehensive opportunity management with real-time filtering and analytics
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useOpportunitiesV2, useUserGoalsV2 } from '@/lib/velocityHooks';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, Filter, Search } from 'lucide-react';

export default function Opportunities() {
  const { opportunities } = useOpportunitiesV2();
  const { goals } = useUserGoalsV2();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = opportunities.filter(o => {
    const matchesSearch = o.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         o.platform?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || o.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const categories = [...new Set(opportunities.map(o => o.category))].filter(Boolean);
  const statuses = ['new', 'reviewing', 'queued', 'executing', 'completed', 'failed', 'dismissed'];

  const stats = {
    total: opportunities.length,
    active: opportunities.filter(o => ['new', 'reviewing', 'queued', 'executing'].includes(o.status)).length,
    value: opportunities
      .filter(o => ['new', 'reviewing', 'queued', 'executing'].includes(o.status))
      .reduce((s, o) => s + (o.profit_estimate_high || 0), 0),
    completed: opportunities.filter(o => o.status === 'completed').length,
  };

  return (
    <div className="min-h-screen galaxy-bg p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-orbitron text-2xl font-bold text-white mb-4">Opportunities</h1>
          <div className="grid grid-cols-4 gap-3">
            <Card className="glass-card p-3">
              <div className="text-xs text-slate-400">Total</div>
              <div className="text-xl font-bold text-cyan-400">{stats.total}</div>
            </Card>
            <Card className="glass-card p-3">
              <div className="text-xs text-slate-400">Active</div>
              <div className="text-xl font-bold text-emerald-400">{stats.active}</div>
            </Card>
            <Card className="glass-card p-3">
              <div className="text-xs text-slate-400">Est. Value</div>
              <div className="text-xl font-bold text-amber-400">${(stats.value / 1000).toFixed(1)}k</div>
            </Card>
            <Card className="glass-card p-3">
              <div className="text-xs text-slate-400">Completed</div>
              <div className="text-xl font-bold text-violet-400">{stats.completed}</div>
            </Card>
          </div>
        </div>

        {/* Filters */}
        <Card className="glass-card p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by title or platform..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg pl-9 pr-3 py-2 text-white text-sm"
                />
              </div>
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="all">All Status</option>
              {statuses.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
        </Card>

        {/* Opportunities List */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <Card className="glass-card p-8 text-center">
              <div className="text-slate-400">No opportunities match your filters</div>
            </Card>
          ) : (
            filtered.map(opp => (
              <Card key={opp.id} className="glass-card p-4 hover:border-violet-500/40 transition cursor-pointer">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">{opp.title}</h3>
                    <p className="text-sm text-slate-400 mt-1">{opp.platform || 'Unknown'}</p>
                    <div className="flex gap-2 mt-2">
                      <span className="text-xs px-2 py-1 rounded bg-slate-800/50 text-slate-300 capitalize">{opp.category}</span>
                      <span className="text-xs px-2 py-1 rounded bg-slate-800/50 text-slate-300 capitalize">{opp.status}</span>
                    </div>
                  </div>
                  <div className="ml-4 text-right shrink-0">
                    <div className="text-lg font-bold text-emerald-400">${opp.profit_estimate_high || 0}</div>
                    <div className="text-xs text-slate-500 mt-1">Score: {opp.overall_score || 0}</div>
                    {opp.velocity_score && (
                      <div className="text-xs text-amber-400 mt-1">⚡ {opp.velocity_score}</div>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}