import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, Unlock, AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function TaskExecutionLockMonitor() {
  const queryClient = useQueryClient();
  const [refreshInterval, setRefreshInterval] = useState(5000);

  // Fetch active locks
  const { data: lockData, isLoading } = useQuery({
    queryKey: ['activeLocks'],
    queryFn: async () => {
      const response = await base44.functions.invoke('taskExecutionLockManager', {
        action: 'get_active_locks'
      });
      return response.data || { active_locks: [], count: 0 };
    },
    refetchInterval: refreshInterval,
    staleTime: 2000
  });

  // Force unlock mutation
  const forceUnlockMutation = useMutation({
    mutationFn: async ({ platform, accountId }) => {
      const response = await base44.functions.invoke('taskExecutionLockManager', {
        action: 'force_unlock',
        platform,
        accountId
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Lock force-released (use carefully!)');
        queryClient.invalidateQueries({ queryKey: ['activeLocks'] });
      }
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    }
  });

  const activeLocks = lockData?.active_locks || [];

  if (isLoading) {
    return <div className="p-4 text-muted-foreground text-sm">Loading lock status...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Lock className={`w-5 h-5 ${activeLocks.length > 0 ? 'text-amber-500' : 'text-primary'}`} />
          <div>
            <h3 className="font-semibold text-foreground">Execution Locks</h3>
            <p className="text-xs text-muted-foreground">
              {activeLocks.length === 0
                ? 'No active locks - all accounts available'
                : `${activeLocks.length} account(s) currently locked`}
            </p>
          </div>
        </div>
        <Badge variant={activeLocks.length > 0 ? 'destructive' : 'default'}>
          {activeLocks.length} Active
        </Badge>
      </div>

      {/* Active Locks List */}
      {activeLocks.length > 0 ? (
        <div className="space-y-2">
          {activeLocks.map((lock, idx) => (
            <Card key={idx} className="glass-card border border-amber-500/30 bg-amber-500/5">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-500" />
                      <span className="font-medium text-foreground">
                        {lock.platform}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {lock.account_id.substring(0, 8)}...
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>
                        Locked {Math.round(lock.age_minutes * 60)}s ago
                        {lock.age_minutes > 4 && ' (expiring soon)'}
                      </span>
                    </div>
                  </div>

                  {/* Force Unlock Button (Emergency Only) */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (confirm('Force unlock this account? Use only if task is hung.')) {
                        forceUnlockMutation.mutate({
                          platform: lock.platform,
                          accountId: lock.account_id
                        });
                      }
                    }}
                    disabled={forceUnlockMutation.isPending}
                    className="text-xs gap-1.5 text-amber-600 border-amber-300 hover:bg-amber-500/10"
                  >
                    <Unlock className="w-3 h-3" />
                    Force Release
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="glass-card border border-primary/30 bg-primary/5">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground text-center">
              ✓ No concurrent task execution in progress
            </p>
          </CardContent>
        </Card>
      )}

      {/* Info Box */}
      <Card className="glass-card border border-border/50 bg-card/50">
        <CardContent className="pt-4 text-xs text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">🔒 How It Works</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Only one task executes per account at a time</li>
            <li>Locks expire automatically after 5 minutes</li>
            <li>Locked tasks are queued and retry automatically</li>
            <li>Prevents platform ban from concurrent session abuse</li>
            <li>Force release is emergency-only (use carefully)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}