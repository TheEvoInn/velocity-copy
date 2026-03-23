import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * useRealtimeEventBus Hook
 * ACTUAL FIX: Subscribe to ActivityLog for ALL entity mutations
 * Invalidates React Query caches IMMEDIATELY on any change
 * No delays, no batching, no gaps
 */

export function useRealtimeEventBus() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscribe to ActivityLog for real-time updates
    const unsubscribe = base44.entities.ActivityLog.subscribe((event) => {
      if (event.type === 'create') {
        const log = event.data;
        if (!log) return;

        const { metadata } = log;
        if (!metadata) return;

        const { entity_name, mutation_type, event_id } = metadata;

        // Check for duplicates - ignore if same event_id processed recently
        const recentLogs = queryClient.getQueryData(['activityLogs']) || [];
        const isDuplicate = recentLogs.some(l => l?.metadata?.event_id === event_id);
        
        if (isDuplicate) return;

        // Map entity to cache keys
        const cacheInvalidations = {
          'Opportunity': ['opportunities', 'activeOpps', 'opportunityDetails'],
          'TaskExecutionQueue': ['taskQueue', 'taskQueueManager', 'activeTasks'],
          'Transaction': ['transactions', 'walletBalance', 'financialData'],
          'AIIdentity': ['aiIdentities', 'activeIdentity'],
          'UserGoals': ['userGoals', 'walletBalance', 'profitMetrics'],
          'ActivityLog': ['activityLogs'],
          'Workflow': ['workflows'],
          'WebhookConfig': ['webhookConfigs']
        };

        const keysToInvalidate = entity_name ? (cacheInvalidations[entity_name] || [entity_name.toLowerCase()]) : [];

        // INVALIDATE IMMEDIATELY - no delay
        keysToInvalidate.forEach(key => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });

        // Also update activity logs in real-time
        queryClient.setQueryData(['activityLogs'], (old) => {
          const updated = [log, ...(old || [])].slice(0, 100);
          return updated;
        });
      }
    });

    return () => unsubscribe?.();
  }, [queryClient]);
}