import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, CheckCircle2, Zap, AlertTriangle } from 'lucide-react';

export default function ExecutionOptimizationDashboard() {
  const [autoRepair, setAutoRepair] = useState(false);

  // Full platform audit
  const { data: audit, isLoading: auditLoading, refetch: refetchAudit } = useQuery({
    queryKey: ['execution-audit'],
    queryFn: async () => {
      const res = await base44.functions.invoke('executionAuditEngine', {
        action: 'full_platform_audit'
      });
      return res.data;
    },
    refetchInterval: 30000
  });

  // Execution pipeline health
  const { data: pipelineHealth } = useQuery({
    queryKey: ['pipeline-health'],
    queryFn: async () => {
      const res = await base44.functions.invoke('executionAuditEngine', {
        action: 'execution_pipeline_health'
      });
      return res.data;
    },
    refetchInterval: 30000
  });

  // Stalled tasks
  const { data: stalledTasks } = useQuery({
    queryKey: ['stalled-tasks'],
    queryFn: async () => {
      const res = await base44.functions.invoke('executionAuditEngine', {
        action: 'identify_stalled_tasks'
      });
      return res.data;
    },
    refetchInterval: 30000
  });

  // Optimization mutations
  const optimizeQueueMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('autonomousOperationsOptimizer', {
        action: 'optimize_task_queue'
      });
      return res.data;
    },
    onSuccess: () => {
      refetchAudit();
      setTimeout(() => refetchAudit(), 2000);
    }
  });

  const batchingMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('autonomousOperationsOptimizer', {
        action: 'intelligent_batching'
      });
      return res.data;
    },
    onSuccess: () => refetchAudit()
  });

  const fixStalledMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('autonomousOperationsOptimizer', {
        action: 'fix_stalled_workflow'
      });
      return res.data;
    },
    onSuccess: () => refetchAudit()
  });

  if (auditLoading) {
    return (
      <div className="min-h-screen galaxy-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  const statusColor = {
    healthy: 'border-emerald-500/30 bg-emerald-500/5',
    warning: 'border-amber-500/30 bg-amber-500/5',
    critical: 'border-red-500/30 bg-red-500/5',
    error: 'border-red-600/30 bg-red-600/5'
  };

  const statusIcon = {
    healthy: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
    critical: <AlertCircle className="w-5 h-5 text-red-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-600" />
  };

  return (
    <div className="min-h-screen galaxy-bg p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-orbitron text-3xl font-bold text-white tracking-wider">EXECUTION OPTIMIZATION</h1>
            <p className="text-sm text-slate-400 mt-1">Real-time agentic operations audit & auto-repair</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => refetchAudit()}
              variant="outline"
              disabled={auditLoading}
            >
              Refresh
            </Button>
            <Button
              onClick={() => setAutoRepair(!autoRepair)}
              className={autoRepair ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            >
              {autoRepair ? '✓ Auto-Repair ON' : 'Auto-Repair'}
            </Button>
          </div>
        </div>

        {/* Overall Status */}
        {audit && (
          <Card className={`glass-card ${statusColor[audit.overall_status]}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {statusIcon[audit.overall_status]}
                  <div>
                    <CardTitle className="capitalize">{audit.overall_status}</CardTitle>
                    <CardDescription>Platform health status</CardDescription>
                  </div>
                </div>
                <div className="text-right text-xs text-slate-400">
                  {new Date(audit.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </CardHeader>
          </Card>
        )}

        {/* Task Execution */}
        {audit?.sections?.task_execution && (
          <Card className={`glass-card ${statusColor[audit.sections.task_execution.status]}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {statusIcon[audit.sections.task_execution.status]}
                  <CardTitle>Task Execution Queue</CardTitle>
                </div>
                <Button
                  onClick={() => optimizeQueueMutation.mutate()}
                  disabled={optimizeQueueMutation.isPending}
                  size="sm"
                  variant="outline"
                >
                  {optimizeQueueMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  Optimize
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">Queued</p>
                  <p className="text-xl font-bold text-cyan-300">{audit.sections.task_execution.queued.count}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">Processing</p>
                  <p className="text-xl font-bold text-blue-300">{audit.sections.task_execution.processing.count}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">Completed</p>
                  <p className="text-xl font-bold text-emerald-300">{audit.sections.task_execution.completed_24h}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">Success Rate</p>
                  <p className="text-xl font-bold text-teal-300">{audit.sections.task_execution.success_rate}%</p>
                </div>
              </div>
              {audit.sections.task_execution.issues.length > 0 && (
                <div className="space-y-1">
                  {audit.sections.task_execution.issues.map((issue, idx) => (
                    <div key={idx} className="text-xs text-amber-300 flex items-start gap-2">
                      <span className="shrink-0">⚠️</span>
                      <span>{issue}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Interventions */}
        {audit?.sections?.interventions && (
          <Card className={`glass-card ${statusColor[audit.sections.interventions.status]}`}>
            <CardHeader>
              <div className="flex items-center gap-2">
                {statusIcon[audit.sections.interventions.status]}
                <CardTitle>User Interventions</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">Pending</p>
                  <p className="text-xl font-bold text-orange-300">{audit.sections.interventions.pending.count}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">In Progress</p>
                  <p className="text-xl font-bold text-blue-300">{audit.sections.interventions.in_progress.count}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">Resolved</p>
                  <p className="text-xl font-bold text-emerald-300">{audit.sections.interventions.resolved_24h}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">Expired</p>
                  <p className="text-xl font-bold text-red-400">{audit.sections.interventions.expired}</p>
                </div>
              </div>
              {audit.sections.interventions.issues.length > 0 && (
                <div className="space-y-1">
                  {audit.sections.interventions.issues.map((issue, idx) => (
                    <div key={idx} className="text-xs text-amber-300 flex items-start gap-2">
                      <span className="shrink-0">⚠️</span>
                      <span>{issue}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Credentials/Identity */}
        {audit?.sections?.credentials_identities && (
          <Card className={`glass-card ${statusColor[audit.sections.credentials_identities.status]}`}>
            <CardHeader>
              <CardTitle>Credentials & Identities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">Active Creds</p>
                  <p className="text-xl font-bold text-cyan-300">{audit.sections.credentials_identities.active_credentials}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">Expired</p>
                  <p className="text-xl font-bold text-red-400">{audit.sections.credentials_identities.expired_credentials}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">Identities</p>
                  <p className="text-xl font-bold text-violet-300">{audit.sections.credentials_identities.active_identities}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">Linked Accts</p>
                  <p className="text-xl font-bold text-teal-300">{audit.sections.credentials_identities.linked_accounts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Wallet Sync */}
        {audit?.sections?.wallet && (
          <Card className={`glass-card ${statusColor[audit.sections.wallet.status]}`}>
            <CardHeader>
              <CardTitle>Wallet & Transaction Sync</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">Total Earnings</p>
                  <p className="text-xl font-bold text-emerald-300">${audit.sections.wallet.total_earnings_tracked.toFixed(2)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">Sync Mismatches</p>
                  <p className="text-xl font-bold text-red-400">{audit.sections.wallet.wallet_sync_mismatches}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-400">Tracked Users</p>
                  <p className="text-xl font-bold text-blue-300">{audit.sections.wallet.user_goals_tracked}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card className="glass-card border-cyan-500/30">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button
              onClick={() => batchingMutation.mutate()}
              disabled={batchingMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {batchingMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
              Intelligent Batching
            </Button>
            <Button
              onClick={() => fixStalledMutation.mutate()}
              disabled={fixStalledMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {fixStalledMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
              Fix Stalled Workflow
            </Button>
            <Button
              onClick={() => refetchAudit()}
              variant="outline"
            >
              Full Re-Audit
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}