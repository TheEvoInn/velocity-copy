import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Zap, CheckCircle2, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function OpportunityAutoQueuePanel() {
  const queryClient = useQueryClient();

  // Get queue status
  const { data: queueStatus = {}, refetch: refetchStatus } = useQuery({
    queryKey: ['opportunityQueueStatus'],
    queryFn: async () => {
      const res = await base44.functions.invoke('opportunityAutoQueue', {
        action: 'get_queue_status'
      });
      return res.data?.queue_status || {};
    },
    refetchInterval: 30000
  });

  // Get new opportunities
  const { data: newOpps = [] } = useQuery({
    queryKey: ['newOpportunities'],
    queryFn: () => base44.entities.Opportunity.filter({
      status: 'new',
      auto_execute: true
    }, '-overall_score', 20),
    refetchInterval: 60000
  });

  // Auto-queue new opportunities
  const autoQueueMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('opportunityAutoQueue', {
        action: 'auto_queue_new_opportunities'
      });
      return res.data;
    },
    onSuccess: (data) => {
      if (data.queued_count > 0) {
        toast.success(`Queued ${data.queued_count} opportunity(ies)`);
        queryClient.invalidateQueries({ queryKey: ['opportunityQueueStatus'] });
        queryClient.invalidateQueries({ queryKey: ['newOpportunities'] });
      } else {
        toast.info('No new opportunities to queue');
      }
      refetchStatus();
    },
    onError: (err) => toast.error(`Queueing failed: ${err.message}`)
  });

  return (
    <Card className="bg-slate-900 border-slate-800 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Plus className="w-5 h-5 text-blue-400" />
          Opportunity Auto-Queue
        </h3>
        <Button
          onClick={() => autoQueueMutation.mutate()}
          disabled={autoQueueMutation.isPending || newOpps.length === 0}
          size="sm"
          className="bg-blue-600 hover:bg-blue-500 text-white gap-2"
        >
          <Zap className="w-4 h-4" />
          {autoQueueMutation.isPending ? 'Queuing...' : `Queue ${newOpps.length} New`}
        </Button>
      </div>

      {/* Queue Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-500 uppercase">In Queue</p>
          <p className="text-2xl font-bold text-white mt-1">{queueStatus.total_queued || 0}</p>
        </div>

        <div className="bg-amber-950/20 rounded-lg p-3 border border-amber-900/30">
          <p className="text-xs text-amber-300 uppercase">High Priority</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{queueStatus.high_priority || 0}</p>
        </div>

        <div className="bg-emerald-950/20 rounded-lg p-3 border border-emerald-900/30">
          <p className="text-xs text-emerald-300 uppercase">Estimated Value</p>
          <p className="text-lg font-bold text-emerald-400 mt-1">${(queueStatus.total_estimated_value || 0).toLocaleString()}</p>
        </div>

        <div className="bg-violet-950/20 rounded-lg p-3 border border-violet-900/30">
          <p className="text-xs text-violet-300 uppercase">Completed Today</p>
          <p className="text-2xl font-bold text-violet-400 mt-1">{queueStatus.completed_today || 0}</p>
        </div>
      </div>

      {/* New Opportunities Preview */}
      {newOpps.length > 0 && (
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <h4 className="text-sm font-semibold text-white mb-3">Ready to Queue ({newOpps.length})</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {newOpps.slice(0, 5).map(opp => (
              <div key={opp.id} className="flex items-start justify-between p-2 bg-slate-700/30 rounded border border-slate-700/50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{opp.title}</p>
                  <p className="text-xs text-slate-400">{opp.platform} · Score: {opp.overall_score || 0}</p>
                </div>
                <span className="text-xs font-semibold text-emerald-400 ml-2 shrink-0">
                  ${opp.profit_estimate_high || 0}
                </span>
              </div>
            ))}
            {newOpps.length > 5 && (
              <p className="text-xs text-slate-500 text-center py-2">+{newOpps.length - 5} more</p>
            )}
          </div>
        </div>
      )}

      {newOpps.length === 0 && (
        <div className="bg-slate-800/30 rounded-lg p-8 text-center border border-slate-700">
          <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No new opportunities to queue</p>
          <p className="text-xs text-slate-600 mt-1">Discoveries will appear here automatically</p>
        </div>
      )}

      {/* Auto-Queue Explanation */}
      <div className="mt-4 p-3 bg-slate-800/50 rounded border border-slate-700">
        <div className="flex gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-400">
            <strong className="text-white">Auto-Queueing:</strong> New opportunities with <code className="text-slate-300 bg-slate-700 px-1 py-0.5 rounded">auto_execute: true</code> are automatically added to the task queue when discovered.
          </p>
        </div>
      </div>
    </Card>
  );
}