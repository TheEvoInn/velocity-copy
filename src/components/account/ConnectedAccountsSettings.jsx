import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Globe, Check, AlertCircle, Eye, Lock, Trash2, RefreshCw } from 'lucide-react';

export default function ConnectedAccountsSettings() {
  const queryClient = useQueryClient();
  const [expandedAccount, setExpandedAccount] = useState(null);

  // Fetch linked accounts (actual user-connected accounts)
  const { data: connections = [], isLoading, refetch: refetchAccounts } = useQuery({
    queryKey: ['linkedAccounts'],
    queryFn: async () => {
      try {
        return await base44.entities.LinkedAccount.list('-last_used', 50);
      } catch (e) {
        return [];
      }
    },
    refetchInterval: 30000
  });

  // Mutation to verify/sync account
  const verifyMutation = useMutation({
    mutationFn: async (accountId) => {
      const res = await base44.functions.invoke('intelligentIdentityRouter', {
        action: 'verify_account_health',
        account_id: accountId
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linkedAccounts'] });
    }
  });

  // Mutation to disconnect account
  const disconnectMutation = useMutation({
    mutationFn: async (accountId) => {
      await base44.entities.LinkedAccount.update(accountId, {
        health_status: 'disconnected',
        ai_can_use: false
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linkedAccounts'] });
    }
  });

  const statusColors = {
    healthy: 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300',
    warning: 'bg-amber-950/30 border-amber-500/30 text-amber-300',
    cooldown: 'bg-orange-950/30 border-orange-500/30 text-orange-300',
    suspended: 'bg-red-950/30 border-red-500/30 text-red-300',
    limited: 'bg-yellow-950/30 border-yellow-500/30 text-yellow-300',
    disconnected: 'bg-slate-950/30 border-slate-700 text-slate-400'
  };

  const statusIcons = {
    healthy: <Check className="w-4 h-4" />,
    warning: <AlertCircle className="w-4 h-4" />,
    cooldown: <AlertCircle className="w-4 h-4" />,
    suspended: <AlertCircle className="w-4 h-4" />,
    limited: <AlertCircle className="w-4 h-4" />,
    disconnected: <AlertCircle className="w-4 h-4" />
  };

  const permissionColors = {
    view_only: 'bg-blue-500/20 text-blue-300',
    limited_automation: 'bg-amber-500/20 text-amber-300',
    full_automation: 'bg-emerald-500/20 text-emerald-300'
  };

  if (isLoading) {
    return <div className="text-slate-400">Loading connected accounts...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Info Box */}
      <Card className="bg-blue-950/30 border-blue-500/30">
        <CardContent className="pt-6 text-xs text-blue-200 space-y-1">
          <div>• Connected accounts are used by Autopilot for task execution</div>
          <div>• Your credentials are encrypted and never exposed</div>
          <div>• You control permission levels for each platform</div>
          <div>• Verify connections to ensure they remain active</div>
        </CardContent>
      </Card>

      {/* Sync Button */}
      {connections.length > 0 && (
        <Button 
          onClick={() => refetchAccounts()}
          variant="outline"
          size="sm"
          className="w-full gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Sync Connected Accounts
        </Button>
      )}

      {/* Connections List */}
      {connections.length === 0 ? (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-6 text-center text-slate-500 text-sm">
            <p>No connected accounts yet.</p>
            <a href="/AccountManager" className="text-blue-400 hover:underline">
              Connect your first account →
            </a>
          </CardContent>
        </Card>
      ) : (
        connections.map((conn) => (
          <Card key={conn.id} className="bg-slate-900/50 border-slate-700 hover:border-slate-600 transition-all">
            <CardContent className="p-4 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white capitalize">{conn.platform}</h4>
                    <p className="text-xs text-slate-500">{conn.label || 'Connected Account'}</p>
                  </div>
                </div>
                <Badge className={statusColors[conn.health_status] || statusColors.healthy}>
                  {statusIcons[conn.health_status] || statusIcons.healthy}
                  <span className="ml-1">{(conn.health_status || 'healthy').replace(/_/g, ' ')}</span>
                </Badge>
              </div>

              {/* Account Details */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-800/50 rounded p-2">
                  <p className="text-slate-500">Username</p>
                  <p className="text-slate-200 font-medium mt-1 truncate">
                    {conn.username || 'N/A'}
                  </p>
                </div>
                <div className="bg-slate-800/50 rounded p-2">
                  <p className="text-slate-500">AI Usage</p>
                  <p className={`font-medium mt-1 ${conn.ai_can_use ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {conn.ai_can_use ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
              </div>

              {/* Verification Status */}
              {conn.last_used && (
                <div className="text-xs text-slate-500 bg-slate-800/30 rounded p-2">
                  Last used: {new Date(conn.last_used).toLocaleDateString()}
                </div>
              )}

              {/* Jobs Completed */}
              <div className="text-xs text-slate-500 bg-slate-800/30 rounded p-2">
                Jobs completed: <span className="text-slate-200 font-medium">{conn.jobs_completed || 0}</span>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-slate-700">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => verifyMutation.mutate(conn.id)}
                  disabled={verifyMutation.isPending}
                  className="flex-1 gap-2 text-xs"
                >
                  <RefreshCw className="w-3 h-3" />
                  Verify
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => disconnectMutation.mutate(conn.id)}
                  disabled={disconnectMutation.isPending}
                  className="flex-1 gap-2 text-xs text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-3 h-3" />
                  Disconnect
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* Add New Connection */}
      <a
        href="/AccountManager"
        className="block w-full py-3 px-4 rounded-lg border border-dashed border-slate-600 text-center text-blue-400 hover:text-blue-300 hover:border-slate-500 transition-all text-sm font-medium"
      >
        + Add New Connection
      </a>
    </div>
  );
}