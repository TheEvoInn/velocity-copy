import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Clock, RefreshCw, CheckCircle2, XCircle, Zap, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function SmartRetryPanel() {
  const queryClient = useQueryClient();
  const [selectedRetry, setSelectedRetry] = useState(null);

  const { data: pendingRetries = [] } = useQuery({
    queryKey: ['retryHistory'],
    queryFn: async () => {
      try {
        const result = await base44.entities.RetryHistory.filter(
          { status: { $in: ['pending', 'in_progress'] } },
          '-scheduled_retry_at',
          20
        );
        return Array.isArray(result) ? result : [];
      } catch (err) {
        console.error('Failed to fetch retry history:', err);
        return [];
      }
    },
    initialData: [],
    refetchInterval: 30000, // Refresh every 30s
  });

  const forceRetryMutation = useMutation({
    mutationFn: async (retryId) => {
      const retries = await base44.entities.RetryHistory.filter({ id: retryId }, '-created_date', 1);
      if (!retries || !retries[0]) throw new Error('Retry not found');

      return base44.functions.invoke('smartRetryOrchestrator', {
        task_id: retries[0].task_id,
        analysis: retries[0],
        force_retry: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retryHistory'] });
    },
  });

  const errorTypeColors = {
    rate_limit: 'text-amber-400',
    captcha: 'text-red-400',
    network_timeout: 'text-orange-400',
    session_expired: 'text-blue-400',
    identity_mismatch: 'text-purple-400',
    form_parsing_error: 'text-yellow-400',
    platform_downtime: 'text-red-400',
    invalid_credentials: 'text-red-400',
    missing_account: 'text-pink-400',
  };

  const strategyIcons = {
    simple_retry: <RefreshCw className="w-3.5 h-3.5" />,
    retry_with_delay: <Clock className="w-3.5 h-3.5" />,
    refresh_credentials: <Zap className="w-3.5 h-3.5" />,
    switch_identity: <TrendingUp className="w-3.5 h-3.5" />,
    switch_account: <TrendingUp className="w-3.5 h-3.5" />,
  };

  return (
    <Card className="bg-slate-900/80 border-slate-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              Smart Retry System
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {pendingRetries.length} task(s) scheduled for intelligent retry
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {pendingRetries.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-8 h-8 text-emerald-400/50 mx-auto mb-2" />
            <p className="text-xs text-slate-400">No pending retries</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {Array.isArray(pendingRetries) && pendingRetries.map((retry) => {
                if (!retry || !retry.scheduled_retry_at) return null;
                const scheduledTime = new Date(retry.scheduled_retry_at);
                const now = new Date();
                const minutesUntil = Math.round((scheduledTime - now) / 60000);
                const isOverdue = minutesUntil < 0;

              return (
                <div
                  key={retry.id}
                  className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors cursor-pointer"
                  onClick={() => setSelectedRetry(selectedRetry?.id === retry.id ? null : retry)}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {retry?.recovery_strategy && strategyIcons[retry.recovery_strategy] && (
                          <div className="text-slate-400">
                            {strategyIcons[retry.recovery_strategy]}
                          </div>
                        )}
                        <p className="text-xs font-semibold text-white truncate">
                          {retry?.platform || 'Unknown'}
                        </p>
                        <Badge
                          variant="outline"
                          className={`text-[9px] ${(retry?.error_type && errorTypeColors[retry.error_type]) || 'text-slate-400'}`}
                        >
                          {(retry?.error_type || 'unknown').replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 truncate">
                        {retry.error_message}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                    <div className="text-right">
                      <p className="text-[10px] font-semibold text-emerald-400">
                        {typeof retry?.confidence_score === 'number' ? retry.confidence_score : 0}%
                      </p>
                      <p className="text-[9px] text-slate-500">confidence</p>
                    </div>
                    {retry?.status === 'pending' && (
                      <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                    )}
                    {retry?.status === 'in_progress' && (
                      <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                    )}
                    </div>
                  </div>

                  {/* Timing & Strategy */}
                  <div className="flex items-center gap-2 text-[9px]">
                    <span className={isOverdue ? 'text-red-400 font-semibold' : 'text-slate-500'}>
                      {isOverdue
                        ? `Overdue by ${Math.abs(minutesUntil)} min`
                        : `Retrying in ${minutesUntil} min`}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-400 capitalize">
                      {retry.recovery_strategy.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Expandable Details */}
                  {selectedRetry?.id === retry.id && (
                    <div className="mt-3 pt-3 border-t border-slate-700 space-y-2">
                    <div>
                      <p className="text-[9px] text-slate-400 mb-1">Recovery Actions</p>
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(retry?.recovery_actions_taken) ? retry.recovery_actions_taken.map((action, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="text-[8px] bg-slate-700 text-slate-300"
                            >
                              {action?.action?.replace(/_/g, ' ') || 'action'}
                            </Badge>
                            )) : <span className="text-[8px] text-slate-500">No actions</span>}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[9px]">
                        <div>
                          <p className="text-slate-400">Retry Count</p>
                          <p className="text-white font-semibold">
                            {(retry?.retry_count || 0) + 1} / {retry?.max_retries || 3}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">Delay</p>
                          <p className="text-white font-semibold">
                            {typeof retry?.calculated_delay_seconds === 'number' ? Math.round(retry.calculated_delay_seconds / 60) : 0} min
                          </p>
                        </div>
                      </div>
                      <p className="text-[8px] text-slate-500 italic">
                        {retry?.delay_reason || 'Retry scheduled'}
                      </p>

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            forceRetryMutation.mutate(retry.id)
                          }
                          disabled={forceRetryMutation.isPending}
                          className="flex-1 h-6 text-xs bg-emerald-600 hover:bg-emerald-500"
                        >
                          <Zap className="w-3 h-3 mr-1" />
                          {forceRetryMutation.isPending ? 'Forcing...' : 'Force Retry'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Stats Summary */}
        <div className="pt-3 border-t border-slate-700 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[9px] text-slate-400">Pending</p>
            <p className="text-sm font-semibold text-amber-400">
              {pendingRetries.filter(r => r.status === 'pending').length}
            </p>
          </div>
          <div>
            <p className="text-[9px] text-slate-400">In Progress</p>
            <p className="text-sm font-semibold text-blue-400">
              {pendingRetries.filter(r => r.status === 'in_progress').length}
            </p>
          </div>
          <div>
            <p className="text-[9px] text-slate-400">Avg Confidence</p>
            <p className="text-sm font-semibold text-emerald-400">
              {pendingRetries.length > 0
                ? Math.round(
                    pendingRetries.reduce((sum, r) => sum + (r.confidence_score || 0), 0) /
                      pendingRetries.length
                  )
                : 0}
              %
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}