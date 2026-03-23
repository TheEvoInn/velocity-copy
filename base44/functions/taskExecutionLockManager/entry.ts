/**
 * TASK EXECUTION LOCK MANAGER
 * Prevents concurrent task execution on the same platform account
 * Ensures browser session integrity and minimizes platform ban risk
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Acquire a lock for an account before task execution
 * Returns lock token if successful, null if account is locked
 */
async function acquireLock(base44, userEmail, platform, accountId) {
  try {
    // Check if account is already locked
    const existingLocks = await base44.asServiceRole.entities.ActivityLog.filter(
      {
        action_type: 'task_lock_acquired',
        metadata: { platform, account_id: accountId, user_email: userEmail }
      },
      null,
      1
    ).catch(() => []);

    // If recent lock exists (within last 5 minutes), account is locked
    if (existingLocks.length > 0) {
      const lockTime = new Date(existingLocks[0].created_date);
      const now = new Date();
      const lockAgeMinutes = (now - lockTime) / (1000 * 60);

      if (lockAgeMinutes < 5) {
        return {
          success: false,
          locked: true,
          lockAgeMinutes,
          message: `Account ${accountId} is locked by another task`
        };
      }
    }

    // Generate lock token
    const lockToken = `lock_${platform}_${accountId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Record lock acquisition
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'task_lock_acquired',
      message: `🔒 Task execution lock acquired for ${platform}:${accountId}`,
      severity: 'info',
      metadata: {
        platform,
        account_id: accountId,
        user_email: userEmail,
        lock_token: lockToken,
        acquired_at: new Date().toISOString()
      }
    }).catch(() => null);

    return {
      success: true,
      locked: false,
      lock_token: lockToken,
      platform,
      account_id: accountId
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Release a lock after task execution completes
 */
async function releaseLock(base44, userEmail, lockToken) {
  try {
    // Record lock release
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'task_lock_released',
      message: `🔓 Task execution lock released`,
      severity: 'info',
      metadata: {
        lock_token: lockToken,
        user_email: userEmail,
        released_at: new Date().toISOString()
      }
    }).catch(() => null);

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Queue task if account is locked
 * Stores pending task for later execution
 */
async function queueTaskForLockedAccount(base44, userEmail, taskId, reason) {
  try {
    // Create a pending execution record
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'task_queued_for_lock_release',
      message: `⏳ Task ${taskId} queued: ${reason}`,
      severity: 'warning',
      metadata: {
        task_id: taskId,
        user_email: userEmail,
        reason,
        queued_at: new Date().toISOString()
      }
    }).catch(() => null);

    return { success: true, queued: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Get lock status for an account
 */
async function getLockStatus(base44, userEmail, platform, accountId) {
  try {
    const locks = await base44.asServiceRole.entities.ActivityLog.filter(
      {
        action_type: 'task_lock_acquired',
        metadata: { platform, account_id: accountId }
      },
      '-created_date',
      1
    ).catch(() => []);

    if (locks.length === 0) {
      return { locked: false, account_id: accountId, platform };
    }

    const latestLock = locks[0];
    const lockTime = new Date(latestLock.created_date);
    const now = new Date();
    const lockAgeMinutes = (now - lockTime) / (1000 * 60);

    // Lock expires after 5 minutes
    const isLocked = lockAgeMinutes < 5;

    return {
      locked: isLocked,
      account_id: accountId,
      platform,
      lock_age_minutes: lockAgeMinutes,
      lock_token: latestLock.metadata?.lock_token,
      locked_by: latestLock.metadata?.user_email
    };
  } catch (e) {
    return { locked: false, error: e.message };
  }
}

/**
 * Get all active locks for a user
 */
async function getActiveLocks(base44, userEmail) {
  try {
    const locks = await base44.asServiceRole.entities.ActivityLog.filter(
      {
        action_type: 'task_lock_acquired',
        created_by: userEmail
      },
      '-created_date',
      50
    ).catch(() => []);

    const activeLocks = [];
    const now = new Date();

    for (const lock of locks) {
      const lockTime = new Date(lock.created_date);
      const lockAgeMinutes = (now - lockTime) / (1000 * 60);

      // Only include locks < 5 minutes old
      if (lockAgeMinutes < 5) {
        activeLocks.push({
          platform: lock.metadata?.platform,
          account_id: lock.metadata?.account_id,
          lock_token: lock.metadata?.lock_token,
          age_minutes: lockAgeMinutes,
          acquired_at: lock.created_date
        });
      }
    }

    return { success: true, active_locks: activeLocks, count: activeLocks.length };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Force unlock an account (emergency use only)
 */
async function forceUnlock(base44, userEmail, platform, accountId) {
  try {
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'task_lock_forced_release',
      message: `⚠️ EMERGENCY: Lock force-released for ${platform}:${accountId}`,
      severity: 'critical',
      metadata: {
        platform,
        account_id: accountId,
        user_email: userEmail,
        forced_at: new Date().toISOString()
      }
    }).catch(() => null);

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, platform, accountId, taskId, lockToken, reason } = await req.json();

    // ─── Acquire lock ──────────────────────────────────────────────
    if (action === 'acquire_lock') {
      if (!platform || !accountId) {
        return Response.json({ error: 'Platform and accountId required' }, { status: 400 });
      }

      const result = await acquireLock(base44, user.email, platform, accountId);
      return Response.json(result);
    }

    // ─── Release lock ──────────────────────────────────────────────
    if (action === 'release_lock') {
      if (!lockToken) {
        return Response.json({ error: 'Lock token required' }, { status: 400 });
      }

      const result = await releaseLock(base44, user.email, lockToken);
      return Response.json(result);
    }

    // ─── Queue task for locked account ────────────────────────────
    if (action === 'queue_task') {
      if (!taskId || !reason) {
        return Response.json({ error: 'Task ID and reason required' }, { status: 400 });
      }

      const result = await queueTaskForLockedAccount(base44, user.email, taskId, reason);
      return Response.json(result);
    }

    // ─── Get lock status ──────────────────────────────────────────
    if (action === 'get_lock_status') {
      if (!platform || !accountId) {
        return Response.json({ error: 'Platform and accountId required' }, { status: 400 });
      }

      const result = await getLockStatus(base44, user.email, platform, accountId);
      return Response.json(result);
    }

    // ─── Get all active locks ─────────────────────────────────────
    if (action === 'get_active_locks') {
      const result = await getActiveLocks(base44, user.email);
      return Response.json(result);
    }

    // ─── Force unlock (emergency) ─────────────────────────────────
    if (action === 'force_unlock') {
      if (!platform || !accountId) {
        return Response.json({ error: 'Platform and accountId required' }, { status: 400 });
      }

      const result = await forceUnlock(base44, user.email, platform, accountId);
      return Response.json(result);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('[TaskExecutionLockManager] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});