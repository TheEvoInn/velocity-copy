/**
 * IDENTITY WALLET VIEW
 * Centralized credential management for all AI agents and crypto wallets
 * Real-time sync with bidirectional communication to all services
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Wallet, Bot, Lock, CheckCircle2, AlertCircle, RefreshCw,
  Shield, Eye, Zap, Coins, Mail, Database, Clock
} from 'lucide-react';
import { toast } from 'sonner';

export default function IdentityWalletView() {
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const [selectedTab, setSelectedTab] = useState('overview');

  // Fetch identity wallet
  const { data: wallet, isLoading } = useQuery({
    queryKey: ['identityWallet', authUser?.email],
    queryFn: async () => {
      if (!authUser?.email) return null;
      const wallets = await base44.entities.IdentityWallet.filter(
        { created_by: authUser.email, is_primary: true },
        '-created_date',
        1
      );
      return wallets.length > 0 ? wallets[0] : null;
    },
    enabled: !!authUser?.email,
    refetchInterval: 30000,
  });

  // Sync wallet mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('identityWalletSync', {
        action: 'sync_wallet'
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identityWallet'] });
      toast.success('Wallet synced successfully');
    },
    onError: (err) => toast.error(err.message),
  });

  // Verify credentials mutation
  const verifyMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('identityWalletSync', {
        action: 'verify_credentials',
        wallet_id: wallet.id
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.all_credentials_verified) {
        toast.success(`All ${data.total_count} credentials verified!`);
      } else {
        toast.warning(`${data.verified_count}/${data.total_count} credentials verified`);
      }
      queryClient.invalidateQueries({ queryKey: ['identityWallet'] });
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-400">Loading identity wallet...</p>
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card className="border-amber-500/30 bg-amber-950/20">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-white mb-2">No Identity Wallet Found</h2>
            <p className="text-slate-300 mb-4">Initialize your identity wallet to manage credentials</p>
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="bg-cyan-600 hover:bg-cyan-500"
            >
              <Zap className="w-4 h-4 mr-2" />
              {syncMutation.isPending ? 'Initializing...' : 'Initialize Wallet'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = {
    total_agents: wallet.ai_agents?.length || 0,
    active_agents: wallet.ai_agents?.filter(a => a.status === 'active').length || 0,
    total_wallets: wallet.crypto_wallets?.length || 0,
    active_wallets: wallet.crypto_wallets?.filter(w => w.status === 'active').length || 0,
    total_balance: wallet.crypto_wallets?.reduce((sum, w) => sum + (w.balance_usd || 0), 0) || 0,
    verified_percentage: wallet.credential_status?.total_credentials > 0
      ? Math.round((wallet.credential_status?.verified_count / wallet.credential_status?.total_credentials) * 100)
      : 0,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white font-orbitron flex items-center gap-3">
            <Wallet className="w-8 h-8 text-cyan-400" />
            Identity Wallet
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Unified credential management for {wallet.identity_name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => verifyMutation.mutate()}
            disabled={verifyMutation.isPending}
            variant="outline"
            className="gap-2"
          >
            <Shield className="w-4 h-4" />
            {verifyMutation.isPending ? 'Verifying...' : 'Verify All'}
          </Button>
          <Button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="bg-cyan-600 hover:bg-cyan-500 gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            Sync Now
          </Button>
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-4">
        <Badge className={wallet.credential_status?.all_verified ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}>
          {wallet.credential_status?.all_verified ? '✓ All Verified' : '⚠ Verification Needed'}
        </Badge>
        <span className="text-sm text-slate-400">
          Last synced: {wallet.credential_status?.last_sync ? new Date(wallet.credential_status.last_sync).toLocaleTimeString() : 'Never'}
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          label="AI Agents"
          value={`${stats.active_agents}/${stats.total_agents}`}
          icon={Bot}
          color="violet"
        />
        <StatCard
          label="Crypto Wallets"
          value={`${stats.active_wallets}/${stats.total_wallets}`}
          icon={Coins}
          color="cyan"
        />
        <StatCard
          label="Total Balance"
          value={`$${stats.total_balance.toLocaleString()}`}
          icon={Wallet}
          color="emerald"
        />
        <StatCard
          label="Verified"
          value={`${stats.verified_percentage}%`}
          icon={CheckCircle2}
          color="amber"
        />
        <StatCard
          label="Departments"
          value={wallet.department_access?.filter(d => d.enabled).length || 0}
          icon={Database}
          color="pink"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800">
        {[
          { id: 'overview', label: 'Overview', icon: Eye },
          { id: 'agents', label: 'AI Agents', icon: Bot },
          { id: 'wallets', label: 'Wallets', icon: Coins },
          { id: 'permissions', label: 'Permissions', icon: Lock },
          { id: 'departments', label: 'Departments', icon: Database },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setSelectedTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
              selectedTab === tab.id
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
      {selectedTab === 'overview' && (
        <div className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-cyan-400" />
                Active Systems
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded bg-slate-800/50 border border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">Digital Commerce</p>
                  <p className="text-lg font-bold text-purple-400">Active</p>
                </div>
                <div className="p-4 rounded bg-slate-800/50 border border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">Crypto Automation</p>
                  <p className="text-lg font-bold text-cyan-400">Active</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                All departments are accessible through this identity wallet. Sync automatically updates all connected services.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedTab === 'agents' && (
        <div className="space-y-4">
          {wallet.ai_agents && wallet.ai_agents.length > 0 ? (
            wallet.ai_agents.map(agent => (
              <AgentCard key={agent.agent_id} agent={agent} />
            ))
          ) : (
            <Card className="glass-card">
              <CardContent className="p-8 text-center text-slate-400">
                No AI agents configured
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {selectedTab === 'wallets' && (
        <div className="space-y-4">
          {wallet.crypto_wallets && wallet.crypto_wallets.length > 0 ? (
            wallet.crypto_wallets.map(w => (
              <WalletCard key={w.wallet_id} wallet={w} />
            ))
          ) : (
            <Card className="glass-card">
              <CardContent className="p-8 text-center text-slate-400">
                No wallets configured
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {selectedTab === 'permissions' && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Permission Scopes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {wallet.permission_scopes && Object.entries(wallet.permission_scopes).map(([scope, enabled]) => (
              <div key={scope} className="flex items-center justify-between p-3 rounded bg-slate-800/50 border border-slate-700">
                <span className="text-sm text-slate-300 capitalize">{scope.replace(/_/g, ' ')}</span>
                {enabled ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-slate-500" />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {selectedTab === 'departments' && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Department Access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {wallet.department_access && wallet.department_access.map(dept => (
              <div key={dept.department} className="flex items-center justify-between p-3 rounded bg-slate-800/50 border border-slate-700">
                <div>
                  <p className="text-sm font-medium text-white">{dept.department}</p>
                  <p className="text-xs text-slate-400 capitalize">{dept.access_level} access</p>
                </div>
                {dept.enabled ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400">Active</Badge>
                ) : (
                  <Badge variant="secondary">Disabled</Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AgentCard({ agent }) {
  return (
    <Card className="border-slate-700 hover:border-violet-500/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-white flex items-center gap-2">
              {agent.agent_name}
              {agent.status === 'active' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-slate-500" />
              )}
            </h3>
            <p className="text-xs text-slate-400 mt-1">{agent.role_label}</p>
          </div>
          <Badge className={agent.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}>
            {agent.status}
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="p-2 rounded bg-slate-800">
            <p className="text-slate-400">Tasks</p>
            <p className="text-violet-400 font-bold">{agent.tasks_executed}</p>
          </div>
          <div className="p-2 rounded bg-slate-800">
            <p className="text-slate-400">Earned</p>
            <p className="text-emerald-400 font-bold">${agent.total_earned?.toLocaleString() || 0}</p>
          </div>
          <div className="p-2 rounded bg-slate-800">
            <p className="text-slate-400">Connected</p>
            <p className="text-cyan-400 font-bold">{agent.connected_accounts?.length || 0}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WalletCard({ wallet }) {
  return (
    <Card className="border-slate-700 hover:border-cyan-500/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-white flex items-center gap-2">
              {wallet.wallet_name}
              {wallet.is_primary && (
                <Badge className="bg-amber-500/20 text-amber-400 text-xs">Primary</Badge>
              )}
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-mono">{wallet.address}</p>
          </div>
          <Badge className={wallet.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}>
            {wallet.status}
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="p-2 rounded bg-slate-800">
            <p className="text-slate-400">Type</p>
            <p className="text-cyan-400 font-bold">{wallet.wallet_type}</p>
          </div>
          <div className="p-2 rounded bg-slate-800">
            <p className="text-slate-400">Balance</p>
            <p className="text-emerald-400 font-bold">${wallet.balance_usd?.toLocaleString() || 0}</p>
          </div>
          <div className="p-2 rounded bg-slate-800">
            <p className="text-slate-400">Updated</p>
            <p className="text-slate-400 font-bold text-xs">{new Date(wallet.last_updated).toLocaleDateString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  const colorMap = {
    violet: 'text-violet-400 bg-violet-500/10',
    cyan: 'text-cyan-400 bg-cyan-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    pink: 'text-pink-400 bg-pink-500/10',
  };

  return (
    <Card className="border-slate-700">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colorMap[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400">{label}</p>
            <p className="text-xl font-bold text-white">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}