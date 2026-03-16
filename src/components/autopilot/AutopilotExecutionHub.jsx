import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Play, Pause, CheckCircle2, AlertCircle, Zap, Clock, Users, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function AutopilotExecutionHub() {
  const [isRunning, setIsRunning] = useState(false);
  const [lastCycleTime, setLastCycleTime] = useState(null);

  // Get autopilot status
  const { data: statusData, refetch: refetchStatus } = useQuery({
    queryKey: ['autopilot_status'],
    queryFn: async () => {
      const res = await base44.functions.invoke('autopilotScheduler', {
        action: 'get_autopilot_status'
      });
      return res.data?.status || {};
    },
    refetchInterval: 10000
  });

  // Run cycle mutation
  const runCycleMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('autopilotScheduler', {
        action: 'run_continuous_cycle'
      });
      return res.data?.cycle;
    },
    onSuccess: (cycle) => {
      setLastCycleTime(cycle?.end_time);
      refetchStatus();
    }
  });

  // Auto-run cycles
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      runCycleMutation.mutate();
    }, 30000); // Run every 30 seconds

    return () => clearInterval(interval);
  }, [isRunning]);

  const statusColor = statusData?.ready_to_execute ? 'text-emerald-400' : 'text-amber-400';

  return (
    <div className="space-y-4">
      {/* Control Bar */}
      <div className="flex items-center justify-between bg-slate-900/50 border border-slate-800 rounded-lg p-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
            Autonomous Execution Engine
          </h3>
          <p className="text-xs text-slate-400">
            {isRunning ? 'Running continuous cycles' : 'Ready to execute'}
            {lastCycleTime && ` · Last cycle: ${new Date(lastCycleTime).toLocaleTimeString()}`}
          </p>
        </div>

        <Button
          onClick={() => setIsRunning(!isRunning)}
          className={isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}
        >
          {isRunning ? (
            <>
              <Pause className="w-4 h-4 mr-2" />
              Stop Cycles
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Start Cycles
            </>
          )}
        </Button>
      </div>

      {/* Status Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-slate-900/50 border-slate-800 p-3">
          <p className="text-xs text-slate-500">Status</p>
          <p className={`text-lg font-bold mt-1 ${statusColor}`}>
            {statusData?.ready_to_execute ? '✓ Ready' : '⚠ Setup'}
          </p>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800 p-3">
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <Users className="w-3 h-3" /> Active Identity
          </p>
          <p className="text-sm font-semibold text-white mt-1 truncate">
            {statusData?.current_identity?.name || 'None'}
          </p>
        </Card>

        <Card className="bg-blue-950/20 border-blue-900/30 p-3">
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Opportunities
          </p>
          <p className="text-lg font-bold text-blue-400 mt-1">
            {statusData?.queued_opportunities || 0}
          </p>
        </Card>

        <Card className="bg-emerald-950/20 border-emerald-900/30 p-3">
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <Zap className="w-3 h-3" /> Active Tasks
          </p>
          <p className="text-lg font-bold text-emerald-400 mt-1">
            {statusData?.active_tasks || 0}
          </p>
        </Card>
      </div>

      {/* Execution Stats */}
      {statusData?.execution_stats && (
        <Card className="bg-slate-900/50 border-slate-800 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Performance Metrics
          </h4>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-slate-500">Success Rate</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">
                {statusData.execution_stats.success_rate || 0}%
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">Value Completed</p>
              <p className="text-xl font-bold text-white mt-1">
                ${(statusData.execution_stats.total_value_completed || 0).toLocaleString()}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">Avg Time</p>
              <p className="text-lg font-bold text-slate-300 mt-1">
                {statusData.execution_stats.avg_execution_time || 0}s
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Manual Cycle Button */}
      <Button
        onClick={() => runCycleMutation.mutate()}
        disabled={runCycleMutation.isPending}
        variant="outline"
        className="w-full"
      >
        {runCycleMutation.isPending ? (
          <>
            <Zap className="w-4 h-4 mr-2 animate-spin" />
            Running Cycle...
          </>
        ) : (
          <>
            <Play className="w-4 h-4 mr-2" />
            Run Manual Cycle Now
          </>
        )}
      </Button>
    </div>
  );
}