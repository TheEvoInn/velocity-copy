import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Wifi, RefreshCw, Zap, Shield, Eye, Clock, TrendingUp,
  AlertCircle, CheckCircle2, Activity, Globe, Lock, Users
} from 'lucide-react';

const PLATFORM_COLORS = {
  upwork: 'text-green-400 bg-green-400/10',
  fiverr: 'text-emerald-400 bg-emerald-400/10',
  freelancer: 'text-blue-400 bg-blue-400/10',
  peopleperhour: 'text-orange-400 bg-orange-400/10',
  toptal: 'text-purple-400 bg-purple-400/10',
  guru: 'text-pink-400 bg-pink-400/10',
  other: 'text-slate-400 bg-slate-400/10'
};

function StatPill({ icon: Icon, label, value, color = 'text-slate-300' }) {
  return (
    <div className="flex items-center gap-2 bg-slate-800/60 rounded-lg px-3 py-2">
      <Icon className={`w-3.5 h-3.5 ${color}`} />
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-xs font-bold ${color}`}>{value}</span>
    </div>
  );
}

export default function LiveIngestionPanel({ onScanComplete }) {
  const [isScanning, setIsScanning] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [scanMode, setScanMode] = useState('quick');
  const queryClient = useQueryClient();

  // Feed status
  const { data: feedStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['ingestion_feed_status'],
    queryFn: () => base44.functions.invoke('liveJobIngestion', { action: 'get_feed_status' }),
    refetchInterval: 30000
  });

  const status = feedStatus?.data || {};

  // Recent activity logs for scan history
  const { data: scanLogs } = useQuery({
    queryKey: ['scan_logs'],
    queryFn: () => base44.entities.ActivityLog.filter({ action_type: 'scan' }, '-created_date', 8),
    refetchInterval: 15000
  });

  // Recent credential accesses
  const { data: credLogs } = useQuery({
    queryKey: ['cred_logs'],
    queryFn: () => base44.entities.AIWorkLog.filter({ log_type: 'credential_access' }, '-created_date', 5)
  });

  const runScan = async (mode) => {
    setIsScanning(true);
    setLastResult(null);
    try {
      const res = await base44.functions.invoke('liveJobIngestion', {
        action: mode === 'quick' ? 'run_quick_scan' : 'run_full_scan'
      });
      const data = res?.data || {};
      setLastResult(data);
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['ingestion_feed_status'] });
      queryClient.invalidateQueries({ queryKey: ['scan_logs'] });
      queryClient.invalidateQueries({ queryKey: ['cred_logs'] });
      if (onScanComplete) onScanComplete(data);
    } catch (err) {
      setLastResult({ error: err.message });
    } finally {
      setIsScanning(false);
      refetchStatus();
    }
  };

  const expireOld = async () => {
    await base44.functions.invoke('liveJobIngestion', { action: 'expire_old_jobs' });
    queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    queryClient.invalidateQueries({ queryKey: ['ingestion_feed_status'] });
  };

  return (
    <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-900">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Wifi className="w-4 h-4 text-emerald-400" />
            {isScanning && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />}
          </div>
          <span className="text-sm font-semibold text-white">Live Job Ingestion Engine</span>
          <Badge className={`text-[10px] px-1.5 py-0 ${isScanning ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>
            {isScanning ? 'SCANNING' : 'LIVE'}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={expireOld}
            className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded transition-colors"
          >
            Clean expired
          </button>
          <Button
            size="sm"
            variant={scanMode === 'quick' ? 'outline' : 'ghost'}
            onClick={() => setScanMode('quick')}
            className="h-7 text-xs px-2 border-slate-600 text-slate-400"
          >
            Quick
          </Button>
          <Button
            size="sm"
            variant={scanMode === 'full' ? 'outline' : 'ghost'}
            onClick={() => setScanMode('full')}
            className="h-7 text-xs px-2 border-slate-600 text-slate-400"
          >
            Full
          </Button>
          <Button
            size="sm"
            onClick={() => runScan(scanMode)}
            disabled={isScanning}
            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
          >
            <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'Scanning…' : `${scanMode === 'quick' ? 'Quick' : 'Full'} Scan`}
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-slate-800">
        <StatPill icon={Globe} label="Active opps" value={status.new_opportunities ?? '—'} color="text-emerald-400" />
        <StatPill icon={Users} label="Accounts" value={`${status.active_accounts ?? 0}/${status.total_accounts ?? 0}`} color="text-blue-400" />
        <StatPill icon={Lock} label="Credentials" value={status.accounts_with_credentials ?? 0} color="text-purple-400" />
        <StatPill icon={Activity} label="Vault entries" value={status.vault_entries ?? 0} color="text-amber-400" />
        {status.last_scan && (
          <StatPill icon={Clock} label="Last scan" value={new Date(status.last_scan).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} color="text-slate-400" />
        )}
      </div>

      {/* Platforms covered */}
      {status.platforms_covered?.length > 0 && (
        <div className="px-4 py-2 flex items-center gap-2 border-b border-slate-800">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">Authenticated feeds:</span>
          {status.platforms_covered.map(p => (
            <span key={p} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${PLATFORM_COLORS[p] || PLATFORM_COLORS.other}`}>
              {p}
            </span>
          ))}
        </div>
      )}

      {/* Scan Result */}
      {lastResult && (
        <div className={`mx-4 my-3 rounded-lg px-3 py-2.5 text-xs ${lastResult.error ? 'bg-red-500/10 border border-red-500/30' : 'bg-emerald-500/10 border border-emerald-500/30'}`}>
          {lastResult.error ? (
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-3.5 h-3.5" />
              {lastResult.error}
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Scan complete — {lastResult.new_opportunities} new, {lastResult.updated_opportunities} updated, {lastResult.auto_expired} expired
              </div>
              {lastResult.market_insights && (
                <div className="text-slate-400 pl-5">{lastResult.market_insights}</div>
              )}
              {lastResult.platforms_scanned?.length > 0 && (
                <div className="flex items-center gap-1.5 pl-5 text-slate-500">
                  <span>Scanned:</span>
                  {lastResult.platforms_scanned.map(p => (
                    <span key={p} className="text-slate-400">{p}</span>
                  ))}
                  {lastResult.accounts_used > 0 && (
                    <span className="text-purple-400">· {lastResult.accounts_used} authenticated accounts</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Scanning animation */}
      {isScanning && (
        <div className="px-4 pb-3">
          <div className="bg-slate-800/60 rounded-lg px-3 py-2.5 text-xs text-slate-400 space-y-1.5">
            <div className="flex items-center gap-2">
              <Zap className="w-3 h-3 text-amber-400 animate-pulse" />
              <span>Accessing credential vault…</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-3 h-3 text-blue-400 animate-pulse" />
              <span>Authenticating into platform feeds…</span>
            </div>
            <div className="flex items-center gap-2">
              <Eye className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>Scraping live job boards (public + authenticated)…</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3 h-3 text-purple-400 animate-pulse" />
              <span>Scoring opportunities against your profile…</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-1 mt-2 overflow-hidden">
              <div className="bg-emerald-500 h-1 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        </div>
      )}

      {/* Recent scan history */}
      {!isScanning && scanLogs?.length > 0 && (
        <div className="px-4 pb-3">
          <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1.5">Recent ingestion events</div>
          <div className="space-y-1">
            {scanLogs.slice(0, 4).map(log => (
              <div key={log.id} className="flex items-start gap-2 text-xs text-slate-500">
                <div className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${log.severity === 'success' ? 'bg-emerald-500' : log.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                <span className="flex-1 leading-tight">{log.message}</span>
                <span className="text-slate-600 flex-shrink-0">{new Date(log.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Credential access log */}
      {credLogs?.length > 0 && !isScanning && (
        <div className="px-4 pb-3 border-t border-slate-800 pt-2">
          <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Lock className="w-3 h-3" /> Recent credential accesses
          </div>
          <div className="space-y-0.5">
            {credLogs.slice(0, 3).map(log => (
              <div key={log.id} className="flex items-center gap-2 text-xs text-slate-500">
                <span className={`px-1.5 py-0 rounded text-[10px] ${PLATFORM_COLORS[log.platform] || PLATFORM_COLORS.other}`}>{log.platform}</span>
                <span className="flex-1 truncate">{log.subject?.replace('[Ingestion] ', '')}</span>
                <span className="text-slate-600">{new Date(log.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}