import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, AlertTriangle, Key, RefreshCw, Lock, Zap } from 'lucide-react';
import { toast } from 'sonner';

const HEALTH_COLORS = {
  healthy: { color: 'text-emerald-400', bg: 'bg-emerald-950/30', border: 'border-emerald-700/30', icon: CheckCircle2 },
  warning: { color: 'text-amber-400', bg: 'bg-amber-950/30', border: 'border-amber-700/30', icon: AlertTriangle },
  critical: { color: 'text-red-400', bg: 'bg-red-950/30', border: 'border-red-700/30', icon: AlertCircle }
};

export default function VaultHealthIndicator() {
  const [expandedPlatform, setExpandedPlatform] = useState(null);

  // Fetch vault health report
  const { data: healthReport = {}, refetch, isLoading } = useQuery({
    queryKey: ['vaultHealth'],
    queryFn: async () => {
      const res = await base44.functions.invoke('vaultHealthMonitor', {
        action: 'vault_health_report'
      });
      return res.data?.report || {};
    },
    refetchInterval: 600000 // 10 minutes
  });

  // Trigger credential rotation
  const rotationMutation = useMutation({
    mutationFn: async () => {
      return base44.functions.invoke('credentialAutoRotationEngine', {
        action: 'check_and_rotate_all'
      });
    },
    onSuccess: (data) => {
      toast.success(`✅ Rotation complete: ${data.data?.rotated || 0} rotated, ${data.data?.archived || 0} archived`);
      refetch();
    },
    onError: (err) => {
      toast.error(`Rotation failed: ${err.message}`);
    }
  });

  const {
    overall_health = 'healthy',
    health_score = 100,
    total_credentials = 0,
    active_credentials = 0,
    expiring_soon = 0,
    expired = 0,
    rotation_overdue = 0,
    never_rotated = 0,
    archived_credentials = 0,
    by_platform = {},
    credentials_needing_renewal = [],
    issues = [],
    recommendations = []
  } = healthReport;

  const healthConfig = HEALTH_COLORS[overall_health] || HEALTH_COLORS.healthy;
  const HealthIcon = healthConfig.icon;

  return (
    <div className="space-y-4">
      {/* Health Status Card */}
      <Card className={`${healthConfig.bg} border ${healthConfig.border}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-white">
              <Lock className="w-5 h-5 text-blue-400" />
              Credential Vault Health
            </CardTitle>
            <Button
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
              variant="outline"
              className="gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Overall Status */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50">
            <div className="flex items-center gap-3">
              <HealthIcon className={`w-6 h-6 ${healthConfig.color}`} />
              <div>
                <p className="text-sm text-slate-400">Vault Status</p>
                <p className={`text-lg font-bold uppercase ${healthConfig.color}`}>
                  {overall_health}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">{health_score}</div>
              <p className="text-xs text-slate-500">Health Score</p>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-cyan-400">{active_credentials}</p>
              <p className="text-xs text-slate-500 mt-1">Active Credentials</p>
            </div>
            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-violet-400">{archived_credentials}</p>
              <p className="text-xs text-slate-500 mt-1">Archived</p>
            </div>
            <div className={`rounded-lg p-3 text-center ${expired > 0 ? 'bg-red-950/30 border border-red-700/30' : 'bg-slate-900/50 border border-slate-700'}`}>
              <p className={`text-2xl font-bold ${expired > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {expired}
              </p>
              <p className="text-xs text-slate-500 mt-1">Expired</p>
            </div>
            <div className={`rounded-lg p-3 text-center ${expiring_soon > 0 ? 'bg-amber-950/30 border border-amber-700/30' : 'bg-slate-900/50 border border-slate-700'}`}>
              <p className={`text-2xl font-bold ${expiring_soon > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {expiring_soon}
              </p>
              <p className="text-xs text-slate-500 mt-1">Expiring Soon (&lt;30d)</p>
            </div>
          </div>

          {/* Rotation Status */}
          <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3 space-y-2">
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-blue-400" />
              Rotation Status
            </p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Never Rotated</span>
                <span className={`font-bold ${never_rotated > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                  {never_rotated}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-700 pt-1">
                <span className="text-slate-400">Rotation Overdue (&gt;6m)</span>
                <span className={`font-bold ${rotation_overdue > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                  {rotation_overdue}
                </span>
              </div>
            </div>
          </div>

          {/* Auto-Rotation Trigger */}
          <Button
            onClick={() => rotationMutation.mutate()}
            disabled={rotationMutation.isPending}
            className="w-full gap-2 bg-blue-600 hover:bg-blue-500"
          >
            <Zap className="w-4 h-4" />
            {rotationMutation.isPending ? 'Rotating...' : 'Trigger Auto-Rotation'}
          </Button>
        </CardContent>
      </Card>

      {/* Credentials Needing Renewal */}
      {credentials_needing_renewal.length > 0 && (
        <Card className="bg-amber-950/20 border border-amber-700/30">
          <CardHeader>
            <CardTitle className="text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {credentials_needing_renewal.length} Credential(s) Need Renewal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {credentials_needing_renewal.map((cred, idx) => (
              <div key={idx} className="bg-slate-900/50 border border-amber-700/20 rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{cred.platform}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{cred.account_label}</p>
                    {cred.expires_at && (
                      <p className="text-xs text-amber-300 mt-1">
                        Expires: {new Date(cred.expires_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-amber-400 border-amber-600">
                    Action
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Issues Found */}
      {issues.length > 0 && (
        <Card className="bg-red-950/20 border border-red-700/30">
          <CardHeader>
            <CardTitle className="text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {issues.length} Issue(s) Detected
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-64 overflow-y-auto">
            {issues.map((issue, idx) => (
              <div key={idx} className="bg-slate-900/50 border border-red-700/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Badge className={issue.severity === 'critical' ? 'bg-red-600' : 'bg-amber-600'}>
                    {issue.severity}
                  </Badge>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white capitalize">
                      {issue.type.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {issue.platform} - {issue.account_label}
                    </p>
                    {issue.days_until !== undefined && (
                      <p className="text-xs text-red-300 mt-1">
                        {issue.days_until} days until expiration
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card className="bg-cyan-950/20 border border-cyan-700/30">
          <CardHeader>
            <CardTitle className="text-cyan-400">Recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recommendations.map((rec, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2 bg-slate-900/50 rounded-lg">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 flex-shrink-0" />
                <p className="text-xs text-cyan-300">{rec.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Platforms Breakdown */}
      <Card className="bg-slate-900/50 border border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-sm">Credentials by Platform</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(by_platform).map(([platform, stats]) => (
            <div key={platform}>
              <button
                onClick={() => setExpandedPlatform(expandedPlatform === platform ? null : platform)}
                className="w-full flex items-center justify-between p-2 hover:bg-slate-800/50 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium text-white capitalize">{platform}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">
                    {stats.active}/{stats.total} active
                  </span>
                  <span className={`text-xs font-bold ${
                    stats.expired > 0 ? 'text-red-400' :
                    stats.expiring_soon > 0 ? 'text-amber-400' :
                    'text-emerald-400'
                  }`}>
                    {stats.expired > 0 && `${stats.expired} expired`}
                    {stats.expiring_soon > 0 && `${stats.expiring_soon} expiring`}
                    {stats.overdue_rotation > 0 && `${stats.overdue_rotation} overdue`}
                  </span>
                </div>
              </button>

              {expandedPlatform === platform && (
                <div className="ml-6 mt-2 space-y-1 text-xs border-l border-slate-700 pl-3">
                  <div className="flex justify-between text-slate-400">
                    <span>Total:</span>
                    <span className="text-white">{stats.total}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Active:</span>
                    <span className="text-cyan-400">{stats.active}</span>
                  </div>
                  {stats.never_rotated > 0 && (
                    <div className="flex justify-between text-amber-400">
                      <span>Never Rotated:</span>
                      <span>{stats.never_rotated}</span>
                    </div>
                  )}
                  {stats.overdue_rotation > 0 && (
                    <div className="flex justify-between text-amber-400">
                      <span>Overdue:</span>
                      <span>{stats.overdue_rotation}</span>
                    </div>
                  )}
                  {stats.expired > 0 && (
                    <div className="flex justify-between text-red-400">
                      <span>Expired:</span>
                      <span>{stats.expired}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Empty State */}
      {Object.keys(by_platform).length === 0 && (
        <Card className="bg-emerald-950/20 border border-emerald-700/30">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
            <p className="text-sm text-emerald-400 font-medium">No credentials in vault</p>
            <p className="text-xs text-slate-500 mt-1">Credentials will appear here once added</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}