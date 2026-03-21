import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Clock, Zap, TrendingUp, CheckCircle, RefreshCw } from 'lucide-react';

export default function RealTimeAlertSystem() {
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Real-time query for alerts with auto-refresh
  const { data: alertsData = {}, isLoading, error, refetch } = useQuery({
    queryKey: ['realtimeAlerts'],
    queryFn: async () => {
      const res = await base44.functions.invoke('advancedScanningEngine', {
        action: 'generate_smart_alerts',
        payload: {}
      });
      return res.data || {};
    },
    refetchInterval: autoRefresh ? 5 * 60 * 1000 : false, // 5 min auto-refresh if enabled
    staleTime: 1000 * 60 * 4, // 4 min
    retry: 2,
    enabled: true
  });

  // Subscribe to real-time updates via base44
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refetch();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refetch]);

  const alerts = alertsData || {};
  const totalAlerts = typeof alerts.total_alerts === 'number' ? alerts.total_alerts : 0;

  if (isLoading) {
    return (
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 animate-pulse" />
            Real-Time Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Loading alerts...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    const errorMsg = error?.message || 'Unable to fetch alerts. Please try again.';
    return (
      <Card className="bg-slate-900/50 border-slate-700 rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            Alert System Error
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs text-red-400 font-medium">Failed to load alerts</p>
            <p className="text-xs text-slate-500 mt-1">{errorMsg}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()} className="text-xs w-full">
            <RefreshCw className="w-3 h-3 mr-1" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const immediateAction = Array.isArray(alerts?.immediate_action) ? alerts.immediate_action : [];
  const expiringSoon = Array.isArray(alerts?.expiring_soon) ? alerts.expiring_soon : [];
  const highValue = Array.isArray(alerts?.high_value_alerts) ? alerts.high_value_alerts : [];

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={autoRefresh ? 'default' : 'outline'}
          onClick={() => setAutoRefresh(!autoRefresh)}
          className="text-xs"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          {autoRefresh ? 'Auto: ON' : 'Auto: OFF'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          className="text-xs"
        >
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>

      {/* Alert Summary */}
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              Real-Time Alert System
            </CardTitle>
            <div className="text-xs text-slate-500">
              {totalAlerts} active {totalAlerts === 1 ? 'alert' : 'alerts'}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Immediate Action Alerts */}
          {immediateAction.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-red-400 flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3" />
                🚨 Immediate Action ({immediateAction.length})
              </div>
              {immediateAction.map((alert) => (
                <div key={alert?.id || Math.random()} className="rounded-lg bg-red-950/30 border border-red-500/30 p-2.5 text-xs">
                  <div className="font-medium text-red-300 truncate">{alert?.title || 'Untitled'}</div>
                  <div className="text-red-400 text-[10px] mt-1">
                    ⏱️ {typeof alert?.minutes_remaining === 'number' ? alert.minutes_remaining : '—'} min • ${typeof alert?.profit_estimate === 'number' ? alert.profit_estimate : '0'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Expiring Soon Alerts */}
          {expiringSoon.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                ⏰ Expiring Soon ({expiringSoon.length})
              </div>
              {expiringSoon.slice(0, 3).map((alert) => (
                <div key={alert?.id || Math.random()} className="rounded-lg bg-amber-950/30 border border-amber-500/30 p-2.5 text-xs">
                  <div className="font-medium text-amber-300 truncate">{alert?.title || 'Untitled'}</div>
                  <div className="text-amber-400 text-[10px] mt-1">
                    ⏰ {typeof alert?.hours_remaining === 'number' ? alert.hours_remaining : '—'}h • ${typeof alert?.profit_estimate === 'number' ? alert.profit_estimate : '0'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* High Value Alerts */}
          {highValue.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3" />
                💰 High Value ({highValue.length})
              </div>
              {highValue.slice(0, 3).map((alert) => (
                <div key={alert?.id || Math.random()} className="rounded-lg bg-emerald-950/30 border border-emerald-500/30 p-2.5 text-xs">
                  <div className="font-medium text-emerald-300 truncate">{alert?.title || 'Untitled'}</div>
                  <div className="text-emerald-400 text-[10px] mt-1">
                    💰 ${typeof alert?.profit_high === 'number' ? alert.profit_high : '0'} • Score: {typeof alert?.score === 'number' ? alert.score : '—'}/100 • {alert?.platform || 'unknown'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalAlerts === 0 && (
            <div className="text-center py-4">
              <CheckCircle className="w-8 h-8 text-emerald-500/30 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No urgent alerts at this time</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}