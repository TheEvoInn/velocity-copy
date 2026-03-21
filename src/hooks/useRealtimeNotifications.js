import { useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { notifyHighValueOpportunity, notifyTaskFailure, notifyAutopilotAction } from '@/services/notificationService';

const WALLET_INCREASE_THRESHOLD = 50;
const OPPORTUNITY_VALUE_THRESHOLD = 100;

function requestPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function sendBrowserNotification(title, body, icon = '💰') {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: `profit-engine-${Date.now()}`,
    });
  } catch (e) {
    console.error('Failed to send browser notification:', e);
  }
}

export function useRealtimeNotifications() {
  const seenTxIds = useRef(new Set());
  const seenOppIds = useRef(new Set());
  const seenTaskIds = useRef(new Set());
  const initialized = useRef(false);

  const requestPermissionIfNeeded = useCallback(() => {
    requestPermission();
  }, []);

  useEffect(() => {
    requestPermission();

    // --- Transaction subscription ---
    const unsubTx = base44.entities.Transaction.subscribe((event) => {
      if (event.type !== 'create') return;
      const tx = event.data;
      if (!tx || seenTxIds.current.has(event.id)) return;
      seenTxIds.current.add(event.id);

      if (!initialized.current) return;

      if (tx.type === 'income') {
        const amount = tx.net_amount ?? tx.amount ?? 0;
        if (amount >= WALLET_INCREASE_THRESHOLD) {
          sendBrowserNotification(
            '💸 Income Received!',
            `+$${amount.toFixed(2)} added to your wallet${tx.platform ? ` from ${tx.platform}` : ''}${tx.description ? ` — ${tx.description}` : ''}`
          );
        }
      }
    });

    // --- Opportunity subscription for high-value detection ---
    const unsubOpp = base44.entities.Opportunity.subscribe((event) => {
      if (event.type !== 'update' && event.type !== 'create') return;
      const opp = event.data;
      if (!opp || seenOppIds.current.has(event.id)) return;

      if (!initialized.current) return;

      // High-value opportunity detected
      const value = ((opp.profit_estimate_low ?? 0) + (opp.profit_estimate_high ?? 0)) / 2;
      if (value >= 300 && opp.status === 'new') {
        seenOppIds.current.add(event.id);
        notifyHighValueOpportunity({
          opportunityId: event.id,
          title: opp.title,
          platform: opp.platform,
          estimatedValue: Math.round(value),
          category: opp.category,
          timeUntilDeadline: opp.deadline ? new Date(opp.deadline).toLocaleDateString() : null,
        });
      }

      // Completed opportunity
      if (opp.status === 'completed') {
        seenOppIds.current.add(event.id);
        if (value >= OPPORTUNITY_VALUE_THRESHOLD || opp.submission_confirmed) {
          sendBrowserNotification(
            '🎯 Opportunity Completed!',
            `"${opp.title}" finished${value > 0 ? ` — Est. $${value.toFixed(0)} profit` : ''}${opp.platform ? ` via ${opp.platform}` : ''}`
          );
        }
      }
    });

    // --- Task failure subscription ---
    const unsubTask = base44.entities.TaskExecutionQueue.subscribe((event) => {
      if (event.type !== 'update') return;
      const task = event.data;
      if (!task || seenTaskIds.current.has(event.id)) return;

      if (!initialized.current) return;

      if (task.status === 'failed' || task.status === 'needs_review') {
        seenTaskIds.current.add(event.id);
        notifyTaskFailure({
          taskId: event.id,
          platform: task.platform,
          opportunityTitle: task.opportunity_id || 'Unknown',
          errorType: task.error_type || 'unknown',
          errorMessage: task.error_message,
          isRetryable: (task.retry_count || 0) < (task.max_retries || 2),
        });
      }
    });

    // Mark as initialized after delay
    const initTimer = setTimeout(() => {
      initialized.current = true;
    }, 3000);

    return () => {
      unsubTx();
      unsubOpp();
      unsubTask();
      clearTimeout(initTimer);
    };
  }, []);

  return { requestPermissionIfNeeded };
}