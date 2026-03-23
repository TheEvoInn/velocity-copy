import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * SMART RETRY ORCHESTRATOR
 * Implements exponential backoff with credential rotation
 * Handles task submission failures with intelligent recovery
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const { action, task_id, opportunity_id, error_type, retry_count } = body;

    if (action === 'evaluate_retry') {
      return await evaluateRetry(base44, user, task_id, error_type, retry_count);
    }

    if (action === 'execute_retry') {
      return await executeRetry(base44, user, task_id, opportunity_id);
    }

    if (action === 'rotate_credential') {
      return await rotateCredential(base44, user, task_id);
    }

    return jsonResponse({ error: 'Unknown action' }, 400);

  } catch (error) {
    console.error('[SmartRetryOrchestrator]', error.message);
    return jsonResponse({ error: error.message }, 500);
  }
});

/**
 * Evaluate if retry is viable and calculate backoff
 */
async function evaluateRetry(base44, user, taskId, errorType, retryCount = 0) {
  if (!taskId || !errorType) {
    return jsonResponse({ error: 'task_id, error_type required' }, 400);
  }

  try {
    // Determine if error is retryable
    const retryableErrors = [
      'rate_limit_exceeded',
      'temporary_network_error',
      'captcha_required',
      'session_expired',
      'credential_invalid',
      'account_suspended_temporarily'
    ];

    const isRetryable = retryableErrors.includes(errorType);
    const maxRetries = 3;
    const canRetry = isRetryable && retryCount < maxRetries;

    // Calculate exponential backoff
    const baseDelay = 1000; // 1 second
    const backoffMultiplier = 2;
    const delayMs = canRetry ? baseDelay * Math.pow(backoffMultiplier, retryCount) : 0;

    return jsonResponse({
      task_id: taskId,
      error_type: errorType,
      is_retryable: isRetryable,
      can_retry: canRetry,
      current_attempt: retryCount + 1,
      max_retries: maxRetries,
      backoff_delay_ms: delayMs,
      recommendation: canRetry ? 'RETRY_WITH_BACKOFF' : 'FAIL_AND_ESCALATE',
      recovery_strategy: getRecoveryStrategy(errorType),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return jsonResponse({ error: 'Retry evaluation failed', details: error.message }, 500);
  }
}

/**
 * Execute retry with backoff
 */
async function executeRetry(base44, user, taskId, opportunityId) {
  if (!taskId) {
    return jsonResponse({ error: 'task_id required' }, 400);
  }

  try {
    // Fetch the task
    const task = await base44.entities.AITask?.get?.(taskId).catch(() => null);
    
    if (!task) {
      return jsonResponse({ error: 'Task not found' }, 404);
    }

    // Increment retry count
    const newRetryCount = (task.retry_count || 0) + 1;

    // Update task status
    await base44.asServiceRole.entities.AITask?.update?.(taskId, {
      status: 'queued',
      retry_count: newRetryCount,
      last_retry_at: new Date().toISOString()
    }).catch(() => {});

    // Log retry attempt
    await base44.asServiceRole.entities.AuditLog?.create?.({
      entity_type: 'TaskRetry',
      entity_id: taskId,
      action_type: 'retry_executed',
      user_email: user.email,
      details: {
        task_id: taskId,
        opportunity_id: opportunityId,
        retry_attempt: newRetryCount,
        timestamp: new Date().toISOString()
      },
      severity: 'info',
      timestamp: new Date().toISOString()
    }).catch(() => {});

    return jsonResponse({
      task_id: taskId,
      retry_executed: true,
      retry_attempt: newRetryCount,
      status: 'queued_for_retry',
      message: `Task requeued for retry attempt ${newRetryCount}`
    });

  } catch (error) {
    return jsonResponse({ error: 'Retry execution failed', details: error.message }, 500);
  }
}

/**
 * Rotate credential on failure
 */
async function rotateCredential(base44, user, taskId) {
  if (!taskId) {
    return jsonResponse({ error: 'task_id required' }, 400);
  }

  try {
    const task = await base44.entities.AITask?.get?.(taskId).catch(() => null);

    if (!task) {
      return jsonResponse({ error: 'Task not found' }, 404);
    }

    // Fetch linked accounts for the identity
    const linkedAccounts = await base44.entities.LinkedAccount?.filter?.({
      id: { $nin: task.credential_attempt_history || [] }
    }, 'last_used', 10).catch(() => []);

    if (!linkedAccounts || linkedAccounts.length === 0) {
      return jsonResponse({
        task_id: taskId,
        credential_rotated: false,
        reason: 'no_alternative_credentials',
        message: 'No alternative credentials available for rotation'
      });
    }

    // Select next credential (prefer healthier accounts)
    const nextCredential = linkedAccounts.sort((a, b) => 
      (b.performance_score || 0) - (a.performance_score || 0)
    )[0];

    // Update task with new credential
    const attemptHistory = task.credential_attempt_history || [];
    attemptHistory.push(task.linked_account_id);

    await base44.asServiceRole.entities.AITask?.update?.(taskId, {
      linked_account_id: nextCredential.id,
      credential_attempt_history: attemptHistory.slice(-3) // Keep last 3
    }).catch(() => {});

    // Log rotation
    await base44.asServiceRole.entities.AuditLog?.create?.({
      entity_type: 'CredentialRotation',
      entity_id: taskId,
      action_type: 'credential_rotated',
      user_email: user.email,
      details: {
        task_id: taskId,
        from_credential: task.linked_account_id,
        to_credential: nextCredential.id,
        attempts_so_far: attemptHistory.length
      },
      severity: 'warning',
      timestamp: new Date().toISOString()
    }).catch(() => {});

    return jsonResponse({
      task_id: taskId,
      credential_rotated: true,
      from_account: task.linked_account_id,
      to_account: nextCredential.id,
      next_account_health: nextCredential.health_status,
      performance_score: nextCredential.performance_score,
      message: `Credential rotated to ${nextCredential.id}`
    });

  } catch (error) {
    return jsonResponse({ error: 'Credential rotation failed', details: error.message }, 500);
  }
}

/**
 * Determine recovery strategy based on error type
 */
function getRecoveryStrategy(errorType) {
  const strategies = {
    'rate_limit_exceeded': 'WAIT_AND_RETRY_WITH_LONGER_BACKOFF',
    'temporary_network_error': 'RETRY_WITH_STANDARD_BACKOFF',
    'captcha_required': 'ESCALATE_TO_USER_INTERVENTION',
    'session_expired': 'ROTATE_CREDENTIAL_AND_RETRY',
    'credential_invalid': 'ROTATE_CREDENTIAL_AND_RETRY',
    'account_suspended_temporarily': 'WAIT_24H_AND_RETRY'
  };
  
  return strategies[errorType] || 'ESCALATE_TO_USER_INTERVENTION';
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}