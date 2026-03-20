/**
 * Admin Activity Monitor — Real-time audit logs, user actions, execution events
 * Immutable, timestamped, filterable by user / module / severity / department
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, RefreshCw, Filter, AlertTriangle, Info,
  CheckCircle2, XCircle, Search, Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const SEV_CFG = {
  error:   { color: '#ef4444', icon: XCircle,       label: 'Error' },
  warning: { color: '#f59e0b', icon: AlertTriangle,  label: 'Warning' },
  success: { color: '#10b981', icon: CheckCircle2,   label: 'Success' },
  info:    { color: '#3b82f6', icon: Info,            label: 'Info' },
};

function LogRow({ log }) {
  const sev = SEV_CFG[log.severity] || SEV_CFG.info;
  const Icon = sev.icon;
  return (
    <div className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-800/30 transition-colors border-b border-slate-800/50 last:border-0">
      <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: sev.color }} />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white leading-relaxed">{log.message}</p>
        <div className="flex flex-wrap gap-2 mt-1">
          <span className="text-[10px] text-slate-500">{log.created_by || 'system'}</span>
          {log.action_type && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 capitalize">
              {log.action_type.replace('_', ' ')}
            </span>
          )}
          {log.metadata?.identity_id && (
            <span className="text-[10px] text-violet-400">identity</span>
          )}
        </div>
      </div>
      <div className="text-[10px] text-slate-600 shrink-0 text-right">
        <p>{new Date(log.created_date).toLocaleTimeString()}</p>
        <p>{new Date(log.created_date).toLocaleDateString()}</p>
      </div>
    </div>
  );
}

export default function AdminActivityMonitor() {
  const [search, setSearch]   = useState('');
  const [sevFilter, setSev]   = useState('all');
  const [typeFilter, setType] = useState('all');
  const [userFilter, setUser] = useState('');

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['admin_activity_all'],
    queryFn: () => base44.entities.ActivityLog.list('-created_date', 500),
    refetchInterval: 10000,
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['admin_audit_logs'],
    queryFn: () => base44.entities.UserDataAuditLog.list('-created_date', 200),
    refetchInterval: 15000,
  });

  const { data: engineLogs = [] } = useQuery({
    queryKey: ['admin_engine_logs'],
    queryFn: () => base44.entities.EngineAuditLog.list('-created_date', 100),
    refetchInterval: 15000,
  });

  const ACTION_TYPES = [...new Set(logs.map(l => l.action_type).filter(Boolean))];

  const filtered = logs.filter(log => {
    const matchSearch = !search || log.message?.toLowerCase().includes(search.toLowerCase()) || log.created_by?.toLowerCase().includes(search.toLowerCase());
    const matchSev    = sevFilter === 'all' || log.severity === sevFilter;
    const matchType   = typeFilter === 'all' || log.action_type === typeFilter;
    const matchUser   = !userFilter || log.created_by?.toLowerCase().includes(userFilter.toLowerCase());
    return matchSearch && matchSev && matchType && matchUser;
  });

  const sevCounts = {
    error:   logs.filter(l => l.severity === 'error').length,
    warning: logs.filter(l => l.severity === 'warning').length,
    success: logs.filter(l => l.severity === 'success').length,
    info:    logs.filter(l => l.severity === 'info').length,
  };

  const exportLogs = () => {
    const data = filtered.map(l => ({
      timestamp: l.created_date,
      user: l.created_by,
      severity: l.severity,
      action: l.action_type,
      message: l.message,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `audit_logs_${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-orbitron text-base font-bold text-emerald-400 tracking-wide flex items-center gap-2">
          <Activity className="w-4 h-4" /> Activity Monitor
        </h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportLogs}
            className="border-slate-700 text-slate-400 text-xs h-7 gap-1.5">
            <Download className="w-3 h-3" /> Export
          </Button>
          <Button size="sm" variant="outline" onClick={refetch}
            className="border-slate-700 text-slate-400 text-xs h-7 gap-1.5">
            <RefreshCw className="w-3 h-3" /> Refresh
          </Button>
        </div>
      </div>

      {/* Severity Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(sevCounts).map(([sev, count]) => {
          const cfg = SEV_CFG[sev];
          const Icon = cfg.icon;
          return (
            <button key={sev} onClick={() => setSev(sevFilter === sev ? 'all' : sev)}
              className="rounded-xl p-3 text-left transition-all"
              style={{
                background: sevFilter === sev ? `${cfg.color}15` : `${cfg.color}08`,
                border: `1px solid ${sevFilter === sev ? cfg.color + '50' : cfg.color + '20'}`,
              }}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">{cfg.label}</p>
              </div>
              <p className="text-xl font-orbitron font-bold" style={{ color: cfg.color }}>{count}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search messages..."
            className="pl-9 bg-slate-800/60 border-slate-700 text-white text-xs h-8" />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <Input value={userFilter} onChange={e => setUser(e.target.value)}
            placeholder="Filter by user/email..."
            className="pl-9 bg-slate-800/60 border-slate-700 text-white text-xs h-8" />
        </div>
        <select value={typeFilter} onChange={e => setType(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 text-xs text-white h-8 focus:outline-none">
          <option value="all">All action types</option>
          {ACTION_TYPES.map(t => (
            <option key={t} value={t}>{t.replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      {/* Live Feed */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-white">
            Activity Feed
            <span className="ml-2 text-slate-500">({filtered.length} entries)</span>
          </p>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-400">Live</span>
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto space-y-0.5">
          {isLoading ? (
            <div className="text-center py-8 text-slate-500 text-sm">Loading logs...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">No matching log entries.</div>
          ) : (
            filtered.slice(0, 200).map(log => <LogRow key={log.id} log={log} />)
          )}
        </div>
      </div>

      {/* Engine Audit Log (last 20) */}
      {engineLogs.length > 0 && (
        <div className="glass-card rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3 font-orbitron tracking-wide">Engine Audit Log</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {engineLogs.slice(0, 20).map(log => (
              <div key={log.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/30 text-xs">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  log.status === 'success' ? 'bg-emerald-500' :
                  log.status === 'failed' ? 'bg-red-500' : 'bg-amber-500'
                }`} />
                <span className="text-slate-400 capitalize">{log.action_type?.replace(/_/g, ' ')}</span>
                {log.amount && <span className="text-emerald-400">${log.amount}</span>}
                <span className="text-slate-600 ml-auto">{new Date(log.created_date).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User Data Audit */}
      {auditLogs.length > 0 && (
        <div className="glass-card rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3 font-orbitron tracking-wide">Data Audit Trail</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {auditLogs.slice(0, 20).map(log => (
              <div key={log.id} className="flex items-start gap-3 p-2 rounded-lg bg-slate-800/20 text-xs border-b border-slate-800/50">
                <div className="flex-1 min-w-0">
                  <p className="text-slate-300">{log.change_description || log.event_type}</p>
                  <p className="text-slate-600">{log.user_email} · {log.entity_type} · {log.modification_source}</p>
                </div>
                <span className="text-[10px] text-slate-600 shrink-0">{new Date(log.created_date).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}