import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Search, Zap, Globe, Filter, Plus, ExternalLink, Loader2, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const CATEGORIES = [
  { id: 'all', label: 'All Opportunities' },
  { id: 'giveaway', label: '🎁 Giveaways' },
  { id: 'job', label: '💼 Jobs' },
  { id: 'gig', label: '⚡ Gigs' },
  { id: 'survey', label: '📋 Surveys' },
  { id: 'affiliate', label: '🔗 Affiliate' },
  { id: 'gaming', label: '🎮 Gaming' },
  { id: 'crypto', label: '₿ Crypto' },
  { id: 'grant', label: '💰 Grants' },
  { id: 'arbitrage', label: '📈 Arbitrage' },
];

const DIFFICULTY_COLOR = {
  easy: 'text-emerald-400',
  medium: 'text-amber-400',
  hard: 'text-red-400',
};

export default function GlobalOpportunityDiscovery() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    no_captcha: true,
    instant_only: false,
    no_signup: false,
    min_value: 0,
    max_value: 1000,
  });

  const discoveryMutation = useMutation({
    mutationFn: async (query) => {
      const res = await base44.functions.invoke('globalOpportunityDiscovery', {
        action: 'discover',
        searchQuery: query,
        filters: {
          ...filters,
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
        },
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Found ${data.count} opportunities!`);
    },
    onError: () => {
      toast.error('Failed to discover opportunities');
    },
  });

  const addOpportunityMutation = useMutation({
    mutationFn: async (opportunity) => {
      const res = await base44.functions.invoke('globalOpportunityDiscovery', {
        action: 'create_from_discovery',
        ...opportunity,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('✅ Opportunity added to your queue!');
    },
  });

  const handleDiscover = () => {
    if (!searchQuery.trim()) {
      discoveryMutation.mutate(null);
    } else {
      discoveryMutation.mutate(searchQuery);
    }
  };

  const opportunities = discoveryMutation.data?.opportunities || [];

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Globe className="w-6 h-6 text-cyan-400" />
          <h1 className="text-2xl font-bold text-white font-orbitron">Global Opportunity Discovery</h1>
        </div>
        <p className="text-sm text-slate-400">Discover worldwide profit opportunities with zero friction</p>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3 glass-card rounded-xl p-4">
        {/* Search Bar */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search for specific opportunities... (or leave blank for auto-discovery)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDiscover()}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>
          <Button
            onClick={handleDiscover}
            disabled={discoveryMutation.isPending}
            className="bg-cyan-600 hover:bg-cyan-500 gap-2"
          >
            {discoveryMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Discover
          </Button>
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="outline"
            className="border-slate-600"
          >
            <Filter className="w-4 h-4" />
          </Button>
        </div>

        {/* Category Pills */}
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`text-xs px-3 py-1.5 rounded-full transition-all ${
                selectedCategory === cat.id
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={filters.no_captcha}
                  onChange={(e) => setFilters(p => ({ ...p, no_captcha: e.target.checked }))}
                  className="w-3 h-3 accent-cyan-500"
                />
                No CAPTCHA
              </label>
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={filters.instant_only}
                  onChange={(e) => setFilters(p => ({ ...p, instant_only: e.target.checked }))}
                  className="w-3 h-3 accent-cyan-500"
                />
                Instant Claim Only
              </label>
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={filters.no_signup}
                  onChange={(e) => setFilters(p => ({ ...p, no_signup: e.target.checked }))}
                  className="w-3 h-3 accent-cyan-500"
                />
                No Signup
              </label>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-slate-400">Value Range: ${filters.min_value} - ${filters.max_value}</p>
              <input
                type="range"
                min="0"
                max="1000"
                value={filters.max_value}
                onChange={(e) => setFilters(p => ({ ...p, max_value: parseInt(e.target.value) }))}
                className="w-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {discoveryMutation.isPending && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-slate-400 text-sm">Searching the web for opportunities...</p>
        </div>
      )}

      {opportunities.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">
            {opportunities.length} Opportunities Found
          </p>
          <div className="grid gap-3">
            {opportunities.map((opp, i) => (
              <Card
                key={i}
                className="bg-slate-900 border-slate-800 hover:border-cyan-600/50 transition-all"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start gap-2">
                        <h3 className="font-semibold text-white text-sm flex-1">{opp.title}</h3>
                        <span className={`text-xs font-bold ${DIFFICULTY_COLOR[opp.difficulty] || 'text-slate-400'}`}>
                          {opp.difficulty?.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{opp.description}</p>
                      <div className="flex gap-3 flex-wrap">
                        <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300">
                          {opp.category}
                        </span>
                        {opp.instant_claim && (
                          <span className="text-xs bg-emerald-900/50 text-emerald-300 px-2 py-1 rounded">
                            ⚡ Instant Claim
                          </span>
                        )}
                        {!opp.has_captcha && (
                          <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-1 rounded">
                            No CAPTCHA
                          </span>
                        )}
                        {!opp.signup_required && (
                          <span className="text-xs bg-purple-900/50 text-purple-300 px-2 py-1 rounded">
                            No Signup
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Est. Value</p>
                        <p className="text-lg font-bold text-emerald-400">${opp.estimated_value || 0}</p>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={opp.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <Button
                          onClick={() => addOpportunityMutation.mutate(opp)}
                          disabled={addOpportunityMutation.isPending}
                          size="sm"
                          className="bg-cyan-600 hover:bg-cyan-500 gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!discoveryMutation.isPending && opportunities.length === 0 && discoveryMutation.data && (
        <div className="text-center py-12">
          <p className="text-slate-500 text-sm">No opportunities found. Try different filters or search terms.</p>
        </div>
      )}

      {!discoveryMutation.data && (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6 text-center space-y-3">
            <TrendingUp className="w-8 h-8 text-cyan-400 mx-auto opacity-50" />
            <p className="text-slate-400 text-sm">Click "Discover" to start searching for global profit opportunities</p>
            <p className="text-xs text-slate-600">We'll find free, CAPTCHA-free, instant-claim opportunities for you</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}