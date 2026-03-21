/**
 * UNIFIED VELOCITY HOOKS
 * All pages use these for real-time, synchronized data
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useEffect, useState } from 'react';

/**
 * Real-time user goals with instant updates
 */
export function useUserGoalsV2() {
  const [goals, setGoals] = useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['userGoals'],
    queryFn: () => base44.entities.UserGoals.filter({ created_by: true }, '-updated_date', 1).then(r => r[0] || {}),
    staleTime: 5000,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (data) setGoals(data);
  }, [data]);

  useEffect(() => {
    const unsub = base44.entities.UserGoals.subscribe((event) => {
      if (['update', 'create'].includes(event.type)) {
        queryClient.invalidateQueries({ queryKey: ['userGoals'] });
        setGoals(event.data);
      }
    });
    return unsub;
  }, [queryClient]);

  return { goals: goals || {}, isLoading, error };
}

/**
 * Real-time opportunities with automatic filtering
 */
export function useOpportunitiesV2(filters = {}) {
  const queryClient = useQueryClient();
  const [opps, setOpps] = useState([]);

  const { data, isLoading } = useQuery({
    queryKey: ['opportunities', filters],
    queryFn: async () => {
      const query = { created_by: true, ...filters };
      return base44.entities.Opportunity.filter(query, '-updated_date', 100);
    },
    staleTime: 5000,
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (data) setOpps(Array.isArray(data) ? data : []);
  }, [data]);

  useEffect(() => {
    const unsub = base44.entities.Opportunity.subscribe((event) => {
      if (['create', 'update', 'delete'].includes(event.type)) {
        queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      }
    });
    return unsub;
  }, [queryClient]);

  return { opportunities: opps, isLoading, refetch: () => queryClient.invalidateQueries({ queryKey: ['opportunities'] }) };
}

/**
 * Real-time tasks with status tracking
 */
export function useTasksV2(filters = {}) {
  const queryClient = useQueryClient();
  const [tasks, setTasks] = useState([]);

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', filters],
    queryFn: async () => {
      const query = { created_by: true, ...filters };
      return base44.entities.TaskExecutionQueue.filter(query, '-updated_date', 100);
    },
    staleTime: 3000,
    refetchInterval: 8000,
  });

  useEffect(() => {
    if (data) setTasks(Array.isArray(data) ? data : []);
  }, [data]);

  useEffect(() => {
    const unsub = base44.entities.TaskExecutionQueue.subscribe((event) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    });
    return unsub;
  }, [queryClient]);

  return { tasks, isLoading, refetch: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }) };
}

/**
 * Real-time transactions
 */
export function useTransactionsV2() {
  const queryClient = useQueryClient();
  const [txns, setTxns] = useState([]);

  const { data, isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.Transaction.filter({ created_by: true }, '-created_date', 50),
    staleTime: 5000,
    refetchInterval: 12000,
  });

  useEffect(() => {
    if (data) setTxns(Array.isArray(data) ? data : []);
  }, [data]);

  useEffect(() => {
    const unsub = base44.entities.Transaction.subscribe((event) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    });
    return unsub;
  }, [queryClient]);

  return { transactions: txns, isLoading };
}

/**
 * Real-time activity logs
 */
export function useActivityLogsV2(limit = 50) {
  const [logs, setLogs] = useState([]);

  const { data, isLoading } = useQuery({
    queryKey: ['activityLogs', limit],
    queryFn: () => base44.entities.ActivityLog.filter({ created_by: true }, '-created_date', limit),
    staleTime: 3000,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (data) setLogs(Array.isArray(data) ? data : []);
  }, [data]);

  return { logs, isLoading };
}

/**
 * Real-time AI identities
 */
export function useAIIdentitiesV2() {
  const queryClient = useQueryClient();
  const [identities, setIdentities] = useState([]);

  const { data, isLoading } = useQuery({
    queryKey: ['aiIdentities'],
    queryFn: () => base44.entities.AIIdentity.filter({ created_by: true }, '-updated_date', 20),
    staleTime: 5000,
    refetchInterval: 20000,
  });

  useEffect(() => {
    if (data) setIdentities(Array.isArray(data) ? data : []);
  }, [data]);

  useEffect(() => {
    const unsub = base44.entities.AIIdentity.subscribe((event) => {
      queryClient.invalidateQueries({ queryKey: ['aiIdentities'] });
    });
    return unsub;
  }, [queryClient]);

  return { identities, isLoading };
}

/**
 * Real-time workflows
 */
export function useWorkflowsV2() {
  const queryClient = useQueryClient();
  const [workflows, setWorkflows] = useState([]);

  const { data, isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: () => base44.entities.Workflow.filter({ created_by: true }, '-updated_date', 30),
    staleTime: 5000,
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (data) setWorkflows(Array.isArray(data) ? data : []);
  }, [data]);

  useEffect(() => {
    const unsub = base44.entities.Workflow.subscribe((event) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    });
    return unsub;
  }, [queryClient]);

  return { workflows, isLoading };
}