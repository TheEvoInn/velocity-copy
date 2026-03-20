/**
 * Admin Health Dashboard — Real-time platform health monitoring
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  Zap, Activity, CheckCircle2, AlertTriangle, XCircle,
  RefreshCw, Cpu, Database, Globe, Clock, TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';

function StatCard({ label, value, sub, color, icon: Icon, glow }) {
  return (
    <div className="rounded-2xl p-4"
      style={{ background: `${color}10`, border: `1px solid ${color}30` }}>
      <div className="flex items-start justify-between mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${color}20`, border: `1px solid ${color}30` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: color }} />
      </div>
      <p className="text-xl font-orbitron font-bold text-white" style={{ textShadow: `0 0 15px ${color}` }}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>}
    </div>
  );
}

function HealthBadge({ status }) {
  const cfg = {
    healthy:  { color: '#10b981', label: 'Healthy',  icon: CheckCircle2 },
    warning:  { color: '#f59e0b', label: 'Warning',  icon: AlertTriangle },
    critical: { color: '#ef4444', label: 'Critical', icon: XCircle },
  }[status] || { color: '#64748b', label: 'Unknown', icon: Activity };
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium"
      style={{ background: `${cfg.color}15`, border: `1px solid ${cfg.color}35`, color: cfg.color }}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

export default function AdminHealthDashboard() {
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const { data: platformStates = [], refetch: refetchPlatform } = useQuery({
    queryKey: ['admin_platform_states'],
    queryFn: () => base44.entities.PlatformState.list('-updated_date', 5),
    refetchInterval: 15000,
  });

  const { data: tasks = [], refetch: refetchTasks } = useQuery({
    queryKey: ['admin_tasks_health'],
    queryFn: () => base44.entities.TaskExecutionQueue.list('-created_date', 50),
    refetchInterval: 15000,
  });

  const { data: opportunities = [] } = useQuery({
    queryKey: ['admin_opps_health'],
    queryFn: () => base44.entities.Opportunity.list('-created_date', 100),
    refetchInterval: 20000,
  });

  const { data: activityLogs = [] } = useQuery({
    queryKey: ['admin_activity_health'],
    queryFn: () => base44.entities.ActivityLog.list('-created_date', 200),
    refetchInterval: 10000,
  });

  const { data: identities = [] } = useQuery({
    queryKey: ['admin_identities_health'],
    queryFn: () => base44.entities.AIIdentity.list('-created_date', 50),
  });

  const handleRefresh = () => {
    refetchPlatform();
    refetchTasks();
    setLastRefresh(new Date());
  };

  const ps = platformStates[0] || {};
  const queuedTasks    = tasks.filter(t => t.status === 'queued').length;
  const processingTasks = tasks.filter(t => t.status === 'processing' || t.status === 'navigating').length;
  const failedTasks    = tasks.filter(t => t.status === 'failed').length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const activeOpps     = opportunities.filter(o => ['new','reviewing','queued','executing'].includes(o.status)).length;
  const activeIdentities = identities.filter(i => i.is_active).length;
  const recentErrors   = activityLogs.filter(l => l.severity === 'error').slice(0, 10);
  const recentWarnings = activityLogs.filter(l => l.severity === 'warning').slice(0, 5);

  const integrations = [
    { name: 'Autopilot Engine', status: ps.autopilot_enabled ? 'healthy' : 'warning', detail: ps.autopilot_mode || 'continuous' },
    { name: 'Task Queue',       status: failedTasks > 5 ? 'warning' : 'healthy',      detail: `${queuedTasks} queued` },
    { name: 'Opportunity Feed', status: activeOpps > 0 ? 'healthy' : 'warning',       detail: `${activeOpps} active` },
    { name: 'Identity System',  status: activeIdentities > 0 ? 'healthy' : 'warning', detail: `${activeIdentities} active` },
    { name: 'Emergency Stop',   status: ps.emergency_stop_engaged ? 'critical' : 'healthy', detail: ps.emergency_stop_engaged ? 'ENGAGED' : 'Standby' },
    { name: 'System Health',    status: ps.system_health || 'healthy',                detail: ps.last_error ? 'Has errors' : 'No errors' },
  ];

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="font-orbitron text-base font-bold text-cyan-400 tracking-wide flex items-center gap-2">
          <Zap className="w-4 h-4" /> Platform Health
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-600">
            Updated {lastRefresh.toLocaleTimeString()}
          </span>
          <Button size="sm" variant="outline" onClick={handleRefresh}
            className="border-slate-700 text-slate-400 text-xs h-7 gap-1.5">
            <RefreshCw className="w-3 h-3" /> Refresh
          </Button>
        </div>
      </div>

      {/* Emergency stop alert */}
      {ps.emergency_stop_engaged && (
        <div className="flex items-center gap-3 p-3 rounded-xl"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)' }}>
          <XCircle className="w-5 h-5 text-red-400 shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-300">⚠️ EMERGENCY STOP ENGAGED</p>
            <p className="text-xs text-red-400/70">All automations are halted. Manual override required.</p>
          </div>
        </div>
      )}

      {/* Stat Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Tasks Queued"     value={queuedTasks}    color="#f59e0b" icon={Clock}     sub="Awaiting execution" />
        <StatCard label="Processing"       value={processingTasks} color="#3b82f6" icon={Cpu}       sub="Active now" />
        <StatCard label="Completed"        value={completedTasks} color="#10b981" icon={CheckCircle2} sub="All time" />
        <StatCard label="Failed Tasks"     value={failedTasks}    color="#ef4444" icon={XCircle}   sub="Needs review" />
        <StatCard label="Active Opps"      value={activeOpps}     color="#06b6d4" icon={Globe}      sub="In pipeline" />
        <StatCard label="Active Identities" value={activeIdentities} color="#a855f7" icon={Activity} sub="Online" />
      </div>

      {/* Integration Status Grid */}
      <div className="glass-card rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3 font-orbitron tracking-wide">Integration Status</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {integrations.map(intg => (
            <div key={intg.name} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <div>
                <p className="text-xs font-medium text-white">{intg.name}</p>
                <p className="text-[10px] text-slate-500">{intg.detail}</p>
              </div>
              <HealthBadge status={intg.status} />
            </div>
          ))}
        </div>
      </div>

      {/* Autopilot State */}
      {ps.id && (
        <div className="glass-card rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3 font-orbitron tracking-wide">Autopilot State</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {[
              { label: 'Mode',           value: ps.autopilot_mode || '—' },
              { label: 'Queue Count',    value: ps.current_queue_count || 0 },
              { label: 'Tasks Today',    value: ps.tasks_completed_today || 0 },
              { label: 'Revenue Today',  value: `$${(ps.revenue_generated_today || 0).toFixed(2)}` },
              { label: 'Cycle Count',    value: ps.cycle_count_today || 0 },
              { label: 'Error Count',    value: ps.error_count_today || 0 },
              { label: 'Last Cycle',     value: ps.last_cycle_timestamp ? new Date(ps.last_cycle_timestamp).toLocaleTimeString() : '—' },
              { label: 'System Health',  value: <HealthBadge status={ps.system_health || 'healthy'} /> },
            ].map(({ label, value }) => (
              <div key={label} className="p-2 rounded-lg bg-slate-800/40">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">{label}</p>
                <p className="text-sm font-medium text-white capitalize">{value}</p>
              </div>
            ))}
          </div>
          {ps.last_error && (
            <div className="mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-[10px] text-red-400 uppercase tracking-wide mb-0.5">Last Error</p>
              <p className="text-xs text-red-300">{ps.last_error}</p>
              {ps.last_error_timestamp && (
                <p className="text-[10px] text-slate-600 mt-0.5">{new Date(ps.last_error_timestamp).toLocaleString()}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Recent Errors Feed */}
      {recentErrors.length > 0 && (
        <div className="glass-card rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-red-400 mb-3 font-orbitron tracking-wide flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Recent Errors
          </h3>
          <div className="space-y-2">
            {recentErrors.map(log => (
              <div key={log.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-red-500/5 border border-red-500/15">
                <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-red-200 truncate">{log.message}</p>
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-600">{log.created_by || 'system'}</span>
                    <span className="text-[10px] text-slate-700">·</span>
                    <span className="text-[10px] text-slate-600">{new Date(log.created_date).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}