import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Clock, Zap, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function AutopilotActivationDiagnostics() {
  const qc = useQueryClient();
  const [showDetails, setShowDetails] = useState(false);

  // Fetch diagnostic data
  const { data: diagnostics, isLoading, refetch } = useQuery({
    queryKey: ['autopilotDiagnostics'],
    queryFn: async () => {
      const res = await base44.functions.invoke('autopilotDiagnosticsRepair', {});
      return res.data?.diagnostics;
    },
    refetchInterval: 30000
  });

  // Manual repair mutation
  const repairMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('autopilotDiagnosticsRepair', {});
      return res.data;
    },
    onSuccess: () => {
      refetch();
      qc.invalidateQueries({ queryKey: ['autopilotDiagnostics'] });
      toast.success('Diagnostics & repair completed');
    },
    onError: (err) => toast.error(err.message)
  });

  if (isLoading) {
    return <div className="text-sm text-slate-400">Loading diagnostics...</div>;
  }

  if (!diagnostics) {
    return <div className="text-sm text-slate-400">No diagnostic data available</div>;
  }

  const failedChecks = diagnostics.checks.filter(c => c.status === 'failed');
  const warningChecks = diagnostics.checks.filter(c => c.status === 'warning');
  const okChecks = diagnostics.checks.filter(c => c.status === 'ok');

  const systemHealth = failedChecks.length > 0 ? 'critical' : warningChecks.length > 0 ? 'warning' : 'healthy';

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card className={`border-l-4 ${
        systemHealth === 'critical' ? 'border-l-red-500 bg-red-500/5' :
        systemHealth === 'warning' ? 'border-l-amber-500 bg-amber-500/5' :
        'border-l-emerald-500 bg-emerald-500/5'
      }`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              {systemHealth === 'critical' ? (
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
              ) : systemHealth === 'warning' ? (
                <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5" />
              )}
              <div>
                <p className="font-semibold text-white capitalize">
                  System Status: {systemHealth}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {okChecks.length} checks passed • {warningChecks.length} warnings • {failedChecks.length} failures
                </p>
                {diagnostics.issues_found > 0 && (
                  <p className="text-xs text-slate-300 mt-2">
                    Issues fixed: {diagnostics.issues_fixed}/{diagnostics.issues_found}
                  </p>
                )}
              </div>
            </div>
            <Button
              onClick={() => repairMutation.mutate()}
              disabled={repairMutation.isPending}
              size="sm"
              className="gap-2 bg-cyan-600 hover:bg-cyan-500"
            >
              <RefreshCw className="w-4 h-4" />
              Repair Now
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Checks */}
      <div className="space-y-2">
        {diagnostics.checks.map((check, idx) => (
          <CheckItem key={idx} check={check} />
        ))}
      </div>

      {/* Repairs Applied */}
      {diagnostics.repairs.length > 0 && (
        <div className="mt-6 pt-6 border-t border-slate-700">
          <h3 className="text-sm font-semibold text-white mb-3">Repairs Applied</h3>
          <div className="space-y-2">
            {diagnostics.repairs.map((repair, idx) => (
              <div key={idx} className="p-2 bg-slate-800/50 rounded text-xs">
                <div className="flex items-center gap-2">
                  {repair.status === 'success' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : repair.status === 'in_progress' ? (
                    <Clock className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                  )}
                  <span className="text-slate-300">{repair.repair}</span>
                  <span className={`ml-auto ${
                    repair.status === 'success' ? 'text-emerald-400' :
                    repair.status === 'in_progress' ? 'text-blue-400' :
                    'text-red-400'
                  }`}>
                    {repair.status}
                  </span>
                </div>
                {repair.error && (
                  <p className="text-red-400 text-xs mt-1">{repair.error}</p>
                )}
                {repair.tasks_queued && (
                  <p className="text-slate-400 text-xs mt-1">Queued: {repair.tasks_queued} tasks</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toggle Details */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="text-xs text-cyan-400 hover:text-cyan-300 mt-4"
      >
        {showDetails ? 'Hide Details' : 'Show Details'}
      </button>

      {showDetails && (
        <pre className="text-xs bg-slate-900 p-3 rounded border border-slate-700 text-slate-400 overflow-auto max-h-64">
          {JSON.stringify(diagnostics, null, 2)}
        </pre>
      )}
    </div>
  );
}

function CheckItem({ check }) {
  const statusStyles = {
    ok: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    failed: 'bg-red-500/10 border-red-500/30 text-red-400'
  };

  const icon = {
    ok: CheckCircle2,
    warning: AlertTriangle,
    failed: AlertCircle
  }[check.status];

  const Icon = icon;

  return (
    <div className={`p-3 rounded border ${statusStyles[check.status]}`}>
      <div className="flex items-start gap-3">
        <Icon className="w-4 h-4 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-mono text-xs font-semibold capitalize">{check.check}</p>
          {check.issue && (
            <p className="text-xs mt-1 opacity-80">{check.issue}</p>
          )}
          {check.status === 'ok' && check.identity_name && (
            <p className="text-xs mt-1 opacity-80">Active: {check.identity_name}</p>
          )}
          {check.verified_count !== undefined && (
            <p className="text-xs mt-1 opacity-80">Count: {check.verified_count}</p>
          )}
          {check.queued_tasks !== undefined && (
            <p className="text-xs mt-1 opacity-80">Queued: {check.queued_tasks} tasks</p>
          )}
        </div>
      </div>
    </div>
  );
}