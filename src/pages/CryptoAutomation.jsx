/**
 * CRYPTO AUTOMATION UNIFIED SYSTEM
 * Merged Crypto + NED: Autonomous crypto earnings, mining, staking, arbitrage
 * Integrated with Velocity identity, workflows, and real-time reporting
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Coins, Zap, TrendingUp, Wallet, Radio, Target,
  Plus, Settings, BarChart3, Bot, AlertCircle, CheckCircle2,
  Lock, DollarSign, Eye, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

export default function CryptoAutomation() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();

  // Get Velocity identity profile
  const { data: velocityIdentity } = useQuery({
    queryKey: ['velocityIdentity', authUser?.email],
    queryFn: async () => {
      if (!authUser?.email) return null;
      const identities = await base44.entities.AIIdentity.filter(
        { created_by: authUser.email, is_active: true },
        '-last_used_at',
        1
      );
      return identities.length > 0 ? identities[0] : null;
    },
    enabled: !!authUser?.email,
  });

  // Fetch user
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => await base44.auth.me(),
  });

  // Fetch crypto opportunities
  const { data: opportunities = [] } = useQuery({
    queryKey: ['cryptoOpportunities', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return await base44.entities.CryptoOpportunity.filter(
        { created_by: user.email },
        '-priority_score',
        100
      );
    },
    enabled: !!user?.email,
    refetchInterval: 30000,
  });

  // Fetch wallets
  const { data: wallets = [] } = useQuery({
    queryKey: ['cryptoWallets', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return await base44.entities.CryptoWallet.filter(
        { created_by: user.email },
        '-is_primary',
        50
      );
    },
    enabled: !!user?.email,
    refetchInterval: 15000,
  });

  // Fetch staking positions
  const { data: stakingPositions = [] } = useQuery({
    queryKey: ['stakingPositions', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return await base44.entities.StakingPosition.filter(
        { created_by: user.email, status: 'active' },
        '-started_at',
        20
      );
    },
    enabled: !!user?.email,
    refetchInterval: 20000,
  });

  // Fetch transactions
  const { data: transactions = [] } = useQuery({
    queryKey: ['cryptoTransactions', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return await base44.entities.CryptoTransaction.filter(
        { created_by: user.email },
        '-timestamp',
        100
      );
    },
    enabled: !!user?.email,
    refetchInterval: 15000,
  });

  // Fetch NED config
  const { data: nedConfig } = useQuery({
    queryKey: ['nedConfig', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const configs = await base44.entities.ResellAutopilotConfig.filter(
        { created_by: user.email },
        '-updated_date',
        1
      );
      return configs.length > 0 ? configs[0] : null;
    },
    enabled: !!user?.email,
  });

  // NED scan mutation
  const scanMutation = useMutation({
    mutationFn: async (types) => {
      if (!velocityIdentity) {
        throw new Error('Activate your Velocity identity first');
      }
      const response = await base44.functions.invoke('nedCryptoOrchestrator', {
        action: 'scan_opportunities',
        payload: { opportunity_types: types },
        user_identity: velocityIdentity.id,
        report_to_workflow: true,
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`NED found ${data.opportunities_found} opportunities!`);
      queryClient.invalidateQueries({ queryKey: ['cryptoOpportunities'] });
    },
    onError: (err) => {
      toast.error(`Scan failed: ${err.message}`);
    },
  });

  // Launch NED mutation
  const launchNedMutation = useMutation({
    mutationFn: async () => {
      if (!velocityIdentity) {
        throw new Error('Activate your Velocity identity first');
      }
      const response = await base44.functions.invoke('nedCryptoOrchestrator', {
        action: 'launch_autonomy',
        user_id: user?.id,
        user_email: user?.email,
        identity_id: velocityIdentity.id,
        workflow_trigger: 'crypto_automation_autopilot',
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('NED Autopilot launched!');
      queryClient.invalidateQueries({ queryKey: ['nedConfig'] });
    },
    onError: (err) => {
      toast.error(`Launch failed: ${err.message}`);
    },
  });

  // Calculate stats
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
            <Coins className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white font-orbitron">Crypto Automation</h1>
            <p className="text-sm text-slate-400">Mining, staking, arbitrage & airdrop automation via NED</p>
          </div>
        </div>
        {velocityIdentity && (
          <Badge className="bg-emerald-500/20 text-emerald-400 gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Identity: {velocityIdentity.name}
          </Badge>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="glass-card-bright">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Total Earned</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-bold text-emerald-400">${stats.total_earned.toFixed(0)}</div>
            <div className="text-xs text-slate-500 mt-2">Lifetime</div>
          </CardContent>
        </Card>

        <Card className="glass-card-bright">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Wallet Balance</span>
              <Wallet className="w-4 h-4 text-violet-400" />
            </div>
            <div className="text-3xl font-bold text-violet-400">${stats.wallet_balance.toFixed(0)}</div>
            <div className="text-xs text-slate-500 mt-2">{stats.wallets_connected} wallets</div>
          </CardContent>
        </Card>

        <Card className="glass-card-bright">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Active Opps</span>
              <Radio className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-3xl font-bold text-cyan-400">{stats.active_opportunities}</div>
            <div className="text-xs text-slate-500 mt-2">Ready</div>
          </CardContent>
        </Card>

        <Card className="glass-card-bright">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Staking</span>
              <DollarSign className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-bold text-amber-400">${stats.daily_staking_rewards.toFixed(0)}/day</div>
            <div className="text-xs text-slate-500 mt-2">{stats.staking_positions} positions</div>
          </CardContent>
        </Card>

        <Card className="glass-card-bright">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Pending</span>
              <AlertCircle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-bold text-amber-400">{stats.pending_claims}</div>
            <div className="text-xs text-slate-500 mt-2">Claims</div>
          </CardContent>
        </Card>
      </div>

      {/* Launch CTA */}
      <Card className="bg-gradient-to-r from-blue-600/30 to-cyan-600/30 border-blue-500/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Bot className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-1">NED Autopilot</h2>
                <p className="text-sm text-slate-300">
                  24/7 autonomous crypto earnings: scans, executes, and reports in real-time
                </p>
              </div>
            </div>
            <Button
              onClick={() => launchNedMutation.mutate()}
              disabled={launchNedMutation.isPending || !velocityIdentity || nedConfig?.autopilot_enabled}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 gap-2 shrink-0"
            >
              {!velocityIdentity ? (
                <>
                  <Lock className="w-4 h-4" />
                  Set Identity First
                </>
              ) : nedConfig?.autopilot_enabled ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Running
                </>
              ) : launchNedMutation.isPending ? (
                <>
                  <Zap className="w-4 h-4 animate-spin" />
                  Launching...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Launch Now
                </>
              )}
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
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-cyan-400" />
                NED Intelligence Engine
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-300">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded bg-slate-800/50">
                  <h3 className="font-semibold text-white mb-2">🔄 Continuous Scanning</h3>
                  <p className="text-xs">24/7 monitoring for airdrops, mining, staking, arbitrage</p>
                </div>
                <div className="p-4 rounded bg-slate-800/50">
                  <h3 className="font-semibold text-white mb-2">⚡ Auto-Execution</h3>
                  <p className="text-xs">Finds & claims opportunities autonomously</p>
                </div>
                <div className="p-4 rounded bg-slate-800/50">
                  <h3 className="font-semibold text-white mb-2">💰 Multi-Wallet</h3>
                  <p className="text-xs">Manage multiple wallets, distribute earnings</p>
                </div>
                <div className="p-4 rounded bg-slate-800/50">
                  <h3 className="font-semibold text-white mb-2">📊 Real-time Sync</h3>
                  <p className="text-xs">Live reporting via Velocity workflows</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Opportunities Tab */}
      {activeTab === 'opportunities' && (
        <div className="space-y-4">
          <div className="flex gap-2 mb-4">
            <Button
              onClick={() => scanMutation.mutate(['airdrop', 'mining', 'staking', 'arbitrage'])}
              disabled={scanMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${scanMutation.isPending ? 'animate-spin' : ''}`} />
              Scan Now
            </Button>
          </div>
          {opportunities.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="p-8 text-center">
                <Target className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No opportunities found. Run a scan to get started.</p>
              </CardContent>
            </Card>
          ) : (
            opportunities.map(opp => (
              <Card key={opp.id} className="glass-card hover:border-cyan-500/50">
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
                    <Badge className="bg-cyan-500/20 text-cyan-400">
                      ${opp.estimated_value_usd || 0}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2 rounded bg-slate-800/50">
                      <div className="text-slate-400">Legitimacy</div>
                      <div className="text-cyan-400 font-bold">{opp.legitimacy_score}/100</div>
                    </div>
                    <div className="p-2 rounded bg-slate-800/50">
                      <div className="text-slate-400">Time</div>
                      <div className="text-cyan-400 font-bold">{opp.estimated_time_hours || '?'}h</div>
                    </div>
                    <div className="p-2 rounded bg-slate-800/50">
                      <div className="text-slate-400">Status</div>
                      <div className="text-cyan-400 font-bold capitalize">{opp.status}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Wallets Tab */}
      {activeTab === 'wallets' && (
        <div className="space-y-4">
          {wallets.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="p-8 text-center">
                <Wallet className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No wallets configured yet.</p>
              </CardContent>
            </Card>
          ) : (
            wallets.map(w => (
              <Card key={w.id} className="glass-card">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white mb-1">{w.wallet_name}</h3>
                      <p className="text-xs text-slate-400 font-mono break-all">{w.address}</p>
                      <p className="text-xs text-cyan-400 mt-2">${w.balance?.total_balance_usd || 0} USD</p>
                    </div>
                    <Badge className="bg-cyan-500/20 text-cyan-400">{w.wallet_type}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Staking Tab */}
      {activeTab === 'staking' && (
        <div className="space-y-4">
          {stakingPositions.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="p-8 text-center">
                <DollarSign className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No active staking positions.</p>
              </CardContent>
            </Card>
          ) : (
            stakingPositions.map(pos => (
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
                    <div className="p-2 rounded bg-slate-800/50">
                      <div className="text-slate-400">Staked</div>
                      <div className="text-cyan-400 font-bold">{pos.amount_staked}</div>
                    </div>
                    <div className="p-2 rounded bg-slate-800/50">
                      <div className="text-slate-400">Daily</div>
                      <div className="text-emerald-400 font-bold">${pos.daily_reward_usd?.toFixed(2) || 0}</div>
                    </div>
                    <div className="p-2 rounded bg-slate-800/50">
                      <div className="text-slate-400">Total Earned</div>
                      <div className="text-violet-400 font-bold">${pos.total_earned || 0}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          {transactions.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="p-8 text-center text-slate-400">
                No transactions yet.
              </CardContent>
            </Card>
          ) : (
            transactions.slice(0, 20).map(tx => (
              <Card key={tx.id} className="glass-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white capitalize">{tx.transaction_type.replace('_', ' ')}</h3>
                        <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">
                          +${tx.value_usd.toFixed(2)}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400">{tx.source}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-cyan-400">{tx.token_symbol}</div>
                      <p className="text-xs text-slate-400">{new Date(tx.timestamp).toLocaleDateString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Crypto Automation Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="p-4 rounded bg-slate-800/50">
              <div className="font-semibold text-white mb-2">✓ Velocity Identity</div>
              <p className="text-slate-400">
                {velocityIdentity ? `Active: ${velocityIdentity.name}` : 'No identity selected'}
              </p>
            </div>
            <div className="p-4 rounded bg-slate-800/50">
              <div className="font-semibold text-white mb-2">✓ Workflow Integration</div>
              <p className="text-slate-400">Reports to: crypto_automation_autopilot, mining_orchestrator, staking_monitor</p>
            </div>
            <div className="p-4 rounded bg-slate-800/50">
              <div className="font-semibold text-white mb-2">✓ Real-time Feed</div>
              <p className="text-slate-400">Live synchronization every 15 seconds</p>
            </div>
            <div className="p-4 rounded bg-slate-800/50">
              <div className="font-semibold text-white mb-2">✓ Credential Verification</div>
              <p className="text-slate-400">All wallets and credentials verified through Velocity profile</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}