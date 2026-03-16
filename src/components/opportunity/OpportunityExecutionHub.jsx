import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  X, Play, Zap, Bot, AlertTriangle, CheckCircle2,
  Clock, Link2, User, Cpu, FileText, Copy, ExternalLink,
  Sparkles, TrendingUp, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

export default function OpportunityExecutionHub({ opportunity, onClose }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview'); // overview | execution | proposal
  const [executionLog, setExecutionLog] = useState([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [proposalContent, setProposalContent] = useState(null);
  const [copiedProposal, setCopiedProposal] = useState(false);

  // Update opportunity status
  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Opportunity.update(opportunity.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['opportunities'] })
  });

  // Send to Autopilot
  const sendToAutopilotMutation = useMutation({
    mutationFn: async () => {
      // Create task in queue
      const task = await base44.entities.TaskExecutionQueue.create({
        opportunity_id: opportunity.id,
        url: opportunity.url,
        opportunity_type: opportunity.opportunity_type,
        platform: opportunity.platform,
        identity_id: opportunity.identity_id,
        status: 'queued',
        priority: 80,
        estimated_value: opportunity.profit_estimate_high,
        deadline: opportunity.deadline
      });

      // Update opportunity
      await updateMutation.mutateAsync({
        status: 'queued',
        task_execution_id: task.id
      });

      return task;
    },
    onSuccess: (task) => {
      toast.success(`Queued for Autopilot execution (${task.id})`);
      setExecutionLog([
        { timestamp: new Date().toISOString(), action: 'Task created', status: 'success' },
        { timestamp: new Date().toISOString(), action: 'Queued for Autopilot', status: 'success' },
        ...executionLog
      ]);
    },
    onError: (error) => {
      toast.error(`Queue failed: ${error.message}`);
    }
  });

  // Generate proposal with AI
  const generateProposalMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('proposalEngine', {
        action: 'generate_proposal',
        payload: {
          opportunity_id: opportunity.id,
          opportunity_title: opportunity.title,
          opportunity_description: opportunity.description,
          required_skills: opportunity.required_skills,
          platform: opportunity.platform,
          identity_id: opportunity.identity_id
        }
      });
      return res.data;
    },
    onSuccess: (data) => {
      setProposalContent(data.proposal);
      setActiveTab('proposal');
    },
    onError: (error) => {
      toast.error(`Proposal generation failed: ${error.message}`);
    }
  });

  // Execute with Agent Worker directly
  const executeWithAgentMutation = useMutation({
    mutationFn: async () => {
      setIsExecuting(true);
      const res = await base44.functions.invoke('agentWorker', {
        action: 'execute_opportunity',
        payload: {
          opportunity_id: opportunity.id,
          url: opportunity.url,
          identity_id: opportunity.identity_id,
          form_instructions: 'Fill out and submit the application form',
          proposal_content: proposalContent
        }
      });
      return res.data;
    },
    onSuccess: (data) => {
      setIsExecuting(false);
      setExecutionLog(data.execution_log || []);
      updateMutation.mutate({
        status: 'submitted',
        submission_timestamp: new Date().toISOString(),
        submission_confirmed: data.success,
        confirmation_number: data.confirmation_code,
        notes: data.confirmation_message
      });
      toast.success('Execution complete');
    },
    onError: (error) => {
      setIsExecuting(false);
      toast.error(`Execution failed: ${error.message}`);
    }
  });

  const copyProposal = () => {
    navigator.clipboard.writeText(proposalContent || '');
    setCopiedProposal(true);
    setTimeout(() => setCopiedProposal(false), 2000);
  };

  const categoryLabels = {
    arbitrage: "Arbitrage", service: "Service", lead_gen: "Lead Gen",
    digital_flip: "Digital Flip", auction: "Auction", market_inefficiency: "Market Gap",
    trend_surge: "Trend Surge", freelance: "Freelance", resale: "Resale",
    grant: "Grant", contest: "Contest", giveaway: "Giveaway"
  };

  const statusConfig = {
    new: { bg: 'bg-slate-500/10', text: 'text-slate-400', icon: Circle },
    queued: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Queued' },
    executing: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Executing' },
    submitted: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Submitted' },
    completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Completed' },
    failed: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Failed' }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-800 shrink-0">
          <div className="flex-1">
            <Badge variant="outline" className="mb-2 text-[10px] border-slate-600 text-slate-400">
              {opportunity.opportunity_type?.toUpperCase()} • {opportunity.platform?.toUpperCase()}
            </Badge>
            <h2 className="text-lg font-bold text-white">{opportunity.title}</h2>
            <p className="text-xs text-slate-400 mt-1">${opportunity.profit_estimate_low}–${opportunity.profit_estimate_high}</p>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} className="text-slate-500 hover:text-white">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-slate-800 bg-slate-900/50 shrink-0">
          {['overview', 'execution', 'proposal'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 px-4 text-xs font-medium transition-colors border-b-2 ${
                activeTab === tab
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab === 'overview' && '📋 Overview'}
              {tab === 'execution' && '⚙️ Execution'}
              {tab === 'proposal' && '✍️ Proposal'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Status Badge */}
              <div className={`p-4 rounded-xl border ${statusConfig[opportunity.status]?.bg} border-current/20`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Current Status</p>
                    <p className={`text-lg font-bold ${statusConfig[opportunity.status]?.text}`}>
                      {opportunity.status?.toUpperCase()}
                    </p>
                  </div>
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${statusConfig[opportunity.status]?.bg}`}>
                    {opportunity.status === 'completed' && <CheckCircle2 className="w-6 h-6 text-emerald-400" />}
                    {opportunity.status === 'executing' && <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />}
                    {opportunity.status === 'submitted' && <FileText className="w-6 h-6 text-blue-400" />}
                    {opportunity.status === 'new' && <Zap className="w-6 h-6 text-slate-400" />}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Description</p>
                <p className="text-sm text-slate-300 leading-relaxed">{opportunity.description}</p>
              </div>

              {/* Execution Metadata */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                  <p className="text-[10px] text-slate-500 mb-1">Profit Estimate</p>
                  <p className="text-sm font-bold text-emerald-400">
                    ${opportunity.profit_estimate_low}–${opportunity.profit_estimate_high}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                  <p className="text-[10px] text-slate-500 mb-1">Velocity Score</p>
                  <p className="text-sm font-bold text-amber-400">{opportunity.velocity_score}/100</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                  <p className="text-[10px] text-slate-500 mb-1">Risk Level</p>
                  <p className="text-sm font-bold text-rose-400">{opportunity.risk_score}/100</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                  <p className="text-[10px] text-slate-500 mb-1">Overall Score</p>
                  <p className="text-sm font-bold text-blue-400">{opportunity.overall_score}/100</p>
                </div>
              </div>

              {/* Execution Bindings */}
              <div className="space-y-3 p-4 rounded-lg bg-slate-800/30 border border-slate-700">
                <p className="text-xs font-semibold text-slate-400 uppercase">Execution Bindings</p>
                
                {opportunity.url && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-slate-500" />
                      <span className="text-xs text-slate-400">Entry URL</span>
                    </div>
                    <a href={opportunity.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                      Visit <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {opportunity.identity_id && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-500" />
                      <span className="text-xs text-slate-400">Identity</span>
                    </div>
                    <span className="text-xs text-slate-300">{opportunity.identity_name || opportunity.identity_id.slice(0, 8)}</span>
                  </div>
                )}

                {opportunity.platform && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-slate-500" />
                      <span className="text-xs text-slate-400">Platform</span>
                    </div>
                    <span className="text-xs text-slate-300 uppercase font-semibold">{opportunity.platform}</span>
                  </div>
                )}

                {opportunity.submission_timestamp && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-500" />
                      <span className="text-xs text-slate-400">Submitted</span>
                    </div>
                    <span className="text-xs text-slate-300">
                      {new Date(opportunity.submission_timestamp).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {opportunity.confirmation_number && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs text-slate-400">Confirmation</span>
                    </div>
                    <span className="text-xs text-emerald-400 font-mono">{opportunity.confirmation_number}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'execution' && (
            <div className="space-y-4">
              {isExecuting ? (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-3" />
                  <p className="text-sm font-semibold text-white">Agent Worker Executing...</p>
                  <p className="text-xs text-slate-400 mt-1">Navigating, filling, and submitting...</p>
                </div>
              ) : (
                <>
                  {/* Quick Actions */}
                  <div className="grid grid-cols-1 gap-2">
                    <Button
                      onClick={() => generateProposalMutation.mutate()}
                      disabled={generateProposalMutation.isPending}
                      className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      {generateProposalMutation.isPending ? 'Generating...' : 'Generate AI Proposal'}
                    </Button>

                    <Button
                      onClick={() => executeWithAgentMutation.mutate()}
                      disabled={executeWithAgentMutation.isPending}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Cpu className="w-4 h-4 mr-2" />
                      {executeWithAgentMutation.isPending ? 'Executing...' : 'Run with Agent Worker'}
                    </Button>

                    <Button
                      onClick={() => sendToAutopilotMutation.mutate()}
                      disabled={sendToAutopilotMutation.isPending}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Bot className="w-4 h-4 mr-2" />
                      {sendToAutopilotMutation.isPending ? 'Queuing...' : 'Send to Autopilot'}
                    </Button>
                  </div>

                  {/* Execution Log */}
                  {executionLog.length > 0 && (
                    <div className="mt-6 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                      <p className="text-xs font-semibold text-slate-400 uppercase mb-3">Execution Log</p>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {executionLog.map((log, idx) => (
                          <div key={idx} className="flex gap-2 text-xs">
                            <span className="text-emerald-500 font-mono shrink-0">{String(idx + 1).padStart(2, '0')}</span>
                            <div className="flex-1">
                              <p className="text-slate-300">{log.action}</p>
                              {log.detail && <p className="text-slate-500 text-[10px]">{log.detail}</p>}
                            </div>
                            {log.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'proposal' && (
            <div className="space-y-4">
              {!proposalContent ? (
                <div className="text-center py-12">
                  <Sparkles className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">Generate an AI proposal to see it here</p>
                  <Button
                    onClick={() => generateProposalMutation.mutate()}
                    className="mt-4 bg-violet-600 hover:bg-violet-700"
                  >
                    Generate Proposal
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-400 uppercase">Generated Proposal</p>
                    <button
                      onClick={copyProposal}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiedProposal ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="p-4 rounded-lg bg-slate-800 border border-slate-700 max-h-96 overflow-y-auto">
                    <p className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                      {proposalContent}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <Button
                      onClick={() => executeWithAgentMutation.mutate()}
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Cpu className="w-4 h-4 mr-2" />
                      Execute with This Proposal
                    </Button>
                    <Button
                      onClick={() => sendToAutopilotMutation.mutate()}
                      variant="outline"
                      className="w-full border-slate-700 text-slate-400"
                    >
                      <Bot className="w-4 h-4 mr-2" />
                      Send to Autopilot
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}