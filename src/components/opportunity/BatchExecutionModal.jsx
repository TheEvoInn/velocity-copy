import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Play, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function BatchExecutionModal({ opportunities, onClose, onSuccess }) {
  const [selectedCount, setSelectedCount] = useState(5);

  const executeMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('unifiedAutopilot', {
        action: 'batch_execute_opportunities',
        filter_criteria: {
          status: 'new',
          auto_execute: true
        },
        max_count: selectedCount
      });
      return res.data;
    },
    onSuccess: (data) => {
      onSuccess?.(data);
    }
  });

  const newOppsCount = opportunities?.filter(o => o.status === 'new').length || 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="bg-slate-900 border-slate-700 max-w-md w-full p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Batch Execute Opportunities</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info */}
        <div className="bg-blue-950/20 border border-blue-900/30 rounded-lg p-3">
          <p className="text-sm text-blue-300">
            🤖 Queue multiple opportunities for autonomous execution. The Autopilot will handle agent dispatch, proposal generation, and form submission.
          </p>
        </div>

        {/* Count Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-white">
            Opportunities to Execute
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="1"
              max={newOppsCount}
              value={selectedCount}
              onChange={(e) => setSelectedCount(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-lg font-bold text-emerald-400 w-12 text-right">
              {selectedCount}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {newOppsCount} new opportunities available
          </p>
        </div>

        {/* Stats */}
        <div className="bg-slate-950/50 rounded-lg p-3 space-y-1">
          <p className="text-xs text-slate-400">
            <span className="font-medium">Status Breakdown:</span>
          </p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="text-slate-500">New</p>
              <p className="text-white font-semibold">{newOppsCount}</p>
            </div>
            <div>
              <p className="text-slate-500">Est. Value</p>
              <p className="text-emerald-400 font-semibold">
                ${opportunities
                  ?.filter(o => o.status === 'new')
                  .slice(0, selectedCount)
                  .reduce((sum, o) => sum + (o.profit_estimate_high || 0), 0)
                  .toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Avg Score</p>
              <p className="text-white font-semibold">
                {Math.round(
                  opportunities
                    ?.filter(o => o.status === 'new')
                    .slice(0, selectedCount)
                    .reduce((sum, o) => sum + (o.overall_score || 50), 0) / selectedCount
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={executeMutation.isPending}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={() => executeMutation.mutate()}
            disabled={executeMutation.isPending}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
          >
            {executeMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Queuing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Execute {selectedCount}
              </>
            )}
          </Button>
        </div>

        {/* Results */}
        {executeMutation.data && (
          <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-lg p-3">
            <p className="text-sm text-emerald-300">
              ✅ {executeMutation.data.queued} opportunities queued for execution
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}