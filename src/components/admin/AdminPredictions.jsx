import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, TrendingUp, Brain, AlertTriangle, Zap } from 'lucide-react';

export default function AdminPredictions() {
  const { data: mlReport = {}, isLoading } = useQuery({
    queryKey: ['mlPredictions'],
    queryFn: async () => {
      const res = await base44.functions.invoke('predictiveMLEngine', {
        action: 'generate_ml_report'
      });
      return res.data;
    },
    refetchInterval: 3600000 // 1 hour
  });

  const summary = mlReport.summary || {};
  const anomalies = mlReport.anomalies || [];
  const recommendations = mlReport.recommendations || [];
  const topOpps = mlReport.top_opportunities || [];

  const getSeverityColor = (severity) => {
    switch(severity) {
      case 'critical': return 'bg-red-950 border-red-700 text-red-400';
      case 'high': return 'bg-orange-950 border-orange-700 text-orange-400';
      case 'medium': return 'bg-amber-950 border-amber-700 text-amber-400';
      default: return 'bg-blue-950 border-blue-700 text-blue-400';
    }
  };

  const getRecommendationBadge = (reason) => {
    switch(reason) {
      case 'excellent_fit': return 'bg-emerald-600';
      case 'good_fit': return 'bg-blue-600';
      default: return 'bg-slate-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500 mb-1">Avg Success Rate</p>
            <p className="text-2xl font-bold text-cyan-400">{summary.avg_success_probability || 0}%</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500 mb-1">High Priority</p>
            <p className="text-2xl font-bold text-emerald-400">{summary.high_priority_count || 0}</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500 mb-1">Avg ROI Est.</p>
            <p className="text-2xl font-bold text-amber-400">{summary.avg_roi_estimate || 0}%</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-4">
            <p className="text-xs text-slate-500 mb-1">Analyzed</p>
            <p className="text-2xl font-bold text-violet-400">{summary.total_opportunities_analyzed || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Behavioral Anomalies */}
      {anomalies.length > 0 && (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" /> Behavioral Anomalies
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {anomalies.map((anom, idx) => (
              <div key={idx} className={`p-3 rounded border text-xs ${getSeverityColor(anom.severity)}`}>
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-bold capitalize">{anom.type.replace(/_/g, ' ')}</p>
                    <p className="text-xs opacity-75 mt-1">{anom.details}</p>
                    <p className="text-xs opacity-60 mt-1 italic">{anom.recommendation}</p>
                  </div>
                  <Badge className={
                    anom.severity === 'critical' ? 'bg-red-600' :
                    anom.severity === 'high' ? 'bg-orange-600' :
                    'bg-amber-600'
                  }>
                    {anom.severity}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Top Scoring Opportunities */}
      {topOpps.length > 0 && (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" /> Top Scored Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topOpps.map((opp, idx) => (
                <div key={idx} className="flex items-start justify-between p-2 rounded bg-slate-800/50 border border-slate-700">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{opp.title}</p>
                    <p className="text-xs text-slate-400">{opp.category}</p>
                  </div>
                  <div className="flex gap-2 ml-2 flex-shrink-0">
                    <Badge className="bg-cyan-600 text-xs">{opp.success_probability}% success</Badge>
                    <Badge className={opp.recommendation === 'high_priority' ? 'bg-emerald-600 text-xs' : 'bg-slate-600 text-xs'}>
                      {opp.recommendation}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="w-4 h-4 text-violet-400" /> Personalized Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start justify-between p-2 rounded bg-slate-800/50 border border-slate-700">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{rec.title}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">{rec.category}</Badge>
                      {rec.capital_required && (
                        <Badge variant="outline" className="text-xs">${rec.capital_required}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2 flex-shrink-0">
                    <Badge className={getRecommendationBadge(rec.recommendation_reason)}>
                      {rec.user_match_score}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="text-xs text-slate-500">
        Last updated: {mlReport.timestamp ? new Date(mlReport.timestamp).toLocaleString() : 'N/A'}
      </div>
    </div>
  );
}