/**
 * CRYPTO HUB — VELO AI
 * AI Assistant: CIPHER
 * Mining, staking, arbitrage & airdrop automation via NED
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { useActiveIdentity } from '@/hooks/useUserData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Coins, Zap, TrendingUp, Wallet, Radio, Target,
  Settings, BarChart3, Bot, AlertCircle, CheckCircle2,
  Lock, DollarSign, Eye, RefreshCw, Brain
} from 'lucide-react';
import { toast } from 'sonner';

export default function CryptoAutomation() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const { activeIdentity } = useActiveIdentity();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: opportunities = [] } = useQuery({
    queryKey: ['cryptoOpportunities', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.CryptoOpportunity.filter({ created_by: user.email }, '-priority_score', 100);
    },
    enabled: !!user?.email,
    refetchInterval: 30000,
  });

  const { data: wallets = [] } = useQuery({
    queryKey: ['cryptoWallets', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.CryptoWallet.filter({ created_by: user.email }, '-is_primary', 50);
    },
    enabled: !!user?.email,
    refetchInterval: 15000,
  });

  const { data: stakingPositions = [] } = useQuery({
    queryKey: ['stakingPositions', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.StakingPosition.filter({ created_by: user.email, status: 'active' }, '-started_at', 20);
    },
    enabled: !!user?.email,
    refetchInterval: 20000,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['cryptoTransactions', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.CryptoTransaction.filter({ created_by: user.email }, '-timestamp', 100);
    },
    enabled: !!user?.email,
    refetchInterval: 15000,
  });

  const { data: nedConfig } = useQuery({
    queryKey: ['nedConfig', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const configs = await base44.entities.ResellAutopilotConfig.filter({ created_by: user.email }, '-updated_date', 1);
      return configs.length > 0 ? configs[0] : null;
    },
    enabled: !!user?.email,
  });

  const scanMutation = useMutation({
    mutationFn: async (types) => {
      if (!activeIdentity) throw new Error('Activate your VELO AI identity first');
      const response = await base44.functions.invoke('nedCryptoOrchestrator', {
        action: 'scan_opportunities',
        payload: { opportunity_types: types },
        user_identity: activeIdentity.id,
        report_to_workflow: true,
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`CIPHER found ${data?.opportunities_found || 0} opportunities!`);
      queryClient.invalidateQueries({ queryKey: ['cryptoOpportunities'] });
    },
    onError: (err) => toast.error(`Scan failed: ${err.message}`),
  });

  const launchNedMutation = useMutation({
    mutationFn: async () => {
      if (!activeIdentity) throw new Error('Activate your VELO AI identity first');
      const response = await base44.functions.invoke('nedCryptoOrchestrator', {
        action: 'launch_autonomy',
        user_id: user?.id,
        user_email: user?.email,
        identity_id: activeIdentity.id,
        workflow_trigger: 'crypto_automation_autopilot',
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('CIPHER Autopilot launched!');
      queryClient.invalidateQueries({ queryKey: ['nedConfig'] });
    },
    onError: (err) => toast.error(`Launch failed: ${err.message}`),
  });

  const stats = {
    total_earned: transactions.reduce((sum, tx) => sum + (tx.value_usd || 0), 0),
    wallet_balance: wallets.reduce((sum, w) => sum + (w.balance?.total_balance_usd || 0), 0),
    active_opportunities: opportunities.filter(o => o.status === 'active').length,
    wallets_connected: wallets.length,
    staking_positions: stakingPositions.length,
    daily_staking_rewards: stakingPositions.reduce((sum, p) => sum + (p.daily_reward_usd || 0), 0),
    pending_claims: opportunities.filter(o => o.status === 'active' && !o.execution_status?.reward_claimed).length,
  };

  return (
    <div className="min-h-screen pt-20 pb-8 px-4 md:px-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-2 h-8 rounded-full" style={{ background: 'linear-gradient(to bottom, #00ffd9, #06b6d4)' }} />
              <div>
                <h1 className="font-orbitron text-3xl font-bold text-white">CRYPTO HUB</h1>
                <p className="text-[10px] font-mono tracking-widest text-teal-400/70">VELO AI · AI: CIPHER</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm ml-5">Mining, staking, arbitrage & airdrop automation via NED</p>
          </div>
          {activeIdentity && (
            <Badge className="bg-emerald-500/20 text-emerald-400 gap-1 border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3" />
              Identity: {activeIdentity.name}
            </Badge>
          )}
        </div>

        {/* CIPHER AI Status */}
        <div className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: 'rgba(0,255,217,0.05)', border: '1px solid rgba(0,255,217,0.2)' }}>
          <Brain className="w-5 h-5 text-teal-400 shrink-0" />
          <div className="flex-1">
            <span className="text-xs font-orbitron text-teal-400 tracking-wider">CIPHER INTELLIGENCE ENGINE</span>
            <p className="text-xs text-slate-500 mt-0.5">Scanning crypto markets · Monitoring airdrops · Tracking staking yields · Syncing with Finance Command</p>
          </div>
          <span className="text-xs text-teal-400 font-mono px-2 py-1 rounded-lg border border-teal-400/30 bg-teal-400/10 shrink-0">ACTIVE</span>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Earned', value: `$${stats.total_earned.toFixed(0)}`, color: '#10b981', icon: TrendingUp, sub: 'Lifetime' },
            { label: 'Wallet Balance', value: `$${stats.wallet_balance.toFixed(0)}`, color: '#818cf8', icon: Wallet, sub: `${stats.wallets_connected} wallets` },
            { label: 'Active Opps', value: stats.active_opportunities, color: '#00ffd9', icon: Radio, sub: 'Ready' },
            { label: 'Staking', value: `$${stats.daily_staking_rewards.toFixed(0)}/day`, color: '#f59e0b', icon: DollarSign, sub: `${stats.staking_positions} positions` },
            { label: 'Pending Claims', value: stats.pending_claims, color: '#f97316', icon: AlertCircle, sub: 'Claims' },
          ].map(s => (
            <Card key={s.label} className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">{s.label}</span>
                  <s.icon className="w-4 h-4" style={{ color: s.color }} />
                </div>
                <div className="text-2xl font-bold font-orbitron" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs text-slate-500 mt-1">{s.sub}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Launch CTA */}
        <Card className="glass-card border-teal-500/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,255,217,0.1)', border: '1px solid rgba(0,255,217,0.3)' }}>
                  <Bot className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-orbitron text-white mb-0.5">NED Autopilot — CIPHER ENGINE</h2>
                  <p className="text-sm text-slate-400">24/7 autonomous crypto earnings: scans, executes, and reports in real-time via VELO AI</p>
                </div>
              </div>
              <Button
                onClick={() => launchNedMutation.mutate()}
                disabled={launchNedMutation.isPending || !activeIdentity || nedConfig?.autopilot_enabled}
                style={{ background: 'linear-gradient(135deg, #00ffd9, #06b6d4)', color: '#000' }}
                className="gap-2 shrink-0 font-bold"
              >
                {!activeIdentity ? <><Lock className="w-4 h-4" /> Set Identity First</>
                  : nedConfig?.autopilot_enabled ? <><CheckCircle2 className="w-4 h-4" /> Running</>
                  : launchNedMutation.isPending ? <><Zap className="w-4 h-4 animate-spin" /> Launching...</>
                  : <><Zap className="w-4 h-4" /> Launch Now</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-800 overflow-x-auto">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Eye },
            { id: 'opportunities', label: 'Opportunities', icon: Target },
            { id: 'wallets', label: 'Wallets', icon: Wallet },
            { id: 'staking', label: 'Staking', icon: DollarSign },
            { id: 'transactions', label: 'Transactions', icon: TrendingUp },
            { id: 'settings', label: 'Config', icon: Settings },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id ? 'border-teal-500 text-teal-400' : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}>
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'dashboard' && (
          <div className="space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-teal-400" />
                  CIPHER Intelligence Engine — NED Integration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-300">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { title: '🔄 Continuous Scanning', desc: '24/7 monitoring for airdrops, mining, staking, arbitrage' },
                    { title: '⚡ Auto-Execution', desc: 'Finds & claims opportunities autonomously via VELO AI' },
                    { title: '💰 Multi-Wallet', desc: 'Manage multiple wallets, distribute earnings' },
                    { title: '📊 Finance Sync', desc: 'Live sync with Finance Command every 15 seconds' },
                  ].map(item => (
                    <div key={item.title} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/40">
                      <h3 className="font-semibold text-white mb-1">{item.title}</h3>
                      <p className="text-xs text-slate-400">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'opportunities' && (
          <div className="space-y-4">
            <div className="flex gap-2 mb-4">
              <Button
                onClick={() => scanMutation.mutate(['airdrop', 'mining', 'staking', 'arbitrage'])}
                disabled={scanMutation.isPending}
                style={{ background: 'linear-gradient(135deg, #00ffd9, #06b6d4)', color: '#000' }}
                className="gap-2 font-bold"
              >
                <RefreshCw className={`w-4 h-4 ${scanMutation.isPending ? 'animate-spin' : ''}`} />
                {scanMutation.isPending ? 'Scanning...' : 'CIPHER Scan'}
              </Button>
            </div>
            {opportunities.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="p-8 text-center">
                  <Target className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No opportunities found. Run a CIPHER scan to get started.</p>
                </CardContent>
              </Card>
            ) : opportunities.map(opp => (
              <Card key={opp.id} className="glass-card hover:border-teal-500/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white">{opp.title}</h3>
                        <Badge className={opp.risk_score < 40 ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}>
                          Risk: {opp.risk_score}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400">{opp.description}</p>
                    </div>
                    <Badge className="bg-teal-500/20 text-teal-400">${opp.estimated_value_usd || 0}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {[
                      { label: 'Legitimacy', value: `${opp.legitimacy_score}/100`, color: 'text-teal-400' },
                      { label: 'Time', value: `${opp.estimated_time_hours || '?'}h`, color: 'text-teal-400' },
                      { label: 'Status', value: opp.status, color: 'text-teal-400' },
                    ].map(f => (
                      <div key={f.label} className="p-2 rounded-lg bg-slate-800/50">
                        <div className="text-slate-400">{f.label}</div>
                        <div className={`${f.color} font-bold capitalize`}>{f.value}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'wallets' && (
          <div className="space-y-4">
            {wallets.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="p-8 text-center">
                  <Wallet className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No wallets configured yet. CIPHER will auto-provision wallets when NED runs.</p>
                </CardContent>
              </Card>
            ) : wallets.map(w => (
              <Card key={w.id} className="glass-card">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white mb-1">{w.wallet_name}</h3>
                      <p className="text-xs text-slate-400 font-mono break-all">{w.address}</p>
                      <p className="text-xs text-teal-400 mt-2 font-bold">${w.balance?.total_balance_usd || 0} USD</p>
                    </div>
                    <Badge className="bg-teal-500/20 text-teal-400">{w.wallet_type}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'staking' && (
          <div className="space-y-4">
            {stakingPositions.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="p-8 text-center">
                  <DollarSign className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No active staking positions. Launch NED Autopilot to begin staking.</p>
                </CardContent>
              </Card>
            ) : stakingPositions.map(pos => (
              <Card key={pos.id} className="glass-card">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-white">{pos.token_symbol}</h3>
                      <p className="text-xs text-slate-400">{pos.platform}</p>
                    </div>
                    <Badge className="bg-amber-500/20 text-amber-400">{pos.apy_percentage?.toFixed(1)}% APY</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {[
                      { label: 'Staked', value: pos.amount_staked, color: 'text-teal-400' },
                      { label: 'Daily', value: `$${pos.daily_reward_usd?.toFixed(2) || 0}`, color: 'text-emerald-400' },
                      { label: 'Total Earned', value: `$${pos.total_earned || 0}`, color: 'text-violet-400' },
                    ].map(f => (
                      <div key={f.label} className="p-2 rounded-lg bg-slate-800/50">
                        <div className="text-slate-400">{f.label}</div>
                        <div className={`${f.color} font-bold`}>{f.value}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="space-y-4">
            {transactions.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="p-8 text-center text-slate-400">No crypto transactions yet.</CardContent>
              </Card>
            ) : transactions.slice(0, 20).map(tx => (
              <Card key={tx.id} className="glass-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white capitalize">{tx.transaction_type?.replace('_', ' ')}</h3>
                        <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">+${tx.value_usd?.toFixed(2)}</Badge>
                      </div>
                      <p className="text-xs text-slate-400">{tx.source}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-teal-400">{tx.token_symbol}</div>
                      <p className="text-xs text-slate-400">{new Date(tx.timestamp).toLocaleDateString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'settings' && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-teal-400" />
                CIPHER Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                { label: '✓ VELO AI Identity', value: activeIdentity ? `Active: ${activeIdentity.name}` : 'No identity selected — go to Identity Hub' },
                { label: '✓ NED Integration', value: 'nedCryptoOrchestrator connected' },
                { label: '✓ Finance Sync', value: 'Live sync to Finance Command every 15 seconds' },
                { label: '✓ Credential Vault', value: 'All wallets and credentials via VELO AI Credential Vault' },
                { label: '✓ Identity Routing', value: 'CIPHER uses active VELO AI identity for all submissions' },
              ].map(item => (
                <div key={item.label} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/40">
                  <div className="font-semibold text-white mb-1">{item.label}</div>
                  <p className="text-slate-400 text-xs">{item.value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}