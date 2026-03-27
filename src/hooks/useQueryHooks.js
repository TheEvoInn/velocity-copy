import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

/**
 * Query key factory — keys now include user email for multi-tenant isolation.
 * Bare prefix arrays (without email) are used for invalidation so React Query
 * partial-matches all keys that start with that prefix.
 */
export const queryKeys = {
  all:                        ['velocity'],
  userGoals:         (email) => ['userGoals', email],
  opportunities:     (email) => ['opportunities', email],
  opportunitiesByStatus: (email, status) => ['opportunities', email, status],
  aiTasks:           (email) => ['aiTasks', email],
  aiTasksByStatus:   (email, status) => ['aiTasks', email, status],
  taskExecutions:    (email) => ['taskExecutions', email],
  cryptoTransactions:(email) => ['cryptoTransactions', email],
  cryptoWallets:     (email) => ['cryptoWallets', email],
  activityLogs:      (email) => ['activityLogs', email],
  aiIdentities:      (email) => ['aiIdentities', email],
  workflows:         (email) => ['workflows', email],
  userWorkflows:     (email) => ['userWorkflows', email],
  workflowTemplatesSaved: (email) => ['workflowTemplatesSaved', email],
  linkedAccounts:    (email) => ['linkedAccounts', email],
};

// ===== USER & GOALS =====

export function useUserGoals() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.userGoals(user?.email),
    queryFn: async () => {
      if (!user?.email) return [];
      try {
        return await base44.entities.UserGoals.filter(
          { created_by: user.email }, '-created_date', 100
        );
      } catch (error) {
        console.error('Failed to fetch user goals:', error);
        return [];
      }
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

// ===== OPPORTUNITIES =====

export function useOpportunities(filters = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.opportunitiesByStatus(user?.email, JSON.stringify(filters)),
    queryFn: async () => {
      if (!user?.email) return [];
      try {
        const combinedFilter = { created_by: user.email, ...filters };
        return await base44.entities.Opportunity.filter(
          combinedFilter, '-created_date', 100
        );
      } catch (error) {
        console.error('Failed to fetch opportunities:', error);
        return [];
      }
    },
    enabled: !!user?.email,
    staleTime: 3 * 60 * 1000,
    retry: 2,
  });
}

export function useOpportunitiesByStatus(status) {
  return useOpportunities({ status });
}

// ===== AI TASKS =====

export function useAITasks(filters = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.aiTasksByStatus(user?.email, JSON.stringify(filters)),
    queryFn: async () => {
      if (!user?.email) return [];
      try {
        const combinedFilter = { created_by: user.email, ...filters };
        return await base44.entities.AITask.filter(
          combinedFilter, '-created_date', 100
        );
      } catch (error) {
        console.error('Failed to fetch AI tasks:', error);
        return [];
      }
    },
    enabled: !!user?.email,
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });
}

export function useAITasksByStatus(status) {
  return useAITasks({ status });
}

// ===== TASK EXECUTIONS =====

export function useTaskExecutions(filters = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.taskExecutions(user?.email),
    queryFn: async () => {
      if (!user?.email) return [];
      try {
        const combinedFilter = { created_by: user.email, ...filters };
        return await base44.entities.TaskExecution.filter(
          combinedFilter, '-created_date', 100
        );
      } catch (error) {
        console.error('Failed to fetch task executions:', error);
        return [];
      }
    },
    enabled: !!user?.email,
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });
}

// ===== CRYPTO TRANSACTIONS =====

export function useCryptoTransactions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.cryptoTransactions(user?.email),
    queryFn: async () => {
      if (!user?.email) return [];
      try {
        return await base44.entities.CryptoTransaction.filter(
          { created_by: user.email }, '-created_date', 100
        );
      } catch (error) {
        console.error('Failed to fetch crypto transactions:', error);
        return [];
      }
    },
    enabled: !!user?.email,
    staleTime: 1 * 60 * 1000,
    retry: 2,
  });
}

// ===== CRYPTO WALLETS =====

