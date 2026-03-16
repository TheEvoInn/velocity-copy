import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Play, Zap, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function OpportunityExecutionPanel({ opportunity, onStatusChange }) {
  const [expanded, setExpanded] = useState(false);

  // Fetch identities
  const { data: identities } = useQuery({
    queryKey: ['identities'],
    queryFn: async () => {
      const res = await base44.entities.AIIdentity.list();
      return res || [];
    }
  });

  // Execute mutation
  const executeMutation = useMutation({
    mutationFn: async (identityId) => {
      const res = await base44.functions.invoke('unifiedAutopilot', {
        action: 'execute_opportunity_end_to_end',
        opportunity_id: opportunity.id,
        force_identity_id: identityId
      });
      return res.data;
    },
    onSuccess: (data) => {
      onStatusChange?.();
    }
  });

  const canExecute = opportunity.url && opportunity.status === 'new';
  const isExecuting = opportunity.status === 'queued' || opportunity.status === 'executing';

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/50 hover:bg-slate-900/80 transition-colors"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-white flex items-center gap-2">
            {isExecuting && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
            {opportunity.status === 'submitted' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {!canExecute && !isExecuting && opportunity.status !== 'submitted' && (
              <AlertCircle className="w-4 h-4 text-amber-400" />
            )}
            Agent Execution
          </span>
          <span className="text-xs text-slate-400 capitalize">{opportunity.status}</span>
        </div>
      </button>

      {expanded && (
        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3 space-y-3">
          {/* Status Info */}
          <div className="text-xs space-y-1">
            <p className="text-slate-400">
              <span className="font-medium">Status:</span> {opportunity.status}
            </p>
            {opportunity.identity_name && (
              <p className="text-slate-400">
                <span className="font-medium">Identity:</span> {opportunity.identity_name}
              </p>
            )}
            {opportunity.task_execution_id && (
              <p className="text-slate-400">
                <span className="font-medium">Task ID:</span> {opportunity.task_execution_id.slice(0, 8)}...
              </p>
            )}
            {opportunity.confirmation_number && (
              <p className="text-emerald-400">
                <span className="font-medium">Confirmation:</span> {opportunity.confirmation_number}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          {canExecute && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 font-medium">Select Identity for Execution</p>
              <div className="grid gap-1 max-h-40 overflow-y-auto">
                {identities && identities.length > 0 ? (
                  identities.map(id => (
                    <Button
                      key={id.id}
                      size="sm"
                      variant="outline"
                      onClick={() => executeMutation.mutate(id.id)}
                      disabled={executeMutation.isPending}
                      className="justify-start text-xs h-8"
                    >
                      <Play className="w-3 h-3 mr-1.5" />
                      {id.name}
                      {id.is_active && <span className="ml-auto text-emerald-400 text-xs">Active</span>}
                    </Button>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">No identities available</p>
                )}
              </div>
            </div>
          )}

          {isExecuting && (
            <Card className="bg-blue-950/20 border-blue-900/30 p-2">
              <p className="text-xs text-blue-300">
                <Loader2 className="w-3 h-3 inline mr-1.5 animate-spin" />
                Agent Worker is processing this opportunity
              </p>
            </Card>
          )}

          {opportunity.status === 'submitted' && (
            <Card className="bg-emerald-950/20 border-emerald-900/30 p-2">
              <p className="text-xs text-emerald-300">
                <CheckCircle2 className="w-3 h-3 inline mr-1.5" />
                ✅ Application submitted successfully
              </p>
            </Card>
          )}

          {opportunity.status === 'failed' && (
            <Card className="bg-red-950/20 border-red-900/30 p-2">
              <p className="text-xs text-red-300">
                ❌ Execution failed. May require manual review.
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}