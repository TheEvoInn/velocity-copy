import { useCallback, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Hook to fetch and sync real-time execution step data
 * Handles opportunty state, task queue status, and validation
 */
export function useExecutionStepData(opportunityId, options = {}) {
  const {
    autoRefresh = true,
    refreshInterval = 5000,
    onDataUpdate = null,
  } = options;

  const cacheRef = useRef({
    opportunity: null,
    executionQueue: null,
    lastFetch: 0,
  });

  // Fetch opportunity with full step data
  const fetchOpportunity = useCallback(async () => {
    if (!opportunityId) return null;

    try {
      const opps = await base44.entities.Opportunity.filter(
        { id: opportunityId },
        '-updated_date',
        1
      );

      if (opps && opps.length > 0) {
        cacheRef.current.opportunity = opps[0];
        return opps[0];
      }
    } catch (error) {
      console.error('Error fetching opportunity:', error);
    }
    return null;
  }, [opportunityId]);

  // Fetch execution queue for this opportunity
  const fetchExecutionQueue = useCallback(async () => {
    if (!opportunityId) return [];

    try {
      const queue = await base44.entities.TaskExecutionQueue.filter(
        { opportunity_id: opportunityId },
        '-created_date',
        20
      );

      cacheRef.current.executionQueue = queue || [];
      return queue || [];
    } catch (error) {
      console.error('Error fetching execution queue:', error);
    }
    return [];
  }, [opportunityId]);

  // Validate step prerequisites and dependencies
  const validateSteps = useCallback((executionSteps) => {
    if (!executionSteps || executionSteps.length === 0) {
      return { valid: true, errors: [] };
    }

    const errors = [];
    executionSteps.forEach((step, idx) => {
      // Check if all prior steps are completed
      if (idx > 0) {
        const allPriorComplete = executionSteps
          .slice(0, idx)
          .every(s => s.completed);

        if (!allPriorComplete && step.completed) {
          errors.push(`Step ${step.step} completed but prior steps incomplete`);
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      completionStatus: {
        completed: executionSteps.filter(s => s.completed).length,
        total: executionSteps.length,
      },
    };
  }, []);

  // Sync execution queue status to opportunity steps
  const syncQueueStatus = useCallback((opportunity, queue) => {
    if (!opportunity || !queue || !opportunity.execution_steps) {
      return opportunity;
    }

    // Update step completion status based on task queue
    const updated = { ...opportunity };
    const completedTasks = queue.filter(t => t.status === 'completed');

    if (completedTasks.length > 0) {
      updated.execution_steps = opportunity.execution_steps.map((step, idx) => ({
        ...step,
        completed: idx < completedTasks.length,
      }));
    }

    return updated;
  }, []);

  // Main sync function
  const syncData = useCallback(async () => {
    const [opp, queue] = await Promise.all([
      fetchOpportunity(),
      fetchExecutionQueue(),
    ]);

    if (!opp) return null;

    // Sync and validate
    const synced = syncQueueStatus(opp, queue);
    const validation = validateSteps(synced.execution_steps);

    const result = {
      opportunity: synced,
      executionQueue: queue,
      validation,
      lastSync: new Date().toISOString(),
    };

    cacheRef.current.lastFetch = Date.now();

    if (onDataUpdate) {
      onDataUpdate(result);
    }

    return result;
  }, [fetchOpportunity, fetchExecutionQueue, syncQueueStatus, validateSteps, onDataUpdate]);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;

    syncData();
    const interval = setInterval(syncData, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, syncData]);

  return {
    syncData,
    getCachedData: () => cacheRef.current,
    validateSteps,
    syncQueueStatus,
  };
}