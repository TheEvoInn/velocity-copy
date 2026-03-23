import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';

export default function ComplianceDashboard() {
  const [activeTab, setActiveTab] = useState('audit');
  const [auditLogs, setAuditLogs] = useState([]);
  const [report, setReport] = useState(null);
  const [discrepancies, setDiscrepancies] = useState([]);
  const [syncStatus, setSyncStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadComplianceData();
  }, []);

  const loadComplianceData = async () => {
    setLoading(true);
    try {
      const [auditRes, reportRes, discrepRes, syncRes] = await Promise.all([
        base44.functions.invoke('complianceAuditEngine', { action: 'get_audit_logs' }),
        base44.functions.invoke('complianceAuditEngine', { action: 'get_compliance_report' }),
        base44.functions.invoke('payoutReconciliationEngine', { action: 'get_discrepancies' }),
        base44.functions.invoke('identitySyncEngine', { action: 'get_sync_status' })
      ]);

      setAuditLogs(auditRes.data?.logs || []);
      setReport(reportRes.data);
      setDiscrepancies(discrepRes.data?.discrepancies || []);
      setSyncStatus(syncRes.data);
    } catch (e) {
      console.error('Failed to load compliance data:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-galaxy-deep p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-orbitron font-bold text-cyber-cyan mb-2">Compliance Dashboard</h1>
          <p className="text-muted-foreground">Regulatory audit, payout reconciliation, and identity sync monitoring</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="audit">Audit Trail</TabsTrigger>
            <TabsTrigger value="payouts">Payouts</TabsTrigger>
            <TabsTrigger value="identities">Identities</TabsTrigger>
            <TabsTrigger value="report">Report</TabsTrigger>
          </TabsList>

          <TabsContent value="audit" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Autonomous Action Audit Log</CardTitle>
                <CardDescription>All AI-executed actions for regulatory compliance</CardDescription>
              </CardHeader>
              <CardContent>
                {auditLogs.length === 0 ? (
                  <p className="text-muted-foreground">No actions logged yet</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="p-3 rounded border border-slate-700 bg-slate-900/50">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-sm">{log.action_type}</p>
                            <p className="text-xs text-muted-foreground">{log.entity_type} • {log.timestamp}</p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded ${
                            log.risk_level === 'low' ? 'bg-green-500/20 text-green-400' :
                            log.risk_level === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {log.risk_level}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payouts" className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              {discrepancies.length > 0 && (
                <Card className="glass-card border-red-500/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                      Discrepancies
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-red-400">{discrepancies.length}</p>
                  </CardContent>
                </Card>
              )}
            </div>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Payout Issues</CardTitle>
                <CardDescription>Delayed payouts and unusual withholding</CardDescription>
              </CardHeader>
              <CardContent>
                {discrepancies.length === 0 ? (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    <p>All payouts reconciled</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {discrepancies.map((disc, i) => (
                      <div key={i} className="p-3 rounded border border-slate-700 bg-slate-900/50">
                        <p className="font-semibold text-sm">{disc.type}</p>
                        <p className="text-xs text-muted-foreground">{disc.platform} • ${disc.amount.toFixed(2)}</p>
                        {disc.days_delayed && <p className="text-xs text-red-400">{disc.days_delayed} days delayed</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="identities" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Identity Sync Status</CardTitle>
                <CardDescription>Cross-platform identity consistency</CardDescription>
              </CardHeader>
              <CardContent>
                {syncStatus ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded border border-slate-700">
                      <p className="text-sm text-muted-foreground">Last Sync</p>
                      <p className="text-lg font-semibold">{syncStatus.last_sync ? new Date(syncStatus.last_sync).toLocaleString() : 'Never'}</p>
                    </div>
                    <div className="p-4 rounded border border-slate-700">
                      <p className="text-sm text-muted-foreground">Sync Health</p>
                      <div className="flex items-center gap-2">
                        {syncStatus.overall_sync_health === 'healthy' ? (
                          <>
                            <CheckCircle className="w-5 h-5 text-green-400" />
                            <p className="text-green-400">Healthy</p>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-5 h-5 text-yellow-400" />
                            <p className="text-yellow-400">Needs Attention</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Loading...</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="report" className="space-y-6">
            {report ? (
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Compliance Report (30 days)</CardTitle>
                  <CardDescription>{report.report_date}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded border border-slate-700">
                      <p className="text-sm text-muted-foreground">Total Actions</p>
                      <p className="text-3xl font-bold">{report.total_actions_30d}</p>
                    </div>
                    <div className={`p-4 rounded border ${report.high_risk_actions > 0 ? 'border-red-500/50' : 'border-slate-700'}`}>
                      <p className="text-sm text-muted-foreground">High-Risk Actions</p>
                      <p className={`text-3xl font-bold ${report.high_risk_actions > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {report.high_risk_actions}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded border border-slate-700">
                    <p className="font-semibold mb-2">Action Breakdown</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Task Executions</span>
                        <span>{report.action_breakdown.task_execution}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Identity Usage</span>
                        <span>{report.action_breakdown.identity_usage}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Financial Decisions</span>
                        <span>{report.action_breakdown.financial_decision}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Account Access</span>
                        <span>{report.action_breakdown.account_access}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Policy Violations</span>
                        <span>{report.action_breakdown.policy_violation}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded border border-slate-700">
                    <p className="font-semibold mb-2">Status</p>
                    <p className={`text-lg ${report.compliance_status === 'compliant' ? 'text-green-400' : 'text-yellow-400'}`}>
                      {report.compliance_status === 'compliant' ? '✓ Compliant' : '⚠ Attention Needed'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <p>Loading report...</p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}