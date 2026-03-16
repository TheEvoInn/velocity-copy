import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Play, TrendingDown, TrendingUp, Zap, DollarSign, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EngineStatusBar from '../components/engine/EngineStatusBar';
import PolicyEditor from '../components/engine/PolicyEditor';
import BankAccountVault from '../components/engine/BankAccountVault';
import PayoutMonitor from '../components/engine/PayoutMonitor';
import EngineAuditFeed from '../components/engine/EngineAuditFeed';

function StatCard({ label, value, sub, color, icon: Icon }) {
  return (
    <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-600 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function WithdrawalEngine() {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);

  const { data: statusData, refetch } = useQuery({
    queryKey: ['engine_status'],
    queryFn: () => base44.functions.invoke('withdrawalEngine', { action: 'get_status' }),
    refetchInterval: 30000
  });

  const { data: auditData } = useQuery({
    queryKey: ['engine_audit'],
    queryFn: () => base44.entities.EngineAuditLog.list('-created_date', 100),
    initialData: [],
    refetchInterval: 30000
  });

  const status = statusData?.data || {};
  const engine = status.engine || {};
  const wallet = status.wallet || {};
  const payouts = status.payouts || {};
  const policy = status.policy || {};

  const handleRunCycle = async () => {
    setRunning(true);
    await base44.functions.invoke('withdrawalEngine', { action: 'run_cycle' });
    await refetch();
    qc.invalidateQueries({ queryKey: ['engine_audit'] });
    setRunning(false);
  };

  const handleRefresh = async () => {
    await refetch();
    qc.invalidateQueries({ queryKey: ['engine_audit'] });
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-emerald-400" />
            Withdrawal & Reinvestment Engine
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Autonomous financial automation · Runs every 30 minutes · {status.viable_opportunities_count || 0} viable opportunities
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleRefresh} variant="outline"
            className="border-slate-700 text-slate-400 hover:text-white text-xs h-8 gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={handleRunCycle} disabled={running || engine.emergency_stop}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 gap-1.5">
            <Play className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
            {running ? 'Running...' : 'Run Cycle Now'}
          </Button>
        </div>
      </div>

      {/* Engine status bar */}
      <EngineStatusBar engineData={engine} policyData={policy} onRefresh={handleRefresh} />

      {/* Emergency stop banner */}
      {engine.emergency_stop && (
        <div className="rounded-xl bg-rose-950/40 border border-rose-500/30 px-5 py-3 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <div>
            <span className="text-sm font-bold text-rose-400">Emergency Stop Active</span>
            <p className="text-xs text-rose-400/70">All automated actions are halted. Re-enable the engine to resume.</p>
          </div>
          <Button size="sm" onClick={async () => {
            await base44.functions.invoke('withdrawalEngine', {
              action: 'update_policy', policy_data: { emergency_stop: false }
            });
            await handleRefresh();
          }} className="ml-auto bg-rose-600 hover:bg-rose-500 text-white text-xs h-7">
            Clear Stop
          </Button>
        </div>
      )}

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Wallet Balance" icon={DollarSign} color="text-white"
          value={`$${(wallet.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          sub={`$${(wallet.safety_buffer || 0).toLocaleString()} buffer reserved`}
        />
        <StatCard
          label="Eligible to Withdraw" icon={TrendingDown} color="text-blue-400"
          value={`$${(wallet.eligible_for_withdrawal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          sub={`${policy.withdrawal_pct || 60}% of eligible`}
        />
        <StatCard
          label="Eligible to Reinvest" icon={TrendingUp} color="text-violet-400"
          value={`$${(wallet.max_reinvestment_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          sub={`${policy.max_reinvestment_pct || 40}% max reinvestment`}
        />
        <StatCard
          label="Pending Payouts" icon={RefreshCw} color="text-amber-400"
          value={`$${(payouts.pending_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          sub={`${payouts.pending_count || 0} transactions pending`}
        />
      </div>

      {/* 2-col layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PayoutMonitor payoutsData={payouts} walletData={wallet} />
        <div className="space-y-4">
          <PolicyEditor policy={policy} onSaved={handleRefresh} />
          <BankAccountVault policy={policy} onSaved={handleRefresh} />
        </div>
      </div>

      {/* Audit log full width */}
      <EngineAuditFeed logs={Array.isArray(auditData) ? auditData : (auditData?.data || [])} />
    </div>
  );
}