export function useCryptoWallets() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.cryptoWallets(user?.email),
    queryFn: async () => {
      if (!user?.email) return [];
      try {
        return await base44.entities.CryptoWallet.filter(
          { created_by: user.email }, '-created_date', 100
        );
      } catch (error) {
        console.error('Failed to fetch crypto wallets:', error);
        return [];
      }
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

// ===== ACTIVITY LOGS =====

export function useActivityLogs(limit = 50) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.activityLogs(user?.email),
    queryFn: async () => {
      if (!user?.email) return [];
      try {
        return await base44.entities.ActivityLog.filter(
          { created_by: user.email }, '-created_date', limit
        );
      } catch (error) {
        console.error('Failed to fetch activity logs:', error);
        return [];
      }
    },
    enabled: !!user?.email,
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });
}

// ===== AI IDENTITIES =====

export function useAIIdentities() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.aiIdentities(user?.email),
    queryFn: async () => {
      if (!user?.email) return [];
      try {
        return await base44.entities.AIIdentity.filter(
          { created_by: user.email }, '-created_date', 100
        );
      } catch (error) {
        console.error('Failed to fetch AI identities:', error);
        return [];
      }
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

// ===== WORKFLOWS =====

export function useWorkflows() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.workflows(user?.email),
    queryFn: async () => {
      if (!user?.email) return [];
      try {
        return await base44.entities.Workflow.filter(
          { created_by: user.email }, '-updated_date', 100
        );
      } catch (error) {
        console.error('Failed to fetch workflows:', error);
        return [];
      }
    },
    enabled: !!user?.email,
    staleTime: 60 * 1000,
    retry: 2,
  });
}

export function useUserWorkflows() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.userWorkflows(user?.email),
    queryFn: async () => {
      if (!user?.email) return [];
      try {
        return await base44.entities.UserWorkflow.filter(
          { created_by: user.email }, '-updated_date', 100
        );
      } catch (error) {
        console.error('Failed to fetch user workflows:', error);
        return [];
      }
    },
    enabled: !!user?.email,
    staleTime: 60 * 1000,
    retry: 2,
  });
}

export function useWorkflowTemplatesSaved() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.workflowTemplatesSaved(user?.email),
    queryFn: async () => {
      if (!user?.email) return [];
      try {
        return await base44.entities.WorkflowTemplate.filter(
          { created_by: user.email }, '-updated_date', 100
        );
      } catch (error) {
        console.error('Failed to fetch workflow templates:', error);
        return [];
      }
    },
    enabled: !!user?.email,
    staleTime: 60 * 1000,
    retry: 2,
  });
}

// ===== LINKED ACCOUNTS =====

export function useLinkedAccounts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.linkedAccounts(user?.email),
    queryFn: async () => {
      if (!user?.email) return [];
      try {
        return await base44.entities.LinkedAccount.filter(
          { created_by: user.email }, '-created_date', 100
        );
      } catch (error) {
        console.error('Failed to fetch linked accounts:', error);
        return [];
      }
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

// ===== MUTATIONS =====
// onSuccess invalidation uses bare prefix keys so React Query partial-matches
// all cache entries starting with that prefix (regardless of email suffix).

export function useUpdateOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => await base44.entities.Opportunity.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['opportunities'] }),
    onError: (error) => console.error('Failed to update opportunity:', error),
  });
}

export function useUpdateAITask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => await base44.entities.AITask.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['aiTasks'] }),
    onError: (error) => console.error('Failed to update AI task:', error),
  });
}

export function useUpdateUserGoals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => await base44.entities.UserGoals.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['userGoals'] }),
    onError: (error) => console.error('Failed to update user goals:', error),
  });
}

// ===== INVALIDATION HELPERS =====

export function useInvalidateQueries() {
  const queryClient = useQueryClient();
  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: queryKeys.all }),
    invalidateOpportunities: () => queryClient.invalidateQueries({ queryKey: ['opportunities'] }),
    invalidateAITasks: () => queryClient.invalidateQueries({ queryKey: ['aiTasks'] }),
    invalidateUserGoals: () => queryClient.invalidateQueries({ queryKey: ['userGoals'] }),
    invalidateCrypto: () => {
      queryClient.invalidateQueries({ queryKey: ['cryptoTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['cryptoWallets'] });
    },
  };
}
