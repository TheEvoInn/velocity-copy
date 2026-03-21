/**
 * Task Reader Interface
 * UI for submitting URLs, reviewing understanding, and managing task execution
 */
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Globe, Zap, CheckCircle2, AlertCircle, Loader, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

export default function TaskReaderInterface() {
  const [url, setUrl] = useState('');
  const [taskName, setTaskName] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [loading, setLoading] = useState(false);

  // Read and process mutation
  const readMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('taskReaderEngine', {
        action: 'read_and_process',
        payload: { url, task_name: taskName }
      });
      return res.data;
    },
    onSuccess: (data) => {
      setAnalysis(data);
      toast.success(`Task analyzed: ${data.actions.length} actions compiled`);
    },
    onError: (err) => {
      toast.error('Analysis failed: ' + err.message);
    }
  });

  // Submit to Autopilot mutation
  const submitToAutopilotMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('taskReaderAutomationBridge', {
        action: 'submit_to_autopilot',
        payload: {
          workflow_id: analysis.workflow.id,
          actions: analysis.actions,
          url,
          priority: 85
        }
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Task queued for Autopilot execution');
      setAnalysis(null);
      setUrl('');
    },
    onError: (err) => {
      toast.error('Submission failed: ' + err.message);
    }
  });

  // Submit to Agent Worker mutation
  const submitToAgentMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('taskReaderAutomationBridge', {
        action: 'submit_to_agent_worker',
        payload: {
          workflow_id: analysis.workflow.id,
          actions: analysis.actions,
          url,
          task_name: taskName,
          agent_type: 'intelligent'
        }
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Task submitted to Agent Worker');
      setAnalysis(null);
      setUrl('');
    },
    onError: (err) => {
      toast.error('Submission failed: ' + err.message);
    }
  });

  return (
    <div className="space-y-6">
      {/* Input Section */}
      {!analysis && (
        <Card className="p-6 bg-slate-900/50 border-slate-800">
          <h3 className="text-lg font-semibold text-white mb-4">3rd-Party Task Reader</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-2 block">
                Website URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/form"
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 mb-2 block">
                Task Name (Optional)
              </label>
              <input
                type="text"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="e.g., Apply for Grant #2024"
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
              />
            </div>

            <Button
              onClick={() => readMutation.mutate()}
              disabled={!url || readMutation.isPending}
              className="w-full bg-violet-600 hover:bg-violet-500 gap-2"
            >
              {readMutation.isPending ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4" />
                  Read & Analyze
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* Analysis Results */}
      {analysis && (
        <div className="space-y-4">
          {/* Understanding Summary */}
          <Card className="p-4 bg-slate-900/50 border-slate-800">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-white">Analysis Results</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAnalysis(null);
                  setUrl('');
                }}
              >
                Close
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-xs text-slate-400 mb-1">Page Type</p>
                <p className="text-sm font-semibold text-white">{analysis.understanding.page_type}</p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-xs text-slate-400 mb-1">Confidence</p>
                <p className="text-sm font-semibold text-white">{Math.round(analysis.understanding.confidence * 100)}%</p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-xs text-slate-400 mb-1">Actions</p>
                <p className="text-sm font-semibold text-white">{analysis.actions.length}</p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <p className="text-xs text-slate-400 mb-1">Est. Time</p>
                <p className="text-sm font-semibold text-white">{analysis.understanding.estimated_time_minutes}m</p>
              </div>
            </div>

            {/* Form Fields */}
            {analysis.understanding.form_fields?.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-white mb-2">Form Fields Detected</h4>
                <div className="space-y-1">
                  {analysis.understanding.form_fields.map((field, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs py-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span className="text-slate-300">
                        {field.name} {field.required && <span className="text-red-400">*</span>}
                      </span>
                      <Badge variant="secondary" className="text-[10px] ml-auto">
                        {field.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Blockers/Warnings */}
            {analysis.understanding.blockers?.length > 0 && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 mb-4">
                <div className="flex gap-2 items-start">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-red-200 mb-1">Potential Blockers</p>
                    {analysis.understanding.blockers.map((blocker, idx) => (
                      <p key={idx} className="text-xs text-red-300">{blocker}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Action Plan */}
          <Card className="p-4 bg-slate-900/50 border-slate-800">
            <h4 className="font-semibold text-white mb-3">Execution Plan</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {analysis.actions.map((action, idx) => (
                <div key={action.id} className="flex items-start gap-2 text-xs py-2 px-2 rounded bg-slate-800/50">
                  <span className="text-slate-400 font-mono min-w-fit">{idx + 1}.</span>
                  <div className="flex-1">
                    <p className="font-semibold text-white capitalize">{action.type}</p>
                    <p className="text-slate-400 text-[10px]">{action.selector || action.target_url || 'System action'}</p>
                  </div>
                  {idx < analysis.actions.length - 1 && (
                    <ChevronRight className="w-3 h-3 text-slate-600 mt-1 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Workflow Info */}
          <Card className="p-4 bg-slate-900/50 border-slate-800">
            <h4 className="font-semibold text-white mb-2">Generated Workflow</h4>
            <div className="p-3 bg-slate-800/50 rounded flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Workflow ID</p>
                <p className="text-sm font-mono text-violet-300">{analysis.workflow.id}</p>
              </div>
              <Badge variant={analysis.workflow.newly_created ? 'default' : 'secondary'}>
                {analysis.workflow.newly_created ? 'New' : 'Matched'}
              </Badge>
            </div>
          </Card>

          {/* Execute Options */}
          <div className="flex gap-3">
            <Button
              onClick={() => submitToAutopilotMutation.mutate()}
              disabled={submitToAutopilotMutation.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-500 gap-2"
            >
              <Zap className="w-4 h-4" />
              Run with Autopilot
            </Button>
            <Button
              onClick={() => submitToAgentMutation.mutate()}
              disabled={submitToAgentMutation.isPending}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 gap-2"
            >
              <Zap className="w-4 h-4" />
              Run with Agent Worker
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}