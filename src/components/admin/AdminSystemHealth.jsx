import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, AlertTriangle, Zap, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminSystemHealth() {
  const [lastCheck, setLastCheck] = useState(null);

  // Fetch health status
  const { data: healthReport = {}, refetch, isLoading } = useQuery({
    queryKey: ['systemHealth'],
    queryFn: async () => {
      const res = await base44.functions.invoke('systemHealthMonitor', {
        action: 'full_health_check'
      });
      setLastCheck(new Date());
      return res.data?.report || {};
    },
    refetchInterval: 300000 // 5 minutes
  });

  // Manual health check mutation
  const checkHealthMutation = useMutation({
    mutationFn: () => refetch(),
    onSuccess: () => {
      toast.success('Health check completed');
    },
    onError: (err) => {
      toast.error(`Health check failed: ${err.message}`);
    }
  });

  const {
    overall_status = 'healthy',
    module_health = {},
    data_integrity = {},
    task_health = {},
    issues_found = [],
    auto_repairs = [],
    checks_performed = 0
  } = healthReport;

  const criticalIssues = issues_found.filter(i => i.severity === 'critical').length;
  const warnings = issues_found.filter(i => i.severity === 'warning').length;

  const statusConfig = {
    healthy: { color: 'text-emerald-400', bg: 'bg-emerald-950/30', icon: CheckCircle2 },
    warning: { color: 'text-amber-400', bg: 'bg-amber-950/30', icon: AlertTriangle },
    critical: { color: 'text-red-400', bg: 'bg-red-950/30', icon: AlertCircle }
  };

  const Status = statusConfig[overall_status] || statusConfig.healthy;

  return (
    <div className="space-y-6">
      {/* Overall Status Card */}
      <Card className={`${Status.bg} border-slate-700`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Status.icon className={`w-8 h-8 ${Status.color}`} />
              <div>
                <p className="text-sm text-slate-400">System Status</p>
                <p className={`text-2xl font-bold ${Status.color} uppercase`}>
                  {overall_status}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-400 mb-2">Last check</p>
              <p className="text-xs text-slate-500">
                {lastCheck ? lastCheck.toLocaleTimeString() : 'Never'}
              </p>
              <Button
                size="sm"
                onClick={() => checkHealthMutation.mutate()}
                disabled={checkHealthMutation.isPending || isLoading}
                className="mt-2 gap-1 text-xs"
              >
                <RefreshCw className="w-3 h-3" />
                Check Now
              </Button>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-3 mt-6 pt-4 border-t border-slate-700">
            <div className="text-center">
              <p className="text-xs text-slate-500">Checks</p>
              <p className="text-lg font-bold text-slate-200">{checks_performed}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">Critical</p>
              <p className={`text-lg font-bold ${criticalIssues > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {criticalIssues}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">Warnings</p>
              <p className={`text-lg font-bold ${warnings > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                {warnings}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">Auto-Repairs</p>
              <p className="text-lg font-bold text-violet-400">{auto_repairs.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Module Health */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Module Connectivity</h3>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(module_health).map(([module, status]) => {
            const isHealthy = status === 'healthy';
            return (
              <Card key={module} className="bg-slate-900/50 border-slate-700">
                <CardContent className="pt-4 flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-200 capitalize">{module}</p>
                  <Badge className={isHealthy ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}>
                    {status}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Task Health */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Task Health Metrics</h3>
        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-6 space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-slate-400">Stale Tasks (>6h executing)</p>
              <p className="font-bold text-slate-200">{task_health.stale_tasks || 0}</p>
            </div>
            <div className="flex justify-between items-center border-t border-slate-700 pt-3">
              <p className="text-sm text-slate-400">Failed Tasks Missing Logs</p>
              <p className="font-bold text-slate-200">{task_health.failed_tasks_missing_logs || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Integrity */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Data Integrity</h3>
        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-6 space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-slate-400">Opportunities Missing Transactions</p>
              <p className="font-bold text-slate-200">{data_integrity.opportunities_missing_transactions || 0}</p>
            </div>
            <div className="flex justify-between items-center border-t border-slate-700 pt-3">
              <p className="text-sm text-slate-400">Wallet Inconsistencies</p>
              <p className="font-bold text-slate-200">{data_integrity.wallet_inconsistencies || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Issues & Auto-Repairs */}
      {issues_found.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Issues Found ({issues_found.length})</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {issues_found.map((issue, idx) => {
              const severity = issue.severity === 'critical' ? 'text-red-400' : 'text-amber-400';
              return (
                <Card key={idx} className="bg-slate-900/30 border-slate-700">
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-start gap-3">
                      <div className={`text-lg font-bold ${severity}`}>⚠️</div>
                      <div>
                        <p className={`text-sm font-medium ${severity}`}>
                          {issue.type || issue.issue}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">{issue.issue || issue.issue}</p>
                        {issue.task_id && (
                          <p className="text-xs text-slate-600 mt-1">Task: {issue.task_id}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Auto-Repairs Applied */}
      {auto_repairs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Auto-Repairs Applied ({auto_repairs.length})</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {auto_repairs.map((repair, idx) => (
              <Card key={idx} className="bg-emerald-950/20 border-emerald-700/30">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-emerald-400">{repair.type}</p>
                      <p className="text-xs text-slate-500 mt-1">{repair.action}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {issues_found.length === 0 && auto_repairs.length === 0 && (
        <Card className="bg-emerald-950/20 border-emerald-700/30">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
            <p className="text-sm text-emerald-400 font-medium">All systems healthy</p>
            <p className="text-xs text-slate-500 mt-1">No issues detected in last check</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}