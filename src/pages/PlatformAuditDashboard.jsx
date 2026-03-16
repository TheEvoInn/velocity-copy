import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Zap, RefreshCw, BarChart3, Shield, DollarSign, Activity } from 'lucide-react';
import { toast } from 'sonner';

export default function PlatformAuditDashboard() {
  const [auditResults, setAuditResults] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  const runAudit = useMutation({
    mutationFn: async (action) => {
      setIsRunning(true);
      const res = await base44.functions.invoke('platformAuditAndRepair', {
        action
      });
      setIsRunning(false);
      return res.data;
    },
    onSuccess: (data) => {
      setAuditResults(data);
      toast.success(`${data.audit_type || data.sync_type || 'Operation'} completed`);
    },
    onError: (err) => {
      toast.error(`Audit failed: ${err.message}`);
      setIsRunning(false);
    }
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Platform Audit & Repair</h1>
        <p className="text-slate-400 text-sm">
          Comprehensive system audit to ensure user data isolation, real-time synchronization, and financial accuracy
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="bg-slate-900 border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-5 h-5 text-blue-400" />
            <span className="font-semibold text-white">User Data Isolation</span>
          </div>
          <p className="text-xs text-slate-400 mb-4">Audit all user-specific data isolation</p>
          <Button
            onClick={() => runAudit.mutate('audit_user_data_isolation')}
            disabled={isRunning}
            size="sm"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white"
          >
            {isRunning ? 'Running...' : 'Audit Data Isolation'}
          </Button>
        </Card>

        <Card className="bg-slate-900 border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <span className="font-semibold text-white">Transaction Flows</span>
          </div>
          <p className="text-xs text-slate-400 mb-4">Validate and repair transaction pipelines</p>
          <Button
            onClick={() => runAudit.mutate('repair_transaction_flows')}
            disabled={isRunning}
            size="sm"
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            {isRunning ? 'Running...' : 'Repair Transactions'}
          </Button>
        </Card>

        <Card className="bg-slate-900 border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            <span className="font-semibold text-white">Wallet Integrity</span>
          </div>
          <p className="text-xs text-slate-400 mb-4">Validate wallet balances and sync</p>
          <Button
            onClick={() => runAudit.mutate('validate_wallet_integrity')}
            disabled={isRunning}
            size="sm"
            className="w-full bg-amber-600 hover:bg-amber-500 text-white"
          >
            {isRunning ? 'Running...' : 'Validate Wallet'}
          </Button>
        </Card>

        <Card className="bg-slate-900 border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-purple-400" />
            <span className="font-semibold text-white">Module Sync</span>
          </div>
          <p className="text-xs text-slate-400 mb-4">Sync all financial modules</p>
          <Button
            onClick={() => runAudit.mutate('sync_all_financial_modules')}
            disabled={isRunning}
            size="sm"
            className="w-full bg-purple-600 hover:bg-purple-500 text-white"
          >
            {isRunning ? 'Running...' : 'Sync Modules'}
          </Button>
        </Card>

        <Card className="bg-slate-900 border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <RefreshCw className="w-5 h-5 text-cyan-400" />
            <span className="font-semibold text-white">Reconcile Streams</span>
          </div>
          <p className="text-xs text-slate-400 mb-4">Reconcile all income streams</p>
          <Button
            onClick={() => runAudit.mutate('reconcile_all_streams')}
            disabled={isRunning}
            size="sm"
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white"
          >
            {isRunning ? 'Running...' : 'Reconcile'}
          </Button>
        </Card>

        <Card className="bg-slate-900 border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="font-semibold text-white">Full Platform Audit</span>
          </div>
          <p className="text-xs text-slate-400 mb-4">Complete system audit (slow)</p>
          <Button
            onClick={() => runAudit.mutate('full_platform_audit')}
            disabled={isRunning}
            size="sm"
            className="w-full bg-red-600 hover:bg-red-500 text-white"
          >
            {isRunning ? 'Running...' : 'Full Audit'}
          </Button>
        </Card>
      </div>

      {/* Results */}
      {auditResults && (
        <Card className="bg-slate-900 border-slate-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Audit Results</h2>
          </div>

          <div className="space-y-4">
            {/* Summary */}
            {auditResults.summary && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <p className="text-sm text-white font-medium mb-2">Summary</p>
                <p className="text-xs text-slate-400">{auditResults.summary}</p>
              </div>
            )}

            {/* Issues/Repairs */}
            {auditResults.issues && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <p className="text-sm text-white font-medium mb-3">Issues Found</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {auditResults.issues.map((issue, i) => (
                    <div key={i} className="text-xs text-slate-400 bg-slate-900/50 p-2 rounded">
                      {typeof issue === 'string' ? issue : (
                        <>
                          <p className="font-medium text-slate-300">{issue.category || issue.type}</p>
                          <p>{JSON.stringify(issue).substring(0, 200)}...</p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Repairs */}
            {auditResults.repairs && (
              <div className="bg-emerald-900/20 border border-emerald-800 rounded-lg p-4">
                <p className="text-sm text-emerald-400 font-medium mb-3">Repairs Applied: {auditResults.repairs_applied || 0}</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {auditResults.repairs?.slice(0, 10).map((repair, i) => (
                    <p key={i} className="text-xs text-emerald-300">{repair.opportunity_id} → {repair.action}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Modules */}
            {auditResults.sections && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <p className="text-sm text-white font-medium mb-3">System Sections</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {auditResults.sections.map((section, i) => (
                    <div key={i} className="bg-slate-900/50 p-3 rounded border border-slate-700">
                      <p className="text-xs font-semibold text-white mb-1">{section.section}</p>
                      {section.error ? (
                        <p className="text-[10px] text-red-400">{section.error}</p>
                      ) : (
                        <div className="space-y-0.5 text-[10px] text-slate-400">
                          {Object.entries(section)
                            .filter(([k]) => k !== 'section')
                            .map(([k, v]) => (
                              <p key={k}>
                                <span className="text-slate-500">{k}:</span> {typeof v === 'object' ? JSON.stringify(v) : v}
                              </p>
                            ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reconciliation */}
            {auditResults.reconciliation && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <p className="text-sm text-white font-medium mb-3">Income Stream Reconciliation</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="bg-emerald-950/30 p-2 rounded border border-emerald-800">
                    <p className="text-[10px] text-emerald-400">AI Stream</p>
                    <p className="text-sm font-bold text-emerald-300">${auditResults.reconciliation.ai_stream?.toFixed(2) || 0}</p>
                  </div>
                  <div className="bg-blue-950/30 p-2 rounded border border-blue-800">
                    <p className="text-[10px] text-blue-400">User Stream</p>
                    <p className="text-sm font-bold text-blue-300">${auditResults.reconciliation.user_stream?.toFixed(2) || 0}</p>
                  </div>
                  <div className="bg-purple-950/30 p-2 rounded border border-purple-800">
                    <p className="text-[10px] text-purple-400">Passive</p>
                    <p className="text-sm font-bold text-purple-300">${auditResults.reconciliation.passive_income?.toFixed(2) || 0}</p>
                  </div>
                  <div className="bg-amber-950/30 p-2 rounded border border-amber-800">
                    <p className="text-[10px] text-amber-400">Total</p>
                    <p className="text-sm font-bold text-amber-300">${auditResults.reconciliation.total?.toFixed(2) || 0}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Raw JSON */}
            <details className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <summary className="text-xs font-semibold text-slate-400 cursor-pointer hover:text-slate-300">
                View Full JSON
              </summary>
              <pre className="mt-3 text-[9px] text-slate-500 bg-slate-950 p-3 rounded overflow-x-auto max-h-64 overflow-y-auto">
                {JSON.stringify(auditResults, null, 2)}
              </pre>
            </details>
          </div>
        </Card>
      )}
    </div>
  );
}