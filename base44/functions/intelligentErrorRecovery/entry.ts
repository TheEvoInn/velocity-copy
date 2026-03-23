import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * INTELLIGENT ERROR RECOVERY (Phase 10.3)
 * Root cause analysis, auto-remediation, escalation paths
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, payload } = await req.json();

    if (action === 'analyze_task_failure') {
      return await analyzeTaskFailure(base44, user, payload);
    }

    if (action === 'apply_auto_remediation') {
      return await applyAutoRemediation(base44, user, payload);
    }

    if (action === 'schedule_retry') {
      return await scheduleRetry(base44, user, payload);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[IntelligentErrorRecovery]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Analyze root cause of task failure
 */
async function analyzeTaskFailure(base44, user, payload) {
  const { task_id, error_message } = payload;

  // Get task details
  const task = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
    { id: task_id },
    null, 1
  ).then(r => r[0]).catch(() => null);

  if (!task) {
    return Response.json({ error: 'Task not found' }, { status: 404 });
  }

  // Categorize error
  const rootCause = categorizeError(error_message || task.error_message);

  // Check similar failures
  const similarTasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
    { status: 'failed', identity_id: task.identity_id },
    '-completion_timestamp',
    10
  ).catch(() => []);

  const similarErrorCount = similarTasks.filter(t => 
    categorizeError(t.error_message) === rootCause
  ).length;

  const remediation = getRemediationSteps(rootCause, task);

  return Response.json({
    success: true,
    analysis: {
      task_id,
      root_cause: rootCause,
      similar_failures: similarErrorCount,
      remediation_options: remediation,
      auto_remediate: remediation.filter(r => r.automatic).length > 0
    }
  });
}

/**
 * Apply auto-remediation
 */
async function applyAutoRemediation(base44, user, payload) {
  const { task_id, remediation_type } = payload;

  const task = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
    { id: task_id },
    null, 1
  ).then(r => r[0]).catch(() => null);

  if (!task) {
    return Response.json({ error: 'Task not found' }, { status: 404 });
  }

  const steps = [];

  if (remediation_type === 'retry_with_different_identity') {
    const alt = await findAlternativeIdentity(base44, task);
    if (alt) {
      steps.push(`Assigned to identity: ${alt.id}`);
      await base44.asServiceRole.entities.TaskExecutionQueue.update(task_id, {
        identity_id: alt.id,
        retry_count: (task.retry_count || 0) + 1,
        status: 'queued'
      }).catch(() => {});
    }
  }

  if (remediation_type === 'wait_and_retry') {
    const retryDelay = Math.min((task.retry_count || 0) * 300, 3600) + 300; // exponential backoff, max 1 hour
    steps.push(`Scheduled retry in ${retryDelay}s`);
    await base44.asServiceRole.entities.TaskExecutionQueue.update(task_id, {
      retry_count: (task.retry_count || 0) + 1,
      status: 'queued',
      next_retry_at: new Date(Date.now() + retryDelay * 1000).toISOString()
    }).catch(() => {});
  }

  if (remediation_type === 'escalate_to_manual') {
    steps.push('Escalated for manual review');
    await base44.asServiceRole.entities.TaskExecutionQueue.update(task_id, {
      status: 'needs_review',
      escalation_reason: 'Auto-remediation failed'
    }).catch(() => {});
  }

  // Log remediation attempt
  await base44.asServiceRole.entities.ActivityLog.create({
    action_type: 'error_recovery',
    message: `Applied ${remediation_type} to task ${task_id}`,
    severity: 'info',
    metadata: { task_id, remediation_type, steps }
  }).catch(() => {});

  return Response.json({
    success: true,
    remediation: {
      task_id,
      type: remediation_type,
      steps
    }
  });
}

/**
 * Schedule retry with exponential backoff
 */
async function scheduleRetry(base44, user, payload) {
  const { task_id, delay_seconds = 300 } = payload;

  const task = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
    { id: task_id },
    null, 1
  ).then(r => r[0]).catch(() => null);

  if (!task) {
    return Response.json({ error: 'Task not found' }, { status: 404 });
  }

  const nextRetry = new Date(Date.now() + delay_seconds * 1000).toISOString();

  await base44.asServiceRole.entities.TaskExecutionQueue.update(task_id, {
    retry_count: (task.retry_count || 0) + 1,
    status: 'queued',
    next_retry_at: nextRetry
  }).catch(() => {});

  return Response.json({
    success: true,
    retry: {
      task_id,
      next_retry_at: nextRetry,
      retry_count: (task.retry_count || 0) + 1
    }
  });
}

/**
 * Categorize error type
 */
function categorizeError(errorMessage) {
  if (!errorMessage) return 'unknown';
  const msg = errorMessage.toLowerCase();
  
  if (msg.includes('timeout') || msg.includes('timeout')) return 'timeout';
  if (msg.includes('auth') || msg.includes('credential')) return 'credential_invalid';
  if (msg.includes('rate limit') || msg.includes('429')) return 'rate_limit';
  if (msg.includes('not found') || msg.includes('404')) return 'not_found';
  if (msg.includes('permission') || msg.includes('forbidden')) return 'permission_denied';
  if (msg.includes('network') || msg.includes('connection')) return 'network_error';
  
  return 'unknown';
}

/**
 * Get remediation steps for error type
 */
function getRemediationSteps(errorType, task) {
  const steps = [];

  if (errorType === 'timeout') {
    steps.push({ action: 'wait_and_retry', automatic: true, description: 'Wait and retry' });
    steps.push({ action: 'retry_with_different_identity', automatic: true, description: 'Try different identity' });
  }

  if (errorType === 'credential_invalid') {
    steps.push({ action: 'retry_with_different_identity', automatic: true, description: 'Use different identity' });
    steps.push({ action: 'escalate_to_manual', automatic: false, description: 'Manual review needed' });
  }

  if (errorType === 'rate_limit') {
    steps.push({ action: 'wait_and_retry', automatic: true, description: 'Wait for rate limit reset' });
    steps.push({ action: 'retry_with_different_identity', automatic: true, description: 'Use different identity' });
  }

  if (errorType === 'permission_denied') {
    steps.push({ action: 'retry_with_different_identity', automatic: true, description: 'Use different identity' });
    steps.push({ action: 'escalate_to_manual', automatic: false, description: 'Manual review required' });
  }

  if (steps.length === 0) {
    steps.push({ action: 'escalate_to_manual', automatic: false, description: 'Manual review needed' });
  }

  return steps;
}

/**
 * Find alternative identity for retry
 */
async function findAlternativeIdentity(base44, task) {
  const identities = await base44.asServiceRole.entities.AIIdentity.filter(
    { is_active: true },
    null,
    5
  ).catch(() => []);

  // Filter out the current identity
  const alternatives = identities.filter(id => id.id !== task.identity_id);
  
  return alternatives.length > 0 ? alternatives[0] : null;
}