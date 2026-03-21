import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Zap, Settings, Play, BarChart3, AlertCircle, CheckCircle2, Clock, TrendingUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function WorkflowAutomationControl() {
  const [showSettings, setShowSettings] = useState(false);
  const [thresholds, setThresholds] = useState({
    min_value: 50,
    max_signup_time: 5,
    max_captcha_likelihood: 0.3,
    required_difficulty: 'easy',
    instant_claim_only: false,
  });
  const [dryRun, setDryRun] = useState(true);

  // Get workflow status
  const { data: status, isLoading: statusLoading, refetch } = useQuery({
    queryKey: ['workflow_status'],
    queryFn: async () => {
      const res = await base44.functions.invoke('opportunityAutoWorkflow', {
        action: 'get_workflow_status',
      });
      return res.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Run workflow
  const workflowMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('opportunityAutoWorkflow', {
        action: 'evaluate_and_auto_execute',
        thresholds,
        dryRun,
      });
      return res.data;
    },
    onSuccess: (data) => {
      refetch();
      if (dryRun) {
        toast.info(`Dry run: Would process ${data.results.length} opportunities`);
      } else {
        toast.success(`✅ Auto-queued ${data.results.filter(r => r.status === 'auto_queued').length} opportunities`);
      }
    },
    onError: () => {
      toast.error('Failed to run workflow');
    },
  });

  // Update thresholds
  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('opportunityAutoWorkflow', {
        action: 'update_thresholds',
        thresholds,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('✅ Thresholds saved');
      setShowSettings(false);
    },
  });

  if (statusLoading) {
    return (
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-cyan-400 mr-2" />
          Loading workflow status...
        </CardContent>
      </Card>
    );
  }

  const stats = status?.stats || {};

  return (
    <div className="space-y-4">
      {/* Main Control Card */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              <CardTitle className="text-white">Automated Opportunity Workflow</CardTitle>
            </div>
            <Button
              onClick={() => setShowSettings(!showSettings)}
              variant="outline"
              size="sm"
              className="border-slate-600"
            >
              <Settings className="w-4 h-4 mr-1" />
              Configure
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Explanation */}
          <div className="bg-cyan-950/30 border border-cyan-800/30 rounded-lg p-3">
            <p className="text-xs text-cyan-200">
              Automatically evaluates discovered opportunities, filters by your thresholds, and uses AI to auto-complete simple forms and tasks without your intervention.
            </p>
          </div>

          {/* Stats Grid */}
          {stats.total_auto_tasks !== undefined && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-xs text-slate-500">Total Auto-Tasks</p>
                <p className="text-lg font-bold text-white">{stats.total_auto_tasks}</p>
              </div>
              <div className="bg-emerald-900/20 border border-emerald-800/30 rounded-lg p-3">
                <p className="text-xs text-emerald-400">Completed</p>
                <p className="text-lg font-bold text-emerald-300">{stats.completed}</p>
              </div>
              <div className="bg-purple-900/20 border border-purple-800/30 rounded-lg p-3">
                <p className="text-xs text-purple-400">Pending</p>
                <p className="text-lg font-bold text-purple-300">{stats.pending}</p>
              </div>
              <div className="bg-amber-900/20 border border-amber-800/30 rounded-lg p-3">
                <p className="text-xs text-amber-400">Total Value</p>
                <p className="text-lg font-bold text-amber-300">${stats.total_value}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => workflowMutation.mutate()}
              disabled={workflowMutation.isPending}
              className={dryRun ? 'bg-slate-700 hover:bg-slate-600' : 'bg-cyan-600 hover:bg-cyan-500'}
              size="sm"
            >
              {workflowMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 mr-1.5" />
                  {dryRun ? 'Preview' : 'Execute Now'}
                </>
              )}
            </Button>

            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="w-3 h-3 accent-cyan-500"
              />
              Dry Run Mode
            </label>
          </div>

          {/* Configuration Panel */}
          {showSettings && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">Min Opportunity Value: ${thresholds.min_value}</label>
                <input
                  type="range"
                  min="10"
                  max="500"
                  value={thresholds.min_value}
                  onChange={(e) => setThresholds(p => ({ ...p, min_value: parseInt(e.target.value) }))}
                  className="w-full"
                />
                <p className="text-xs text-slate-500">Only process opportunities worth at least this much</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">Max Signup Time: {thresholds.max_signup_time} minutes</label>
                <input
                  type="range"
                  min="1"
                  max="15"
                  value={thresholds.max_signup_time}
                  onChange={(e) => setThresholds(p => ({ ...p, max_signup_time: parseInt(e.target.value) }))}
                  className="w-full"
                />
                <p className="text-xs text-slate-500">Skip if signup/form filling takes longer than this</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">Preferred Difficulty</label>
                <select
                  value={thresholds.required_difficulty}
                  onChange={(e) => setThresholds(p => ({ ...p, required_difficulty: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500"
                >
                  <option value="easy">Easy (instant/minimal effort)</option>
                  <option value="medium">Medium (some effort required)</option>
                  <option value="hard">Hard (full tasks)</option>
                </select>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={thresholds.instant_claim_only}
                  onChange={(e) => setThresholds(p => ({ ...p, instant_claim_only: e.target.checked }))}
                  className="w-3 h-3 accent-cyan-500"
                />
                Only instant claim opportunities
              </label>

              <Button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
              >
                Save Thresholds
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Auto-Tasks */}
      {status?.recent_tasks && status.recent_tasks.length > 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-400" />
              Recent Auto-Queued Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {status.recent_tasks.map((task) => (
                <div key={task.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-2 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate font-medium">{task.opportunity_id}</p>
                    <p className="text-xs text-slate-500">${task.estimated_value}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {task.status === 'completed' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                    {task.status === 'failed' && (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    )}
                    {['queued', 'processing'].includes(task.status) && (
                      <Clock className="w-4 h-4 text-amber-400" />
                    )}
                    <span className="text-xs text-slate-400 capitalize">{task.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}