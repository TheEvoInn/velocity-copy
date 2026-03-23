import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Clock, CheckCircle2, AlertTriangle, BarChart3, Zap } from 'lucide-react';
import { toast } from 'sonner';

export default function IntegrationSyncManager() {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(new Set());

  // Fetch sync status
  const { data: syncStatus = {}, refetch: refetchStatus } = useQuery({
    queryKey: ['integrationSyncStatus'],
    queryFn: async () => {
      const res = await base44.functions.invoke('integrationSyncService', {
        action: 'get_sync_status'
      });
      return res.data;
    },
    refetchInterval: 60000,
    staleTime: 30000
  });

  // Sync all mutation
  const syncAllMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('integrationSyncService', {
        action: 'sync_all'
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Synced ${data.results?.length || 0} connections`);
      refetchStatus();
      queryClient.invalidateQueries({ queryKey: ['platformConnections'] });
    },
    onError: (err) => {
      toast.error(`Sync failed: ${err.message}`);
    }
  });

  // Sync single platform mutation
  const syncPlatformMutation = useMutation({
    mutationFn: async (connectionId) => {
      const res = await base44.functions.invoke('integrationSyncService', {
        action: 'sync_platform',
        connection_id: connectionId
      });
      return res.data;
    },
    onSuccess: (data, connectionId) => {
      toast.success(`Synced ${data.platform}`);
      refetchStatus();
      setSyncing(prev => {
        const next = new Set(prev);
        next.delete(connectionId);
        return next;
      });
    },
    onError: (err, connectionId) => {
      toast.error(`Sync failed: ${err.message}`);
      setSyncing(prev => {
        const next = new Set(prev);
        next.delete(connectionId);
        return next;
      });
    }
  });

  const handleSyncAll = async () => {
    await syncAllMutation.mutateAsync();
  };

  const handleSyncPlatform = (connectionId) => {
    setSyncing(prev => new Set(prev).add(connectionId));
    syncPlatformMutation.mutate(connectionId);
  };

  const { total_connected = 0, synced_today = 0, never_synced = 0, connections = [] } = syncStatus;

  return (
    <div className="space-y-4">
      {/* Overview Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Connected</p>
                <p className="text-2xl font-bold text-cyan-400 mt-1">{total_connected}</p>
              </div>
              <BarChart3 className="w-5 h-5 text-slate-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Synced Today</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">{synced_today}</p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-slate-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Never Synced</p>
                <p className="text-2xl font-bold text-amber-400 mt-1">{never_synced}</p>
              </div>
              <AlertTriangle className="w-5 h-5 text-slate-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sync All Button */}
      <Button
        onClick={handleSyncAll}
        disabled={syncAllMutation.isPending || total_connected === 0}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
      >
        {syncAllMutation.isPending ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            Syncing all connections...
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            Sync All Connected Platforms
          </>
        )}
      </Button>

      {/* Connections List */}
      {connections.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-white">Sync Details</h3>
          {connections.map(conn => (
            <Card key={conn.id} className="bg-slate-900/30 border-slate-700">
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-white capitalize">{conn.platform}</p>
                    <Badge variant="outline" className="text-xs">
                      {conn.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">
                    {conn.last_synced ? (
                      <>
                        Last synced {conn.sync_age_hours}h ago
                        <span className="text-slate-600 ml-1">
                          ({new Date(conn.last_synced).toLocaleDateString()})
                        </span>
                      </>
                    ) : (
                      'Never synced'
                    )}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSyncPlatform(conn.id)}
                  disabled={conn.status !== 'connected' || syncing.has(conn.id)}
                  className="gap-1 text-xs"
                >
                  {syncing.has(conn.id) ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3 h-3" />
                      Sync
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-6 text-center text-slate-500 text-sm">
            No connected platforms to sync
          </CardContent>
        </Card>
      )}

      {/* Info Box */}
      <Card className="bg-blue-950/30 border-blue-500/30">
        <CardContent className="pt-6 text-xs text-blue-200 space-y-1">
          <div>• Auto-sync fetches job history, transaction data, and wallet balances</div>
          <div>• Jobs imported as Opportunities · Transactions synced to Transaction entity</div>
          <div>• Crypto wallets synced to CryptoWallet entity with real-time balances</div>
          <div>• Auto-sync runs daily; manually trigger anytime to refresh data</div>
        </CardContent>
      </Card>
    </div>
  );
}