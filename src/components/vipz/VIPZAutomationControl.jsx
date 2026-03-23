import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, Sparkles, TrendingUp, Wand2, BarChart3 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';

export default function VIPZAutomationControl({ campaignId, storefrontId }) {
  const [selectedOptimization, setSelectedOptimization] = useState(null);
  const [showResults, setShowResults] = useState(false);

  const generatePageMutation = useMutation({
    mutationFn: () =>
      base44.functions.invoke('vipzAutonomousAutomation', {
        action: 'generate_landing_page',
        campaign_id: campaignId
      }),
    onSuccess: () => {
      setShowResults(true);
    }
  });

  const optimizeMutation = useMutation({
    mutationFn: (type) =>
      base44.functions.invoke('vipzAutonomousAutomation', {
        action: 'optimize_campaign',
        campaign_id: campaignId,
        optimization_type: type
      }),
    onSuccess: () => {
      setShowResults(true);
    }
  });

  const autoScheduleMutation = useMutation({
    mutationFn: () =>
      base44.functions.invoke('vipzAutonomousAutomation', {
        action: 'auto_schedule_campaign',
        campaign_id: campaignId
      }),
    onSuccess: () => {
      setShowResults(true);
    }
  });

  const createABTestMutation = useMutation({
    mutationFn: () =>
      base44.functions.invoke('vipzAutonomousAutomation', {
        action: 'create_ab_test',
        campaign_id: campaignId
      }),
    onSuccess: () => {
      setShowResults(true);
    }
  });

  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-pink-400" />
            AI Automation Suite
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Landing Page Generation */}
          <div className="p-4 bg-slate-800/30 rounded-lg border border-pink-500/20">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-semibold text-white text-sm">Generate Landing Page</h4>
                <p className="text-xs text-slate-400 mt-1">AI creates high-converting landing page from campaign details</p>
              </div>
              <Button
                size="sm"
                variant={generatePageMutation.isPending ? 'outline' : 'default'}
                onClick={() => generatePageMutation.mutate()}
                disabled={generatePageMutation.isPending}
                className="shrink-0"
              >
                {generatePageMutation.isPending ? 'Generating...' : 'Generate'}
              </Button>
            </div>
            {generatePageMutation.data?.data?.message && (
              <p className="text-xs text-emerald-400 mt-2">✓ {generatePageMutation.data.data.message}</p>
            )}
          </div>

          {/* Auto Schedule */}
          <div className="p-4 bg-slate-800/30 rounded-lg border border-cyan-500/20">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-semibold text-white text-sm">Auto-Schedule Campaign</h4>
                <p className="text-xs text-slate-400 mt-1">Optimal send times based on subscriber behavior</p>
              </div>
              <Button
                size="sm"
                variant={autoScheduleMutation.isPending ? 'outline' : 'default'}
                onClick={() => autoScheduleMutation.mutate()}
                disabled={autoScheduleMutation.isPending}
                className="shrink-0"
              >
                {autoScheduleMutation.isPending ? 'Scheduling...' : 'Schedule'}
              </Button>
            </div>
            {autoScheduleMutation.data?.data?.schedule && (
              <p className="text-xs text-emerald-400 mt-2">
                ✓ Send {autoScheduleMutation.data.data.schedule.send_day} at {autoScheduleMutation.data.data.schedule.send_time}
              </p>
            )}
          </div>

          {/* Campaign Optimization */}
          <div className="p-4 bg-slate-800/30 rounded-lg border border-amber-500/20">
            <div className="mb-3">
              <h4 className="font-semibold text-white text-sm">Optimize Campaign</h4>
              <p className="text-xs text-slate-400 mt-1">AI-powered recommendations to improve performance</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['subject_line', 'content', 'send_time'].map((type) => (
                <Button
                  key={type}
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedOptimization(type);
                    optimizeMutation.mutate(type);
                  }}
                  disabled={optimizeMutation.isPending}
                  className="text-xs"
                >
                  {type === 'subject_line' ? 'Subject' : type === 'send_time' ? 'Timing' : 'Content'}
                </Button>
              ))}
            </div>
            {optimizeMutation.data?.data?.optimizations && (
              <p className="text-xs text-emerald-400 mt-2">
                ✓ {optimizeMutation.data.data.optimizations.length} recommendations generated
              </p>
            )}
          </div>

          {/* A/B Testing */}
          <div className="p-4 bg-slate-800/30 rounded-lg border border-violet-500/20">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-semibold text-white text-sm">Create A/B Test</h4>
                <p className="text-xs text-slate-400 mt-1">Automatically test variations and apply winner</p>
              </div>
              <Button
                size="sm"
                variant={createABTestMutation.isPending ? 'outline' : 'default'}
                onClick={() => createABTestMutation.mutate()}
                disabled={createABTestMutation.isPending}
                className="shrink-0"
              >
                {createABTestMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </div>
            {createABTestMutation.data?.data?.ab_test && (
              <p className="text-xs text-emerald-400 mt-2">
                ✓ Test running for 7 days with 50/50 split
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results Panel */}
      {showResults && (optimizeMutation.data || generatePageMutation.data || autoScheduleMutation.data || createABTestMutation.data) && (
        <Card className="glass-card border-emerald-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-400">
              <Sparkles className="w-5 h-5" />
              Automation Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            {optimizeMutation.data?.data?.optimizations && (
              <div className="space-y-3 mb-4">
                <div className="text-sm font-semibold text-white">Optimization Recommendations</div>
                {optimizeMutation.data.data.optimizations.map((opt, idx) => (
                  <div key={idx} className="text-xs text-slate-300 bg-slate-800/30 p-3 rounded">
                    <div className="font-semibold text-cyan-400 mb-1">{opt.type.toUpperCase().replace('_', ' ')}</div>
                    {opt.recommendations && opt.recommendations.map((rec, i) => (
                      <div key={i} className="ml-2">• {rec}</div>
                    ))}
                    {opt.expected_impact && (
                      <div className="text-emerald-400 mt-2">Expected: {opt.expected_impact}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {generatePageMutation.data?.data?.key_benefits && (
              <div className="text-xs text-slate-300 bg-slate-800/30 p-3 rounded">
                <div className="font-semibold text-cyan-400 mb-2">Generated Page Benefits</div>
                <ul className="list-disc list-inside space-y-1">
                  {generatePageMutation.data.data.key_benefits.map((benefit, idx) => (
                    <li key={idx} className="text-slate-300">{benefit}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowResults(false)}
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}