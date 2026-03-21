/**
 * AI Discovery Cards Component
 * Displays ranked discovery opportunities with one-click actions
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Zap, TrendingUp, Clock, AlertCircle, CheckCircle2,
  DollarSign, Coins, Store, Plus, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

export default function AIDiscoveryCards({ opportunities = [], loading = false, onRefresh }) {
  const queryClient = useQueryClient();
  const [selectedOpps, setSelectedOpps] = useState(new Set());

  const createStorefrontMutation = useMutation({
    mutationFn: async ({ opportunity_id, title }) => {
      const res = await base44.functions.invoke('aiDiscoveryEngine', {
        action: 'create_storefront_from_discovery',
        opportunity_id,
        title
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success('Storefront created! Ready for customization.');
      queryClient.invalidateQueries({ queryKey: ['storefronts'] });
    },
    onError: (err) => toast.error(err.message),
  });

  const createStakingMutation = useMutation({
    mutationFn: async ({ opportunity_id, token_symbol }) => {
      const res = await base44.functions.invoke('aiDiscoveryEngine', {
        action: 'create_staking_from_discovery',
        opportunity_id,
        token_symbol
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success('Staking position initialized!');
      queryClient.invalidateQueries({ queryKey: ['stakingPositions'] });
    },
    onError: (err) => toast.error(err.message),
  });

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-64 rounded-xl bg-slate-800/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!opportunities || opportunities.length === 0) {
    return (
      <Card className="border-slate-700">
        <CardContent className="p-8 text-center">
          <Zap className="w-12 h-12 text-slate-400 mx-auto mb-3 opacity-50" />
          <p className="text-slate-400">No opportunities available at this time.</p>
          <Button onClick={onRefresh} variant="outline" className="mt-4 gap-2">
            <Zap className="w-4 h-4" />
            Scan Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          Ranked Discovery Opportunities ({opportunities.length})
        </h3>
        <Button
          onClick={onRefresh}
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={loading}
        >
          <Zap className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {opportunities.map((opp, idx) => (
          <DiscoveryCard
            key={opp.id}
            opportunity={opp}
            rank={idx + 1}
            onCreateStorefront={() =>
              createStorefrontMutation.mutate({
                opportunity_id: opp.id,
                title: opp.title
              })
            }
            onCreateStaking={() =>
              createStakingMutation.mutate({
                opportunity_id: opp.id,
                token_symbol: opp.token_symbol
              })
            }
            isCreatingStorefront={createStorefrontMutation.isPending}
            isCreatingStaking={createStakingMutation.isPending}
          />
        ))}
      </div>
    </div>
  );
}

function DiscoveryCard({
  opportunity,
  rank,
  onCreateStorefront,
  onCreateStaking,
  isCreatingStorefront,
  isCreatingStaking
}) {
  const isDigital = opportunity.source_type === 'digital';
  const isCrypto = opportunity.source_type === 'crypto';
  const scorePercentage = Math.min(100, opportunity.action_score);

  const getRiskColor = (score) => {
    if (score < 30) return 'bg-emerald-500/20 text-emerald-400';
    if (score < 60) return 'bg-amber-500/20 text-amber-400';
    return 'bg-red-500/20 text-red-400';
  };

  const getScoreColor = (score) => {
    if (score > 70) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
    if (score > 40) return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50';
    return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
  };

  return (
    <Card className="border-slate-700 hover:border-violet-500/50 transition-all group overflow-hidden">
      {/* Header */}
      <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-cyan-500 to-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />

      <CardContent className="p-5 space-y-4">
        {/* Rank Badge */}
        <div className="flex items-start justify-between">
          <Badge className="bg-violet-500/20 text-violet-400 text-xs font-bold">
            #{rank} RANKED
          </Badge>
          {isDigital && <Store className="w-5 h-5 text-purple-400" />}
          {isCrypto && <Coins className="w-5 h-5 text-cyan-400" />}
        </div>

        {/* Title */}
        <div>
          <h4 className="font-semibold text-white line-clamp-2">
            {opportunity.title}
          </h4>
          <p className="text-xs text-slate-400 mt-1">
            {opportunity.platform}
          </p>
        </div>

        {/* Description */}
        <p className="text-sm text-slate-300 line-clamp-2">
          {opportunity.description}
        </p>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-2">
          {isDigital && (
            <>
              <MetricBox
                label="Profit Range"
                value={`$${opportunity.profit_estimate.low}-${opportunity.profit_estimate.high}`}
                icon={DollarSign}
              />
              <MetricBox
                label="Time to ROI"
                value={opportunity.time_sensitivity || 'Ongoing'}
                icon={Clock}
              />
              <MetricBox
                label="Velocity"
                value={`${opportunity.velocity_score}/100`}
                icon={TrendingUp}
              />
              <MetricBox
                label="Risk"
                value={`${opportunity.risk_score}/100`}
                icon={AlertCircle}
              />
            </>
          )}
          {isCrypto && (
            <>
              <MetricBox
                label="Estimated Value"
                value={`$${opportunity.estimated_value_usd.toLocaleString()}`}
                icon={DollarSign}
              />
              <MetricBox
                label="Difficulty"
                value={opportunity.difficulty_level || 'Medium'}
                icon={TrendingUp}
              />
              <MetricBox
                label="APY/Profit"
                value={`${opportunity.profit_potential}%`}
                icon={Coins}
              />
              <MetricBox
                label="Legitimacy"
                value={`${opportunity.legitimacy_score}%`}
                icon={CheckCircle2}
              />
            </>
          )}
        </div>

        {/* Action Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Action Score</span>
            <span className="font-bold text-violet-400">
              {scorePercentage.toFixed(0)}/100
            </span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all"
              style={{ width: `${scorePercentage}%` }}
            />
          </div>
        </div>

        {/* Red Flags (Crypto) */}
        {isCrypto && opportunity.red_flags && opportunity.red_flags.length > 0 && (
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30">
            <p className="text-xs text-red-300 font-semibold mb-1">⚠ Red Flags</p>
            <ul className="text-xs text-red-300 space-y-1">
              {opportunity.red_flags.slice(0, 2).map((flag, i) => (
                <li key={i}>• {flag}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Tags */}
        {opportunity.tags && opportunity.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {opportunity.tags.slice(0, 3).map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {isDigital && (
            <Button
              onClick={onCreateStorefront}
              disabled={isCreatingStorefront}
              className="flex-1 bg-purple-600 hover:bg-purple-500 text-white text-sm h-9 gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              {isCreatingStorefront ? 'Creating...' : 'New Storefront'}
            </Button>
          )}
          {isCrypto && (
            <Button
              onClick={onCreateStaking}
              disabled={isCreatingStaking}
              className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white text-sm h-9 gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              {isCreatingStaking ? 'Creating...' : 'Stake Now'}
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Deadline Warning */}
        {opportunity.deadline && (
          <div className="text-xs text-amber-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Expires: {new Date(opportunity.deadline).toLocaleDateString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricBox({ label, value, icon: Icon }) {
  return (
    <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <p className="text-sm font-bold text-white">{value}</p>
    </div>
  );
}