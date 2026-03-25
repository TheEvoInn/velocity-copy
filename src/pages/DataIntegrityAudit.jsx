import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function DataIntegrityAudit() {
  const [auditRunning, setAuditRunning] = useState(false);
  const [recoveryRunning, setRecoveryRunning] = useState(false);
  const [auditResult, setAuditResult] = useState(null);
  const [recoveryResult, setRecoveryResult] = useState(null);

  const runAudit = async () => {
    setAuditRunning(true);
    try {
      const response = await base44.functions.invoke('userDataIntegrityAudit', {});
      setAuditResult(response.data);
      toast.success(`✓ Audit complete: ${response.data.summary.total_issues} issues found`);
    } catch (err) {
      toast.error(`Audit failed: ${err.message}`);
      console.error(err);
    } finally {
      setAuditRunning(false);
    }
  };

  const runRecovery = async () => {
    if (!auditResult) {
      toast.error('Run audit first');
      return;
    }
    setRecoveryRunning(true);
    try {
      const response = await base44.functions.invoke('recoverCorruptedUserData', {
        audit_report: auditResult,
      });
      setRecoveryResult(response.data);
      toast.success(`✓ Recovery complete: ${response.data.recovered_records} records recovered`);
    } catch (err) {
      toast.error(`Recovery failed: ${err.message}`);
      console.error(err);
    } finally {
      setRecoveryRunning(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Data Integrity Audit & Recovery</h1>
        <p className="text-slate-400">Scan for lost, corrupted, or unsynced user records and recover them.</p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mb-8">
        <Button
          onClick={runAudit}
          disabled={auditRunning || recoveryRunning}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold"
        >
          {auditRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          {auditRunning ? 'Auditing...' : 'Run Audit'}
        </Button>
        <Button
          onClick={runRecovery}
          disabled={!auditResult || recoveryRunning || auditRunning}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
        >
          {recoveryRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
          {recoveryRunning ? 'Recovering...' : 'Run Recovery'}
        </Button>
      </div>

      {/* Audit Results */}
      {auditResult && (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            {auditResult.summary.critical_issues > 0 ? (
              <AlertCircle className="w-6 h-6 text-red-400" />
            ) : (
              <CheckCircle className="w-6 h-6 text-emerald-400" />
            )}
            <h2 className="text-xl font-bold text-white">Audit Results</h2>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-800 rounded p-3">
              <div className="text-sm text-slate-400">Total Issues</div>
              <div className="text-2xl font-bold text-white">{auditResult.summary.total_issues}</div>
            </div>
            <div className="bg-slate-800 rounded p-3">
              <div className="text-sm text-slate-400">Critical</div>
              <div className={`text-2xl font-bold ${auditResult.summary.critical_issues > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {auditResult.summary.critical_issues}
              </div>
            </div>
            <div className="bg-slate-800 rounded p-3">
              <div className="text-sm text-slate-400">Warnings</div>
              <div className="text-2xl font-bold text-yellow-400">{auditResult.summary.warnings}</div>
            </div>
            <div className="bg-slate-800 rounded p-3">
              <div className="text-sm text-slate-400">Corrupted</div>
              <div className="text-2xl font-bold text-orange-400">{auditResult.summary.corrupted_count}</div>
            </div>
          </div>

          {/* Details Tabs */}
          <div className="space-y-4">
            {/* Identities */}
            <div className="bg-slate-800 rounded p-4">
              <h3 className="font-bold text-white mb-2">AI Identities</h3>
              <div className="text-sm text-slate-300">
                {auditResult.sections.identity_audit.total_identities} identities found
              </div>
              {auditResult.sections.identity_audit.identities.map(i => (
                <div key={i.id} className="text-xs text-slate-400 mt-1">
                  {i.name} {i.issue && <span className="text-red-400">[{i.issue}]</span>}
                </div>
              ))}
            </div>

            {/* Goals */}
            <div className="bg-slate-800 rounded p-4">
              <h3 className="font-bold text-white mb-2">User Goals</h3>
              <div className="text-sm text-slate-300">
                {auditResult.sections.goals_audit.total_goals} goals found
              </div>
              {auditResult.sections.goals_audit.issues && auditResult.sections.goals_audit.issues.map((issue, i) => (
                <div key={i} className="text-xs text-yellow-400 mt-1">
                  ⚠ {issue}
                </div>
              ))}
            </div>

            {/* Transactions */}
            <div className="bg-slate-800 rounded p-4">
              <h3 className="font-bold text-white mb-2">Transactions</h3>
              <div className="text-sm text-slate-300">
                {auditResult.sections.transaction_audit.total_transactions} total
                ({auditResult.sections.transaction_audit.total_income} income,{' '}
                {auditResult.sections.transaction_audit.total_expense} expense)
              </div>
              {auditResult.sections.transaction_audit.corrupted_transactions.length > 0 && (
                <div className="text-xs text-red-400 mt-2">
                  {auditResult.sections.transaction_audit.corrupted_transactions.length} corrupted records
                </div>
              )}
            </div>

            {/* Opportunities */}
            <div className="bg-slate-800 rounded p-4">
              <h3 className="font-bold text-white mb-2">Opportunities</h3>
              <div className="text-sm text-slate-300">
                {auditResult.sections.opportunity_audit.total_opportunities} total
              </div>
              {auditResult.sections.opportunity_audit.corrupted_opportunities.length > 0 && (
                <div className="text-xs text-red-400 mt-2">
                  {auditResult.sections.opportunity_audit.corrupted_opportunities.length} corrupted records
                </div>
              )}
            </div>

            {/* Cross-Entity Issues */}
            {auditResult.sections.cross_entity_validation.issues.length > 0 && (
              <div className="bg-red-900/20 border border-red-500/30 rounded p-4">
                <h3 className="font-bold text-red-400 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Cross-Entity Issues
                </h3>
                {auditResult.sections.cross_entity_validation.issues.map((issue, i) => (
                  <div key={i} className="text-xs text-red-200 mb-2">
                    <strong>{issue.severity}:</strong> {issue.issue}
                    <br />
                    <span className="text-red-300">Action: {issue.action}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recovery Results */}
      {recoveryResult && (
        <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold text-emerald-400">Recovery Results</h2>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-800 rounded p-3">
              <div className="text-sm text-slate-400">Records Recovered</div>
              <div className="text-2xl font-bold text-emerald-400">{recoveryResult.recovered_records}</div>
            </div>
            <div className="bg-slate-800 rounded p-3">
              <div className="text-sm text-slate-400">Failed</div>
              <div className={`text-2xl font-bold ${recoveryResult.failed_recoveries.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {recoveryResult.failed_recoveries.length}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {recoveryResult.actions_taken.map((action, i) => (
              <div key={i} className="text-sm text-emerald-300">
                ✓ {action.action}
              </div>
            ))}
          </div>

          {recoveryResult.failed_recoveries.length > 0 && (
            <div className="mt-4 border-t border-red-500/30 pt-4">
              <h4 className="font-bold text-red-400 mb-2">Failed Recoveries:</h4>
              {recoveryResult.failed_recoveries.map((failure, i) => (
                <div key={i} className="text-xs text-red-300 mb-1">
                  {failure.action}: {failure.error}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}