/**
 * NED DEPARTMENT
 * AI crypto intelligence, arbitrage detection, mining/staking automation
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getDeptStyle } from '@/lib/galaxyTheme';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TrendingUp, Zap, Wallet, DollarSign } from 'lucide-react';

const style = getDeptStyle('ned');

const DUMMY_COLOR = '#06b6d4';

export default function NED() {
  const { data: opportunities = [] } = useQuery({
    queryKey: ['cryptoOpportunities'],
    queryFn: () => base44.entities.CryptoOpportunity.filter({ created_by: true }, '-priority_score', 50).catch(() => []),
    staleTime: 5000,
  });

  const { data: wallets = [] } = useQuery({
    queryKey: ['cryptoWallets'],
    queryFn: () => base44.entities.CryptoWallet.filter({ created_by: true }, '-is_primary', 10).catch(() => []),
    staleTime: 5000,
  });

  const { data: stakingPositions = [] } = useQuery({
    queryKey: ['stakingPositions'],
    queryFn: () => base44.entities.StakingPosition.filter({ created_by: true, status: 'active' }, '-started_at', 20).catch(() => []),
    staleTime: 5000,
  });

  const stats = {
    opportunities: opportunities.length,
    active: opportunities.filter(o => o.status === 'active').length,
    wallets: wallets.length,
    totalBalance: wallets.reduce((s, w) => s + (w.balance?.total_balance_usd || 0), 0),
    staking: stakingPositions.reduce((s, p) => s + (p.daily_reward_usd || 0), 0),
  };

  return (
    <div className="min-h-screen galaxy-bg p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `rgba(6,182,212,0.1)`, border: `1px solid ${style.color}` }}>
              <span className="text-2xl">🤖</span>
            </div>
            <div>
              <h1 className="font-orbitron text-2xl font-bold text-white">NED</h1>
              <p className="text-xs text-slate-400">Crypto Intelligence · Arbitrage · Mining & Staking</p>
            </div>
          </div>
          <Link to="/CryptoProfitSystems">
            <Button className="btn-cosmic gap-2">
              <Zap className="w-4 h-4" />
              Crypto Dashboard
            </Button>
          </Link>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card className="glass-card p-4">
            <div className="text-xs text-slate-400 mb-1">Opportunities</div>
            <div className="text-2xl font-bold text-cyan-400">{stats.active}</div>
            <div className="text-xs text-slate-600 mt-1">of {stats.opportunities}</div>
          </Card>
          <Card className="glass-card p-4">
            <div className="text-xs text-slate-400 mb-1">Wallets</div>
            <div className="text-2xl font-bold text-purple-400">{stats.wallets}</div>
          </Card>
          <Card className="glass-card p-4">
            <div className="text-xs text-slate-400 mb-1">Total Balance</div>
            <div className="text-2xl font-bold text-emerald-400">${stats.totalBalance.toLocaleString()}</div>
          </Card>
          <Card className="glass-card p-4">
            <div className="text-xs text-slate-400 mb-1">Daily Staking</div>
            <div className="text-2xl font-bold text-amber-400">${stats.staking.toFixed(0)}</div>
          </Card>
        </div>

        {/* Top Opportunities */}
        <Card className="glass-card p-4 mb-6">
          <h3 className="font-orbitron text-sm font-bold text-white mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            Ranked Crypto Opportunities
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {opportunities.filter(o => o.status === 'active').length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-4">No active opportunities</div>
            ) : (
              opportunities
                .filter(o => o.status === 'active')
                .slice(0, 8)
                .map(opp => (
                  <div key={opp.id} className="p-3 bg-slate-800/40 rounded-lg border border-cyan-500/30">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{opp.title}</div>
                        <div className="text-xs text-slate-400">
                          {opp.opportunity_type} · {opp.token_symbol}
                        </div>
                      </div>
                      <div className="ml-3 text-right text-xs">
                        <div className="font-bold text-emerald-400">${opp.estimated_value_usd?.toFixed(0) || 0}</div>
                        <div className="text-slate-500">Score: {opp.priority_score || 0}</div>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </Card>

        {/* Staking Positions */}
        <Card className="glass-card p-4">
          <h3 className="font-orbitron text-sm font-bold text-white mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-amber-400" />
            Active Staking Positions
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {stakingPositions.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-4">No staking positions</div>
            ) : (
              stakingPositions.slice(0, 6).map(pos => (
                <div key={pos.id} className="p-3 bg-slate-800/40 rounded-lg border border-amber-500/30">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-semibold text-white">{pos.token_symbol}</div>
                      <div className="text-xs text-slate-400">{pos.platform}</div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-bold text-emerald-400">${pos.daily_reward_usd?.toFixed(0) || 0}/day</div>
                      <div className="text-slate-500">{pos.apy_percentage?.toFixed(1)}% APY</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}