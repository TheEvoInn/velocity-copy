import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

export function useRealtimeEventBus() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.email) return;

    const unsubscribe = base44.entities.ActivityLog.subscribe((event) => {
      if (event.type === 'create') {
        const log = event.data;
        if (!log) return;

        const { metadata } = log;
        if (!metadata) return;

        const { entity_name, event_id } = metadata;

        // ── Dedup: check user-scoped activityLogs cache ──
        const recentLogs =
          queryClient.getQueryData(['activityLogs', user.email]) || [];
        const isDuplicate = recentLogs.some(
          (l) => l?.metadata?.event_id === event_id
        );
        if (isDuplicate) return;

        // ── Cache invalidation map ──
        // Keys are BARE PREFIXES — React Query partial-matches all
        // cache entries starting with that prefix, so ['opportunities']
        // invalidates ['opportunities', email], etc.
        //
        // VERIFIED against useQueryHooks.js + useUserData.js cache keys:
        //   userGoals, opportunities, aiTasks, taskExecutions,
        //   cryptoTransactions, cryptoWallets, activityLogs, aiIdentities,
        //   workflows, userWorkflows, workflowTemplatesSaved, linkedAccounts,
        //   currentUser, userProfile, identities, activeIdentity,
        //   walletTxs, identityCredentials
        const cacheInvalidations = {
          Opportunity: ['opportunities'],
          WorkOpportunity: ['opportunities'],
          AITask: ['aiTasks', 'taskExecutions'],
          TaskExecution: ['taskExecutions', 'aiTasks'],
          Transaction: ['walletTxs', 'userGoals'],
          WalletTransaction: ['walletTxs'],
          CryptoTransaction: ['cryptoTransactions'],
          CryptoWallet: ['cryptoWallets'],
          AIIdentity: ['identities', 'activeIdentity', 'aiIdentities'],
          UserGoals: ['userGoals'],
          ActivityLog: ['activityLogs'],
          UserWorkflow: ['workflows', 'userWorkflows'],
          Workflow: ['workflows'],
          WorkflowTemplate: ['workflowTemplatesSaved'],
          KYCVerification: ['identities', 'activeIdentity'],
          CredentialVault: ['identityCredentials'],
          UserProfile: ['userProfile'],
          EngineAuditLog: ['activityLogs'],
          LinkedAccount: ['linkedAccounts'],
          AutopilotSetting: ['userGoals'],
        };

        const keysToInvalidate = entity_name
          ? cacheInvalidations[entity_name] || [entity_name.toLowerCase()]
          : [];

        keysToInvalidate.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });

        // ── Optimistic prepend — use user-scoped key ──
        queryClient.setQueryData(
          ['activityLogs', user.email],
          (old) => [log, ...(old || [])].slice(0, 100)
        );
      }
    });

    return () => unsubscribe?.();
  }, [queryClient, user?.email]);
}
