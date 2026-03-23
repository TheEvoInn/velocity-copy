import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, AlertTriangle, RefreshCw, Zap, BarChart3 } from 'lucide-react';

export default function AuditTrailDashboard() {
  const [lastCheckTime, setLastCheckTime] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  const { data: integrityReport = {}, isLoading: reportLoading, refetch: refetchReport } = useQuery({
    queryKey: ['dataIntegrityReport'],
    queryFn: async () => {
      const res = await base44.functions.invoke('dataIntegrityVerifier', {
        action: 'full_data_integrity_check'
      });
      return res.data;
    },
    refetchInterval: 3600000 // 1 hour
  });

  const { data: auditLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: async () => {
      const res = await base44.functions.invoke('dataIntegrityVerifier', {
        action: 'get_audit_logs',
        limit: 50
      });
      return res.data?.logs || [];
    },
    refetchInterval: 300000 // 5 min
  });

  const handleRunCheck = async () => {
    setIsRunning(true);
    try {
      await refetchReport();
      setLastCheckTime(new Date());
    } finally {
      setIsRunning(false);
    }
  };

  const getSeverityIcon = (severity) => {
    switch(severity) {
      case 'critical': return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'high': return <AlertTriangle className="w-4 h-4 text-orange-400" />;
      case 'medium': return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      default: return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    }
  };

  const getSeverityColor = (severity) => {
    switch(severity) {
      case 'critical': return 'bg-red-950 border-red-700';
      case 'high': return 'bg-orange-950 border-orange-700';
      case 'medium': return 'bg-amber-950 border-amber-700';
      default: return 'bg-emerald-950 border-emerald-700';
    }
  };

  const rec = integrityReport.reconciliation || {};
  const hasIssues = integrityReport.overall_status === 'issues_detected';

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <div className={`rounded-lg p-4 border-2 ${hasIssues ? 'border-red-700 bg-red-950/30' : 'border-emerald-700 bg-emerald-950/30'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {hasIssues ? (
              <AlertCircle className="w-6 h-6 text-red-400" />
            ) : (
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            )}
            <div>
              <p className="font-bold uppercase">Data Integrity Status</p>
              <p className="text-xs opacity-75">{lastCheckTime ? `Last check: ${lastCheckTime.toLocaleTimeString()}` : 'Never checked'}</p>
            </div>
          </div>
          <Button
            onClick={handleRunCheck}
            disabled={isRunning}
            className="gap-1"
          >
            <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
            Run Check
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500 mb-1">Issues Found</p>
            <p className={`text-2xl font-bold ${rec.issues > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {rec.issues || 0}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500 mb-1">Duplicates</p>
            <p className="text-2xl font-bold text-amber-400">{rec.duplicates || 0}</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500 mb-1">Balance Variance</p>
            <p className={`text-2xl font-bold ${Math.abs(rec.balance_variance || 0) > 0.01 ? 'text-red-400' : 'text-emerald-400'}`}>
              ${(rec.balance_variance || 0).toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500 mb-1">Incomplete Data</p>
            <p className={`text-2xl font-bold ${rec.incomplete > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {rec.incomplete || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Issues List */}
      {rec.issues > 0 && (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" /> Detected Issues
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {rec.balance_variance && Math.abs(rec.balance_variance) > 0.01 && (
              <p className="flex gap-2 text-red-400">
                <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                Balance mismatch: ${Math.abs(rec.balance_variance).toFixed(2)}
              </p>
            )}
            {rec.duplicates > 0 && (
              <p className="flex gap-2 text-amber-400">
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                {rec.duplicates} duplicate transaction{rec.duplicates !== 1 ? 's' : ''} detected
              </p>
            )}
            {rec.incomplete > 0 && (
              <p className="flex gap-2 text-amber-400">
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                {rec.incomplete} transaction{rec.incomplete !== 1 ? 's' : ''} missing required fields
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Audit Log */}
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Audit Log History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-500">No audit logs yet</p>
            ) : (
              auditLogs.map((log, idx) => (
                <div key={idx} className={`p-2 rounded border text-xs ${getSeverityColor(log.severity)}`}>
                  <div className="flex items-start gap-2">
                    {getSeverityIcon(log.severity)}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold capitalize">{log.action_type.replace(/_/g, ' ')}</p>
                      <p className="text-xs opacity-75">{log.entity_type}</p>
                      {log.details && (
                        <p className="text-xs mt-1 opacity-70">
                          {log.action_type === 'reconciliation' && 
                            `${log.details.total_transactions} trans, ${log.details.duplicates_found} dups, balance var: $${log.details.balance_variance?.toFixed(2) || 0}`}
                          {log.action_type === 'balance_correction' && 
                            `Adjusted: $${log.details.variance?.toFixed(2) || 0}`}
                          {log.action_type === 'anomaly_detection' && 
                            `${log.details.anomalies_found} anomalies detected`}
                        </p>
                      )}
                      <p className="text-xs opacity-50 mt-1">
                        {new Date(log.created_date).toLocaleString()}
                      </p>
                    </div>
                    <Badge className={
                      log.status === 'clean' ? 'bg-emerald-600' :
                      log.status === 'resolved' ? 'bg-blue-600' :
                      'bg-red-600'
                    }>
                      {log.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}