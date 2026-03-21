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

  const { data: goals = [] }        = useQuery({ queryKey: ['userGoals'],     queryFn: () => base44.entities.UserGoals.list(),                    initialData: [], refetchInterval: 30000 });
  const { data: opportunities = [] } = useQuery({ queryKey: ['opportunities'], queryFn: () => base44.entities.Opportunity.list('-created_date', 200), initialData: [], refetchInterval: 10000 });
  const { data: transactions = [] }  = useQuery({ queryKey: ['transactions'],  queryFn: () => base44.entities.Transaction.list('-created_date', 200), initialData: [], refetchInterval: 10000 });
  const { data: tasks = [] }         = useQuery({ queryKey: ['taskQueue', 'taskQueueManager'], queryFn: () => base44.entities.TaskExecutionQueue.list('-created_date', 100), initialData: [], refetchInterval: 8000 });
  const { data: identities = [] }    = useQuery({ queryKey: ['aiIdentities'],  queryFn: () => base44.entities.AIIdentity.list(),                   initialData: [], refetchInterval: 30000 });
  const { data: activityLogs = [] }  = useQuery({ queryKey: ['activityLogs'], queryFn: () => base44.entities.ActivityLog.list('-created_date', 50), initialData: [], refetchInterval: 15000 });

  const userGoals = goals[0] || {};
  const today = new Date().toDateString();
  const incomeTxs = transactions.filter(t => t.type === 'income');
  const todayEarned = incomeTxs.filter(t => new Date(t.created_date).toDateString() === today).reduce((s, t) => s + (t.net_amount ?? t.amount ?? 0), 0);
  const totalEarned = incomeTxs.reduce((s, t) => s + (t.net_amount ?? t.amount ?? 0), 0);
  const walletBalance = userGoals.wallet_balance > 0 ? userGoals.wallet_balance : totalEarned;
  const activeOpps = opportunities.filter(o => ['new', 'queued', 'reviewing', 'executing'].includes(o.status));
  const activeTasks = tasks.filter(t => ['queued', 'processing', 'navigating', 'filling', 'submitting'].includes(t.status));
  const activeIdentity = identities.find(i => i.is_active) || identities[0];

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