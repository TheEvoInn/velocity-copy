import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lightbulb, AlertCircle, Target, Zap, TrendingUp, Shield, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function InsightsDashboard() {
  const [expandedSection, setExpandedSection] = useState(null);

  // Fetch smart recommendations
  const { data: recommendations = {} } = useQuery({
    queryKey: ['smartRecommendations'],
    queryFn: async () => {
      const res = await base44.functions.invoke('insightsRecommendationEngine', {
        action: 'get_smart_recommendations',
        payload: { limit: 5 }
      });
      return res.data || {};
    },
    refetchInterval: 300000
  });

  // Fetch performance insights
  const { data: insights = {} } = useQuery({
    queryKey: ['performanceInsights'],
    queryFn: async () => {
      const res = await base44.functions.invoke('insightsRecommendationEngine', {
        action: 'get_performance_insights',
        payload: { days: 7 }
      });
      return res.data || {};
    }
  });

  // Fetch opportunity recommendations
  const { data: oppRecommendations = {} } = useQuery({
    queryKey: ['opportunityRecommendations'],
    queryFn: async () => {
      const res = await base44.functions.invoke('insightsRecommendationEngine', {
        action: 'get_opportunity_recommendations',
        payload: { limit: 5 }
      });
      return res.data || {};
    }
  });

  // Fetch active alerts
  const { data: alerts = {} } = useQuery({
    queryKey: ['activeAlerts'],
    queryFn: async () => {
      const res = await base44.functions.invoke('insightsRecommendationEngine', {
        action: 'get_active_alerts',
        payload: {}
      });
      return res.data || {};
    },
    refetchInterval: 60000
  });

  // Fetch optimization opportunities
  const { data: optimizations = {} } = useQuery({
    queryKey: ['optimizationOpportunities'],
    queryFn: async () => {
      const res = await base44.functions.invoke('insightsRecommendationEngine', {
        action: 'get_optimization_opportunities',
        payload: {}
      });
      return res.data || {};
    }
  });

  // Fetch risk mitigation strategies
  const { data: strategies = {} } = useQuery({
    queryKey: ['riskMitigationStrategies'],
    queryFn: async () => {
      const res = await base44.functions.invoke('insightsRecommendationEngine', {
        action: 'get_risk_mitigation_strategies',
        payload: {}
      });
      return res.data || {};
    }
  });

  const handleAcknowledgeAlert = async (alertId) => {
    await base44.functions.invoke('insightsRecommendationEngine', {
      action: 'acknowledge_alert',
      payload: { alert_id: alertId }
    });
    toast.success('Alert acknowledged');
  };

  const getPriorityColor = (priority) => {
    if (priority === 'high') return 'border-red-500/30 bg-red-950/20';
    if (priority === 'medium') return 'border-amber-500/30 bg-amber-950/20';
    return 'border-blue-500/30 bg-blue-950/20';
  };

  const getAlertSeverityColor = (severity) => {
    if (severity === 'critical') return 'bg-red-950/30 border-red-500/30 text-red-400';
    if (severity === 'warning') return 'bg-amber-950/30 border-amber-500/30 text-amber-400';
    return 'bg-blue-950/30 border-blue-500/30 text-blue-400';
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <h2 className="text-lg font-bold text-white">Intelligent Insights & Recommendations</h2>

      {/* Active Alerts */}
      {alerts.total_active > 0 && (
        <Card className={`${getAlertSeverityColor(alerts.alerts?.[0]?.severity)} border`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Active Alerts ({alerts.total_active})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.alerts?.slice(0, 3).map((alert, idx) => (
              <div key={idx} className="text-sm space-y-1">
                <div className="font-medium">{alert.message}</div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleAcknowledgeAlert(alert.id)}
                  className="text-xs h-7 mt-1"
                >
                  Acknowledge
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Smart Recommendations */}
      {recommendations.recommendations && recommendations.recommendations.length > 0 && (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader
            className="pb-3 cursor-pointer"
            onClick={() => setExpandedSection(expandedSection === 'recommendations' ? null : 'recommendations')}
          >
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-yellow-400" />
              Smart Recommendations ({recommendations.total_recommendations})
            </CardTitle>
          </CardHeader>
          {expandedSection === 'recommendations' && (
            <CardContent className="space-y-3">
              {recommendations.recommendations.map((rec, idx) => (
                <div key={idx} className={`p-3 rounded-lg border ${getPriorityColor(rec.priority)}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-medium text-white text-sm">{rec.title}</div>
                      <div className="text-xs text-slate-400 mt-1">{rec.description}</div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded whitespace-nowrap ${
                      rec.priority === 'high' ? 'bg-red-900/30 text-red-400' : 'bg-amber-900/30 text-amber-400'
                    }`}>
                      {rec.priority}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-emerald-400">📈 {rec.potential_impact}</div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 w-full mt-2"
                    >
                      {rec.action}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* Performance Insights */}
      {insights.insights && insights.insights.length > 0 && (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader
            className="pb-3 cursor-pointer"
            onClick={() => setExpandedSection(expandedSection === 'insights' ? null : 'insights')}
          >
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Performance Insights (Last 7 Days)
            </CardTitle>
          </CardHeader>
          {expandedSection === 'insights' && (
            <CardContent className="space-y-2">
              {insights.insights.map((insight, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/50">
                  <div className="flex items-start gap-2">
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${
                      insight.actionable ? 'bg-amber-500' : 'bg-emerald-500'
                    }`} />
                    <div className="flex-1">
                      <div className="text-sm text-white">{insight.insight}</div>
                      {insight.actionable && (
                        <div className="text-xs text-amber-400 mt-1">⚠️ Action required</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* Opportunity Recommendations */}
      {oppRecommendations.opportunities && oppRecommendations.opportunities.length > 0 && (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader
            className="pb-3 cursor-pointer"
            onClick={() => setExpandedSection(expandedSection === 'opportunities' ? null : 'opportunities')}
          >
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-400" />
              Recommended Opportunities ({oppRecommendations.total_recommended})
            </CardTitle>
          </CardHeader>
          {expandedSection === 'opportunities' && (
            <CardContent className="space-y-2 max-h-96 overflow-y-auto">
              {oppRecommendations.opportunities.map((opp, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/50">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-white text-sm">{opp.title}</div>
                      <div className="text-xs text-slate-500">{opp.platform} • {opp.category}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-400 text-sm">{opp.match_score.toFixed(0)}%</div>
                      <div className="text-xs text-slate-500">match</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500">ROI:</span>
                      <span className="ml-1 font-bold text-amber-400">{opp.roi_pct.toFixed(0)}%</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Speed:</span>
                      <span className="ml-1 font-bold text-blue-400">{opp.velocity_score}/100</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Risk:</span>
                      <span className="ml-1 font-bold text-rose-400">{opp.risk_score}/100</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* Optimization Opportunities */}
      {optimizations.optimizations && optimizations.optimizations.length > 0 && (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader
            className="pb-3 cursor-pointer"
            onClick={() => setExpandedSection(expandedSection === 'optimization' ? null : 'optimization')}
          >
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" />
              Optimization Opportunities ({optimizations.total_optimizations})
            </CardTitle>
          </CardHeader>
          {expandedSection === 'optimization' && (
            <CardContent className="space-y-2">
              {optimizations.optimizations.map((opt, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-purple-950/20 border border-purple-500/30">
                  <div className="font-medium text-white text-sm mb-1">{opt.title}</div>
                  <div className="text-xs text-slate-400 mb-2">{opt.description}</div>
                  <div className="text-xs text-emerald-400">💰 {opt.potential_impact}</div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* Risk Mitigation Strategies */}
      {strategies.strategies && strategies.strategies.length > 0 && (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader
            className="pb-3 cursor-pointer"
            onClick={() => setExpandedSection(expandedSection === 'strategies' ? null : 'strategies')}
          >
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-orange-400" />
              Risk Mitigation Strategies ({strategies.total_strategies})
            </CardTitle>
          </CardHeader>
          {expandedSection === 'strategies' && (
            <CardContent className="space-y-3">
              {strategies.strategies.map((strat, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-orange-950/20 border border-orange-500/30">
                  <div className="font-medium text-white text-sm mb-2">{strat.strategy}</div>
                  <div className="text-xs text-slate-400 mb-2">{strat.description}</div>
                  <div className="space-y-1">
                    {strat.action_items?.map((action, aIdx) => (
                      <div key={aIdx} className="text-xs text-slate-500 pl-3 border-l border-orange-500/30">
                        • {action}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}