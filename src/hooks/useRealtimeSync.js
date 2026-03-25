import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * REALTIME SYNC HOOK
 * Subscribes to entity changes and keeps UI in sync with backend
 * Auto-updates Dashboard, Wallet, Notifications on task/intervention changes
 */

export function useRealtimeTaskSync(onTaskUpdate) {
  useEffect(() => {
    const unsubscribe = base44.entities.TaskExecutionQueue.subscribe((event) => {
      if (event.type === 'update') {
        console.log(`[UI SYNC] Task ${event.id} → ${event.data.status}`);
        onTaskUpdate?.(event.data);
      }
    });

    return () => unsubscribe?.();
  }, [onTaskUpdate]);
}

export function useRealtimeInterventionSync(onInterventionUpdate) {
  useEffect(() => {
    const unsubscribe = base44.entities.UserIntervention.subscribe((event) => {
      if (event.type === 'update' || event.type === 'create') {
        console.log(`[UI SYNC] Intervention ${event.id} → ${event.data.status}`);
        onInterventionUpdate?.(event.data);
      }
    });

    return () => unsubscribe?.();
  }, [onInterventionUpdate]);
}

export function useRealtimeWalletSync(onWalletUpdate) {
  useEffect(() => {
    const unsubscribe = base44.entities.UserGoals.subscribe((event) => {
      if (event.type === 'update') {
        console.log(`[UI SYNC] Wallet → balance: ${event.data.wallet_balance}, earned: ${event.data.total_earned}`);
        onWalletUpdate?.(event.data);
      }
    });

    return () => unsubscribe?.();
  }, [onWalletUpdate]);
}

export function useRealtimeNotificationSync(onNotificationUpdate) {
  useEffect(() => {
    const unsubscribe = base44.entities.Notification.subscribe((event) => {
      if (event.type === 'create') {
        console.log(`[UI SYNC] New notification: ${event.data.title}`);
        onNotificationUpdate?.(event.data);
      }
    });

    return () => unsubscribe?.();
  }, [onNotificationUpdate]);
}

/**
 * Multi-entity sync hook
 * Watches multiple entities and aggregates changes for global dashboard
 */
export function useRealtimePlatformSync(callbacks) {
  useEffect(() => {
    const unsubscribers = [];

    if (callbacks.onTaskChange) {
      unsubscribers.push(
        base44.entities.TaskExecutionQueue.subscribe((event) => {
          if (event.type === 'update') callbacks.onTaskChange(event);
        })
      );
    }

    if (callbacks.onInterventionChange) {
      unsubscribers.push(
        base44.entities.UserIntervention.subscribe((event) => {
          if (event.type === 'update' || event.type === 'create') {
            callbacks.onInterventionChange(event);
          }
        })
      );
    }

    if (callbacks.onWalletChange) {
      unsubscribers.push(
        base44.entities.UserGoals.subscribe((event) => {
          if (event.type === 'update') callbacks.onWalletChange(event);
        })
      );
    }

    if (callbacks.onTransactionChange) {
      unsubscribers.push(
        base44.entities.Transaction.subscribe((event) => {
          if (event.type === 'create') callbacks.onTransactionChange(event);
        })
      );
    }

    return () => {
      unsubscribers.forEach(unsub => unsub?.());
    };
  }, [callbacks]);
}