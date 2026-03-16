import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Zap, CheckCircle2, AlertCircle, TrendingUp, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Link } from 'react-router-dom';

export default function UnifiedExecutionSummary() {
  // Get execution status
  const { data: statusData } = useQuery({
    queryKey: ['unified_execution_status'],
    queryFn: async () => {
      const res = await base44.functions.invoke('autopilotScheduler', {
        action: 'get_autopilot_status'
      });
      return res.data?.status || {};
    },
    refetchInterval: 15000
  });

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-white">Autonomous Execution Status</h3>

      {/* Quick Status */}
      <Card className="bg-gradient-to-r from-slate-900/50 to-slate-800/50 border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${statusData?.ready_to_execute ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
            <div>
              <p className="text-xs text-slate-400">System Status</p>
              <p className="text-sm font-semibold text-white">
                {statusData?.ready_to_execute ? '✓ Ready to Execute' : '⚠ Needs Setup'}
              </p>
            </div>
          </div>

          <Link
            to="/AutoPilot"
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            Open AutoPilot
          </Link>
        </div>
      </Card>

      {/* Grid of metrics */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="bg-slate-900/30 border-slate-800 p-3">
          <p className="text-[10px] text-slate-500">Active Identity</p>
          <p className="text-xs font-semibold text-white mt-1 truncate">
            {statusData?.current_identity?.name || '—'}
          </p>
        </Card>

        <Card className="bg-blue-950/20 border-blue-900/30 p-3">
          <p className="text-[10px] text-slate-500">Opportunities</p>
          <p className="text-lg font-bold text-blue-400">
            {statusData?.queued_opportunities || 0}
          </p>
        </Card>

        <Card className="bg-emerald-950/20 border-emerald-900/30 p-3">
          <p className="text-[10px] text-slate-500">Active Tasks</p>
          <p className="text-lg font-bold text-emerald-400">
            {statusData?.active_tasks || 0}
          </p>
        </Card>

        <Card className="bg-amber-950/20 border-amber-900/30 p-3">
          <p className="text-[10px] text-slate-500">Success Rate</p>
          <p className="text-lg font-bold text-amber-400">
            {statusData?.execution_stats?.success_rate || 0}%
          </p>
        </Card>
      </div>

      {/* Value Summary */}
      {statusData?.execution_stats && (
        <Card className="bg-slate-900/30 border-slate-800 p-3">
          <p className="text-[10px] text-slate-500 mb-1.5">Value Generated</p>
          <p className="text-2xl font-bold text-emerald-400">
            ${(statusData.execution_stats.total_value_completed || 0).toLocaleString()}
          </p>
        </Card>
      )}

      {/* Call to action */}
      {statusData?.ready_to_execute && (
        <div className="bg-emerald-950/30 border border-emerald-900/30 rounded-lg p-3 text-xs">
          <p className="text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            System ready for autonomous execution
          </p>
        </div>
      )}

      {!statusData?.ready_to_execute && (
        <div className="bg-amber-950/30 border border-amber-900/30 rounded-lg p-3 text-xs">
          <p className="text-amber-300 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            Create an identity to get started
          </p>
        </div>
      )}
    </div>
  );
}