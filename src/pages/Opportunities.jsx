import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Target, Search, Zap, Star, EyeOff, Sparkles, Play, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import OpportunityCard from '../components/dashboard/OpportunityCard';
import OpportunityDetail from '../components/opportunity/OpportunityDetail';
import OpportunityExecutionHub from '../components/opportunity/OpportunityExecutionHub';
import LiveIngestionPanel from '../components/ingestion/LiveIngestionPanel';
import BatchExecutionModal from '../components/opportunity/BatchExecutionModal';

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
  { value: 'queued', label: 'Queued' },
  { value: 'executing', label: 'Executing' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'dismissed', label: 'Dismissed' },
];

export default function Opportunities() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [showIngestion, setShowIngestion] = useState(true);
  const [lastScanResult, setLastScanResult] = useState(null);
  const [showBatchExecution, setShowBatchExecution] = useState(false);
  const [executionHubOpp, setExecutionHubOpp] = useState(null);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    const handleOpenExecutionHub = (e) => {
      setExecutionHubOpp(e.detail);
    };
    window.addEventListener('openExecutionHub', handleOpenExecutionHub);
    return () => window.removeEventListener('openExecutionHub', handleOpenExecutionHub);
  }, []);

  const { data: opportunities = [] } = useQuery({
    queryKey: ['opportunities'],
    queryFn: () => base44.entities.Opportunity.list('-overall_score', 100),
    initialData: [],
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.Transaction.list('-created_date', 100),
    initialData: [],
  });

  const filtered = opportunities.filter(o => {
    if (category !== 'all' && o.category !== category) return false;
    if (status !== 'all' && o.status !== status) return false;
    if (search && !o.title?.toLowerCase().includes(search.toLowerCase()) && !o.description?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const newOppsCount = filtered.filter(o => o.status === 'new').length;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {selectedOpp && <OpportunityDetail opportunity={selectedOpp} onClose={() => setSelectedOpp(null)} />}
      {executionHubOpp && <OpportunityExecutionHub opportunity={executionHubOpp} onClose={() => setExecutionHubOpp(null)} />}
      {showBatchExecution && (
        <BatchExecutionModal
          opportunities={filtered}
          onClose={() => setShowBatchExecution(false)}
          onSuccess={() => {
            setShowBatchExecution(false);
            queryClient.invalidateQueries({ queryKey: ['opportunities'] });
          }}
        />
      )}
      {showAnalytics && (
        <AdvancedAnalyticsOverlay
          opportunities={opportunities}
          transactions={transactions}
          onClose={() => setShowAnalytics(false)}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-amber-400" />
            Live Opportunities
            {lastScanResult?.new_opportunities > 0 && (
              <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                +{lastScanResult.new_opportunities} new
              </Badge>
            )}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {filtered.length} opportunities · real-time authenticated feed
          </p>
        </div>
        <div className="flex items-center gap-2">
          {newOppsCount > 0 && (
            <Button
              onClick={() => setShowBatchExecution(true)}
              size="sm"
              className="text-xs bg-emerald-600 hover:bg-emerald-700"
            >
              <Play className="w-3.5 h-3.5 mr-1" />
              Auto-Execute ({newOppsCount})
            </Button>
          )}
          <Button
            onClick={() => setShowAnalytics(true)}
            size="sm"
            variant="outline"
            className="text-xs border-slate-700 text-slate-400 hover:text-white"
          >
            <BarChart3 className="w-3.5 h-3.5 mr-1" />
            Analytics
          </Button>
          <button
            onClick={() => setShowIngestion(v => !v)}
            className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1.5 transition-colors"
          >
            <Zap className="w-3.5 h-3.5 text-emerald-500" />
            {showIngestion ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      {showIngestion && (
        <div className="mb-5">
          <LiveIngestionPanel onScanComplete={setLastScanResult} />
        </div>
      )}

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
          <div key={opp.id} className="relative group cursor-pointer" onClick={() => setSelectedOpp(opp)}>
            {/* Hidden / Premium badges */}
            {(opp.tags?.includes('hidden') || opp.tags?.includes('premium')) && (
              <div className="absolute top-2 right-2 z-10 flex gap-1">
                {opp.tags?.includes('hidden') && (
                  <span className="flex items-center gap-0.5 text-[9px] bg-violet-500/20 text-violet-400 border border-violet-500/30 px-1.5 py-0.5 rounded-full">
                    <EyeOff className="w-2.5 h-2.5" /> hidden
                  </span>
                )}
                {opp.tags?.includes('premium') && (
                  <span className="flex items-center gap-0.5 text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full">
                    <Star className="w-2.5 h-2.5" /> premium
                  </span>
                )}
              </div>
            )}
            {/* Status indicator */}
            {opp.status && (
              <div className="absolute top-2 left-2 z-10">
                <Badge variant="outline" className={`text-[10px] ${
                  opp.status === 'completed' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                  opp.status === 'executing' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                  opp.status === 'queued' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                  'bg-slate-500/10 border-slate-500/30 text-slate-400'
                }`}>
                  {opp.status}
                </Badge>
              </div>
            )}
            <OpportunityCard opportunity={opp} />
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Search className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-sm text-slate-500 mb-1">No opportunities match your filters.</p>
          <p className="text-xs text-slate-600 mb-4">Run a live scan above to ingest fresh jobs from authenticated platform feeds.</p>
        </div>
      )}
    </div>
  );
}