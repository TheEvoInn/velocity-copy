import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * useAutoInvalidateCache Hook
 * Subscribes to entity updates and invalidates React Query caches in real-time
 * FIX #1: Ensures write-after-read consistency
 */

export function useAutoInvalidateCache() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribeOpps = base44.entities.Opportunity.subscribe((event) => {
      if (event.type === 'update' || event.type === 'create' || event.type === 'delete') {
        queryClient.invalidateQueries({ queryKey: ['opportunities'] });
        queryClient.invalidateQueries({ queryKey: ['activeOpps'] });
      }
    });

    const unsubscribeTasks = base44.entities.TaskExecutionQueue.subscribe((event) => {
      if (event.type === 'update' || event.type === 'create' || event.type === 'delete') {
        queryClient.invalidateQueries({ queryKey: ['taskQueue', 'taskQueueManager'] });
        queryClient.invalidateQueries({ queryKey: ['activeTasks'] });
      }
    });

    const unsubscribeTx = base44.entities.Transaction.subscribe((event) => {
      if (event.type === 'update' || event.type === 'create' || event.type === 'delete') {
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
      }
    });

    const unsubscribeIds = base44.entities.AIIdentity.subscribe((event) => {
      if (event.type === 'update' || event.type === 'create' || event.type === 'delete') {
        queryClient.invalidateQueries({ queryKey: ['aiIdentities'] });
      }
    });

    const unsubscribeLogs = base44.entities.ActivityLog.subscribe((event) => {
      if (event.type === 'create') {
        queryClient.invalidateQueries({ queryKey: ['activityLogs'] });
      }
    });

    const unsubscribeGoals = base44.entities.UserGoals.subscribe((event) => {
      if (event.type === 'update' || event.type === 'create') {
        queryClient.invalidateQueries({ queryKey: ['userGoals'] });
      }
    });

    return () => {
      unsubscribeOpps?.();
      unsubscribeTasks?.();
      unsubscribeTx?.();
      unsubscribeIds?.();
      unsubscribeLogs?.();
      unsubscribeGoals?.();
    };
  }, [queryClient]);
}