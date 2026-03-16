import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, Zap, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function OpportunityAnalysisPanel() {
  const [analysisResults, setAnalysisResults] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const queryClient = useQueryClient();

  // Run deep analysis
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      setIsAnalyzing(true);
      const res = await base44.functions.invoke('advancedScanningEngine', {
        action: 'analyze_all_opportunities',
        payload: {}
      });
      return res.data;
    },
    onSuccess: (data) => {
      setAnalysisResults(data);
      toast.success(`✓ Analysis complete: ${data.updated_count} opportunities analyzed`);
      setIsAnalyzing(false);
    },
    onError: (error) => {
      toast.error(`Analysis failed: ${error.message}`);
      setIsAnalyzing(false);
    }
  });

  return (
    <div className="space-y-3">
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-400" />
            Deep Opportunity Analysis
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1">Detect requirements, KYC needs, and success probability</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={() => analyzeMutation.mutate()}
            disabled={isAnalyzing || analyzeMutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm h-9"
          >
            {isAnalyzing || analyzeMutation.isPending ? (
              <>
                <div className="w-3 h-3 border-2 border-blue-300/30 border-t-blue-300 rounded-full animate-spin mr-2" />
                Analyzing Opportunities...
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 mr-2" />
                Run Deep Analysis
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {analysisResults && (
        <div className="space-y-3">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-slate-800/50 p-3 border border-slate-700">
              <div className="text-slate-400">Total Analyzed</div>
              <div className="text-xl font-bold text-white mt-1">{analysisResults.total_analyzed}</div>
            </div>
            <div className="rounded-lg bg-slate-800/50 p-3 border border-slate-700">
              <div className="text-slate-400">High Priority</div>
              <div className="text-xl font-bold text-emerald-400 mt-1">{analysisResults.highest_priority.length}</div>
            </div>
          </div>

          {/* Highest Priority Opportunities */}
          {analysisResults.highest_priority && analysisResults.highest_priority.length > 0 && (
            <Card className="bg-slate-900/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-emerald-400" />
                  Top Priority ({analysisResults.highest_priority.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-xs">
                  {analysisResults.highest_priority.slice(0, 5).map((opp) => (
                    <div key={opp.id} className="flex items-center justify-between p-2 rounded bg-slate-800/50 border border-slate-700">
                      <div className="flex-1">
                        <div className="font-medium text-slate-300 truncate">{opp.title}</div>
                        <div className="text-slate-500 text-[10px] mt-0.5">
                          Score: {opp.score}/100 • Urgency: {opp.urgency}/10
                        </div>
                      </div>
                      <div className="text-right ml-2">
                        <div className="text-emerald-400 font-bold">{opp.urgency}</div>
                        <div className="text-slate-500 text-[9px]">urgency</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Category Breakdown */}
          {analysisResults.by_category && Object.keys(analysisResults.by_category).length > 0 && (
            <Card className="bg-slate-900/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Success Rates by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-xs">
                  {Object.entries(analysisResults.by_category)
                    .sort(([, a], [, b]) => b.avg_success - a.avg_success)
                    .slice(0, 5)
                    .map(([category, stats]) => (
                      <div key={category} className="flex items-center justify-between p-2 rounded bg-slate-800/50 border border-slate-700">
                        <div>
                          <div className="capitalize font-medium text-slate-300">{category}</div>
                          <div className="text-slate-500 text-[10px]">{stats.count} opportunities</div>
                        </div>
                        <div className="text-right">
                          <div className="text-emerald-400 font-bold">{stats.avg_success}%</div>
                          <div className="text-slate-500 text-[9px]">avg success</div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}