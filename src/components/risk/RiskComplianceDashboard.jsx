import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Shield, TrendingDown, CheckCircle, Zap, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function RiskComplianceDashboard() {
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [riskAnalysis, setRiskAnalysis] = useState(null);
  const [fraudAnalysis, setFraudAnalysis] = useState(null);
  const queryClient = useQueryClient();

  // Fetch opportunities
  const { data: opportunities = [] } = useQuery({
    queryKey: ['opportunities'],
    queryFn: async () => {
      const res = await base44.entities.Opportunity.list('-created_date', 50);
      return res || [];
    },
    refetchInterval: 30000
  });

  // Fetch risk dashboard
  const { data: dashboard = {} } = useQuery({
    queryKey: ['riskDashboard'],
    queryFn: async () => {
      const res = await base44.functions.invoke('riskComplianceEngine', {
        action: 'get_risk_dashboard',
        payload: {}
      });
      return res.data || {};
    },
    refetchInterval: 60000
  });

  // Assess risk mutation
  const assessRiskMutation = useMutation({
    mutationFn: async (oppId) => {
      const res = await base44.functions.invoke('riskComplianceEngine', {
        action: 'assess_opportunity_risk',
        payload: { opportunity_id: oppId }
      });
      return res.data;
    },
    onSuccess: (data) => {
      setRiskAnalysis(data);
    },
    onError: (error) => {
      toast.error(`Risk assessment failed: ${error.message}`);
    }
  });

  // Detect fraud mutation
  const detectFraudMutation = useMutation({
    mutationFn: async (oppId) => {
      const res = await base44.functions.invoke('riskComplianceEngine', {
        action: 'detect_fraud_signals',
        payload: { opportunity_id: oppId }
      });
      return res.data;
    },
    onSuccess: (data) => {
      setFraudAnalysis(data);
    },
    onError: (error) => {
      toast.error(`Fraud detection failed: ${error.message}`);
    }
  });

  const handleAnalyzeOpp = (opp) => {
    setSelectedOpp(opp);
    setRiskAnalysis(null);
    setFraudAnalysis(null);
    assessRiskMutation.mutate(opp.id);
    detectFraudMutation.mutate(opp.id);
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'low': return 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400';
      case 'medium': return 'bg-amber-950/30 border-amber-500/30 text-amber-400';
      case 'high': return 'bg-orange-950/30 border-orange-500/30 text-orange-400';
      case 'critical': return 'bg-red-950/30 border-red-500/30 text-red-400';
      default: return 'bg-slate-900/30 border-slate-500/30 text-slate-400';
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="rounded-lg bg-blue-950/30 border border-blue-500/30 p-3">
          <div className="text-blue-400">Total Reviewed</div>
          <div className="text-2xl font-bold text-white mt-1">{dashboard.total_opportunities_reviewed || 0}</div>
          <div className="text-blue-600 text-[10px] mt-1">Opportunities</div>
        </div>

        <div className="rounded-lg bg-emerald-950/30 border border-emerald-500/30 p-3">
          <div className="text-emerald-400">Low Risk</div>
          <div className="text-2xl font-bold text-white mt-1">{dashboard.risk_distribution?.low || 0}</div>
          <div className="text-emerald-600 text-[10px] mt-1">Safe to proceed</div>
        </div>

        <div className="rounded-lg bg-amber-950/30 border border-amber-500/30 p-3">
          <div className="text-amber-400">High Risk</div>
          <div className="text-2xl font-bold text-white mt-1">{dashboard.risk_distribution?.high || 0}</div>
          <div className="text-amber-600 text-[10px] mt-1">Needs review</div>
        </div>

        <div className="rounded-lg bg-red-950/30 border border-red-500/30 p-3">
          <div className="text-red-400">Fraud Alerts</div>
          <div className="text-2xl font-bold text-white mt-1">{dashboard.fraud_distribution?.critical || 0}</div>
          <div className="text-red-600 text-[10px] mt-1">Block immediately</div>
        </div>
      </div>

      {/* Recommended Actions */}
      {dashboard.recommended_actions && dashboard.recommended_actions.length > 0 && (
        <Card className="bg-yellow-950/30 border-yellow-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-yellow-400">
              <AlertTriangle className="w-4 h-4" />
              Recommended Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-xs">
              {dashboard.recommended_actions.map((action, idx) => (
                <div key={idx} className="flex items-start gap-2 text-yellow-200">
                  <span className="text-yellow-400 mt-0.5">•</span>
                  <span>{action}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Opportunity Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Opportunities to Analyze */}
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Opportunities to Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {opportunities.slice(0, 10).map((opp) => (
                <div
                  key={opp.id}
                  onClick={() => handleAnalyzeOpp(opp)}
                  className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                    selectedOpp?.id === opp.id
                      ? 'bg-slate-800 border-blue-500/50'
                      : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="font-medium text-white text-sm mb-0.5">{opp.title}</div>
                  <div className="text-xs text-slate-500 flex justify-between">
                    <span>{opp.platform}</span>
                    <span className="text-slate-400">${opp.profit_estimate_high || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Detailed Analysis */}
        {selectedOpp && (
          <div className="space-y-3">
            {/* Risk Analysis */}
            {riskAnalysis && (
              <Card className={`border ${getRiskColor(riskAnalysis.risk_level)}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Risk Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Overall Risk Score</span>
                    <span className="font-bold text-lg">{riskAnalysis.overall_risk_score}/100</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Risk Level</span>
                    <span className="font-bold uppercase">{riskAnalysis.risk_level}</span>
                  </div>
                  {riskAnalysis.approval_required && (
                    <div className="bg-red-950/50 border border-red-500/30 rounded px-2 py-1 text-red-300">
                      ⚠️ Approval Required Before Execution
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Fraud Detection */}
            {fraudAnalysis && (
              <Card className={`border ${
                fraudAnalysis.fraud_level === 'low'
                  ? 'bg-emerald-950/30 border-emerald-500/30'
                  : fraudAnalysis.fraud_level === 'medium'
                  ? 'bg-amber-950/30 border-amber-500/30'
                  : 'bg-red-950/30 border-red-500/30'
              }`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Fraud Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Fraud Risk</span>
                    <span className="font-bold">{fraudAnalysis.fraud_risk_score}/100</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400">Recommendation</span>
                    <span className="font-bold uppercase">{fraudAnalysis.recommendation}</span>
                  </div>
                  {fraudAnalysis.signals.length > 0 && (
                    <div className="space-y-1 mt-2 pt-2 border-t border-slate-700">
                      {fraudAnalysis.signals.slice(0, 3).map((signal, idx) => (
                        <div key={idx} className="flex items-start gap-1.5">
                          <span className="text-red-400 mt-0.5">•</span>
                          <div>
                            <div className="font-medium capitalize">{signal.type.replace(/_/g, ' ')}</div>
                            <div className="text-slate-500 text-[9px]">{signal.details}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Risk Factors */}
            {riskAnalysis?.risk_factors && (
              <Card className="bg-slate-900/50 border-slate-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Risk Factors</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-xs">
                    {riskAnalysis.risk_factors.slice(0, 5).map((factor, idx) => (
                      <div key={idx} className="flex items-between justify-between py-1 border-b border-slate-800 last:border-0">
                        <span className="text-slate-400">{factor.recommendation}</span>
                        <span className="font-bold text-slate-300">{factor.score}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Risk Distribution Chart */}
      {dashboard.risk_distribution && (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Risk Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {['low', 'medium', 'high', 'critical'].map((level) => {
                const count = dashboard.risk_distribution[level] || 0;
                const total = dashboard.total_opportunities_reviewed || 1;
                const percentage = Math.round((count / total) * 100);
                const colors = {
                  low: 'bg-emerald-500',
                  medium: 'bg-amber-500',
                  high: 'bg-orange-500',
                  critical: 'bg-red-500'
                };

                return (
                  <div key={level} className="text-xs">
                    <div className="flex justify-between mb-1">
                      <span className="capitalize font-medium">{level} Risk</span>
                      <span className="text-slate-400">{count} ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full ${colors[level]}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}