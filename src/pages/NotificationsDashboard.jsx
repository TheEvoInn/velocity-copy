/**
 * NOTIFICATIONS DASHBOARD
 * Real-time alerts, system messages, and event tracking
 */
import React from 'react';
import { base44 } from '@/api/base44Client';
import { useActivityLogsV2 } from '@/lib/velocityHooks';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, Trash2, CheckCircle2 } from 'lucide-react';

export default function NotificationsDashboard() {
  const { logs } = useActivityLogsV2(100);

  const criticalLogs = logs.filter(l => l.severity === 'warning' || l.severity === 'critical');
  const infoLogs = logs.filter(l => l.severity === 'info');

  return (
    <div className="min-h-screen galaxy-bg p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-cyan-500/10 border border-cyan-500/30">
              <Bell className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="font-orbitron text-2xl font-bold text-white">Notifications</h1>
              <p className="text-xs text-slate-400">Activity & System Alerts</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Mark All Read
          </Button>
        </div>

        {/* Alerts */}
        {criticalLogs.length > 0 && (
          <Card className="glass-card p-4 mb-6 border-red-500/30">
            <h3 className="font-orbitron text-sm font-bold text-red-400 mb-3">⚠️ Alerts</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {criticalLogs.slice(0, 5).map(log => (
                <div key={log.id} className="p-3 bg-red-500/10 rounded-lg border border-red-500/20 flex justify-between items-start">
                  <div className="flex-1">
                    <div className="text-sm text-white">{log.message}</div>
                    <div className="text-xs text-slate-400 mt-1">{new Date(log.created_date).toLocaleString()}</div>
                  </div>
                  <Button variant="ghost" size="sm" className="ml-2">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Activity Log */}
        <Card className="glass-card p-4">
          <h3 className="font-orbitron text-sm font-bold text-white mb-3">📋 Activity Log</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {infoLogs.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-8">No recent activity</div>
            ) : (
              infoLogs.slice(0, 30).map(log => (
                <div key={log.id} className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/50 flex justify-between items-start hover:border-slate-700 transition">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{log.message}</div>
                    <div className="text-xs text-slate-500 mt-1">{new Date(log.created_date).toLocaleString()}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}