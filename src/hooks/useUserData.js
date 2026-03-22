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