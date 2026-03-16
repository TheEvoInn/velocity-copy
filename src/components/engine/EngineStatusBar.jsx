import React from 'react';
import { Zap, AlertTriangle, Power, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';

function fmt(n) { return (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function EngineStatusBar({ engineData, policyData, onRefresh }) {
  const qc = useQueryClient();
  const [stopping, setStopping] = React.useState(false);

  const isEnabled = engineData?.enabled && !engineData?.emergency_stop;
  const isEmergency = engineData?.emergency_stop;

  const handleEmergencyStop = async () => {
    setStopping(true);
    await base44.functions.invoke('withdrawalEngine', { action: 'emergency_stop' });
    await onRefresh?.();
    setStopping(false);
  };

  const handleToggleEngine = async () => {
    await base44.functions.invoke('withdrawalEngine', {
      action: 'update_policy',
      policy_data: {
        engine_enabled: !engineData?.enabled,
        emergency_stop: false
      }
    });
    await onRefresh?.();
  };

  return (
    <div className={`rounded-2xl border p-4 ${
      isEmergency ? 'bg-rose-950/40 border-rose-500/40' :
      isEnabled ? 'bg-emerald-950/20 border-emerald-500/20' :
      'bg-slate-900/80 border-slate-800'
    }`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Status indicator */}
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isEmergency ? 'bg-rose-500/20' : isEnabled ? 'bg-emerald-500/20' : 'bg-slate-800'
          }`}>
            {isEmergency
              ? <AlertTriangle className="w-5 h-5 text-rose-400 animate-pulse" />
              : <Zap className={`w-5 h-5 ${isEnabled ? 'text-emerald-400' : 'text-slate-600'}`} />
            }
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">
                {isEmergency ? 'EMERGENCY STOP' : isEnabled ? 'Engine Active' : 'Engine Paused'}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                isEmergency ? 'bg-rose-500/20 text-rose-400' :
                isEnabled ? 'bg-emerald-500/20 text-emerald-400' :
                'bg-slate-700 text-slate-500'
              }`}>
                {isEmergency ? 'STOPPED' : isEnabled ? 'RUNNING' : 'PAUSED'}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {engineData?.last_run_at
                ? `Last run: ${new Date(engineData.last_run_at).toLocaleTimeString()}`
                : 'Never run'
              }
              {engineData?.last_action && <span className="ml-2 text-slate-600">· {engineData.last_action}</span>}
            </div>
          </div>
        </div>

        {/* Lifetime stats */}
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-0.5">
              <TrendingDown className="w-3 h-3 text-blue-400" /> Auto-Withdrawn
            </div>
            <div className="text-sm font-bold text-blue-400">${fmt(engineData?.total_auto_withdrawn)}</div>
          </div>
          <div className="text-center">
            <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-0.5">
              <TrendingUp className="w-3 h-3 text-violet-400" /> Auto-Reinvested
            </div>
            <div className="text-sm font-bold text-violet-400">${fmt(engineData?.total_auto_reinvested)}</div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleToggleEngine}
            variant="outline"
            className={`text-xs h-8 gap-1.5 border-slate-700 ${isEnabled ? 'text-amber-400 hover:text-amber-300' : 'text-emerald-400 hover:text-emerald-300'}`}
          >
            <Power className="w-3.5 h-3.5" />
            {isEnabled ? 'Pause Engine' : 'Start Engine'}
          </Button>
          {(isEnabled || isEmergency) && (
            <Button
              size="sm"
              onClick={handleEmergencyStop}
              disabled={stopping || isEmergency}
              className="text-xs h-8 bg-rose-600 hover:bg-rose-500 text-white gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {isEmergency ? 'Stopped' : 'Emergency Stop'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}