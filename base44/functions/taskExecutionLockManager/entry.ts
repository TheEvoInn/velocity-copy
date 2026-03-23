import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * TASK EXECUTION LOCK MANAGER
 * Prevents duplicate concurrent executions on same opportunity
 * Ensures exactly-once task execution semantics
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const { action, opportunity_id, task_id, identity_id } = body;

    if (action === 'acquire_lock') {
      return await acquireLock(base44, user, opportunity_id, task_id, identity_id);
    }

    if (action === 'release_lock') {
      return await releaseLock(base44, user, task_id);
    }

    if (action === 'check_lock_status') {
      return await checkLockStatus(base44, user, opportunity_id);
    }

    return jsonResponse({ error: 'Unknown action' }, 400);

  } catch (error) {
    console.error('[TaskExecutionLockManager]', error.message);
    return jsonResponse({ error: error.message }, 500);
  }
});

/**
 * Acquire exclusive lock for task execution
 */
async function acquireLock(base44, user, opportunityId, taskId, identityId) {
  if (!opportunityId || !taskId || !identityId) {
    return jsonResponse({ error: 'opportunity_id, task_id, identity_id required' }, 400);
  }

  try {
    // Check if lock already exists
    const existingLock = await base44.asServiceRole.entities.TaskExecutionQueue?.filter?.({
      opportunity_id: opportunityId,
      status: { $in: ['queued', 'executing'] }
    }, '-created_date', 10).catch(() => []);

    if (existingLock && existingLock.length > 0) {
      return jsonResponse({
        lock_acquired: false,
        reason: 'execution_already_in_progress',
        existing_task_id: existingLock[0].id,
        message: `Opportunity ${opportunityId} is already executing. Lock denied.`
      }, 409);
    }

    // Create task execution record with lock
    const executionRecord = await base44.asServiceRole.entities.TaskExecutionQueue?.create?.({
      opportunity_id: opportunityId,
      task_id: taskId,
      identity_id: identityId,
      created_by: user.email,
      status: 'queued',
      lock_acquired_at: new Date().toISOString(),
      lock_owner: user.email
    }).catch(() => null);

    if (!executionRecord) {
      return jsonResponse({ error: 'Failed to create execution lock' }, 500);
    }

    // Log lock acquisition
    await base44.asServiceRole.entities.AuditLog?.create?.({
      entity_type: 'TaskExecutionLock',
      entity_id: taskId,
      action_type: 'lock_acquired',
      user_email: user.email,
      details: {
        opportunity_id: opportunityId,
        task_id: taskId,
        identity_id: identityId,
        lock_id: executionRecord.id
      },
      severity: 'info',
      timestamp: new Date().toISOString()
    }).catch(() => {});

    return jsonResponse({
      lock_acquired: true,
      lock_id: executionRecord.id,
      opportunity_id: opportunityId,
      task_id: taskId,
      message: 'Exclusive execution lock acquired successfully'
    }, 200);

  } catch (error) {
    return jsonResponse({ error: 'Lock acquisition failed', details: error.message }, 500);
  }
}

/**
 * Release execution lock
 */
async function releaseLock(base44, user, taskId) {
  if (!taskId) {
    return jsonResponse({ error: 'task_id required' }, 400);
  }

  try {
    // Find and release the lock
    const executionRecords = await base44.asServiceRole.entities.TaskExecutionQueue?.filter?.({
      task_id: taskId,
      status: { $in: ['queued', 'executing', 'completed', 'failed'] }
    }, '-created_date', 5).catch(() => []);

    if (!executionRecords || executionRecords.length === 0) {
      return jsonResponse({ 
        lock_released: false, 
        reason: 'lock_not_found',
        message: `No execution lock found for task ${taskId}` 
      }, 404);
    }

    const lockRecord = executionRecords[0];

    // Update status to released
    await base44.asServiceRole.entities.TaskExecutionQueue?.update?.(lockRecord.id, {
      status: 'released',
      lock_released_at: new Date().toISOString()
    }).catch(() => {});

    // Log lock release
    await base44.asServiceRole.entities.AuditLog?.create?.({
      entity_type: 'TaskExecutionLock',
      entity_id: taskId,
      action_type: 'lock_released',
      user_email: user.email,
      details: {
        lock_id: lockRecord.id,
        held_duration_ms: new Date() - new Date(lockRecord.created_date)
      },
      severity: 'info',
      timestamp: new Date().toISOString()
    }).catch(() => {});

    return jsonResponse({
      lock_released: true,
      task_id: taskId,
      lock_id: lockRecord.id,
      message: 'Execution lock released successfully'
    });

  } catch (error) {
    return jsonResponse({ error: 'Lock release failed', details: error.message }, 500);
  }
}

/**
 * Check lock status for opportunity
 */
async function checkLockStatus(base44, user, opportunityId) {
  if (!opportunityId) {
    return jsonResponse({ error: 'opportunity_id required' }, 400);
  }

  try {
    const activeLocks = await base44.asServiceRole.entities.TaskExecutionQueue?.filter?.({
      opportunity_id: opportunityId,
      status: { $in: ['queued', 'executing'] }
    }, '-created_date', 5).catch(() => []);

    if (!activeLocks || activeLocks.length === 0) {
      return jsonResponse({
        opportunity_id: opportunityId,
        lock_status: 'available',
        active_locks: 0,
        message: 'No active locks on this opportunity'
      });
    }

    const activeLock = activeLocks[0];

    return jsonResponse({
      opportunity_id: opportunityId,
      lock_status: 'locked',
      active_locks: activeLocks.length,
      lock_holder: activeLock.identity_id,
      lock_acquired_at: activeLock.lock_acquired_at,
      current_status: activeLock.status,
      message: `Opportunity is locked by identity ${activeLock.identity_id}`
    });

  } catch (error) {
    return jsonResponse({ error: 'Lock status check failed', details: error.message }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}