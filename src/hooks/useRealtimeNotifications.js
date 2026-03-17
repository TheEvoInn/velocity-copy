import { useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const WALLET_INCREASE_THRESHOLD = 50;   // notify if a single income tx >= $50
const OPPORTUNITY_VALUE_THRESHOLD = 100; // notify if completed opp value >= $100

function requestPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function sendNotification(title, body, icon = '💰') {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: `profit-engine-${Date.now()}`,
    });
  } catch (e) {
    // Silently fail if notifications blocked
  }
}

export function useRealtimeNotifications() {
  const seenTxIds = useRef(new Set());
  const seenOppIds = useRef(new Set());
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

      // Skip seed/initialization phase (first 3 seconds)
      if (!initialized.current) return;

      if (tx.type === 'income') {
        const amount = tx.net_amount ?? tx.amount ?? 0;
        if (amount >= WALLET_INCREASE_THRESHOLD) {
          sendNotification(
            '💸 Income Received!',
            `+$${amount.toFixed(2)} added to your wallet${tx.platform ? ` from ${tx.platform}` : ''}${tx.description ? ` — ${tx.description}` : ''}`
          );
        }
      }
    });

    // --- Opportunity subscription ---
    const unsubOpp = base44.entities.Opportunity.subscribe((event) => {
      if (event.type !== 'update') return;
      const opp = event.data;
      if (!opp || seenOppIds.current.has(event.id)) return;

      // Only fire once per opp completion
      if (opp.status === 'completed') {
        seenOppIds.current.add(event.id);
        if (!initialized.current) return;

        const value = ((opp.profit_estimate_low ?? 0) + (opp.profit_estimate_high ?? 0)) / 2;
        if (value >= OPPORTUNITY_VALUE_THRESHOLD || opp.submission_confirmed) {
          sendNotification(
            '🎯 Opportunity Completed!',
            `"${opp.title}" finished${value > 0 ? ` — Est. $${value.toFixed(0)} profit` : ''}${opp.platform ? ` via ${opp.platform}` : ''}`
          );
        }
      }
    });

    // Mark as initialized after short delay to avoid startup noise
    const initTimer = setTimeout(() => {
      initialized.current = true;
    }, 3000);

    return () => {
      unsubTx();
      unsubOpp();
      clearTimeout(initTimer);
    };
  }, []);

  return { requestPermissionIfNeeded };
}