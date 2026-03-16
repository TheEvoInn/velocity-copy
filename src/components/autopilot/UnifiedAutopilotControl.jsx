import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, Power, Activity, TrendingUp, Zap } from 'lucide-react';

export default function UnifiedAutopilotControl() {
  const qc = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  // Fetch platform state
  const { data: platformState, refetch: refetchState } = useQuery({
    queryKey: ['platformState'],
    queryFn: async () => {
      const res = await base44.functions.invoke('unifiedOrchestrator', { 
        action: 'get_status' 
      });
      return res?.data?.state;
    },
    refetchInterval: 5000
  });

  // Toggle autopilot mutation
  const toggleMutation = useMutation({
    mutationFn: async (enabled) => {
      const res = await base44.functions.invoke('unifiedOrchestrator', {
        action: 'toggle_autopilot',
        enabled
      });
      return res?.data;
    },
    onSuccess: () => {
      refetchState();
      qc.invalidateQueries({ queryKey: ['platformState'] });
    }
  });

  // Run manual cycle
  const cycleMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('unifiedOrchestrator', { 
        action: 'full_cycle' 
      });
      return res?.data;
    },
    onSuccess: () => {
      refetchState();
    }
  });

  const handleToggle = async (checked) => {
    setIsLoading(true);
    try {
      await toggleMutation.mutateAsync(checked);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualCycle = async () => {
    setIsLoading(true);
    try {
      await cycleMutation.mutateAsync();
    } finally {
      setIsLoading(false);
    }
  };

  if (!platformState) {
    return <div className="text-sm text-slate-500">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Main Control Panel */}
      <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${
              platformState.autopilot_enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'
            }`} />
            <div>
              <h3 className="text-sm font-bold text-white">Unified Autopilot</h3>
              <p className="text-xs text-slate-400">
                {platformState.autopilot_enabled ? 'Running continuously' : 'Paused'}
              </p>
            </div>
          </div>
          <Switch
            checked={platformState.autopilot_enabled}
            onCheckedChange={handleToggle}
            disabled={isLoading}
          />
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-slate-800/50 rounded-lg p-2">
            <p className="text-[10px] text-slate-500 uppercase">Cycles Today</p>
            <p className="text-lg font-bold text-emerald-400">{platformState.cycle_count_today || 0}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-2">
            <p className="text-[10px] text-slate-500 uppercase">Tasks Done</p>
            <p className="text-lg font-bold text-blue-400">{platformState.tasks_completed_today || 0}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-2">
            <p className="text-[10px] text-slate-500 uppercase">Queue</p>
            <p className="text-lg font-bold text-amber-400">{platformState.current_queue_count || 0}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-2">
            <p className="text-[10px] text-slate-500 uppercase">Today's Revenue</p>
            <p className="text-lg font-bold text-green-400">${(platformState.revenue_generated_today || 0).toFixed(0)}</p>
          </div>
        </div>

        {/* System Health */}
        <div className="flex items-center gap-2 mb-4 p-2 bg-slate-800/30 rounded-lg">
          <Activity className={`w-4 h-4 ${
            platformState.system_health === 'healthy' ? 'text-emerald-400' :
            platformState.system_health === 'warning' ? 'text-amber-400' :
            'text-red-400'
          }`} />
          <span className="text-xs text-slate-300">
            System: <span className="capitalize font-semibold">
              {platformState.system_health || 'healthy'}
            </span>
          </span>
        </div>

        {/* Error Display */}
        {platformState.last_error && (
          <div className="mb-4 p-2 bg-red-500/10 border border-red-500/30 rounded-lg flex gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-red-400 font-medium">Last Error</p>
              <p className="text-xs text-red-300">{platformState.last_error}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleManualCycle}
            disabled={!platformState.autopilot_enabled || isLoading || cycleMutation.isPending}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white h-9 gap-2"
          >
            <Zap className="w-4 h-4" />
            Run Cycle Now
          </Button>
          <Button
            variant="outline"
            className="px-3 h-9 border-slate-700"
            title="Emergency stop - disables all automation"
          >
            <Power className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Last Activity */}
      {platformState.last_cycle_timestamp && (
        <div className="text-xs text-slate-500 text-center">
          Last cycle: {new Date(platformState.last_cycle_timestamp).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}