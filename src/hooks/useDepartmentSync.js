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
  const { data: goals = [] }        = useQuery({ 
    queryKey: ['userGoals'], 
    queryFn: async () => {
      const result = await base44.entities.UserGoals.list();
      return result.slice(0, 1); // User has max 1 UserGoals record
    },
    initialData: [], 
    refetchInterval: 30000 
  });
  
  const { data: opportunities = [] } = useQuery({ 
    queryKey: ['opportunities'], 
    queryFn: () => base44.entities.Opportunity.list('-created_date', 200),
    initialData: [], 
    refetchInterval: 10000 
  });
  
  const { data: transactions = [] }  = useQuery({ 
    queryKey: ['transactions'],  
    queryFn: () => base44.entities.Transaction.list('-created_date', 200),
    initialData: [], 
    refetchInterval: 10000 
  });
  
  const { data: tasks = [] }         = useQuery({ 
    queryKey: ['taskQueue', 'taskQueueManager'], 
    queryFn: () => base44.entities.TaskExecutionQueue.list('-created_date', 100),
    initialData: [], 
    refetchInterval: 8000 
  });
  
  const { data: identities = [] }    = useQuery({ 
    queryKey: ['aiIdentities'],  
    queryFn: () => base44.entities.AIIdentity.list(),
    initialData: [], 
    refetchInterval: 30000 
  });
  
  const { data: activityLogs = [] }  = useQuery({ 
    queryKey: ['activityLogs'], 
    queryFn: () => base44.entities.ActivityLog.list('-created_date', 50),
    initialData: [], 
    refetchInterval: 15000 
  });

  const userGoals = goals[0] || { daily_target: 1000, wallet_balance: 0 };
  const today = new Date().toDateString();
  
  // Real transaction data only
  const incomeTxs = transactions.filter(t => t.type === 'income' && t.created_date);
  const todayEarned = incomeTxs.filter(t => new Date(t.created_date).toDateString() === today).reduce((s, t) => s + (t.net_amount ?? t.amount ?? 0), 0);
  const totalEarned = incomeTxs.reduce((s, t) => s + (t.net_amount ?? t.amount ?? 0), 0);
  
  // Wallet balance: use stored balance if > 0, otherwise calculate from earnings
  const walletBalance = userGoals.wallet_balance && userGoals.wallet_balance > 0 ? userGoals.wallet_balance : totalEarned;
  
  // Real opportunity & task data only
  const activeOpps = opportunities.filter(o => o.id && ['new', 'queued', 'reviewing', 'executing'].includes(o.status));
  const activeTasks = tasks.filter(t => t.id && ['queued', 'processing', 'navigating', 'filling', 'submitting'].includes(t.status));
  
  // Active identity (prefer explicitly active, fallback to first)
  const activeIdentity = identities.find(i => i.is_active && i.id) || (identities.length > 0 ? identities[0] : null);

  const invalidateAll = () => {
    ['userGoals', 'opportunities', 'transactions', 'taskQueue', 'taskQueueManager', 'aiIdentities', 'activityLogs'].forEach(k =>
      queryClient.invalidateQueries({ queryKey: [k] })
    );
  };

  return {
    // Raw data
    userGoals, opportunities, transactions, tasks, identities, activityLogs,
    // Derived
    todayEarned, totalEarned, walletBalance, activeOpps, activeTasks, activeIdentity,
    // Utilities
    invalidateAll, DeptBus, DEPT_EVENTS,
  };
}