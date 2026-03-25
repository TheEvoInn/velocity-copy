import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, AlertTriangle, Shield, DollarSign, FileCheck, TrendingUp } from 'lucide-react';

export default function AdminCompliance() {
  const [activeTab, setActiveTab] = useState('overview');

  const { data: report = {}, isLoading: reportLoading } = useQuery({
    queryKey: ['complianceReport'],
    queryFn: async () => {
      const res = await base44.functions.invoke('riskComplianceEngine', {
        action: 'generate_compliance_report'
      });
      return res.data?.report || {};
    },
    refetchInterval: 300000 // 5 min
  });

  const { data: riskData = [], isLoading: riskLoading } = useQuery({
    queryKey: ['opportunityRisks'],
    queryFn: async () => {
      const res = await base44.functions.invoke('riskComplianceEngine', {
        action: 'score_opportunities'
      });
      return res.data?.opportunities || [];
    },
    refetchInterval: 600000 // 10 min
  });

  const kyc = report.kyc || {};
  const tax = report.tax || {};
  const safeRiskData = Array.isArray(riskData) ? riskData : [];
  const criticalIssues = Array.isArray(report.critical_issues) ? report.critical_issues : [];
  const kycAlerts = Array.isArray(kyc.alerts) ? kyc.alerts : [];
  const kycRecommendations = Array.isArray(kyc.recommendations) ? kyc.recommendations : [];
  const taxAlerts = Array.isArray(tax.alerts) ? tax.alerts : [];
  const taxRecommendations = Array.isArray(tax.recommendations) ? tax.recommendations : [];

  const getRiskColor = (level) => {
    switch(level) {
      case 'high': return 'bg-red-950 border-red-700 text-red-400';
      case 'medium': return 'bg-amber-950 border-amber-700 text-amber-400';
      case 'low': return 'bg-emerald-950 border-emerald-700 text-emerald-400';
      default: return 'bg-slate-900 border-slate-700 text-slate-400';
    }
  };

  const getReportColor = (level) => {
    switch(level) {
      case 'red': return 'bg-red-600';
      case 'yellow': return 'bg-amber-600';
      case 'green': return 'bg-emerald-600';
      default: return 'bg-slate-600';
    }
  };

  const blockedOpps = safeRiskData.filter(o => o.recommendation === 'BLOCK');
  const reviewOpps = safeRiskData.filter(o => o.recommendation === 'REVIEW');

  return (
    <div className="space-y-6">
      {/* Overall Risk Level */}
      <div className={`rounded-lg p-4 border-2 ${getRiskColor(report.overall_risk_level)}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6" />
            <div>
              <p className="font-bold uppercase">Overall Risk Level</p>
              <p className="text-xs opacity-75">{criticalIssues.length} critical issue{criticalIssues.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className={`px-3 py-1 rounded font-bold uppercase text-sm ${getReportColor(report.overall_risk_level)}`}>
            {report.overall_risk_level}
          </div>
        </div>
        {criticalIssues.length > 0 && (
          <div className="mt-3 pt-3 border-t border-opacity-30 border-current">
            {criticalIssues.map((issue, idx) => (
              <p key={idx} className="text-sm flex items-center gap-2 mb-1">
                <AlertTriangle className="w-3 h-3" /> {issue}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2">
        {[
          { id: 'overview', label: 'Overview', Icon: Shield },
          { id: 'kyc', label: 'KYC Compliance', Icon: FileCheck },
          { id: 'tax', label: 'Tax Obligations', Icon: DollarSign },
          { id: 'risk', label: 'Opportunity Risk', Icon: TrendingUp }
        ].map(({ id, label, Icon }) => (
          <Button
            key={id}
            size="sm"
            variant={activeTab === id ? 'default' : 'outline'}
            onClick={() => setActiveTab(id)}
            className="gap-1"
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </Button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-slate-900/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <FileCheck className="w-4 h-4" /> KYC Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-500">Status</p>
                <Badge className={kyc.kyc_status === 'approved' ? 'bg-emerald-600' : 'bg-amber-600'}>
                  {kyc.kyc_status}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-500">Tier</p>
                <p className="text-sm font-bold text-cyan-400">{kyc.kyc_tier || 'N/A'}</p>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-500">Compliance Score</p>
                <p className="text-sm font-bold text-violet-400">{kyc.compliance_score || 0}/100</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Tax Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-500">Gross Income ({tax.year})</p>
                <p className="text-sm font-bold text-emerald-400">${(tax.gross_income || 0).toLocaleString()}</p>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-500">Est. Tax Obligation</p>
                <p className="text-sm font-bold text-amber-400">${(tax.estimated_tax_obligation || 0).toLocaleString()}</p>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-500">Tax Gap</p>
                <p className={`text-sm font-bold ${tax.tax_gap > 1000 ? 'text-red-400' : 'text-cyan-400'}`}>
                  ${(tax.tax_gap || 0).toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* KYC Tab */}
      {activeTab === 'kyc' && (
        <div className="space-y-4">
          {kycAlerts.map((alert, idx) => (
            <div key={idx} className={`p-3 rounded-lg border flex gap-3 ${
              alert.type === 'critical' ? 'bg-red-950 border-red-700' :
              alert.type === 'warning' ? 'bg-amber-950 border-amber-700' :
              'bg-blue-950 border-blue-700'
            }`}>
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p className="text-sm">{alert.message}</p>
            </div>
          ))}
          {kycRecommendations.map((rec, idx) => (
            <Card key={idx} className="bg-emerald-950/30 border-emerald-700/50">
              <CardContent className="pt-4 flex gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-emerald-400">{rec}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tax Tab */}
      {activeTab === 'tax' && (
        <div className="space-y-4">
          <Card className="bg-slate-900/50 border-slate-700">
            <CardContent className="pt-4 space-y-2">
              <div className="flex justify-between">
                <p className="text-sm text-slate-400">Reporting Status</p>
                <Badge>{tax.reporting_status}</Badge>
              </div>
              <div className="flex justify-between">
                <p className="text-sm text-slate-400">Tax Withheld YTD</p>
                <p className="text-sm font-bold text-cyan-400">${(tax.tax_withheld || 0).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          {taxAlerts.map((alert, idx) => (
            <div key={idx} className={`p-3 rounded-lg border flex gap-3 ${
              alert.type === 'critical' ? 'bg-red-950 border-red-700' :
              alert.type === 'warning' ? 'bg-amber-950 border-amber-700' :
              'bg-blue-950 border-blue-700'
            }`}>
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p className="text-sm">{alert.message}</p>
            </div>
          ))}
          {taxRecommendations.map((rec, idx) => (
            <Card key={idx} className="bg-emerald-950/30 border-emerald-700/50">
              <CardContent className="pt-4 flex gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-emerald-400">{rec}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Risk Tab */}
      {activeTab === 'risk' && (
        <div className="space-y-4">
          {blockedOpps.length > 0 && (
            <div>
              <p className="text-sm font-bold text-red-400 mb-2">🚫 Blocked Opportunities ({blockedOpps.length})</p>
              {blockedOpps.map(opp => (
                <Card key={opp.id} className="bg-red-950/30 border-red-700/50 mb-2">
                  <CardContent className="pt-3 pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-white">{opp.title}</p>
                        <p className="text-xs text-slate-400">{opp.platform}</p>
                        {opp.fraud_flag && <Badge className="mt-1 bg-red-600 text-xs">Fraud Detected</Badge>}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-red-400">Risk: {opp.risk_score}</p>
                        <p className="text-xs text-slate-500">{opp.roi_percentage}% ROI</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {reviewOpps.length > 0 && (
            <div>
              <p className="text-sm font-bold text-amber-400 mb-2">⚠️ Review Required ({reviewOpps.length})</p>
              {reviewOpps.slice(0, 5).map(opp => (
                <Card key={opp.id} className="bg-amber-950/30 border-amber-700/50 mb-2">
                  <CardContent className="pt-3 pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-white">{opp.title}</p>
                        <p className="text-xs text-slate-400">{opp.platform}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-amber-400">Risk: {opp.risk_score}</p>
                        <p className="text-xs text-slate-500">{opp.roi_percentage}% ROI</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {blockedOpps.length === 0 && reviewOpps.length === 0 && (
            <Card className="bg-emerald-950/30 border-emerald-700/50">
              <CardContent className="pt-4 flex gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <p className="text-sm text-emerald-400">All visible opportunities have acceptable risk profiles</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}