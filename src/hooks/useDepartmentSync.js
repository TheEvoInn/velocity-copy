/**
 * useDepartmentSync
 * Shared real-time data hook used by all departments.
 * Provides unified access to cross-department state and the event bus.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { DeptBus, DEPT_EVENTS } from '@/lib/departmentBus';

export function useDepartmentSync() {
  const queryClient = useQueryClient();

  // Fetch user-specific data only (RLS enforced on backend)
  // FIX #3: Aggressive stale time + shorter refetch for consistency
  const { data: goals = [] }        = useQuery({ 
    queryKey: ['userGoals'], 
    queryFn: async () => {
      try {
        const result = await base44.entities.UserGoals.list();
        return Array.isArray(result) ? result.slice(0, 1) : [];
      } catch (err) {
        console.error('Failed to fetch user goals:', err);
        return [];
      }
    },
    initialData: [], 
    refetchInterval: 20000,
    staleTime: 5000
  });
  
  const { data: opportunities = [] } = useQuery({ 
    queryKey: ['opportunities'], 
    queryFn: async () => {
      try {
        const result = await base44.entities.Opportunity.list('-created_date', 200);
        return Array.isArray(result) ? result : [];
      } catch (err) {
        console.error('Failed to fetch opportunities:', err);
        return [];
      }
    },
    initialData: [], 
    refetchInterval: 20000,
    staleTime: 5000
  });
  
  const { data: transactions = [] }  = useQuery({ 
    queryKey: ['transactions'],  
    queryFn: async () => {
      try {
        const result = await base44.entities.Transaction.list('-created_date', 200);
        return Array.isArray(result) ? result : [];
      } catch (err) {
        console.error('Failed to fetch transactions:', err);
        return [];
      }
    },
    initialData: [], 
    refetchInterval: 20000,
    staleTime: 5000
  });
  
  const { data: tasks = [] }         = useQuery({ 
    queryKey: ['taskQueue', 'taskQueueManager'], 
    queryFn: async () => {
      try {
        const result = await base44.entities.TaskExecutionQueue.list('-created_date', 100);
        return Array.isArray(result) ? result : [];
      } catch (err) {
        console.error('Failed to fetch tasks:', err);
        return [];
      }
    },
    initialData: [], 
    refetchInterval: 15000,
    staleTime: 5000
  });
  
  const { data: identities = [] }    = useQuery({ 
    queryKey: ['aiIdentities'],  
    queryFn: async () => {
      try {
        const result = await base44.entities.AIIdentity.list();
        return Array.isArray(result) ? result : [];
      } catch (err) {
        console.error('Failed to fetch identities:', err);
        return [];
      }
    },
    initialData: [], 
    refetchInterval: 20000,
    staleTime: 5000
  });
  
  const { data: activityLogs = [] }  = useQuery({ 
    queryKey: ['activityLogs'], 
    queryFn: async () => {
      try {
        const result = await base44.entities.ActivityLog.list('-created_date', 50);
        return Array.isArray(result) ? result : [];
      } catch (err) {
        console.error('Failed to fetch activity logs:', err);
        return [];
      }
    },
    initialData: [], 
    refetchInterval: 10000,
    staleTime: 3000
  });

  const userGoals = goals[0] || { daily_target: 1000, wallet_balance: 0 };
  const today = new Date().toDateString();
  
  // Real transaction data only
  const safeTxs = Array.isArray(transactions) ? transactions : [];
  const incomeTxs = safeTxs.filter(t => t && t.type === 'income' && t.created_date);
  const todayEarned = incomeTxs.filter(t => {
    try { return new Date(t.created_date).toDateString() === today; } catch { return false; }
  }).reduce((s, t) => s + (typeof t?.net_amount === 'number' ? t.net_amount : (typeof t?.amount === 'number' ? t.amount : 0)), 0);
  const totalEarned = incomeTxs.reduce((s, t) => s + (typeof t?.net_amount === 'number' ? t.net_amount : (typeof t?.amount === 'number' ? t.amount : 0)), 0);
  
  // Wallet balance: use stored balance if > 0, otherwise calculate from earnings
  const walletBalance = userGoals.wallet_balance && userGoals.wallet_balance > 0 ? userGoals.wallet_balance : totalEarned;
  
  // Real opportunity & task data only
  const safeOpps = Array.isArray(opportunities) ? opportunities : [];
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const activeOpps = safeOpps.filter(o => o && o.id && ['new', 'queued', 'reviewing', 'executing'].includes(o?.status));
  const activeTasks = safeTasks.filter(t => t && t.id && ['queued', 'processing', 'navigating', 'filling', 'submitting'].includes(t?.status));
  
  // Active identity (prefer explicitly active, fallback to first)
  const safeIds = Array.isArray(identities) ? identities : [];
  const activeIdentity = safeIds.find(i => i && i.is_active && i.id) || (safeIds.length > 0 ? safeIds[0] : null);

  const invalidateAll = () => {
    ['userGoals', 'opportunities', 'transactions', 'taskQueue', 'taskQueueManager', 'aiIdentities', 'activityLogs'].forEach(k => {
      queryClient.invalidateQueries({ queryKey: [k] }, { exact: false });
    });
  };

  const invalidateTasksOnly = () => {
    queryClient.invalidateQueries({ queryKey: ['taskQueue'] }, { exact: false });
    queryClient.invalidateQueries({ queryKey: ['taskQueueManager'] }, { exact: false });
  };

  return {
    // Raw data
    userGoals, opportunities, transactions, tasks, identities, activityLogs,
    // Derived
    todayEarned, totalEarned, walletBalance, activeOpps, activeTasks, activeIdentity,
    // Utilities
    invalidateAll, invalidateTasksOnly, DeptBus, DEPT_EVENTS, queryClient,
  };
}