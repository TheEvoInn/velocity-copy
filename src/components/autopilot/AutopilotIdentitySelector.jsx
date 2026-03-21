import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader, CheckCircle2, AlertCircle, Zap, GitBranch } from 'lucide-react';
import { toast } from 'sonner';

/**
 * AutopilotIdentitySelector
 * 
 * Integrates intelligent identity routing into autopilot execution.
 * Automatically selects and uses the best identity for each queued task.
 */

export default function AutopilotIdentitySelector({ opportunities = [], onTasksQueued, autoExecute = false }) {
  const [processingQueue, setProcessingQueue] = useState([]);
  const [processedCount, setProcessedCount] = useState(0);

  // Get recommendations for all opportunities
  const { data: recommendations = {}, isLoading } = useQuery({
    queryKey: ['autopilotRecommendations', opportunities.map(o => o.id).join(',')],
    queryFn: async () => {
      if (!opportunities.length) return {};

      const recs = {};
      for (const opp of opportunities) {
        try {
          const res = await base44.functions.invoke('intelligentIdentityRouter', {
            action: 'recommend_identity',
            opportunity: opp
          });
          recs[opp.id] = res.data;
        } catch (err) {
          console.error(`Failed to get recommendation for ${opp.id}:`, err);
          recs[opp.id] = null;
        }
      }
      return recs;
    },
    enabled: opportunities.length > 0,
    staleTime: 60000
  });

  // Queue task mutation
  const queueMutation = useMutation({
    mutationFn: async (opp) => {
      const rec = recommendations[opp.id];
      if (!rec?.recommended_identity_id) {
        throw new Error('No identity recommendation available');
      }

      // Switch and queue via intelligent router
      const res = await base44.functions.invoke('intelligentIdentityRouter', {
        action: 'switch_and_queue',
        opportunity: opp,
        identity_id: rec.recommended_identity_id
      });

      return { opp, rec, task: res.data };
    },
    onSuccess: (result) => {
      setProcessedCount(prev => prev + 1);
      toast.success(`✓ Queued: ${result.opp.title} (${result.rec.recommended_identity?.name})`);
    },
    onError: (error) => {
      toast.error(`Failed to queue task: ${error.message}`);
    }
  });

  // Auto-process queue
  useEffect(() => {
    if (!autoExecute || isLoading || !Object.keys(recommendations).length) return;

    const unprocessed = opportunities.filter(opp => !processingQueue.includes(opp.id));
    if (unprocessed.length === 0) {
      if (onTasksQueued) {
        onTasksQueued(processedCount);
      }
      return;
    }

    // Process first unprocessed opportunity
    const nextOpp = unprocessed[0];
    setProcessingQueue(prev => [...prev, nextOpp.id]);

    // Small delay before queuing to avoid rate limits
    const timer = setTimeout(() => {
      queueMutation.mutate(nextOpp);
    }, 500);

    return () => clearTimeout(timer);
  }, [autoExecute, isLoading, recommendations, opportunities, processingQueue, processedCount, onTasksQueued]);

  if (!opportunities.length) {
    return (
      <Card className="bg-slate-900/40 border-slate-800 p-6 text-center">
        <p className="text-sm text-slate-500">No opportunities to process</p>
      </Card>
    );
  }

  const processedOpps = processingQueue.length;
  const progress = Math.round((processedCount / opportunities.length) * 100);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card className="bg-gradient-to-r from-violet-950/40 to-slate-900/60 border-violet-500/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-violet-400" />
            <span className="font-semibold text-white text-sm">Autopilot Identity Selection</span>
          </div>
          {isLoading && <Loader className="w-4 h-4 text-violet-400 animate-spin" />}
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">Processing queue</span>
            <span className="text-xs font-semibold text-white">{processedCount}/{opportunities.length}</span>
          </div>
          <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-violet-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Status */}
        <div className="text-xs text-slate-400">
          {isLoading && 'Analyzing opportunities for best identity match...'}
          {!isLoading && processedCount < opportunities.length && `Ready to queue ${opportunities.length - processedCount} tasks`}
          {processedCount === opportunities.length && 'All tasks queued ✓'}
        </div>
      </Card>

      {/* Opportunities with Recommendations */}
      <div className="space-y-2">
        {opportunities.map((opp) => {
          const rec = recommendations[opp.id];
          const isProcessed = processingQueue.includes(opp.id);
          const isQueued = isProcessed;

          return (
            <Card key={opp.id} className={`p-3 transition-colors ${
              rec ? 'bg-slate-900/50 border-slate-800 hover:border-slate-700' : 'bg-slate-900/30 border-slate-800/50'
            }`}>
              <div className="flex items-center gap-3">
                {/* Status Icon */}
                <div className="shrink-0">
                  {isProcessed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : rec ? (
                    <GitBranch className="w-4 h-4 text-violet-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-slate-600" />
                  )}
                </div>

                {/* Opportunity Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{opp.title}</p>
                  <p className="text-[10px] text-slate-500">{opp.platform} · {opp.category}</p>
                </div>

                {/* Recommendation */}
                {rec && (
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-[10px] font-semibold text-white">{rec.recommended_identity?.name}</p>
                      <p className={`text-[9px] ${rec.fit_score >= 80 ? 'text-emerald-400' : rec.fit_score >= 70 ? 'text-blue-400' : 'text-amber-400'}`}>
                        Fit: {rec.fit_score}%
                      </p>
                    </div>
                    {!isProcessed && (
                      <Button
                        onClick={() => queueMutation.mutate(opp)}
                        disabled={queueMutation.isPending}
                        size="sm"
                        className="bg-violet-600 hover:bg-violet-500 text-white text-[10px] h-6 px-2"
                      >
                        Queue
                      </Button>
                    )}
                  </div>
                )}

                {!rec && (
                  <span className="text-[10px] text-slate-500">Analyzing...</span>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Summary */}
      {processedCount > 0 && (
        <Card className="bg-emerald-950/30 border-emerald-500/30 p-3">
          <div className="text-xs text-emerald-400">
            ✓ {processedCount} task{processedCount !== 1 ? 's' : ''} queued with optimal identities
          </div>
        </Card>
      )}
    </div>
  );
}