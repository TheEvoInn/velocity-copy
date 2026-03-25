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

    const { task_id, automation_id, error_type, attempt = 1, max_retries = 3 } = body;

    if (!task_id && !automation_id) {
      return Response.json({ error: 'No task_id or automation_id provided' }, { status: 400 });
    }

    const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 30000); // Exponential backoff, max 30s
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

    // Check if should retry
    if (attempt >= max_retries) {
      // Max retries exceeded — escalate to manual review
      await base44.asServiceRole.entities.UserIntervention.create({
        type: 'manual_review_required',
        priority: 'high',
        title: `Task/Automation Failed After ${max_retries} Retries`,
        description: `${task_id ? 'Task' : 'Automation'} failed with error: ${error_type}. Max retries (${max_retries}) exceeded.`,
        required_action: 'Review and manually resolve',
        data: { task_id, automation_id, error_type, attempts: attempt }
      }).catch(() => {});

      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'alert',
        message: `🚨 Error Recovery: Max retries exceeded for ${task_id || automation_id}`,
        severity: 'critical',
        metadata: { error_type, attempts: attempt }
      }).catch(() => {});

      return Response.json({
        success: false,
        message: 'Max retries exceeded, escalated to manual review',
        attempt,
        task_id,
        automation_id
      });
    }

    // Schedule retry after backoff
    const retryTime = new Date(Date.now() + backoffMs);

    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `🔄 Retry Scheduled: ${task_id ? 'Task' : 'Automation'} ${task_id || automation_id} will retry at ${retryTime.toISOString()} (Attempt ${attempt}/${max_retries})`,
      severity: 'info',
      metadata: { backoff_ms: backoffMs, next_retry: retryTime.toISOString() }
    }).catch(() => {});

    return Response.json({
      success: true,
      message: `Retry scheduled in ${Math.round(backoffMs / 1000)}s`,
      attempt,
      max_retries,
      next_retry_at: retryTime.toISOString(),
      task_id,
      automation_id
    });

  } catch (error) {
    console.error('[errorRecoveryOrchestrator] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});