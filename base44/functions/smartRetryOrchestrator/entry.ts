/**
 * SMART RETRY ORCHESTRATOR
 * Intelligently retries failed tasks with adaptive strategies:
 * - Analyzes failure reason (CAPTCHA, auth, rate limit, form error)
 * - Applies different retry strategy for each failure type
 * - Rotates identities on auth failures
 * - Backs off on rate limit errors
 * - Escalates to manual review on ambiguous errors
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Analyze failure reason and determine retry strategy
 */
function determineRetryStrategy(errorType, retryCount, maxRetries) {
  const strategy = {
    should_retry: false,
    delay_seconds: 0,
    strategy_type: null,
    reason: null,
  };

  if (retryCount >= maxRetries) {
    strategy.reason = 'Max retries exceeded';
    return strategy;
  }

  // CAPTCHA error: wait and retry with same identity
  if (errorType === 'captcha') {
    strategy.should_retry = true;
    strategy.delay_seconds = 30 * (retryCount + 1); // Exponential backoff
    strategy.strategy_type = 'captcha_retry_same_identity';
    strategy.reason = 'CAPTCHA solving failed, retrying with better solver';
    return strategy;
  }

  // Authentication error: rotate identity
  if (errorType === 'authentication') {
    strategy.should_retry = true;
    strategy.delay_seconds = 5;
    strategy.strategy_type = 'rotate_identity_retry';
    strategy.reason = 'Auth failed, rotating to different identity';
    return strategy;
  }

  // Rate limit: exponential backoff
  if (errorType === 'rate_limit') {
    strategy.should_retry = true;
    strategy.delay_seconds = Math.pow(2, retryCount) * 60; // 1min, 2min, 4min, 8min...
    strategy.strategy_type = 'exponential_backoff';
    strategy.reason = `Rate limited, backing off ${strategy.delay_seconds}s`;
    return strategy;
  }

  // Form error: analyze and potentially retry with corrected data
  if (errorType === 'form_error') {
    if (retryCount < 2) {
      strategy.should_retry = true;
      strategy.delay_seconds = 10;
      strategy.strategy_type = 'form_retry_same_data';
      strategy.reason = 'Form submission error, retrying';
      return strategy;
    }
  }

  // Geo-block: likely not retryable with same identity
  if (errorType === 'geo_blocked') {
    strategy.should_retry = true;
    strategy.delay_seconds = 60;
    strategy.strategy_type = 'rotate_identity_retry';
    strategy.reason = 'Geo-blocked, trying different identity location';
    return strategy;
  }

  // Timeout: simple retry with slightly longer timeout
  if (errorType === 'timeout') {
    if (retryCount < 2) {
      strategy.should_retry = true;
      strategy.delay_seconds = 15 * (retryCount + 1);
      strategy.strategy_type = 'simple_retry';
      strategy.reason = 'Timeout, retrying with longer wait';
      return strategy;
    }
  }

  // Ambiguous error: escalate to manual review
  strategy.should_retry = false;
  strategy.strategy_type = 'manual_review';
  strategy.reason = `Unknown error type: ${errorType}. Escalating to manual review.`;
  return strategy;
}

/**
 * Execute retry with adaptive strategy
 */
async function executeRetry(base44, userEmail, task, errorType) {
  const retry = {
    task_id: task.id,
    retry_attempt: (task.retry_count || 0) + 1,
    max_retries: task.max_retries || 3,
    error_type: errorType,
    timestamp: new Date().toISOString(),
  };

  try {
    // Determine strategy
    const strategy = determineRetryStrategy(
      errorType,
      retry.retry_attempt - 1,
      retry.max_retries
    );

    retry.strategy = strategy;

    if (!strategy.should_retry) {
      // Log escalation to manual review
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `📋 Task escalated to manual review: "${task.url}" (${errorType})`,
        severity: 'warning',
        metadata: {
          task_id: task.id,
          error_type: errorType,
          reason: strategy.reason,
        },
      }).catch(() => null);

      return {
        success: false,
        retry,
        action: 'escalate_to_manual_review',
      };
    }

    // Handle identity rotation if needed
    if (strategy.strategy_type === 'rotate_identity_retry') {
      const newIdentity = await base44.functions.invoke('intelligentIdentityRouter', {
        action: 'select_best_identity',
        opportunity: { category: task.category, title: task.description },
      }).catch(e => ({ success: false, error: e.message }));

      if (newIdentity.success) {
        retry.new_identity_id = newIdentity.identity.id;
        retry.new_identity_name = newIdentity.identity.name;
      }
    }

    // Schedule retry
    await base44.asServiceRole.entities.TaskExecutionQueue.update(task.id, {
      status: 'queued',
      retry_count: retry.retry_attempt,
      last_retry_at: new Date().toISOString(),
      identity_id: retry.new_identity_id || task.identity_id,
      error_message: null, // Clear error for retry
    }).catch(() => null);

    // Log retry
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `🔄 Task retry scheduled: "${task.url}" (Attempt ${retry.retry_attempt}/${retry.max_retries})`,
      severity: 'info',
      metadata: {
        task_id: task.id,
        retry_attempt: retry.retry_attempt,
        strategy: strategy.strategy_type,
        delay_seconds: strategy.delay_seconds,
        new_identity: retry.new_identity_id,
      },
    }).catch(() => null);

    return {
      success: true,
      retry,
      action: 'retry_scheduled',
      delay_seconds: strategy.delay_seconds,
    };
  } catch (e) {
    return {
      success: false,
      error: e.message,
      retry,
    };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, task, error_type } = body;

    // ── Determine retry strategy ───────────────────────────────────────
    if (action === 'determine_strategy') {
      if (!error_type) {
        return Response.json({ error: 'Error type required' }, { status: 400 });
      }

      const strategy = determineRetryStrategy(error_type, 0, 3);
      return Response.json({ success: true, strategy });
    }

    // ── Execute retry ──────────────────────────────────────────────────
    if (action === 'execute_retry') {
      if (!task || !error_type) {
        return Response.json({ error: 'Task and error_type required' }, { status: 400 });
      }

      const result = await executeRetry(base44, user.email, task, error_type);
      return Response.json(result);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[SmartRetryOrchestrator] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});