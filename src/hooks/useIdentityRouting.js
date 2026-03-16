import { useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export function useIdentityRouting() {
  // Get KYC status
  const { data: kycStatus = {}, isLoading: loadingKYC } = useQuery({
    queryKey: ['kycStatus'],
    queryFn: async () => {
      const response = await base44.functions.invoke('identityRoutingEngine', {
        action: 'get_kyc_status'
      });
      return response.data;
    },
  });

  // Detect required identity for a task
  const detectIdentity = useMutation({
    mutationFn: async (taskData) => {
      const response = await base44.functions.invoke('identityRoutingEngine', {
        action: 'detect',
        ...taskData
      });
      return response.data;
    },
  });

  // Switch identity for a task
  const switchIdentity = useMutation({
    mutationFn: async ({ task_id, new_identity }) => {
      const response = await base44.functions.invoke('identityRoutingEngine', {
        action: 'switch',
        task_id,
        new_identity
      });
      return response.data;
    },
  });

  // Log KYC access
  const logKYCAccess = useMutation({
    mutationFn: async ({ module, task_id, purpose }) => {
      const response = await base44.functions.invoke('identityRoutingEngine', {
        action: 'log_access',
        module,
        task_id,
        purpose
      });
      return response.data;
    },
  });

  // Determine which identity to use for an opportunity
  const getIdentityForOpportunity = async (opportunity) => {
    try {
      const result = await detectIdentity.mutateAsync({
        opportunity_id: opportunity.id,
        task_type: opportunity.opportunity_type,
        platform: opportunity.platform,
        category: opportunity.category,
        estimated_value: opportunity.profit_estimate_high || 0
      });

      return {
        identity_type: result.identity_type,
        requires_kyc: result.requires_kyc,
        can_proceed: result.can_proceed,
        reason: result.routing_reason,
        kyc_status: result.kyc_status
      };
    } catch (error) {
      console.error('Failed to detect identity:', error);
      // Default to persona if detection fails
      return {
        identity_type: 'persona',
        requires_kyc: false,
        can_proceed: true,
        reason: 'Default to persona (detection failed)',
        error: error.message
      };
    }
  };

  // Check if task can proceed with current identity setup
  const canProceedWithTask = (opportunity) => {
    // If no KYC available, persona-only tasks can proceed
    if (!kycStatus.kyc_approved && opportunity.profit_estimate_high < 500) {
      return true;
    }

    // If KYC is required but not approved, block
    if (
      (opportunity.opportunity_type === 'financial' ||
        opportunity.platform?.includes('stripe') ||
        opportunity.platform?.includes('paypal')) &&
      !kycStatus.kyc_approved
    ) {
      return false;
    }

    return true;
  };

  return {
    // State
    kycStatus,
    isLoadingKYC: loadingKYC,

    // Methods
    getIdentityForOpportunity,
    canProceedWithTask,
    switchIdentity: switchIdentity.mutateAsync,
    logKYCAccess: logKYCAccess.mutateAsync,

    // Loading states
    isDetecting: detectIdentity.isPending,
    isSwitching: switchIdentity.isPending,
    isLoggingAccess: logKYCAccess.isPending,

    // Helpers
    isKYCApproved: kycStatus.approved === true,
    isKYCVerified: kycStatus.verified === true,
    kycRequired: kycStatus.kyc_status === 'approved'
  };
}

export default useIdentityRouting;