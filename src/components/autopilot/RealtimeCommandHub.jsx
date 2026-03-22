/**
 * REAL-TIME COMMAND HUB
 * Central brain for autonomous operations
 * - Live task visualization
 * - Emergency kill-switch
 * - Real-time earnings
 * - Identity status
 * - Execution logs
 * - Two-way sync with all engines
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle, Power, Zap, Activity, TrendingUp, Clock,
  CheckCircle2, AlertTriangle, RotateCw, Pause
} from 'lucide-react';
import { toast } from 'sonner';

export default function RealtimeCommandHub() {
  const [emergencyStop, setEmergencyStop] = useState(false);
  const [selectedIdentity, setSelectedIdentity] = useState(null);
  const [logFilter, setLogFilter] = useState('all');

  // Real-time task status from autopilot
  const { data: taskStatus = {} } = useQuery({
    queryKey: ['realtimeTaskStatus'],
    queryFn: async () => {
      const res = await base44.functions.invoke('autopilotOrchestrator', {
        action: 'full_autopilot_cycle'
      });
      return res?.data?.cycle || {};
    },
    refetchInterval: 5000,
  });

  // Real-time identities
  const { data: identities = [] } = useQuery({
    queryKey: ['realtimeIdentities'],
    queryFn: async () => {
      const res = await base44.entities.AIIdentity.list('-last_used_at', 10);
      return Array.isArray(res) ? res : [];
    },
    refetchInterval: 8000,
  });

  // Real-time execution log
  const { data: executionLog = [] } = useQuery({
    queryKey: ['realtimeExecutionLog'],
    queryFn: async () => {
      const res = await base44.entities.AIWorkLog.list('-created_date', 50);
      return Array.isArray(res) ? res : [];
    },
    refetchInterval: 3000,
  });

  // Real-time earnings
  const { data: todayEarnings = 0 } = useQuery({
    queryKey: ['realtimeTodayEarnings'],
    queryFn: async () => {
      const today = new Date().toDateString();
      const txs = await base44.entities.WalletTransaction.list('-created_date', 100);
      return (Array.isArray(txs) ? txs : [])
        .filter(t => t.type === 'earning' && new Date(t.created_date).toDateString() === today)
        .reduce((sum, t) => sum + (t.amount || 0), 0);
    },
    refetchInterval: 4000,
  });

  // Emergency stop all operations
  const handleEmergencyStop = async () => {
    if (!window.confirm('EMERGENCY STOP will halt all Autopilot operations. Continue?')) return;

    setEmergencyStop(true);
    try {
      // Stop all identities
      await base44.functions.invoke('autopilotOrchestrator', {
        action: 'emergency_stop'
      });

      // Log event
      await base44.entities.ActivityLog.create({
        action_type: 'alert',
        message: '🛑 EMERGENCY STOP triggered - All Autopilot operations halted',
        severity: 'critical',
      }).catch(() => null);

      toast.error('🛑 EMERGENCY STOP activated');
    } catch (error) {
      toast.error(`Failed to stop: ${error.message}`);
      setEmergencyStop(false);
    }
  };

  const filteredLog = logFilter === 'all'
    ? executionLog
    : executionLog.filter(l => {
      if (logFilter === 'errors') return l.status === 'failed';
      if (logFilter === 'success') return l.status === 'sent';
      return l.log_type === logFilter;
    });

  // Active tasks count
  const activeTasks = executionLog.filter(l => ['running', 'analyzing', 'executing'].includes(l.status)).length;
  const failedTasks = executionLog.filter(l => l.status === 'failed').length;
  const completedTasks = executionLog.filter(l => l.status === 'sent').length;

  return (
    <div className="space-y-4">
      {/* EMERGENCY KILL-SWITCH */}
      <div className={`p-4 rounded-lg border-2 transition-all ${
        emergencyStop
          ? 'bg-red-950/20 border-red-500'
          : 'bg-slate-900/50 border-slate-800'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Power className={`w-5 h-5 ${emergencyStop ? 'text-red-500 animate-pulse' : 'text-slate-400'}`} />
            <div>
              <h3 className="font-orbitron text-sm text-white">Global Kill-Switch</h3>
              <p className="text-xs text-slate-500">Halt all operations system-wide</p>
            </div>
          </div>
          <button
            onClick={handleEmergencyStop}
            disabled={emergencyStop}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
              emergencyStop
                ? 'bg-red-600/40 text-red-300 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-500 text-white'
            }`}
          >
            {emergencyStop ? '🛑 STOPPED' : '🛑 STOP ALL'}
          </button>
        </div>
      </div>

      {/* REAL-TIME METRICS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-slate-500">Active</span>
          </div>
          <div className="text-2xl font-bold text-cyan-400">{activeTasks}</div>
        </div>

        <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-slate-500">Completed</span>
          </div>
          <div className="text-2xl font-bold text-emerald-400">{completedTasks}</div>
        </div>

        <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-xs text-slate-500">Failed</span>
          </div>
          <div className="text-2xl font-bold text-red-400">{failedTasks}</div>
        </div>

        <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-slate-500">Today</span>
          </div>
          <div className="text-2xl font-bold text-amber-400">${todayEarnings.toFixed(2)}</div>
        </div>
      </div>

      {/* IDENTITY STATUS PANEL */}
      <div className="glass-card rounded-xl p-4">
        <h3 className="font-orbitron text-sm font-bold text-cyan-400 mb-3">IDENTITY STATUS</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {identities.length === 0 ? (
            <p className="text-xs text-slate-500 col-span-2">No identities created yet</p>
          ) : (
            identities.map(identity => {
              const identityTasks = executionLog.filter(l => l.metadata?.identity_id === identity.id);
              const identityEarnings = (Array.isArray(executionLog) ? executionLog : [])
                .filter(l => l.metadata?.identity_id === identity.id && l.status === 'sent')
                .reduce((sum, l) => sum + (l.revenue_associated || 0), 0);

              return (
                <div
                  key={identity.id}
                  onClick={() => setSelectedIdentity(selectedIdentity === identity.id ? null : identity.id)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer ${
                    selectedIdentity === identity.id
                      ? 'bg-slate-800 border-cyan-500'
                      : 'bg-slate-900/50 border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-bold text-sm text-white">{identity.name}</h4>
                      <p className="text-xs text-slate-400">{identity.role_label || 'AI Agent'}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      identity.is_active
                        ? 'bg-emerald-600/20 text-emerald-400'
                        : 'bg-slate-700/20 text-slate-500'
                    }`}>
                      {identity.is_active ? '🟢 Active' : '⚫ Inactive'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 space-y-1 mb-2">
                    <p>Tasks: <span className="text-cyan-400 font-bold">{identityTasks.length}</span></p>
                    <p>Today: <span className="text-amber-400 font-bold">${identityEarnings.toFixed(2)}</span></p>
                    <p>KYC: <span className={identity.kyc_verified_data?.kyc_tier === 'enhanced' ? 'text-emerald-400' : 'text-amber-500'}>
                      {identity.kyc_verified_data?.kyc_tier || 'none'}
                    </span></p>
                  </div>

                  {selectedIdentity === identity.id && (
                    <div className="mt-3 pt-3 border-t border-slate-700 space-y-1 text-xs">
                      <p className="text-slate-400">Onboarding: <span className={identity.onboarding_complete ? 'text-emerald-400' : 'text-orange-400'}>
                        {identity.onboarding_complete ? '✓ Complete' : '⏳ Incomplete'}
                      </span></p>
                      <p className="text-slate-400">Total Earned: <span className="text-amber-400 font-bold">${identity.total_earned.toFixed(2)}</span></p>
                      <p className="text-slate-400">Last Used: <span className="text-slate-300">{identity.last_used_at ? new Date(identity.last_used_at).toLocaleDateString() : 'Never'}</span></p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* EXECUTION LOG */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-orbitron text-sm font-bold text-cyan-400">EXECUTION LOG</h3>
          <select
            value={logFilter}
            onChange={(e) => setLogFilter(e.target.value)}
            className="text-xs px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-400"
          >
            <option value="all">All</option>
            <option value="success">Success</option>
            <option value="errors">Errors</option>
            <option value="email_sent">Emails</option>
            <option value="proposal_submitted">Proposals</option>
          </select>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {filteredLog.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">No logs matching filter</p>
          ) : (
            filteredLog.map((log) => (
              <div
                key={log.id}
                className={`p-2 rounded text-xs border-l-4 ${
                  log.status === 'sent'
                    ? 'bg-emerald-950/20 border-emerald-600 text-emerald-400'
                    : log.status === 'failed'
                    ? 'bg-red-950/20 border-red-600 text-red-400'
                    : 'bg-slate-900/30 border-slate-700 text-slate-400'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-mono font-bold">{log.log_type}</p>
                    <p className="text-slate-400 mt-0.5">{log.subject || log.message || 'N/A'}</p>
                  </div>
                  <span className="text-slate-500 shrink-0">
                    {new Date(log.created_date).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}