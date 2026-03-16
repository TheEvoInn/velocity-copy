import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trophy, Filter, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PrizeScanPanel from '../components/prizes/PrizeScanPanel';
import PrizeCard from '../components/prizes/PrizeCard';
import PrizeStatsBar from '../components/prizes/PrizeStatsBar';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active', statuses: ['discovered', 'evaluating'] },
  { value: 'applied', label: 'Applied', statuses: ['applying', 'applied', 'pending_verification', 'confirmed'] },
  { value: 'won', label: 'Won 🏆', statuses: ['won', 'claimed'] },
  { value: 'action', label: '⚠️ Action Needed' },
  { value: 'closed', label: 'Closed', statuses: ['expired', 'dismissed', 'lost'] },
];

const TYPE_FILTERS = [
  'all', 'grant', 'sweepstakes', 'contest', 'giveaway', 'beta_reward', 'promo_credit', 'free_item', 'raffle', 'first_come'
];

export default function PrizeDashboard() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [applyingId, setApplyingId] = useState(null);
  const [claimResult, setClaimResult] = useState(null);

  const { data: opportunities = [], refetch } = useQuery({
    queryKey: ['prizeOpportunities'],
    queryFn: () => base44.entities.PrizeOpportunity.list('-created_date', 200),
    initialData: [],
    refetchInterval: 60000
  });

  const { data: statsRaw } = useQuery({
    queryKey: ['prizeStats'],
    queryFn: () => base44.functions.invoke('prizeEngine', { action: 'get_stats' }),
    staleTime: 30000
  });

  const stats = statsRaw?.data;

  // Needs-action opportunities
  const needsAction = opportunities.filter(o => o.requires_user_action && !['dismissed', 'expired', 'claimed'].includes(o.status));

  const filtered = opportunities.filter(o => {
    if (typeFilter !== 'all' && o.type !== typeFilter) return false;
    const sf = STATUS_FILTERS.find(f => f.value === statusFilter);
    if (!sf) return true;
    if (statusFilter === 'all') return true;
    if (statusFilter === 'action') return o.requires_user_action && !['dismissed', 'expired', 'claimed'].includes(o.status);
    if (sf.statuses) return sf.statuses.includes(o.status);
    return true;
  });

  const handleApply = async (opp) => {
    setApplyingId(opp.id);
    await base44.functions.invoke('prizeEngine', { action: 'apply', opportunity_id: opp.id });
    qc.invalidateQueries({ queryKey: ['prizeOpportunities'] });
    qc.invalidateQueries({ queryKey: ['prizeStats'] });
    qc.invalidateQueries({ queryKey: ['aiWorkLogs'] });
    setApplyingId(null);
  };

  const handleClaim = async (opp) => {
    const res = await base44.functions.invoke('prizeEngine', { action: 'claim', opportunity_id: opp.id });
    setClaimResult(res?.data);
    qc.invalidateQueries({ queryKey: ['prizeOpportunities'] });
    qc.invalidateQueries({ queryKey: ['prizeStats'] });
  };

  const handleDismiss = async (id) => {
    await base44.functions.invoke('prizeEngine', { action: 'dismiss', opportunity_id: id });
    qc.invalidateQueries({ queryKey: ['prizeOpportunities'] });
    qc.invalidateQueries({ queryKey: ['prizeStats'] });
  };

  const handleMarkWon = async (opp) => {
    await base44.functions.invoke('prizeEngine', { action: 'mark_won', opportunity_id: opp.id });
    qc.invalidateQueries({ queryKey: ['prizeOpportunities'] });
    qc.invalidateQueries({ queryKey: ['prizeStats'] });
  };

  const handleCheckStatus = async () => {
    await base44.functions.invoke('prizeEngine', { action: 'check_status' });
    qc.invalidateQueries({ queryKey: ['prizeOpportunities'] });
    qc.invalidateQueries({ queryKey: ['prizeStats'] });
    refetch();
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            Prize & Free-Opportunity Engine
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Grants · Giveaways · Contests · Sweepstakes · Beta Rewards · Free Value
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleCheckStatus} variant="outline" size="sm"
            className="border-slate-700 text-slate-400 hover:text-white text-xs h-8 gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Check Status
          </Button>
        </div>
      </div>

      {/* Stats */}
      <PrizeStatsBar stats={stats} />

      {/* Action required alert */}
      {needsAction.length > 0 && (
        <div className="rounded-2xl bg-amber-950/20 border border-amber-500/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-sm font-semibold text-amber-300">{needsAction.length} opportunit{needsAction.length !== 1 ? 'ies' : 'y'} require your attention</span>
          </div>
          <div className="space-y-1.5">
            {needsAction.map(o => (
              <div key={o.id} className="flex items-start gap-2 text-xs">
                <span className="text-amber-500 mt-0.5 shrink-0">·</span>
                <div>
                  <span className="text-white font-medium">{o.title}</span>
                  {o.user_action_description && <span className="text-amber-400/70 ml-2">{o.user_action_description}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scan panel */}
      <PrizeScanPanel onScanComplete={() => {
        qc.invalidateQueries({ queryKey: ['prizeOpportunities'] });
        qc.invalidateQueries({ queryKey: ['prizeStats'] });
      }} />

      {/* Claim result */}
      {claimResult && (
        <div className="rounded-2xl bg-emerald-950/20 border border-emerald-500/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-emerald-300">🏆 Prize Claim Instructions</span>
            <button onClick={() => setClaimResult(null)} className="text-slate-500 hover:text-white text-xs">✕</button>
          </div>
          {claimResult.claim_result?.auto_claimable
            ? <p className="text-xs text-emerald-400">✓ Auto-claimed successfully. Winnings routed to your wallet.</p>
            : (
              <div className="space-y-1">
                {claimResult.claim_result?.claim_steps?.map((step, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                    <span className="text-emerald-500 shrink-0">{i + 1}.</span> {step}
                  </div>
                ))}
                {claimResult.claim_result?.required_info?.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] text-slate-500 uppercase mb-1">Required Info</p>
                    {claimResult.claim_result.required_info.map((info, i) => (
                      <div key={i} className="text-xs text-amber-300">· {info}</div>
                    ))}
                  </div>
                )}
              </div>
            )
          }
        </div>
      )}

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
                statusFilter === f.value ? 'bg-slate-700 border-slate-600 text-white' : 'border-slate-800 text-slate-500 hover:text-slate-300'
              }`}>
              {f.label}
              {f.value === 'all' && ` (${opportunities.filter(o => o.status !== 'dismissed').length})`}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {TYPE_FILTERS.map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`text-[10px] px-2 py-0.5 rounded-lg border transition-colors capitalize ${
                typeFilter === t ? 'bg-violet-600/20 border-violet-500/40 text-violet-300' : 'border-slate-800 text-slate-600 hover:text-slate-400'
              }`}>
              {t.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Opportunity grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-slate-900/40 border border-slate-800 py-16 text-center">
          <Trophy className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No opportunities found.</p>
          <p className="text-xs text-slate-600 mt-1">Run a scan to discover grants, giveaways, contests & more.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(opp => (
            <PrizeCard
              key={opp.id}
              opp={opp}
              onApply={handleApply}
              onClaim={handleClaim}
              onDismiss={handleDismiss}
              onMarkWon={handleMarkWon}
              applying={applyingId === opp.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}