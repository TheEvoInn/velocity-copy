import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Zap, TrendingUp, Coins, Lock, Radio, Target,
  Plus, Settings, Wallet, BarChart3, Bot, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

export default function CryptoProfitSystems() {
  const [activeTab, setActiveTab] = useState('overview');
  const [nedStatus, setNedStatus] = useState('idle');
  const queryClient = useQueryClient();

  // Fetch user's crypto data
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => await base44.auth.me(),
  });

  const { data: opportunities = [] } = useQuery({
    queryKey: ['cryptoOpportunities', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const res = await base44.entities.CryptoOpportunity.filter(
        { created_by: user.email },
        '-created_date',
        100
      );
      return res;
    },
    enabled: !!user?.email,
    refetchInterval: 30000,
  });

  const { data: wallets = [] } = useQuery({
    queryKey: ['cryptoWallets', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return await base44.entities.CryptoWallet.filter(
        { created_by: user.email },
        '-created_date',
        50
      );
    },
    enabled: !!user?.email,
  });

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

  // NED Scan Mutation
  const scanMutation = useMutation({
    mutationFn: async (types) => {
      setNedStatus('scanning');
      const response = await base44.functions.invoke('nedCryptoOrchestrator', {
        action: 'scan_opportunities',
        payload: { opportunity_types: types }
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`NED found ${data.opportunities_found} opportunities!`);
      queryClient.invalidateQueries({ queryKey: ['cryptoOpportunities'] });
      setNedStatus('idle');
    },
    onError: (err) => {
      toast.error(`Scan failed: ${err.message}`);
      setNedStatus('idle');
    },
  });

  const stats = {
    total_earned: transactions.reduce((sum, tx) => sum + (tx.value_usd || 0), 0),
    active_opportunities: opportunities.filter(o => o.status === 'active').length,
    wallets_connected: wallets.length,
    pending_claims: opportunities.filter(o => o.status === 'active' && !o.execution_status?.reward_claimed).length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
            <Coins className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white font-orbitron">
              Crypto Profit Systems
            </h1>
            <p className="text-sm text-slate-400">
              Autonomous cryptocurrency earnings powered by NED
            </p>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card-bright">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Total Earned</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-bold text-emerald-400">${stats.total_earned.toFixed(0)}</div>
            <div className="text-xs text-slate-500 mt-2">From all sources</div>
          </CardContent>
        </Card>

        <Card className="glass-card-bright">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Active Opportunities</span>
              <Radio className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-3xl font-bold text-cyan-400">{stats.active_opportunities}</div>
            <div className="text-xs text-slate-500 mt-2">Ready to execute</div>
          </CardContent>
        </Card>

        <Card className="glass-card-bright">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Connected Wallets</span>
              <Wallet className="w-4 h-4 text-violet-400" />
            </div>
            <div className="text-3xl font-bold text-violet-400">{stats.wallets_connected}</div>
            <div className="text-xs text-slate-500 mt-2">Active addresses</div>
          </CardContent>
        </Card>

        <Card className="glass-card-bright">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Pending Claims</span>
              <AlertCircle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-bold text-amber-400">{stats.pending_claims}</div>
            <div className="text-xs text-slate-500 mt-2">Awaiting execution</div>
          </CardContent>
        </Card>
      </div>

      {/* NED Status & Quick Actions */}
      <Card className="bg-gradient-to-r from-blue-600/30 to-cyan-600/30 border-blue-500/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Bot className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-1">NED Status</h2>
                <p className="text-sm text-slate-300">
                  Network Earnings Director {nedStatus === 'scanning' ? '(Scanning...)' : '(Ready)'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => scanMutation.mutate(['airdrop', 'mining', 'staking'])}
                disabled={scanMutation.isPending}
                className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 gap-2"
              >
                <Radio className="w-4 h-4" />
                Scan Now
              </Button>
              <Button
                variant="outline"
                className="gap-2"
              >
                <Settings className="w-4 h-4" />
                Configure
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'opportunities', label: 'Opportunities', icon: Target },
          { id: 'wallets', label: 'Wallets', icon: Wallet },
          { id: 'transactions', label: 'Transactions', icon: TrendingUp },
          { id: 'settings', label: 'Settings', icon: Settings },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
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

      {/* Content */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-cyan-400" />
                About NED
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <p>
                NED (Network Earnings Director) is your autonomous cryptocurrency profit intelligence engine. 
                Operating 24/7, NED continuously scans the crypto ecosystem for profitable opportunities across:
              </p>
              <ul className="grid grid-cols-2 gap-2 text-xs">
                <li className="flex items-center gap-2"><span className="text-cyan-400">•</span> Airdrops & Giveaways</li>
                <li className="flex items-center gap-2"><span className="text-cyan-400">•</span> Mining Operations</li>
                <li className="flex items-center gap-2"><span className="text-cyan-400">•</span> Staking Pools</li>
                <li className="flex items-center gap-2"><span className="text-cyan-400">•</span> Micro-Tasks</li>
                <li className="flex items-center gap-2"><span className="text-cyan-400">•</span> Arbitrage</li>
                <li className="flex items-center gap-2"><span className="text-cyan-400">•</span> Yield Farming</li>
              </ul>
              <Button
                onClick={() => setActiveTab('settings')}
                className="w-full bg-cyan-600 hover:bg-cyan-700 mt-4"
              >
                <Zap className="w-4 h-4 mr-2" />
                Launch NED Autopilot
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'opportunities' && (
        <div className="space-y-4">
          {opportunities.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="p-8 text-center">
                <Target className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 mb-4">No opportunities found. Run a scan to get started.</p>
                <Button
                  onClick={() => scanMutation.mutate(['airdrop', 'mining', 'staking'])}
                  disabled={scanMutation.isPending}
                  className="bg-cyan-600 hover:bg-cyan-700"
                >
                  Scan for Opportunities
                </Button>
              </CardContent>
            </Card>
          ) : (
            opportunities.map(opp => (
              <Card key={opp.id} className="glass-card hover:border-cyan-500/50 transition-colors">
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
                      ${opp.estimated_value_usd}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs mb-3">
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

                  {opp.status === 'active' && (
                    <Button className="w-full bg-cyan-600 hover:bg-cyan-700 text-xs py-2">
                      Execute with NED
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === 'wallets' && (
        <div className="space-y-4">
          {wallets.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="p-8 text-center">
                <Wallet className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 mb-4">No wallets configured. Create one to start earning.</p>
                <Button className="bg-cyan-600 hover:bg-cyan-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Wallet
                </Button>
              </CardContent>
            </Card>
          ) : (
            wallets.map(wallet => (
              <Card key={wallet.id} className="glass-card">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white mb-1">{wallet.wallet_name}</h3>
                      <p className="text-xs text-slate-400 font-mono">{wallet.address}</p>
                      <p className="text-xs text-cyan-400 mt-2">${wallet.balance?.total_balance_usd || 0}</p>
                    </div>
                    <Badge className="bg-cyan-500/20 text-cyan-400">
                      {wallet.wallet_type}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="space-y-4">
          {transactions.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="p-8 text-center text-slate-400">
                No transactions yet. Complete an opportunity to see earnings here.
              </CardContent>
            </Card>
          ) : (
            transactions.map(tx => (
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

      {activeTab === 'settings' && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Crypto Profit Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="p-4 rounded bg-slate-800/50">
              <div className="font-semibold text-white mb-2">NED Autopilot</div>
              <p className="text-slate-400 mb-3">Enable autonomous opportunity scanning and execution</p>
              <Button className="bg-cyan-600 hover:bg-cyan-700 gap-2">
                <Zap className="w-4 h-4" />
                Launch NED Autopilot
              </Button>
            </div>
            <div className="p-4 rounded bg-slate-800/50">
              <div className="font-semibold text-white mb-2">Risk Settings</div>
              <p className="text-slate-400">Configure minimum legitimacy score and maximum risk tolerance for automatic execution</p>
            </div>
            <div className="p-4 rounded bg-slate-800/50">
              <div className="font-semibold text-white mb-2">Wallet Management</div>
              <p className="text-slate-400">Create, import, or connect crypto wallets for earnings deposit</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}