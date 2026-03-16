import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Clock, Zap, TrendingUp, CheckCircle } from 'lucide-react';

export default function RealTimeAlertSystem() {
  const [alerts, setAlerts] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const queryClient = useQueryClient();

  // Generate smart alerts
  const generateAlertsMutation = useMutation({
    mutationFn: async () => {
      setIsGenerating(true);
      const res = await base44.functions.invoke('advancedScanningEngine', {
        action: 'generate_smart_alerts',
        payload: {}
      });
      return res.data;
    },
    onSuccess: (data) => {
      setAlerts(data);
      setIsGenerating(false);
    },
    onError: () => {
      setIsGenerating(false);
    }
  });

  // Auto-generate alerts on mount
  useEffect(() => {
    generateAlertsMutation.mutate();
    const interval = setInterval(() => {
      generateAlertsMutation.mutate();
    }, 5 * 60 * 1000); // Refresh every 5 minutes

    return () => clearInterval(interval);
  }, []);

  if (!alerts) {
    return (
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            Real-Time Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-500">Generating alerts...</p>
        </CardContent>
      </Card>
    );
  }

  const totalAlerts = alerts.total_alerts || 0;

  return (
    <div className="space-y-3">
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
          {alerts.immediate_action && alerts.immediate_action.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-red-400 flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3" />
                🚨 Immediate Action ({alerts.immediate_action.length})
              </div>
              {alerts.immediate_action.map((alert) => (
                <div key={alert.id} className="rounded-lg bg-red-950/30 border border-red-500/30 p-2.5 text-xs">
                  <div className="font-medium text-red-300 truncate">{alert.title}</div>
                  <div className="text-red-400 text-[10px] mt-1">
                    ⏱️ {alert.minutes_remaining} minutes remaining • ${alert.profit_estimate}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Expiring Soon Alerts */}
          {alerts.expiring_soon && alerts.expiring_soon.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                ⏰ Expiring Soon ({alerts.expiring_soon.length})
              </div>
              {alerts.expiring_soon.slice(0, 3).map((alert) => (
                <div key={alert.id} className="rounded-lg bg-amber-950/30 border border-amber-500/30 p-2.5 text-xs">
                  <div className="font-medium text-amber-300 truncate">{alert.title}</div>
                  <div className="text-amber-400 text-[10px] mt-1">
                    ⏰ {alert.hours_remaining}h remaining • ${alert.profit_estimate}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* High Value Alerts */}
          {alerts.high_value_alerts && alerts.high_value_alerts.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3" />
                💰 High Value ({alerts.high_value_alerts.length})
              </div>
              {alerts.high_value_alerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className="rounded-lg bg-emerald-950/30 border border-emerald-500/30 p-2.5 text-xs">
                  <div className="font-medium text-emerald-300 truncate">{alert.title}</div>
                  <div className="text-emerald-400 text-[10px] mt-1">
                    💰 ${alert.profit_high} • Score: {alert.score}/100 • {alert.platform}
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