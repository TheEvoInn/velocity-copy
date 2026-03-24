import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// Query key factory for consistent cache management
export const queryKeys = {
  all: ['data'],
  
  // User & Goals
  userGoals: () => [...queryKeys.all, 'userGoals'],
  userGoalsDetail: (id) => [...queryKeys.userGoals(), id],
  
  // Opportunities
  opportunities: () => [...queryKeys.all, 'opportunities'],
  opportunitiesByStatus: (status) => [...queryKeys.opportunities(), status],
  opportunityDetail: (id) => [...queryKeys.opportunities(), id],
  
  // AI Tasks
  aiTasks: () => [...queryKeys.all, 'aiTasks'],
  aiTasksByStatus: (status) => [...queryKeys.aiTasks(), status],
  aiTaskDetail: (id) => [...queryKeys.aiTasks(), id],
  
  // Crypto
  cryptoTransactions: () => [...queryKeys.all, 'cryptoTransactions'],
  cryptoWallets: () => [...queryKeys.all, 'cryptoWallets'],
  
  // Activity Logs
  activityLogs: () => [...queryKeys.all, 'activityLogs'],
  
  // AI Identities
  aiIdentities: () => [...queryKeys.all, 'aiIdentities'],
  
  // Workflows
  workflows: () => [...queryKeys.all, 'workflows'],
};

// ===== USER & GOALS =====
export function useUserGoals() {
  return useQuery({
    queryKey: queryKeys.userGoals(),
    queryFn: async () => {
      try {
        return await base44.entities.UserGoals?.list?.() || [];
      } catch (error) {
        console.error('Failed to fetch user goals:', error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}

// ===== OPPORTUNITIES =====
export function useOpportunities(filters = {}) {
  return useQuery({
    queryKey: queryKeys.opportunitiesByStatus(JSON.stringify(filters)),
    queryFn: async () => {
      try {
        if (Object.keys(filters).length > 0) {
          return await base44.entities.Opportunity?.filter?.(filters, '-created_date', 100) || [];
        }
        return await base44.entities.Opportunity?.list?.('-created_date', 100) || [];
      } catch (error) {
        console.error('Failed to fetch opportunities:', error);
        return [];
      }
    },
    staleTime: 3 * 60 * 1000, // 3 minutes
    retry: 2,
  });
}

export function useOpportunitiesByStatus(status) {
  return useOpportunities({ status });
}

// ===== AI TASKS =====
export function useAITasks(filters = {}) {
  return useQuery({
    queryKey: queryKeys.aiTasksByStatus(JSON.stringify(filters)),
    queryFn: async () => {
      try {
        if (Object.keys(filters).length > 0) {
          return await base44.entities.AITask?.filter?.(filters, '-created_date', 100) || [];
        }
        return await base44.entities.AITask?.list?.('-created_date', 100) || [];
      } catch (error) {
        console.error('Failed to fetch AI tasks:', error);
        return [];
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 2,
  });
}

export function useAITasksByStatus(status) {
  return useAITasks({ status });
}

// ===== CRYPTO TRANSACTIONS =====
export function useCryptoTransactions() {
  return useQuery({
    queryKey: queryKeys.cryptoTransactions(),
    queryFn: async () => {
      try {
        return await base44.entities.CryptoTransaction?.list?.('-created_date', 100) || [];
      } catch (error) {
        console.error('Failed to fetch crypto transactions:', error);
        return [];
      }
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    retry: 2,
  });
}

// ===== CRYPTO WALLETS =====
export function useCryptoWallets() {
  return useQuery({
    queryKey: queryKeys.cryptoWallets(),
    queryFn: async () => {
      try {
        return await base44.entities.CryptoWallet?.list?.() || [];
      } catch (error) {
        console.error('Failed to fetch crypto wallets:', error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}

// ===== ACTIVITY LOGS =====
export function useActivityLogs(limit = 50) {
  return useQuery({
    queryKey: queryKeys.activityLogs(),
    queryFn: async () => {
      try {
        return await base44.entities.ActivityLog?.list?.('-created_date', limit) || [];
      } catch (error) {
        console.error('Failed to fetch activity logs:', error);
        return [];
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 2,
  });
}

// ===== AI IDENTITIES =====
export function useAIIdentities() {
  return useQuery({
    queryKey: queryKeys.aiIdentities(),
    queryFn: async () => {
      try {
        return await base44.entities.AIIdentity?.list?.() || [];
      } catch (error) {
        console.error('Failed to fetch AI identities:', error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}

// ===== WORKFLOWS =====
export function useWorkflows() {
  return useQuery({
    queryKey: queryKeys.workflows(),
    queryFn: async () => {
      try {
        return await base44.entities.Workflow?.list?.('-updated_date', 100) || [];
      } catch (error) {
        console.error('Failed to fetch workflows:', error);
        return [];
      }
    },
    staleTime: 60 * 1000, // 1 minute — fresher for sync
    retry: 2,
  });
}

export function useUserWorkflows() {
  return useQuery({
    queryKey: [...queryKeys.all, 'userWorkflows'],
    queryFn: async () => {
      try {
        return await base44.entities.UserWorkflow?.list?.('-updated_date', 100) || [];
      } catch (error) {
        console.error('Failed to fetch user workflows:', error);
        return [];
      }
    },
    staleTime: 60 * 1000,
    retry: 2,
  });
}

export function useWorkflowTemplatesSaved() {
  return useQuery({
    queryKey: [...queryKeys.all, 'workflowTemplatesSaved'],
    queryFn: async () => {
      try {
        return await base44.entities.WorkflowTemplate?.list?.('-updated_date', 100) || [];
      } catch (error) {
        console.error('Failed to fetch workflow templates:', error);
        return [];
      }
    },
    staleTime: 60 * 1000,
    retry: 2,
  });
}

// ===== MUTATIONS =====
export function useUpdateOpportunity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }) => {
      return await base44.entities.Opportunity?.update?.(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.opportunities() });
    },
    onError: (error) => {
      console.error('Failed to update opportunity:', error);
    },
  });
}

export function useUpdateAITask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }) => {
      return await base44.entities.AITask?.update?.(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiTasks() });
    },
    onError: (error) => {
      console.error('Failed to update AI task:', error);
    },
  });
}

export function useUpdateUserGoals() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }) => {
      return await base44.entities.UserGoals?.update?.(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userGoals() });
    },
    onError: (error) => {
      console.error('Failed to update user goals:', error);
    },
  });
}

// ===== INVALIDATION HELPERS =====
export function useInvalidateQueries() {
  const queryClient = useQueryClient();
  
  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: queryKeys.all }),
    invalidateOpportunities: () => queryClient.invalidateQueries({ queryKey: queryKeys.opportunities() }),
    invalidateAITasks: () => queryClient.invalidateQueries({ queryKey: queryKeys.aiTasks() }),
    invalidateUserGoals: () => queryClient.invalidateQueries({ queryKey: queryKeys.userGoals() }),
    invalidateCrypto: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cryptoTransactions() });
      queryClient.invalidateQueries({ queryKey: queryKeys.cryptoWallets() });
    },
  };
}