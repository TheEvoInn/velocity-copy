import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wand2, Sparkles, TrendingUp } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';

export default function NEDAutomationControl() {
  const [showResults, setShowResults] = useState(false);

  const scanAirdropsMutation = useMutation({
    mutationFn: () =>
      base44.functions.invoke('nedAutonomousAutomation', {
        action: 'scan_airdrop_opportunities',
        search_criteria: { focus: 'high-probability verified projects' }
      }),
    onSuccess: () => setShowResults(true)
  });

  const optimizeMiningMutation = useMutation({
    mutationFn: () =>
      base44.functions.invoke('nedAutonomousAutomation', {
        action: 'optimize_mining_allocation',
        optimization_type: null
      }),
    onSuccess: () => setShowResults(true)
  });

  const rebalanceMutation = useMutation({
    mutationFn: () =>
      base44.functions.invoke('nedAutonomousAutomation', {
        action: 'rebalance_portfolio',
        rebalance_threshold: 5
      }),
    onSuccess: () => setShowResults(true)
  });

  const analyzeStakingMutation = useMutation({
    mutationFn: () =>
      base44.functions.invoke('nedAutonomousAutomation', {
        action: 'analyze_staking_yields'
      }),
    onSuccess: () => setShowResults(true)
  });

  const autoClaimMutation = useMutation({
    mutationFn: () =>
      base44.functions.invoke('nedAutonomousAutomation', {
        action: 'auto_claim_airdrops'
      }),
    onSuccess: () => setShowResults(true)
  });

  const reportMutation = useMutation({
    mutationFn: () =>
      base44.functions.invoke('nedAutonomousAutomation', {
        action: 'generate_portfolio_report'
      }),
    onSuccess: () => setShowResults(true)
  });

  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-cyan-400" />
            Autonomous Crypto Optimization
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Airdrop Scanner */}
          <div className="p-4 bg-slate-800/30 rounded-lg border border-cyan-500/20">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-semibold text-white text-sm">Scan Airdrop Opportunities</h4>
                <p className="text-xs text-slate-400 mt-1">AI discovers high-value airdrops from verified projects</p>
              </div>
              <Button
                size="sm"
                variant={scanAirdropsMutation.isPending ? 'outline' : 'default'}
                onClick={() => scanAirdropsMutation.mutate()}
                disabled={scanAirdropsMutation.isPending}
                className="shrink-0"
              >
                {scanAirdropsMutation.isPending ? 'Scanning...' : 'Scan'}
              </Button>
            </div>
            {scanAirdropsMutation.data?.data?.opportunities_discovered && (
              <p className="text-xs text-emerald-400 mt-2">
                ✓ Found {scanAirdropsMutation.data.data.opportunities_discovered} opportunities (${scanAirdropsMutation.data.data.total_potential_value.toFixed(0)} total)
              </p>
            )}
          </div>

          {/* Mining Optimization */}
          <div className="p-4 bg-slate-800/30 rounded-lg border border-violet-500/20">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-semibold text-white text-sm">Optimize Mining Operations</h4>
                <p className="text-xs text-slate-400 mt-1">Algorithm, pool, and power efficiency improvements</p>
              </div>
              <Button
                size="sm"
                variant={optimizeMiningMutation.isPending ? 'outline' : 'default'}
                onClick={() => optimizeMiningMutation.mutate()}
                disabled={optimizeMiningMutation.isPending}
                className="shrink-0"
              >
                {optimizeMiningMutation.isPending ? 'Optimizing...' : 'Optimize'}
              </Button>
            </div>
            {optimizeMiningMutation.data?.data?.recommendations && (
              <p className="text-xs text-emerald-400 mt-2">
                ✓ {optimizeMiningMutation.data.data.recommendations.length} optimization opportunities found
              </p>
            )}
          </div>

          {/* Portfolio Rebalancing */}
          <div className="p-4 bg-slate-800/30 rounded-lg border border-amber-500/20">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-semibold text-white text-sm">Rebalance Portfolio</h4>
                <p className="text-xs text-slate-400 mt-1">Maintain optimal diversification across assets</p>
              </div>
              <Button
                size="sm"
                variant={rebalanceMutation.isPending ? 'outline' : 'default'}
                onClick={() => rebalanceMutation.mutate()}
                disabled={rebalanceMutation.isPending}
                className="shrink-0"
              >
                {rebalanceMutation.isPending ? 'Analyzing...' : 'Analyze'}
              </Button>
            </div>
            {rebalanceMutation.data?.data?.recommendations && (
              <p className="text-xs text-emerald-400 mt-2">
                ✓ {rebalanceMutation.data.data.recommendations.length} rebalancing actions needed
              </p>
            )}
          </div>

          {/* Staking Analysis */}
          <div className="p-4 bg-slate-800/30 rounded-lg border border-emerald-500/20">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-semibold text-white text-sm">Analyze Staking Yields</h4>
                <p className="text-xs text-slate-400 mt-1">Find APY optimization opportunities</p>
              </div>
              <Button
                size="sm"
                variant={analyzeStakingMutation.isPending ? 'outline' : 'default'}
                onClick={() => analyzeStakingMutation.mutate()}
                disabled={analyzeStakingMutation.isPending}
                className="shrink-0"
              >
                {analyzeStakingMutation.isPending ? 'Analyzing...' : 'Analyze'}
              </Button>
            </div>
            {analyzeStakingMutation.data?.data?.staking_positions && (
              <p className="text-xs text-emerald-400 mt-2">
                ✓ Analyzed {analyzeStakingMutation.data.data.staking_positions} staking positions
              </p>
            )}
          </div>

          {/* Auto Claim Airdrops */}
          <div className="p-4 bg-slate-800/30 rounded-lg border border-pink-500/20">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-semibold text-white text-sm">Auto-Claim Eligible Airdrops</h4>
                <p className="text-xs text-slate-400 mt-1">Automatically claim low-effort airdrops (easy/medium only)</p>
              </div>
              <Button
                size="sm"
                variant={autoClaimMutation.isPending ? 'outline' : 'default'}
                onClick={() => autoClaimMutation.mutate()}
                disabled={autoClaimMutation.isPending}
                className="shrink-0"
              >
                {autoClaimMutation.isPending ? 'Claiming...' : 'Claim'}
              </Button>
            </div>
            {autoClaimMutation.data?.data?.auto_claimed && (
              <p className="text-xs text-emerald-400 mt-2">
                ✓ Claimed {autoClaimMutation.data.data.auto_claimed} airdrops (${autoClaimMutation.data.data.total_value_claimed})
              </p>
            )}
          </div>

          {/* Generate Report */}
          <div className="p-4 bg-slate-800/30 rounded-lg border border-blue-500/20">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-semibold text-white text-sm">Generate Portfolio Report</h4>
                <p className="text-xs text-slate-400 mt-1">Complete overview with recommendations</p>
              </div>
              <Button
                size="sm"
                variant={reportMutation.isPending ? 'outline' : 'default'}
                onClick={() => reportMutation.mutate()}
                disabled={reportMutation.isPending}
                className="shrink-0"
              >
                {reportMutation.isPending ? 'Generating...' : 'Generate'}
              </Button>
            </div>
            {reportMutation.data?.data?.report && (
              <p className="text-xs text-emerald-400 mt-2">
                ✓ Report generated with action items
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results Panel */}
      {showResults && (
        <Card className="glass-card border-emerald-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-400">
              <Sparkles className="w-5 h-5" />
              Automation Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            {optimizeMiningMutation.data?.data?.recommendations && (
              <div className="space-y-3 mb-4">
                <div className="text-sm font-semibold text-white">Mining Optimizations</div>
                {optimizeMiningMutation.data.data.recommendations.map((rec, idx) => (
                  <div key={idx} className="text-xs text-slate-300 bg-slate-800/30 p-3 rounded">
                    <div className="font-semibold text-violet-400 mb-1">{rec.type.toUpperCase()}</div>
                    <div>{rec.recommendation}</div>
                    <div className="text-emerald-400 mt-1">{rec.expected_improvement}</div>
                  </div>
                ))}
              </div>
            )}

            {analyzeStakingMutation.data?.data?.analysis && (
              <div className="text-xs text-slate-300 bg-slate-800/30 p-3 rounded mb-4">
                <div className="font-semibold text-emerald-400 mb-2">Staking Analysis</div>
                <div>Monthly Yield: ${analyzeStakingMutation.data.data.monthly_yield_estimate?.toFixed(2)}</div>
                <div>Yearly Projection: ${analyzeStakingMutation.data.data.yearly_yield_estimate?.toFixed(2)}</div>
              </div>
            )}

            <div className="mt-4">
              <Button size="sm" variant="outline" onClick={() => setShowResults(false)}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}