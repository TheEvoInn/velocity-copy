import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ReconciliationPanel({ onReconcile }) {
  const [reconciling, setReconciling] = useState(false);

  const { data: reconcileResult, refetch } = useQuery({
    queryKey: ['reconciliation_status'],
    queryFn: async () => {
      const res = await base44.functions.invoke('prizePayoutReconciliation', {
        action: 'reconcile_payouts'
      });
      return res.data?.reconciliation || {};
    },
    enabled: false
  });

  const handleReconcile = async () => {
    setReconciling(true);
    await refetch();
    setReconciling(false);
  };

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <p className="text-sm text-slate-300">
          The reconciliation tool matches all confirmed prizes with your wallet balance. It automatically:
        </p>
        <ul className="text-xs text-slate-400 mt-3 space-y-1 ml-4">
          <li>✓ Identifies prizes won but missing from wallet</li>
          <li>✓ Flags overdue payouts (>14 days)</li>
          <li>✓ Creates compensatory transactions</li>
          <li>✓ Logs all reconciliation attempts</li>
        </ul>
      </div>

      {/* Reconciliation Controls */}
      <div className="flex gap-3">
        <Button
          onClick={handleReconcile}
          disabled={reconciling}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${reconciling ? 'animate-spin' : ''}`} />
          Start Reconciliation
        </Button>
      </div>

      {/* Results */}
      {reconcileResult && (
        <div className="space-y-4">
          <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-sm font-semibold text-emerald-400">
                  {reconcileResult.synced} prize{reconcileResult.synced !== 1 ? 's' : ''} synced to wallet
                </p>
              </div>
            </div>
          </div>

          {reconcileResult.discrepancies && reconcileResult.discrepancies.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">Discrepancies Found</h4>
              <div className="space-y-2">
                {reconcileResult.discrepancies.map(d => (
                  <div key={d.prize_id} className="bg-amber-950/20 border border-amber-900/30 rounded-lg p-3 flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                    <div className="text-xs text-amber-300">
                      <p className="font-medium">{d.title}</p>
                      <p className="text-amber-400/70">Missing: ${d.value.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reconcileResult.overdue && reconcileResult.overdue.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">Overdue Payouts</h4>
              <div className="space-y-2">
                {reconcileResult.overdue.map(o => (
                  <div key={o.prize_id} className="bg-red-950/20 border border-red-900/30 rounded-lg p-3 flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    <div className="text-xs text-red-300">
                      <p className="font-medium">{o.title}</p>
                      <p className="text-red-400/70">{o.days_overdue} days overdue (Expected: {new Date(o.expected_date).toLocaleDateString()})</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!reconcileResult.discrepancies || reconcileResult.discrepancies.length === 0) &&
            (!reconcileResult.overdue || reconcileResult.overdue.length === 0) && (
            <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-4 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-emerald-400 font-medium">All payouts are reconciled ✓</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}