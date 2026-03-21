/**
 * ONBOARDING SYNC HOOK
 * Connects onboarding completion to platform-wide syncing and Autopilot activation
 * Extends realtimeEventBus to ensure all systems receive onboarding data
 */

import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { DeptBus, DEPT_EVENTS } from '@/lib/departmentBus';

export function useOnboardingSync() {
  const queryClient = useQueryClient();

  const triggerFullPlatformSync = useCallback(async () => {
    try {
      // Invalidate all major cache keys to trigger platform-wide refresh
      const cacheKeysToInvalidate = [
        'userGoals',
        'aiIdentities',
        'transactions',
        'workflows',
        'opportunities',
        'tasks',
        'kycVerification',
        'cryptoWallets',
        'encryptedCredentials',
        'activityLogs',
        'webhookConfigs'
      ];

      cacheKeysToInvalidate.forEach(key => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });

      // Emit department-wide update
      DeptBus.emit(DEPT_EVENTS.USER_SETTINGS_CHANGED, {
        event: 'onboarding_complete',
        timestamp: new Date().toISOString(),
        requiresSync: true
      });

      // Log the cascade
      await base44.functions.invoke('onboardingOrchestratorEngine', {
        action: 'sync_to_platforms'
      });

    } catch (error) {
      console.error('Full platform sync error:', error);
    }
  }, [queryClient]);

  const activateAutopilotAfterOnboarding = useCallback(async () => {
    try {
      // Wait for sync to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Invoke autopilotScheduler to begin continuous cycles
      const response = await base44.functions.invoke('autopilotScheduler', {
        action: 'run_continuous_cycle'
      });

      return response.data;
    } catch (error) {
      console.error('Autopilot activation error:', error);
      throw error;
    }
  }, []);

  const onOnboardingComplete = useCallback(async () => {
    try {
      // Step 1: Trigger full platform sync
      await triggerFullPlatformSync();

      // Step 2: Activate Autopilot
      const autopilotResult = await activateAutopilotAfterOnboarding();

      return {
        success: true,
        sync_complete: true,
        autopilot_active: true,
        autopilot_result: autopilotResult
      };
    } catch (error) {
      console.error('Onboarding completion sync error:', error);
      throw error;
    }
  }, [triggerFullPlatformSync, activateAutopilotAfterOnboarding]);

  return {
    triggerFullPlatformSync,
    activateAutopilotAfterOnboarding,
    onOnboardingComplete
  };
}