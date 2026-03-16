import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Loader2, CheckCircle2, AlertCircle, FileText, Zap, Clock, DollarSign, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function OpportunityExecutionHub({ opportunity, onClose }) {
  const [activeTab, setActiveTab] = useState('details');
  const [logs, setLogs] = useState([]);
  const [proposalGen, setProposalGen] = useState(null);
  const qc = useQueryClient();

  const executeMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('agentWorker', { 
        action: 'execute_opportunity',
        opportunity_id: opportunity.id 
      });
      return res?.data;
    },
    onSuccess: (data) => {
      setLogs(prev => [...prev, { timestamp: new Date().toISOString(), status: 'completed', message: data?.message || 'Execution completed' }]);
      qc.invalidateQueries({ queryKey: ['opportunities'] });
    }
  });

  const generateProposalMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('proposalEngine', {
        action: 'generate',
        opportunity_id: opportunity.id
      });
      return res?.data;
    },
    onSuccess: (data) => {
      setProposalGen(data);
      setActiveTab('proposal');
    }
  });

  const queueTaskMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('opportunityExecutor', {
        action: 'queue_task',
        opportunity_id: opportunity.id
      });
      return res?.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opportunities'] });
      setLogs(prev => [...prev, { timestamp: new Date().toISOString(), status: 'queued', message: 'Task queued for execution' }]);
    }
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
          <div className="flex-1">
            <CardTitle className="text-white">{opportunity?.title || 'Execution Hub'}</CardTitle>
            <p className="text-xs text-slate-400 mt-1">{opportunity?.platform}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </CardHeader>

        <CardContent className="space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 bg-slate-800">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="proposal">Proposal</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-3 mt-4">
              <div className="bg-slate-800 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Status:</span>
                  <span className="text-white capitalize">{opportunity?.status}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Category:</span>
                  <span className="text-white capitalize">{opportunity?.category}</span>
                </div>
                {opportunity?.profit_estimate_high && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Est. Profit:</span>
                    <span className="text-emerald-400">${opportunity.profit_estimate_low}-${opportunity.profit_estimate_high}</span>
                  </div>
                )}
                {opportunity?.deadline && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Deadline:</span>
                    <span className="text-white">{new Date(opportunity.deadline).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {opportunity?.description && (
                <div className="bg-slate-800 rounded-lg p-3">
                  <p className="text-xs text-slate-400 mb-1">Description</p>
                  <p className="text-sm text-slate-200">{opportunity.description}</p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={() => generateProposalMutation.mutate()}
                  disabled={generateProposalMutation.isPending}
                  className="flex-1 bg-violet-600 hover:bg-violet-500 gap-2 h-9">
                  {generateProposalMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                  Generate Proposal
                </Button>
                <Button 
                  onClick={() => queueTaskMutation.mutate()}
                  disabled={queueTaskMutation.isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 gap-2 h-9">
                  {queueTaskMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
                  Queue Task
                </Button>
                <Button 
                  onClick={() => executeMutation.mutate()}
                  disabled={executeMutation.isPending}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 gap-2 h-9">
                  {executeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  Execute Now
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="proposal" className="mt-4">
              {proposalGen ? (
                <div className="bg-slate-800 rounded-lg p-4 space-y-3">
                  <div className="text-sm text-slate-300 max-h-64 overflow-y-auto">
                    {proposalGen?.proposal_text || proposalGen?.content || 'Proposal generated'}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => navigator.clipboard.writeText(proposalGen?.proposal_text || '')}
                      variant="outline" 
                      size="sm"
                      className="text-xs">
                      Copy Proposal
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <p className="text-sm">Generate a proposal first</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="logs" className="mt-4">
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {logs.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">No execution logs yet</p>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="bg-slate-800 rounded-lg p-2 text-xs flex items-start gap-2">
                      <Circle className={`w-3 h-3 shrink-0 mt-0.5 ${
                        log.status === 'completed' ? 'fill-emerald-500 text-emerald-500' :
                        log.status === 'error' ? 'fill-red-500 text-red-500' :
                        'fill-blue-500 text-blue-500'
                      }`} />
                      <div className="flex-1">
                        <p className="text-slate-300">{log.message}</p>
                        <p className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}