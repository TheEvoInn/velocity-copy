import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useRealtimeEventBus() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = base44.entities.ActivityLog.subscribe((event) => {
      if (event.type === 'create') {
        const log = event.data;
        if (!log) return;
        const { metadata } = log;
        if (!metadata) return;
        const { entity_name, mutation_type, event_id } = metadata;

        const recentLogs = queryClient.getQueryData(['activityLogs']) || [];
        const isDuplicate = recentLogs.some(l => l?.metadata?.event_id === event_id);
        if (isDuplicate) return;

        const cacheInvalidations = {
          'Opportunity':        ['opportunities'],
          'WorkOpportunity':    ['opportunities'],
          'AITask':             ['aiTasks', 'taskExecutions'],
          'TaskExecution':      ['taskExecutions', 'aiTasks'],
          'Transaction':        ['walletTxs', 'userGoals'],
          'WalletTransaction':  ['walletTxs'],
          'CryptoTransaction':  ['cryptoTransactions'],
          'CryptoWallet':       ['cryptoWallets'],
          'AIIdentity':         ['identities', 'activeIdentity', 'aiIdentities'],
          'UserGoals':          ['userGoals'],
          'ActivityLog':        ['activityLogs'],
          'UserWorkflow':       ['workflows', 'userWorkflows'],
          'Workflow':           ['workflows'],
          'WorkflowTemplate':   ['workflowTemplatesSaved'],
          'KYCVerification':    ['identities', 'activeIdentity'],
          'CredentialVault':    ['identityCredentials'],
          'UserProfile':        ['userProfile'],
          'EngineAuditLog':     ['activityLogs'],
          'LinkedAccount':      ['linkedAccounts'],
          'AutopilotSetting':   ['autopilotSettings'],
        };

        const keysToInvalidate = entity_name
          ? (cacheInvalidations[entity_name] || [entity_name.toLowerCase()])
          : [];

        keysToInvalidate.forEach(key => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });

        queryClient.setQueryData(['activityLogs'], (old) => {
          return [log, ...(old || [])].slice(0, 100);
        });
      }
    });

    return () => unsubscribe?.();
  }, [queryClient]);
}
