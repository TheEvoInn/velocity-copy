import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import APICard from '@/components/api/APICard';
import { Search, RefreshCw, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function APIDiscoveryDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('readiness');
  const navigate = useNavigate();

  const { data: apis = [], isLoading, refetch } = useQuery({
    queryKey: ['apis'],
    queryFn: async () => {
      const list = await base44.entities.APIMetadata.list('-updated_date', 100);
      return list || [];
    },
  });

  const { data: stats = {} } = useQuery({
    queryKey: ['api-stats'],
    queryFn: async () => {
      const allAPIs = await base44.entities.APIMetadata.list('-created_date', 100);
      return {
        total: allAPIs.length,
        verified: allAPIs.filter(a => a.verification_status === 'verified').length,
        high_readiness: allAPIs.filter(a => a.execution_readiness_score >= 75).length,
        in_use: allAPIs.reduce((sum, a) => sum + (a.usage_count || 0), 0),
      };
    },
  });

  // Filter and sort
  let filtered = apis.filter(api => {
    const matchesSearch = api.api_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      api.api_url.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || api.verification_status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  filtered.sort((a, b) => {
    if (sortBy === 'readiness') return (b.execution_readiness_score || 0) - (a.execution_readiness_score || 0);
    if (sortBy === 'name') return a.api_name.localeCompare(b.api_name);
    if (sortBy === 'usage') return (b.usage_count || 0) - (a.usage_count || 0);
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-violet-400" />
          API Discovery Hub
        </h1>
        <p className="text-sm text-slate-400">Discover, manage, and execute APIs autonomously</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total APIs', value: stats.total, color: 'text-cyan-300' },
          { label: 'Verified', value: stats.verified, color: 'text-emerald-300' },
          { label: 'Ready to Use', value: stats.high_readiness, color: 'text-violet-300' },
          { label: 'Total Executions', value: stats.in_use, color: 'text-amber-300' },
        ].map((stat, i) => (
          <Card key={i} className="bg-slate-900/50 border-slate-700 p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wider">{stat.label}</div>
            <div className={`text-2xl font-bold ${stat.color} mt-2`}>{stat.value}</div>
          </Card>
        ))}
      </div>

      {/* Controls */}
      <div className="space-y-3 bg-slate-900/30 border border-slate-800 rounded-lg p-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Search APIs by name or URL..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 bg-slate-800 border-slate-700"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-slate-700 text-slate-400 hover:text-slate-300"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex gap-2 flex-wrap">
          <div className="flex gap-1">
            {['all', 'verified', 'unreliable', 'pending'].map(status => (
              <Button
                key={status}
                variant={filterStatus === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus(status)}
                className="text-xs capitalize"
              >
                {status}
              </Button>
            ))}
          </div>

          <div className="flex gap-1 ml-auto">
            {['readiness', 'name', 'usage'].map(sort => (
              <Button
                key={sort}
                variant={sortBy === sort ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy(sort)}
                className="text-xs capitalize"
              >
                {sort}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* API List */}
      {isLoading ? (
        <div className="text-center py-8 text-slate-400">Loading APIs...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-slate-400">No APIs match your filters</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(api => (
            <APICard
              key={api.id}
              api={api}
              onClick={() => navigate(`/APIManagement?api=${api.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}