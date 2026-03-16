import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Search, BarChart3, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function AdvancedResearchPanel() {
  const [scanResults, setScanResults] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const queryClient = useQueryClient();

  // Run advanced research scan
  const scanMutation = useMutation({
    mutationFn: async () => {
      setIsScanning(true);
      const res = await base44.functions.invoke('opportunityIngestionV2', {
        action: 'advanced_scan_all_sources',
        payload: {}
      });
      return res.data;
    },
    onSuccess: (data) => {
      setScanResults(data);
      toast.success(`✓ Scan complete: ${data.total_opportunities_found} opportunities from 6 sources`);
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      setIsScanning(false);
    },
    onError: (error) => {
      toast.error(`Scan failed: ${error.message}`);
      setIsScanning(false);
    }
  });

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Search className="w-4 h-4 text-emerald-400" />
            Advanced Research Engine
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1">Multi-source opportunity discovery with predictive scoring</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg bg-slate-800/50 p-3 border border-slate-700">
              <div className="text-slate-400 mb-1">Scanning Sources</div>
              <div className="text-white font-medium">6 Platforms</div>
              <div className="text-slate-500 text-xs mt-1">Freelance • Grants • Contests • Microtasks • Affiliate • Beta</div>
            </div>
            <div className="rounded-lg bg-slate-800/50 p-3 border border-slate-700">
              <div className="text-slate-400 mb-1">Analysis</div>
              <div className="text-white font-medium">Predictive Scoring</div>
              <div className="text-slate-500 text-xs mt-1">Velocity • Profit • Risk • Deadline</div>
            </div>
          </div>

          <Button
            onClick={() => scanMutation.mutate()}
            disabled={isScanning || scanMutation.isPending}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm h-9"
          >
            {isScanning || scanMutation.isPending ? (
              <>
                <div className="w-3 h-3 border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin mr-2" />
                Scanning Sources...
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 mr-2" />
                Run Advanced Scan
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {scanResults && (
        <div className="space-y-3">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="rounded-lg bg-slate-800/50 p-3 border border-slate-700">
              <div className="text-slate-400">Total Found</div>
              <div className="text-xl font-bold text-white mt-1">{scanResults.total_opportunities_found}</div>
              <div className="text-emerald-400 text-xs mt-1">new opportunities</div>
            </div>
            <div className="rounded-lg bg-slate-800/50 p-3 border border-slate-700">
              <div className="text-slate-400">New Added</div>
              <div className="text-xl font-bold text-white mt-1">{scanResults.total_new_opportunities}</div>
              <div className="text-slate-500 text-xs mt-1">to database</div>
            </div>
            <div className="rounded-lg bg-slate-800/50 p-3 border border-slate-700">
              <div className="text-slate-400">Duplicates Removed</div>
              <div className="text-xl font-bold text-white mt-1">{scanResults.deduplication_stats.duplicates_removed || 0}</div>
              <div className="text-amber-400 text-xs mt-1">consolidated</div>
            </div>
            <div className="rounded-lg bg-slate-800/50 p-3 border border-slate-700">
              <div className="text-slate-400">Avg Score</div>
              <div className="text-xl font-bold text-white mt-1">{scanResults.predictive_analysis.average_score || 0}</div>
              <div className="text-blue-400 text-xs mt-1">quality metric</div>
            </div>
          </div>

          {/* Source Breakdown */}
          <Card className="bg-slate-900/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                Source Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-xs">
                {Object.entries(scanResults.sources || {}).map(([source, data]) => (
                  <div key={source} className="flex items-center justify-between p-2 rounded bg-slate-800/50 border border-slate-700">
                    <div className="capitalize font-medium text-slate-300">{source.replace(/_/g, ' ')}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold">{data.count || 0}</span>
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Scoring by Category */}
          {scanResults.predictive_analysis?.by_category && (
            <Card className="bg-slate-900/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Scoring by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-xs">
                  {Object.entries(scanResults.predictive_analysis.by_category || {})
                    .sort(([, a], [, b]) => (b.avg_score || 0) - (a.avg_score || 0))
                    .slice(0, 5)
                    .map(([category, stats]) => (
                      <div key={category} className="flex items-center justify-between p-2 rounded bg-slate-800/50 border border-slate-700">
                        <div>
                          <div className="capitalize font-medium text-slate-300">{category}</div>
                          <div className="text-slate-500">{stats.count} opportunities</div>
                        </div>
                        <div className="text-right">
                          <div className="text-white font-bold">{Math.round(stats.avg_score)}/100</div>
                          <div className="text-emerald-400 text-xs">avg score</div>
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