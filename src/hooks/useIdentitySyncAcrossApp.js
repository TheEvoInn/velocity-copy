import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * useIdentitySyncAcrossApp
 * Platform-wide real-time sync hook — subscribes to ALL key entity changes
 * and invalidates every dependent query cache across the full platform.
 * Mounted once in AppLayout so every page benefits automatically.
 */
export function useIdentitySyncAcrossApp() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // AIIdentity — affects identity hub, autopilot, active identity banner, discovery personalization, persona workflows
    const unsubAI = base44.entities.AIIdentity.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['identities'] });
      queryClient.invalidateQueries({ queryKey: ['activeIdentity'] });
      queryClient.invalidateQueries({ queryKey: ['aiIdentities'] });
      queryClient.invalidateQueries({ queryKey: ['userGoals'] });
      queryClient.invalidateQueries({ queryKey: ['kycVerification'] });
      queryClient.invalidateQueries({ queryKey: ['credentialVault'] });
      queryClient.invalidateQueries({ queryKey: ['workflowTemplates'] }); // sync persona workflows
    });

    // KYCVerification — affects identity hub, autopilot clearances, task eligibility
    const unsubKYC = base44.entities.KYCVerification.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['kycVerification'] });
      queryClient.invalidateQueries({ queryKey: ['identities'] });
      queryClient.invalidateQueries({ queryKey: ['activeIdentity'] });
    });

    // UserGoals — affects dashboard metrics, finance command, autopilot config, discovery scan params
    const unsubGoals = base44.entities.UserGoals.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['userGoals'] });
      queryClient.invalidateQueries({ queryKey: ['identities'] });
      queryClient.invalidateQueries({ queryKey: ['walletTxs'] });
      // Dashboard metrics depend on goals
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    });

    // WithdrawalPolicy — affects finance command, wallet, engine audit
    const unsubPolicy = base44.entities.WithdrawalPolicy.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['withdrawalPolicy'] });
    });

    // CredentialVault — affects identity hub credentials tab, autopilot readiness
    const unsubCreds = base44.entities.CredentialVault.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['identityCredentials'] });
      queryClient.invalidateQueries({ queryKey: ['credentialVault'] });
      queryClient.invalidateQueries({ queryKey: ['identities'] });
    });

    // AITask — affects dashboard active tasks count, autopilot hub, execution engine
    const unsubTasks = base44.entities.AITask.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['aiTasks'] });
      queryClient.invalidateQueries({ queryKey: ['taskExecutions'] });
      queryClient.invalidateQueries({ queryKey: ['executionTasks'] });
    });

    // WorkflowTemplate — sync across Identity Hub and Templates Library
    const unsubWfTemplates = base44.entities.WorkflowTemplate.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['workflowTemplates'] });
    });

    // Transaction — affects finance command, wallet balance, dashboard earnings
    const unsubTx = base44.entities.Transaction.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['walletTxs'] });
      queryClient.invalidateQueries({ queryKey: ['userGoals'] }); // wallet_balance lives in goals
    });

    return () => {
      unsubAI?.();
      unsubKYC?.();
      unsubGoals?.();
      unsubPolicy?.();
      unsubCreds?.();
      unsubTasks?.();
      unsubWfTemplates?.();
      unsubTx?.();
    };
  }, [queryClient]);
}