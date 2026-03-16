import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, RefreshCw, Zap, TrendingUp, Lock } from 'lucide-react';
import { toast } from 'sonner';

export default function SystemAuditDashboard() {
  const [auditRunning, setAuditRunning] = useState(false);

  // Run full audit
  const auditMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('systemAudit', {
        action: 'generate_repair_plan',
        payload: {}
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success('Audit complete - review repair plan');
      setAuditRunning(false);
    },
    onError: (error) => {
      toast.error(`Audit failed: ${error.message}`);
      setAuditRunning(false);
    }
  });

  // Ingest opportunities
  const ingestMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('opportunityIngestion', {
        action: 'ingest_opportunities',
        payload: {}
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Ingested ${data.total_ingested} opportunities`);
    },
    onError: (error) => {
      toast.error(`Ingestion failed: ${error.message}`);
    }
  });

  // Reconcile wallet
  const reconcileMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('walletManager', {
        action: 'reconcile_platform_payouts',
        payload: { platform: 'all' }
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Reconciliation: $${data.total_reconciled_amount.toFixed(2)} deposited`);
    },
    onError: (error) => {
      toast.error(`Reconciliation failed: ${error.message}`);
    }
  });

  const { data: auditResults, isLoading } = useQuery({
    queryKey: ['system_audit'],
    queryFn: async () => {
      if (!auditRunning) return null;
      const res = await base44.functions.invoke('systemAudit', {
        action: 'full_audit',
        payload: {}
      });
      return res.data;
    },
    refetchInterval: 5000,
    enabled: auditRunning
  });

  const handleRunAudit = () => {
    setAuditRunning(true);
    auditMutation.mutate();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Zap className="w-8 h-8 text-emerald-400" />
          System Audit & Repair Dashboard
        </h1>
        <p className="text-slate-400">Comprehensive platform health check and automated repair tools</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-emerald-950/20 border-emerald-900/30 p-4">
          <h3 className="font-semibold text-emerald-400 mb-3 flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Run System Audit
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Check backend functions, data pipelines, module connections, and wallet health
          </p>
          <Button
            onClick={handleRunAudit}
            disabled={auditMutation.isPending}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            {auditMutation.isPending ? 'Auditing...' : 'Start Audit'}
          </Button>
        </Card>

        <Card className="bg-blue-950/20 border-blue-900/30 p-4">
          <h3 className="font-semibold text-blue-400 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Ingest Opportunities
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Pull real jobs, grants, and contests from all platforms
          </p>
          <Button
            onClick={() => ingestMutation.mutate()}
            disabled={ingestMutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {ingestMutation.isPending ? 'Ingesting...' : 'Ingest Now'}
          </Button>
        </Card>

        <Card className="bg-purple-950/20 border-purple-900/30 p-4">
          <h3 className="font-semibold text-purple-400 mb-3 flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Reconcile Wallet
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Match completed tasks to wallet deposits
          </p>
          <Button
            onClick={() => reconcileMutation.mutate()}
            disabled={reconcileMutation.isPending}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {reconcileMutation.isPending ? 'Reconciling...' : 'Reconcile'}
          </Button>
        </Card>
      </div>

      {/* Audit Results */}
      {auditResults && (
        <div className="space-y-4">
          {/* Overall Health */}
          <Card className={`p-6 border ${
            auditResults.overall_health === 'HEALTHY' 
              ? 'bg-emerald-950/20 border-emerald-900/30' 
              : 'bg-red-950/20 border-red-900/30'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`text-lg font-semibold ${
                  auditResults.overall_health === 'HEALTHY' ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  System Health: {auditResults.overall_health}
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  Last audit: {new Date(auditResults.timestamp).toLocaleString()}
                </p>
              </div>
              {auditResults.overall_health === 'HEALTHY' ? (
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              ) : (
                <AlertCircle className="w-8 h-8 text-red-400" />
              )}
            </div>
          </Card>

          {/* Backend Functions Status */}
          <Card className="bg-slate-900/50 border-slate-800 p-4">
            <h3 className="font-semibold text-white mb-3">Backend Functions</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-lg p-3">
                <p className="text-xs text-slate-400">Working</p>
                <p className="text-2xl font-bold text-emerald-400">
                  {auditResults.backend_functions?.working || 0}
                </p>
              </div>
              <div className="bg-amber-950/20 border border-amber-900/30 rounded-lg p-3">
                <p className="text-xs text-slate-400">Broken</p>
                <p className="text-2xl font-bold text-amber-400">
                  {auditResults.backend_functions?.broken || 0}
                </p>
              </div>
              <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-3">
                <p className="text-xs text-slate-400">Missing</p>
                <p className="text-2xl font-bold text-red-400">
                  {auditResults.backend_functions?.missing || 0}
                </p>
              </div>
            </div>

            {auditResults.backend_functions?.critical_issues?.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold text-red-400">Critical Issues:</p>
                {auditResults.backend_functions.critical_issues.map((issue, idx) => (
                  <div key={idx} className="text-xs bg-red-950/30 border border-red-900/30 rounded px-2 py-1 text-red-300">
                    ❌ {issue.name || issue} - {issue.error}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Module Connections */}
          <Card className="bg-slate-900/50 border-slate-800 p-4">
            <h3 className="font-semibold text-white mb-3">Module Connections</h3>
            <div className="space-y-2">
              {auditResults.module_connections?.disconnected?.length === 0 ? (
                <div className="text-xs text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  All modules connected
                </div>
              ) : (
                <>
                  <p className="text-xs text-red-400">Disconnected:</p>
                  {auditResults.module_connections?.disconnected?.map((conn, idx) => (
                    <div key={idx} className="text-xs bg-red-950/30 border border-red-900/30 rounded px-2 py-1 text-red-300">
                      ❌ {conn.connection}
                      {conn.issues?.length > 0 && ` - ${conn.issues[0]}`}
                    </div>
                  ))}
                </>
              )}
            </div>
          </Card>

          {/* Data Pipelines */}
          <Card className="bg-slate-900/50 border-slate-800 p-4">
            <h3 className="font-semibold text-white mb-3">Data Pipelines</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-lg p-3">
                <p className="text-xs text-slate-400">Healthy</p>
                <p className="text-2xl font-bold text-emerald-400">
                  {auditResults.data_pipelines?.healthy_pipelines || 0}
                </p>
              </div>
              <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-3">
                <p className="text-xs text-slate-400">Issues</p>
                <p className="text-2xl font-bold text-red-400">
                  {auditResults.data_pipelines?.critical_issues?.length || 0}
                </p>
              </div>
            </div>
          </Card>

          {/* Wallet Health */}
          <Card className="bg-slate-900/50 border-slate-800 p-4">
            <h3 className="font-semibold text-white mb-3">Wallet System</h3>
            <div className="space-y-2">
              {auditResults.wallet_deposits?.critical_issues?.length === 0 ? (
                <div className="text-xs text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Wallet operational
                </div>
              ) : (
                auditResults.wallet_deposits?.critical_issues?.map((issue, idx) => (
                  <div key={idx} className="text-xs bg-amber-950/30 border border-amber-900/30 rounded px-2 py-1 text-amber-300">
                    ⚠ {issue.issue} - {issue.action}
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Placeholder Data */}
          {auditResults.placeholder_data?.instances?.length > 0 && (
            <Card className="bg-amber-950/20 border-amber-900/30 p-4">
              <h3 className="font-semibold text-amber-400 mb-3">
                Placeholder Data Found: {auditResults.placeholder_data.instances.length}
              </h3>
              <div className="text-xs space-y-1 max-h-48 overflow-y-auto">
                {auditResults.placeholder_data.instances.slice(0, 10).map((inst, idx) => (
                  <div key={idx} className="text-amber-300">
                    {inst.entity}: {inst.issue}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Status Grid when loading */}
      {auditRunning && isLoading && (
        <div className="text-center py-8">
          <div className="inline-block">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mb-2" />
            <p className="text-slate-400">Running comprehensive audit...</p>
          </div>
        </div>
      )}
    </div>
  );
}