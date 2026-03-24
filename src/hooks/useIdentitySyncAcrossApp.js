import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * useIdentitySyncAcrossApp
 * Subscribes to ALL identity-related entity changes and syncs across the entire platform.
 * Ensures KYC, Identities, Goals, and Preferences always stay in sync.
 */
export function useIdentitySyncAcrossApp() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscribe to AIIdentity changes
    const unsubAI = base44.entities.AIIdentity.subscribe((event) => {
      queryClient.invalidateQueries({ queryKey: ['identities'] });
      queryClient.invalidateQueries({ queryKey: ['userGoals'] });
      queryClient.invalidateQueries({ queryKey: ['kycVerification'] });
      queryClient.invalidateQueries({ queryKey: ['withdrawalPolicy'] });
    });

    // Subscribe to KYCVerification changes
    const unsubKYC = base44.entities.KYCVerification.subscribe((event) => {
      queryClient.invalidateQueries({ queryKey: ['kycVerification'] });
      queryClient.invalidateQueries({ queryKey: ['identities'] });
    });

    // Subscribe to UserGoals changes
    const unsubGoals = base44.entities.UserGoals.subscribe((event) => {
      queryClient.invalidateQueries({ queryKey: ['userGoals'] });
      queryClient.invalidateQueries({ queryKey: ['identities'] });
    });

    // Subscribe to WithdrawalPolicy changes
    const unsubPolicy = base44.entities.WithdrawalPolicy.subscribe((event) => {
      queryClient.invalidateQueries({ queryKey: ['withdrawalPolicy'] });
      queryClient.invalidateQueries({ queryKey: ['identities'] });
    });

    // Subscribe to CredentialVault changes
    const unsubCreds = base44.entities.CredentialVault.subscribe((event) => {
      queryClient.invalidateQueries({ queryKey: ['identityCredentials'] });
      queryClient.invalidateQueries({ queryKey: ['identities'] });
    });

    // Cleanup subscriptions
    return () => {
      unsubAI?.();
      unsubKYC?.();
      unsubGoals?.();
      unsubPolicy?.();
      unsubCreds?.();
    };
  }, [queryClient]);
}