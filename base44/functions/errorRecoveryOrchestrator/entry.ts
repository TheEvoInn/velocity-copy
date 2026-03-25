import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * ERROR RECOVERY ORCHESTRATOR
 * Implements intelligent retry logic with exponential backoff
 * Handles transient errors, prevents cascading failures
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const { task_id, automation_id, error_type, attempt = 1, max_retries = 3, should_preserve_state = true } = body;
    
    // Detect rate-limit vs transient errors for smarter retry logic
    const isRateLimit = ['rate_limit', 'throttled', 'blocked', '429'].some(t => error_type?.includes(t));
    const isTransient = ['timeout', 'network', 'temporary', '5xx'].some(t => error_type?.includes(t));
    const isAuth = ['authentication', 'unauthorized', 'credentials', '401', '403'].some(t => error_type?.includes(t));

    if (!task_id && !automation_id) {
      return Response.json({ error: 'No task_id or automation_id provided' }, { status: 400 });
    }
    
    // ─── Preserve task state for retry resumption ───────────────────────
    if (task_id && should_preserve_state) {
      const task = await base44.asServiceRole.entities.TaskExecutionQueue.get(task_id).catch(() => null);
      if (task) {
        // Store execution log entry for recovery context
        const executionLog = Array.isArray(task.execution_log) ? task.execution_log : [];
        executionLog.push({
          timestamp: new Date().toISOString(),
          step: `retry_scheduled_${attempt}`,
          status: 'pending',
          details: `Scheduled for retry due to: ${error_type}`
        });
        
        await base44.asServiceRole.entities.TaskExecutionQueue.update(task_id, {
          status: 'queued',
          execution_log: executionLog.slice(-20),
          retry_count: (task.retry_count || 0) + 1
        }).catch(() => {});
      }
    }

    // Differentiated backoff: rate-limits get longer backoff, transient errors shorter
    let backoffMs = 1000 * Math.pow(2, attempt - 1);
    if (isRateLimit) backoffMs = Math.min(300000 * attempt, 3600000); // 5m to 1h per attempt
    else if (isTransient) backoffMs = Math.min(1000 * Math.pow(1.5, attempt), 30000); // Slower growth
    else if (isAuth) backoffMs = 60000; // 1m fixed for auth issues
    const timestamp = new Date().toISOString();

    // Record retry attempt
    await base44.asServiceRole.entities.RetryHistory.create({
      task_id,
      automation_id,
      error_type,
      attempt_number: attempt,
      backoff_ms: backoffMs,
      timestamp,
      status: 'pending'
    }).catch(() => {});

    // Rate-limits may need extended retries; auth errors should fail faster
    const effectiveMaxRetries = isRateLimit ? Math.max(max_retries, 5) : (isAuth ? 1 : max_retries);

    if (attempt >= effectiveMaxRetries) {
      // Create intervention with error-type-specific guidance
      const interventionType = isRateLimit ? 'rate_limit_detected' : isAuth ? 'credential_update_required' : 'manual_review_required';
      const priority = isAuth ? 'critical' : 'high';

      await base44.asServiceRole.entities.UserIntervention.create({
        type: interventionType,
        priority,
        title: `${isAuth ? 'Auth Error' : isRateLimit ? 'Rate Limited' : 'Task Failed'} — ${effectiveMaxRetries} Attempts`,
        description: `${task_id ? 'Task' : 'Automation'}: ${error_type}. ${isRateLimit ? 'Platform throttled. Try again later.' : isAuth ? 'Credentials invalid or expired.' : 'Max retries exceeded.'}`,
        required_action: isAuth ? 'Update credentials' : isRateLimit ? 'Wait and retry' : 'Review and resolve',
        data: { task_id, automation_id, error_type, attempts: attempt, is_rate_limit: isRateLimit }
      }).catch(() => {});

      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'alert',
        message: `🚨 Error Recovery: Max retries exceeded for ${task_id || automation_id}`,
        severity: 'critical',
        metadata: { error_type, attempts: attempt }
      }).catch(() => {});

      return Response.json({
        success: false,
        message: `Max retries exceeded (${effectiveMaxRetries}), escalated to ${interventionType}`,
        attempt,
        error_type,
        is_rate_limit: isRateLimit,
        is_auth_error: isAuth,
        task_id,
        automation_id
      });
    }

    // Schedule retry after backoff
     const retryTime = new Date(Date.now() + backoffMs);

     // Create retry history record with full context
     const retryRecord = await base44.asServiceRole.entities.RetryHistory.create({
       task_id,
       automation_id,
       error_type,
       attempt_number: attempt,
       max_retries,
       backoff_ms: backoffMs,
       timestamp,
       status: 'scheduled'
     }).catch(() => null);

     await base44.asServiceRole.entities.ActivityLog.create({
       action_type: 'system',
       message: `🔄 Retry ${attempt}/${max_retries}: ${task_id ? 'Task' : 'Automation'} will execute in ${Math.round(backoffMs / 1000)}s (${error_type})`,
       severity: 'info',
       metadata: { backoff_ms: backoffMs, next_retry: retryTime.toISOString(), error_type }
     }).catch(() => {});

    return Response.json({
      success: true,
      message: `Retry ${attempt}/${max_retries} scheduled in ${Math.round(backoffMs / 1000)}s`,
      attempt,
      max_retries,
      next_retry_at: retryTime.toISOString(),
      backoff_ms: backoffMs,
      error_type,
      task_id,
      automation_id,
      state_preserved: should_preserve_state
    });

  } catch (error) {
    console.error('[errorRecoveryOrchestrator] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});