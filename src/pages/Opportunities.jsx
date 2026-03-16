import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Target, Filter, Search, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import OpportunityCard from '../components/dashboard/OpportunityCard';
import OpportunityDetail from '../components/opportunity/OpportunityDetail';

const categories = [
  { value: 'all', label: 'All Categories' },
  { value: 'arbitrage', label: 'Arbitrage' },
  { value: 'service', label: 'Service' },
  { value: 'lead_gen', label: 'Lead Gen' },
  { value: 'digital_flip', label: 'Digital Flip' },
  { value: 'auction', label: 'Auction' },
  { value: 'market_inefficiency', label: 'Market Gap' },
  { value: 'trend_surge', label: 'Trend Surge' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'resale', label: 'Resale' },
];

const statuses = [
  { value: 'all', label: 'All Status' },
  { value: 'new', label: 'New' },
  { value: 'executing', label: 'Executing' },
  { value: 'completed', label: 'Completed' },
  { value: 'dismissed', label: 'Dismissed' },
];

export default function Opportunities() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [selectedOpp, setSelectedOpp] = useState(null);

  const { data: opportunities = [] } = useQuery({
    queryKey: ['opportunities'],
    queryFn: () => base44.entities.Opportunity.list('-overall_score', 100),
    initialData: [],
  });

  const filtered = opportunities.filter(o => {
    if (category !== 'all' && o.category !== category) return false;
    if (status !== 'all' && o.status !== status) return false;
    if (search && !o.title?.toLowerCase().includes(search.toLowerCase()) && !o.description?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {selectedOpp && <OpportunityDetail opportunity={selectedOpp} onClose={() => setSelectedOpp(null)} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-amber-400" />
            Opportunities
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">{filtered.length} opportunities found</p>
        </div>
        <Link to="/Chat">
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8">
            <Zap className="w-3.5 h-3.5 mr-1" /> Scan Now
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
            <Input
              placeholder="Search opportunities..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 text-xs"
            />
          </div>
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-40 bg-slate-900 border-slate-800 text-white text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36 bg-slate-900 border-slate-800 text-white text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(opp => (
          <OpportunityCard key={opp.id} opportunity={opp} onClick={() => setSelectedOpp(opp)} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Search className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No opportunities match your filters.</p>
          <Link to="/Chat">
            <Button size="sm" className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs">
              <Zap className="w-3.5 h-3.5 mr-1" /> Ask AI to find some
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}