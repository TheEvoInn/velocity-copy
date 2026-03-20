/**
 * Admin Notifications & Workflow Triggers
 * Shows platform-wide alerts and admin action triggers
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell, Send, CheckCircle2, Clock, AlertTriangle,
  Users, FileCheck, Zap, Settings, RefreshCw, Bot
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

const ALERT_TYPES = [
  { id: 'kyc_pending',    label: 'KYC Pending Review',     icon: FileCheck,    color: '#f59e0b', desc: 'Triggers when KYC submissions need review' },
  { id: 'new_user',       label: 'New User Registration',  icon: Users,        color: '#a855f7', desc: 'Triggers when a new user joins' },
  { id: 'autopilot_err',  label: 'Autopilot Error',        icon: Bot,          color: '#ef4444', desc: 'Triggers on critical autopilot failure' },
  { id: 'task_review',    label: 'Task Needs Review',      icon: Settings,     color: '#3b82f6', desc: 'Triggers when a task requires manual review' },
  { id: 'high_failure',   label: 'High Failure Rate',      icon: AlertTriangle,color: '#ef4444', desc: 'Triggers when failure rate exceeds threshold' },
  { id: 'kyc_expired',    label: 'KYC Processing Too Long',icon: Clock,        color: '#f97316', desc: 'Triggers when KYC waits >48 hours' },
];

function AlertConfigRow({ alert, isActive, onToggle }) {
  const Icon = alert.icon;
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-800/20">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${alert.color}15`, border: `1px solid ${alert.color}25` }}>
        <Icon className="w-4 h-4" style={{ color: alert.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{alert.label}</p>
        <p className="text-xs text-slate-500">{alert.desc}</p>
      </div>
      <button onClick={() => onToggle(alert.id)}
        className={`relative w-10 h-5 rounded-full transition-colors ${isActive ? 'bg-emerald-500' : 'bg-slate-700'}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

export default function AdminNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeAlerts, setActiveAlerts] = useState(
    Object.fromEntries(ALERT_TYPES.map(a => [a.id, true]))
  );
  const [emailAlert, setEmailAlert] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');

  const { data: kycs = [] } = useQuery({
    queryKey: ['admin_notif_kycs'],
    queryFn: () => base44.entities.KYCVerification.filter({ status: 'submitted' }, '-created_date', 20),
    refetchInterval: 20000,
  });

  const { data: failedTasks = [] } = useQuery({
    queryKey: ['admin_notif_failed'],
    queryFn: () => base44.entities.TaskExecutionQueue.filter({ status: 'failed' }, '-created_date', 20),
    refetchInterval: 15000,
  });

  const { data: reviewTasks = [] } = useQuery({
    queryKey: ['admin_notif_review'],
    queryFn: () => base44.entities.TaskExecutionQueue.filter({ status: 'needs_review' }, '-created_date', 20),
    refetchInterval: 15000,
  });

  const { data: platformState = [] } = useQuery({
    queryKey: ['admin_notif_platform'],
    queryFn: () => base44.entities.PlatformState.list('-updated_date', 1),
    refetchInterval: 15000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['admin_notif_users'],
    queryFn: () => base44.entities.User.list('-created_date', 5),
    refetchInterval: 60000,
  });

  const ps = platformState[0] || {};

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      if (!emailAlert.trim()) throw new Error('Enter an email');
      await base44.integrations.Core.SendEmail({
        to: emailAlert,
        subject: 'Admin Alert — MISSION Platform',
        body: broadcastMsg || 'This is an administrative alert from the MISSION platform.',
      });
    },
    onSuccess: () => { toast.success('Alert email sent'); setEmailAlert(''); setBroadcastMsg(''); },
    onError:   err => toast.error(err.message),
  });

  const logAlertMutation = useMutation({
    mutationFn: (msg) => base44.entities.ActivityLog.create({
      action_type: 'system',
      message: `[ADMIN ALERT] ${msg}`,
      severity: 'warning',
      metadata: { admin: user?.email, timestamp: new Date().toISOString() },
    }),
    onSuccess: () => toast.success('Alert logged to system'),
  });

  const overrideAutopilotMutation = useMutation({
    mutationFn: async (enable) => {
      if (ps.id) {
        await base44.entities.PlatformState.update(ps.id, {
          autopilot_enabled: enable,
          execution_log: [...(ps.execution_log || []).slice(-20), {
            timestamp: new Date().toISOString(),
            action: enable ? 'autopilot_enabled_by_admin' : 'autopilot_disabled_by_admin',
            status: 'executed',
            details: `Admin override by ${user?.email}`,
          }],
        });
      }
    },
    onSuccess: (_, enable) => {
      qc.invalidateQueries({ queryKey: ['admin_notif_platform'] });
      toast.success(`Autopilot ${enable ? 'enabled' : 'disabled'} globally`);
    },
  });

  // Build live alerts
  const liveAlerts = [
    kycs.length > 0 && {
      id: 'kyc', icon: FileCheck, color: '#f59e0b',
      title: `${kycs.length} KYC submission${kycs.length > 1 ? 's' : ''} pending review`,
      sub: 'Requires admin action',
    },
    failedTasks.length > 5 && {
      id: 'fail', icon: AlertTriangle, color: '#ef4444',
      title: `${failedTasks.length} tasks failed`,
      sub: 'High failure rate detected',
    },
    reviewTasks.length > 0 && {
      id: 'review', icon: Settings, color: '#3b82f6',
      title: `${reviewTasks.length} task${reviewTasks.length > 1 ? 's' : ''} need manual review`,
      sub: 'User action may be required',
    },
    ps.emergency_stop_engaged && {
      id: 'estop', icon: AlertTriangle, color: '#ef4444',
      title: 'EMERGENCY STOP is currently ENGAGED',
      sub: 'All automations are halted',
    },
    ps.system_health === 'critical' && {
      id: 'health', icon: Zap, color: '#ef4444',
      title: 'System health is CRITICAL',
      sub: ps.last_error || 'Check the Health dashboard',
    },
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-orbitron text-base font-bold text-violet-400 tracking-wide flex items-center gap-2">
          <Bell className="w-4 h-4" /> Admin Notifications
        </h2>
      </div>

      {/* Live Alerts */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-2">Live Platform Alerts</h3>
        {liveAlerts.length === 0 ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <p className="text-sm text-emerald-300">No active alerts — platform is operating normally.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {liveAlerts.map(alert => {
              const Icon = alert.icon;
              return (
                <div key={alert.id} className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: `${alert.color}08`, border: `1px solid ${alert.color}30` }}>
                  <Icon className="w-4 h-4 shrink-0" style={{ color: alert.color }} />
                  <div>
                    <p className="text-sm font-medium text-white">{alert.title}</p>
                    <p className="text-xs text-slate-500">{alert.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Autopilot Override Controls */}
      <div className="glass-card rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3 font-orbitron tracking-wide">Autopilot Global Controls</h3>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 text-sm">
            <div className={`w-2.5 h-2.5 rounded-full ${ps.autopilot_enabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            <span className="text-white">Autopilot: <span className={ps.autopilot_enabled ? 'text-emerald-400' : 'text-slate-500'}>{ps.autopilot_enabled ? 'ACTIVE' : 'PAUSED'}</span></span>
          </div>
          <Button size="sm" onClick={() => overrideAutopilotMutation.mutate(true)}
            disabled={overrideAutopilotMutation.isPending || ps.autopilot_enabled}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 gap-1.5">
            <Zap className="w-3.5 h-3.5" /> Enable Autopilot
          </Button>
          <Button size="sm" onClick={() => overrideAutopilotMutation.mutate(false)}
            disabled={overrideAutopilotMutation.isPending || !ps.autopilot_enabled}
            variant="outline" className="border-red-500/40 text-red-400 text-xs h-8 gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Pause Autopilot
          </Button>
          <Button size="sm" onClick={() => logAlertMutation.mutate('Admin reviewed system status')}
            disabled={logAlertMutation.isPending}
            variant="outline" className="border-slate-700 text-slate-400 text-xs h-8 gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Log Review
          </Button>
        </div>
      </div>

      {/* Send Alert Email */}
      <div className="glass-card rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3 font-orbitron tracking-wide">Send Admin Alert</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Recipient Email</label>
            <input value={emailAlert} onChange={e => setEmailAlert(e.target.value)}
              placeholder="admin@example.com"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50" />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Message</label>
            <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} rows={3}
              placeholder="Alert message..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50 resize-none" />
          </div>
          <Button size="sm" onClick={() => sendEmailMutation.mutate()} disabled={sendEmailMutation.isPending}
            className="btn-cosmic text-white text-xs h-8 gap-1.5">
            <Send className="w-3.5 h-3.5" />
            {sendEmailMutation.isPending ? 'Sending...' : 'Send Alert'}
          </Button>
        </div>
      </div>

      {/* Alert Trigger Config */}
      <div className="glass-card rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3 font-orbitron tracking-wide">Notification Triggers</h3>
        <div className="space-y-2">
          {ALERT_TYPES.map(alert => (
            <AlertConfigRow key={alert.id} alert={alert}
              isActive={activeAlerts[alert.id]}
              onToggle={id => setActiveAlerts(p => ({ ...p, [id]: !p[id] }))} />
          ))}
        </div>
      </div>

      {/* Recent Users */}
      {users.length > 0 && (
        <div className="glass-card rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3 font-orbitron tracking-wide">Recent Registrations</h3>
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-violet-500/5 border border-violet-500/15 text-xs">
                <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center text-[10px] text-violet-400 font-bold shrink-0">
                  {(u.full_name || u.email || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{u.full_name || 'New User'}</p>
                  <p className="text-slate-500 truncate">{u.email}</p>
                </div>
                <span className="text-slate-600">{new Date(u.created_date).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}