import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Zap, Target, TrendingUp, Shield, Cpu, GitBranch } from 'lucide-react';
import { toast } from 'sonner';

export default function IntelligentIdentityRouter({ opportunity, onIdentitySelected }) {
  const qc = useQueryClient();
  const [selectedIdentity, setSelectedIdentity] = useState(null);
  const [evaluatingId, setEvaluatingId] = useState(null);

  // Get router recommendation
  const { data: recommendation, isLoading: loadingRec } = useQuery({
    queryKey: ['identityRecommendation', opportunity?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('intelligentIdentityRouter', {
        action: 'recommend_identity',
        opportunity
      });
      return res.data;
    },
    enabled: !!opportunity?.id,
    staleTime: 30000
  });

  // Evaluate specific identity fit
  const evaluateMutation = useMutation({
    mutationFn: async (identityId) => {
      const res = await base44.functions.invoke('intelligentIdentityRouter', {
        action: 'evaluate_identity_fit',
        opportunity,
        identity_id: identityId
      });
      return res.data;
    },
    onSuccess: (data) => {
      setEvaluatingId(null);
    },
    onError: (error) => {
      toast.error(`Evaluation failed: ${error.message}`);
    }
  });

  // Switch and queue
  const switchMutation = useMutation({
    mutationFn: async (identityId) => {
      const res = await base44.functions.invoke('intelligentIdentityRouter', {
        action: 'switch_and_queue',
        opportunity,
        identity_id: identityId
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`✓ Task queued with ${selectedIdentity?.name}`);
      onIdentitySelected?.(selectedIdentity);
      qc.invalidateQueries({ queryKey: ['taskQueue'] });
    },
    onError: (error) => {
      toast.error(`Failed to queue task: ${error.message}`);
    }
  });

  if (!opportunity) {
    return (
      <div className="text-center py-6 text-slate-500 text-sm">
        Select an opportunity to view identity recommendations
      </div>
    );
  }

  if (loadingRec) {
    return <div className="animate-pulse text-center py-6 text-slate-500">Analyzing best identity match...</div>;
  }

  if (!recommendation) {
    return (
      <div className="p-4 bg-amber-950/20 border border-amber-500/30 rounded-lg">
        <p className="text-amber-400 text-sm">No identities available. Create an identity first.</p>
      </div>
    );
  }

  const recommendedIdentity = recommendation.recommended_identity;
  const fitScore = recommendation.fit_score || 0;
  const fitGrade = fitScore >= 80 ? 'A' : fitScore >= 70 ? 'B' : fitScore >= 60 ? 'C' : 'D';
  const fitColor = fitScore >= 80 ? 'emerald' : fitScore >= 70 ? 'blue' : fitScore >= 60 ? 'amber' : 'red';

  return (
    <div className="space-y-4">
      {/* Top Recommendation */}
      <Card className="bg-gradient-to-r from-violet-950/40 to-slate-900/60 border-violet-500/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-violet-400" />
              <CardTitle className="text-sm">AI Router Recommendation</CardTitle>
            </div>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white bg-${fitColor}-950/50 border border-${fitColor}-500/30 text-${fitColor}-400`}>
              {fitGrade}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Identity Card */}
          <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700 cursor-pointer hover:border-violet-500/50 transition-colors"
            onClick={() => setSelectedIdentity(recommendedIdentity)}>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ background: `${recommendedIdentity.color || '#7c3aed'}44` }}
              >
                {recommendedIdentity.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white">{recommendedIdentity.name}</div>
                <div className="text-xs text-slate-500">{recommendedIdentity.role_label}</div>
              </div>
              <Badge className={`bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]`}>
                RECOMMENDED
              </Badge>
            </div>

            {/* Fit Score Bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400">Fit Score</span>
                <span className="text-xs font-semibold text-white">{fitScore}%</span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r from-${fitColor}-500 to-${fitColor}-400 transition-all duration-500`}
                  style={{ width: `${fitScore}%` }}
                />
              </div>
            </div>

            {/* Routing Reason */}
            <div className="text-xs text-slate-400 mb-3 p-2 bg-slate-900/40 rounded border border-slate-700">
              <p className="font-medium text-white mb-1">Why this identity?</p>
              <p>{recommendation.routing_reason?.policy_applied || 'Best overall match based on skill, experience, and account health'}</p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded bg-slate-700/30 border border-slate-700">
                <div className="text-xl font-bold text-white">{recommendedIdentity.tasks_executed || 0}</div>
                <div className="text-[10px] text-slate-500">Tasks</div>
              </div>
              <div className="p-2 rounded bg-slate-700/30 border border-slate-700">
                <div className="text-xl font-bold text-emerald-400">${(recommendedIdentity.total_earned || 0).toFixed(0)}</div>
                <div className="text-[10px] text-slate-500">Earned</div>
              </div>
              <div className="p-2 rounded bg-slate-700/30 border border-slate-700">
                <div className="text-xl font-bold text-blue-400">{(recommendedIdentity.linked_account_ids || []).length}</div>
                <div className="text-[10px] text-slate-500">Accounts</div>
              </div>
            </div>
          </div>

          {/* KYC Alert */}
          {recommendation.requires_kyc && (
            <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-500/30 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-amber-400">KYC Verification Needed</p>
                <p className="text-xs text-amber-300/70 mt-0.5">{recommendation.routing_reason?.kyc_reason || 'This opportunity requires identity verification'}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => evaluateMutation.mutate(recommendedIdentity.id)}
              variant="outline"
              size="sm"
              className="flex-1 border-slate-700 text-slate-400 hover:text-white text-xs h-8 gap-1"
              disabled={evaluatingId === recommendedIdentity.id}
            >
              <Target className="w-3 h-3" />
              {evaluatingId === recommendedIdentity.id ? 'Analyzing...' : 'Evaluate'}
            </Button>
            <Button
              onClick={() => switchMutation.mutate(recommendedIdentity.id)}
              className="flex-1 bg-violet-600 hover:bg-violet-500 text-white text-xs h-8 gap-1"
              disabled={switchMutation.isPending}
            >
              <Zap className="w-3 h-3" />
              {switchMutation.isPending ? 'Queueing...' : 'Use & Queue'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Alternative Options */}
      {recommendation.alternatives && recommendation.alternatives.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400 px-1">Alternative Identities</p>
          {recommendation.alternatives.map((alt, idx) => (
            <Card key={idx} className="bg-slate-900/30 border-slate-800 p-3 cursor-pointer hover:border-slate-700 transition-colors"
              onClick={() => {
                const identity = alt.identity;
                setSelectedIdentity(identity);
                switchMutation.mutate(identity.id);
              }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">{alt.identity?.name || 'Unknown'}</div>
                  <div className="text-[10px] text-slate-500">Fit Score: {alt.fit_score}%</div>
                </div>
                <GitBranch className="w-4 h-4 text-slate-600" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Evaluation Result Modal */}
      {selectedIdentity && evaluateMutation.data && (
        <Card className="bg-blue-950/20 border-blue-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-400" />
              Detailed Evaluation: {selectedIdentity.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {Object.entries(evaluateMutation.data.metrics || {}).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center p-2 rounded bg-slate-800/40">
                <span className="text-slate-400 capitalize">{key.replace(/_/g, ' ')}</span>
                <span className="font-semibold text-white">{Math.round(value)}%</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}