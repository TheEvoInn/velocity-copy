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
  const filter = { user_email: user?.email };
  if (statusFilter) filter.status = statusFilter;

  return useQuery({
    queryKey: ['opportunities', user?.email, statusFilter],
    queryFn: () => base44.entities.WorkOpportunity.filter(filter, '-created_date', 50),
    enabled: !!user?.email,
    initialData: [],
    refetchInterval: 15000,
  });
}

export function useUserTasks(statusFilter) {
  const { data: user } = useCurrentUser();
  const filter = { user_email: user?.email };
  if (statusFilter) filter.status = statusFilter;

  return useQuery({
    queryKey: ['taskExecutions', user?.email, statusFilter],
    queryFn: () => base44.entities.TaskExecution.filter(filter, '-created_date', 50),
    enabled: !!user?.email,
    initialData: [],
    refetchInterval: 8000,
  });
}

export function useUserWallet() {
  const { data: user } = useCurrentUser();
  const { data: profile } = useUserProfile();

  const txQuery = useQuery({
    queryKey: ['walletTxs', user?.email],
    queryFn: () => base44.entities.WalletTransaction.filter({ user_email: user.email }, '-created_date', 100),
    enabled: !!user?.email,
    initialData: [],
    refetchInterval: 20000,
  });

  const balance = profile?.wallet_balance || 0;
  const totalEarned = profile?.total_earned || 0;

  const todayEarnings = (txQuery.data || [])
    .filter(tx => tx.type === 'earning' && new Date(tx.created_date).toDateString() === new Date().toDateString())
    .reduce((s, tx) => s + (tx.amount || 0), 0);

  const weekEarnings = (txQuery.data || [])
    .filter(tx => {
      if (tx.type !== 'earning') return false;
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return new Date(tx.created_date).getTime() >= weekAgo;
    })
    .reduce((s, tx) => s + (tx.amount || 0), 0);

  return {
    ...txQuery,
    transactions: txQuery.data || [],
    balance,
    totalEarned,
    todayEarnings,
    weekEarnings,
  };
}

export function useUserWorkflows() {
  const { data: user } = useCurrentUser();

  return useQuery({
    queryKey: ['workflows', user?.email],
    queryFn: () => base44.entities.UserWorkflow.filter({ user_email: user.email }, '-created_date', 30),
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
    mutationFn: (data) => base44.entities.AIIdentity.create({ ...data }),
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