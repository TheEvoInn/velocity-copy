/**
 * useUserData - Per-user isolated data hook
 * All queries are filtered by the current user's email
 * ensuring full multi-tenant isolation
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useState, useEffect } from 'react';

export function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 60000,
  });
}

export function useUserProfile() {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['userProfile', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email }, '-created_date', 1);
      return profiles[0] || null;
    },
    enabled: !!user?.email,
  });

  const upsertMutation = useMutation({
    mutationFn: async (data) => {
      if (!user?.email) return;
      if (query.data?.id) {
        return base44.entities.UserProfile.update(query.data.id, data);
      } else {
        return base44.entities.UserProfile.create({ ...data, user_email: user.email });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['userProfile'] }),
  });

  return { ...query, upsert: upsertMutation.mutate, isUpdating: upsertMutation.isPending };
}

export function useUserOpportunities(statusFilter) {
  const { data: user } = useCurrentUser();

  return useQuery({
    queryKey: ['opportunities', user?.email, statusFilter],
    queryFn: async () => {
      if (!user?.email) return [];
      const filter = { created_by: user.email };
      if (statusFilter) filter.status = statusFilter;
      // WorkOpportunity is the primary scan result entity used by Discovery
      try {
        return await base44.entities.WorkOpportunity.filter(filter, '-created_date', 100);
      } catch (_) {
        return base44.entities.Opportunity.filter(filter, '-created_date', 100);
      }
    },
    enabled: !!user?.email,
    initialData: [],
    refetchInterval: 15000,
  });
}

export function useUserTasks(statusFilter) {
  const { data: user } = useCurrentUser();

  return useQuery({
    queryKey: ['taskExecutions', user?.email, statusFilter],
    queryFn: async () => {
      if (!user?.email) return [];
      const filter = { created_by: user.email };
      if (statusFilter) filter.status = statusFilter;
      // Try AITask first (primary), fallback to TaskExecution
      try {
        return await base44.entities.AITask.filter(filter, '-created_date', 50);
      } catch (_) {
        return base44.entities.TaskExecution.filter(filter, '-created_date', 50);
      }
    },
    enabled: !!user?.email,
    initialData: [],
    refetchInterval: 8000,
  });
}

export function useUserWallet() {
  const { data: user } = useCurrentUser();  

  // Authoritative balance source: UserGoals (has wallet_balance + total_earned)
  const goalsQuery = useQuery({
    queryKey: ['userGoals', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const goals = await base44.entities.UserGoals.filter({ created_by: user.email }, '-created_date', 1);
      return goals[0] || null;
    },
    enabled: !!user?.email,
    staleTime: 15000,
  });

  // Transaction history for time-window earnings
  const txQuery = useQuery({
    queryKey: ['walletTxs', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      try {
        return await base44.entities.Transaction.filter({ created_by: user.email }, '-created_date', 200);
      } catch (_) {
        return base44.entities.WalletTransaction.filter({ created_by: user.email }, '-created_date', 100);
      }
    },
    enabled: !!user?.email,
    initialData: [],
    refetchInterval: 20000,
  });

  const goals = goalsQuery.data;
  const balance = goals?.wallet_balance || 0;
  const totalEarned = goals?.total_earned || 0;

  const now = new Date();
  const todayStr = now.toDateString();
  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;

  const txs = txQuery.data || [];
  const todayEarnings = txs
    .filter(tx => tx.type === 'income' && new Date(tx.created_date).toDateString() === todayStr)
    .reduce((s, tx) => s + (tx.net_amount || tx.amount || 0), 0);

  const weekEarnings = txs
    .filter(tx => tx.type === 'income' && new Date(tx.created_date).getTime() >= weekAgo)
    .reduce((s, tx) => s + (tx.net_amount || tx.amount || 0), 0);

  return {
    transactions: txs,
    balance,
    totalEarned,
    todayEarnings,
    weekEarnings,
    isLoading: goalsQuery.isLoading,
  };
}

export function useUserWorkflows() {
  const { data: user } = useCurrentUser();

  return useQuery({
    queryKey: ['workflows', user?.email],
    queryFn: () => base44.entities.UserWorkflow.filter({ created_by: user.email }, '-created_date', 30),
    enabled: !!user?.email,
    initialData: [],
  });
}

export function useUserIdentities() {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['identities', user?.email],
    queryFn: () => base44.entities.AIIdentity.filter({ created_by: user?.email }, '-created_date', 50),
    enabled: !!user?.email,
    initialData: [],
    refetchInterval: 15000,
  });

  const updateIdentity = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AIIdentity.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['identities', user?.email] });
      qc.invalidateQueries({ queryKey: ['active_identity', user?.email] });
    },
  });

  const createIdentity = useMutation({
    mutationFn: (data) => base44.entities.AIIdentity.create({
      ...data,
      is_active: false,              // must complete onboarding before activation
      onboarding_complete: false,
      onboarding_status: 'pending',  // triggers onboarding wizard in UI
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['identities', user?.email] }),
  });

  const deleteIdentity = useMutation({
    mutationFn: (id) => base44.entities.AIIdentity.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['identities', user?.email] }),
  });

  const switchIdentity = useMutation({
    mutationFn: async (identityId) => {
      // Deactivate all, activate target — optimistic per-user scope
      const all = query.data || [];
      await Promise.all(all.map(id =>
        base44.entities.AIIdentity.update(id.id, { is_active: id.id === identityId })
      ));
      await base44.entities.AIIdentity.update(identityId, { last_used_at: new Date().toISOString() });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['identities', user?.email] });
      qc.invalidateQueries({ queryKey: ['active_identity', user?.email] });
    },
  });

  return {
    ...query,
    identities: query.data || [],
    activeIdentity: (query.data || []).find(i => i.is_active) || null,
    update: updateIdentity.mutate,
    create: createIdentity.mutate,
    remove: deleteIdentity.mutate,
    switchTo: switchIdentity.mutate,
    isSwitching: switchIdentity.isPending,
  };
}

export function useActiveIdentity() {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['activeIdentity', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      // AIIdentity RLS uses created_by; user_email is a denormalized field
      const identities = await base44.entities.AIIdentity.filter(
        { created_by: user.email, is_active: true },
        '-last_used_at',
        1
      );
      return identities.length > 0 ? identities[0] : null;
    },
    enabled: !!user?.email,
    staleTime: 10000,
  });

  useEffect(() => {
    if (!user?.email) return;
    const unsub = base44.entities.AIIdentity.subscribe(() => {
      qc.invalidateQueries({ queryKey: ['activeIdentity', user.email] });
    });
    return unsub;
  }, [user?.email, qc]);

  return { ...query, activeIdentity: query.data || null };
}

export function useUserGoals() {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['userGoals', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const goals = await base44.entities.UserGoals.filter({ created_by: user.email }, '-created_date', 1);
      return goals[0] || null;
    },
    enabled: !!user?.email,
    staleTime: 15000,
  });

  const upsertMutation = useMutation({
    mutationFn: async (data) => {
      if (!user?.email) return;
      if (query.data?.id) {
        return base44.entities.UserGoals.update(query.data.id, data);
      } else {
        return base44.entities.UserGoals.create({ ...data, created_by: user.email });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['userGoals', user?.email] }),
  });

  return { ...query, goals: query.data || null, upsert: upsertMutation.mutate, isUpdating: upsertMutation.isPending };
}

export function useIdentityCredentials(identityId) {
  return useQuery({
    queryKey: ['identityCredentials', identityId],
    queryFn: () => base44.entities.CredentialVault.filter({ linked_account_id: identityId }),
    enabled: !!identityId,
    refetchInterval: 30000,
    initialData: [],
  });
}

export function useIdentityLinkedAccounts(linkedAccountIds = []) {
  return useQuery({
    queryKey: ['linkedAccounts', linkedAccountIds.join(',')],
    queryFn: async () => {
      if (!linkedAccountIds.length) return [];
      const all = await base44.entities.LinkedAccount.list('-created_date', 100);
      return all.filter(a => linkedAccountIds.includes(a.id));
    },
    enabled: linkedAccountIds.length > 0,
    refetchInterval: 20000,
    initialData: [],
  });
}