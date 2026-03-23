/**
 * NED DEPARTMENT
 * AI crypto intelligence, arbitrage detection, mining/staking automation
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getDeptStyle } from '@/lib/galaxyTheme';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TrendingUp, Zap, Wallet, DollarSign, RefreshCw } from 'lucide-react';

const style = getDeptStyle('ned');

const DUMMY_COLOR = '#06b6d4';

export default function NED() {
  const { data: dashboardData = {}, refetch: refetchDashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['ned_dashboard'],
    queryFn: async () => {
      const res = await base44.functions.invoke('nedRealtimeEngine', {
        action: 'get_dashboard_summary'
      });
      return res.data?.dashboard || {};
    },
    refetchInterval: 30000,
    staleTime: 5000,
  });

  const { data: opportunities = [] } = useQuery({
    queryKey: ['cryptoOpportunities'],
    queryFn: async () => {
      const res = await base44.functions.invoke('nedRealtimeEngine', {
        action: 'get_airdrop_opportunities'
      });
      return res.data?.opportunities || [];
    },
    refetchInterval: 60000,
    staleTime: 5000,
  });

  const { data: stakingPositions = [] } = useQuery({
    queryKey: ['stakingPositions'],
    queryFn: async () => {
      const res = await base44.functions.invoke('nedRealtimeEngine', {
        action: 'get_staking_positions'
      });
      return res.data?.positions || [];
    },
    refetchInterval: 60000,
    staleTime: 5000,
  });

  const stats = {
    opportunities: dashboardData.total_crypto_opportunities || 0,
    active: dashboardData.airdrop_pending_count || 0,
    wallets: dashboardData.active_wallets || 0,
    totalBalance: parseFloat(dashboardData.total_portfolio_value || 0),
    staking: parseFloat(dashboardData.staking_daily_reward || 0),
    mining: parseFloat(dashboardData.mining_daily_yield || 0),
    daily_passive: parseFloat(dashboardData.daily_passive_income || 0),
    health: dashboardData.health_status || 'SETUP_REQUIRED'
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
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => refetchDashboard()}
              disabled={dashboardLoading}
            >
              <RefreshCw className={`w-4 h-4 ${dashboardLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Link to="/CryptoProfitSystems">
              <Button className="btn-cosmic gap-2">
                <Zap className="w-4 h-4" />
                Crypto Dashboard
              </Button>
            </Link>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
          <Card className="glass-card p-4">
            <div className="text-xs text-slate-400 mb-1">Airdrops Pending</div>
            <div className="text-2xl font-bold text-cyan-400">{stats.active}</div>
          </Card>
          <Card className="glass-card p-4">
            <div className="text-xs text-slate-400 mb-1">Total Wallets</div>
            <div className="text-2xl font-bold text-purple-400">{stats.wallets}</div>
          </Card>
          <Card className="glass-card p-4">
            <div className="text-xs text-slate-400 mb-1">Portfolio Value</div>
            <div className="text-2xl font-bold text-emerald-400">${stats.totalBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
          </Card>
          <Card className="glass-card p-4">
            <div className="text-xs text-slate-400 mb-1">Daily Staking</div>
            <div className="text-2xl font-bold text-amber-400">${stats.staking.toFixed(2)}</div>
          </Card>
          <Card className="glass-card p-4">
            <div className="text-xs text-slate-400 mb-1">Daily Mining</div>
            <div className="text-2xl font-bold text-violet-400">${stats.mining.toFixed(2)}</div>
          </Card>
          <Card className="glass-card p-4">
            <div className="text-xs text-slate-400 mb-1">Health Status</div>
            <div className="text-2xl font-bold text-cyan-400">{stats.health}</div>
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