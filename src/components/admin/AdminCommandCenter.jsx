import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Power, Zap, Radio, CheckCircle2, AlertCircle, Pause, Play } from 'lucide-react';

const ENGINES = [
  { id: 'autopilot', label: 'Autopilot Engine', icon: Zap, color: 'violet' },
  { id: 'discovery', label: 'Discovery Engine', icon: Radio, color: 'cyan' },
  { id: 'vipz', label: 'VIPZ Engine', icon: CheckCircle2, color: 'amber' },
  { id: 'ned', label: 'NED Engine', icon: Zap, color: 'emerald' }
];

export default function AdminCommandCenter() {
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  const [engineStates, setEngineStates] = useState({});

  const { data: commandState = {}, refetch, isLoading } = useQuery({
    queryKey: ['commandCenterStatus'],
    queryFn: async () => {
      const res = await base44.functions.invoke('commandCenterOrchestrator', {
        action: 'get_status'
      });
      return res.data?.state || {};
    },
    refetchInterval: 5000
  });

  useEffect(() => {
    if (commandState.engines) {
      setEngineStates(commandState.engines);
      const allStopped = Object.values(commandState.engines).every(e => !e.enabled);
      setIsEmergencyMode(allStopped);
    }
  }, [commandState.engines]);

  const handleEmergencyStop = async () => {
    const res = await base44.functions.invoke('commandCenterOrchestrator', {
      action: 'emergency_stop'
    });
    if (res.data?.success) {
      setIsEmergencyMode(true);
      refetch();
    }
  };

  const handleResumeAll = async () => {
    const res = await base44.functions.invoke('commandCenterOrchestrator', {
      action: 'resume_all'
    });
    if (res.data?.success) {
      setIsEmergencyMode(false);
      refetch();
    }
  };

  const handleToggleEngine = async (engine, enable) => {
    const res = await base44.functions.invoke('commandCenterOrchestrator', {
      action: 'toggle_engine',
      engine,
      command: enable ? 'enable' : 'disable'
    });
    if (res.data?.success) {
      refetch();
    }
  };

  const handleClearQueue = async () => {
    if (confirm('Clear all queued tasks? This cannot be undone.')) {
      const res = await base44.functions.invoke('commandCenterOrchestrator', {
        action: 'clear_queue'
      });
      if (res.data?.success) {
        refetch();
      }
    }
  };

  const kpis = commandState.kpis || {};

  return (
    <div className="space-y-6">
      {/* Emergency Stop Banner */}
      {isEmergencyMode && (
        <div className="bg-red-950 border border-red-700 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <div>
              <p className="font-bold text-red-400">EMERGENCY STOP ACTIVE</p>
              <p className="text-xs text-red-400/70">All engines are disabled</p>
            </div>
          </div>
          <Button size="sm" onClick={handleResumeAll} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
            <Play className="w-4 h-4" /> Resume All
          </Button>
        </div>
      )}

      {/* KPI Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500 mb-1">Tasks Queued</p>
            <p className="text-2xl font-bold text-cyan-400">{kpis.total_tasks_queued || 0}</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500 mb-1">Active Executions</p>
            <p className="text-2xl font-bold text-violet-400">{kpis.active_executions || 0}</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500 mb-1">Completion Rate</p>
            <p className="text-2xl font-bold text-emerald-400">{kpis.completion_rate || 0}%</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500 mb-1">Today's Revenue</p>
            <p className="text-2xl font-bold text-amber-400">${(kpis.revenue_today || 0).toFixed(0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Engine Controls */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Engine Controls</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ENGINES.map(({ id, label, icon: Icon, color }) => {
            const engine = engineStates[id];
            const isEnabled = engine?.enabled;
            const colorClass = {
              violet: 'border-violet-600 text-violet-400',
              cyan: 'border-cyan-600 text-cyan-400',
              amber: 'border-amber-600 text-amber-400',
              emerald: 'border-emerald-600 text-emerald-400'
            }[color];

            return (
              <Card key={id} className={`bg-slate-900/50 border-2 ${colorClass} border-opacity-30`}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5" />
                      <div>
                        <p className="text-sm font-medium text-white">{label}</p>
                        <p className={`text-xs ${isEnabled ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isEnabled ? 'Running' : 'Stopped'}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={isEnabled ? 'default' : 'outline'}
                      onClick={() => handleToggleEngine(id, !isEnabled)}
                      disabled={isEmergencyMode && isEnabled === false}
                      className="gap-1"
                    >
                      {isEnabled ? (
                        <>
                          <Pause className="w-3 h-3" /> Stop
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3" /> Start
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* System Actions */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">System Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Button
            onClick={handleEmergencyStop}
            disabled={isEmergencyMode}
            className="bg-red-600 hover:bg-red-700 gap-2"
          >
            <AlertTriangle className="w-4 h-4" /> Emergency Stop
          </Button>
          <Button
            onClick={handleClearQueue}
            variant="outline"
            className="gap-2"
          >
            <Zap className="w-4 h-4" /> Clear Queue
          </Button>
          <Button
            onClick={() => refetch()}
            variant="outline"
            className="gap-2"
            disabled={isLoading}
          >
            <Radio className="w-4 h-4" /> Refresh Status
          </Button>
        </div>
      </div>

      {/* Intervention Alerts */}
      {kpis.interventions_pending > 0 && (
        <Card className="bg-amber-950/30 border-amber-700">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              <p className="text-sm text-amber-400">
                <span className="font-bold">{kpis.interventions_pending}</span> pending user intervention{kpis.interventions_pending !== 1 ? 's' : ''}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}