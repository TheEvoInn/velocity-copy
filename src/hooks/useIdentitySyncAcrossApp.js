import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * useIdentitySyncAcrossApp
 *
 * Subscribes to entity-level changes that might NOT produce an
 * ActivityLog entry (which is what realtimeEventBus listens to).
 * This acts as a safety net — if a mutation does produce a log,
 * both systems fire but React Query deduplicates the refetch.
 *
 * RULES:
 *   1. Each subscription invalidates ONLY its own direct cache keys.
 *   2. No cross-entity invalidation (that caused cascade storms).
 *   3. All cache key strings must match useQueryHooks.js / useUserData.js.
 *   4. Uses bare prefix keys so React Query partial-matches all
 *      user-scoped entries (['identities'] matches ['identities', email]).
 */
export function useIdentitySyncAcrossApp() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // ── AIIdentity ──
    const unsubAI = base44.entities.AIIdentity.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['identities'] });
      queryClient.invalidateQueries({ queryKey: ['activeIdentity'] });
      queryClient.invalidateQueries({ queryKey: ['aiIdentities'] });
    });

    // ── KYCVerification ──
    const unsubKYC = base44.entities.KYCVerification.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['identities'] });
      queryClient.invalidateQueries({ queryKey: ['activeIdentity'] });
    });

    // ── UserGoals ──
    const unsubGoals = base44.entities.UserGoals.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['userGoals'] });
    });

    // ── CredentialVault ──
    const unsubCreds = base44.entities.CredentialVault.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['identityCredentials'] });
    });

    // ── AITask ──
    const unsubTasks = base44.entities.AITask.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['aiTasks'] });
      queryClient.invalidateQueries({ queryKey: ['taskExecutions'] });
    });

    // ── WorkflowTemplate ──
    const unsubWfTemplates = base44.entities.WorkflowTemplate.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['workflowTemplatesSaved'] });
    });

    // ── Transaction ──
    // Also refresh userGoals because wallet_balance lives there
    const unsubTx = base44.entities.Transaction.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['walletTxs'] });
      queryClient.invalidateQueries({ queryKey: ['userGoals'] });
    });

    return () => {
      unsubAI?.();
      unsubKYC?.();
      unsubGoals?.();
      unsubCreds?.();
      unsubTasks?.();
      unsubWfTemplates?.();
      unsubTx?.();
    };
  }, [queryClient]);
}
