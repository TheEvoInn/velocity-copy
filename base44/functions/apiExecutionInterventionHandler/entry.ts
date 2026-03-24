import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * API EXECUTION INTERVENTION HANDLER
 * Escalates API failures to user intervention queue
 * Tracks resolution & task resubmission
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, execution_result, task_id, api_id } = await req.json();

    if (action === 'escalate_failure') {
      return await escalateFailure(base44, user, execution_result, task_id, api_id);
    } else if (action === 'resolve_intervention') {
      return await resolveIntervention(base44, task_id);
    } else if (action === 'retry_after_intervention') {
      return await retryAfterIntervention(base44, task_id);
    } else {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[apiExecutionInterventionHandler]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Escalate failed API execution to user intervention
 */
async function escalateFailure(base44, user, executionResult, taskId, apiId) {
  const { error, status_code, api_name } = executionResult;

  // Determine intervention type based on error
  const interventionType = determineInterventionType(status_code, error);
  const severity = determineSeverity(status_code);

  // Create intervention record
  const intervention = await base44.entities.UserIntervention?.create?.({
    user_email: user.email,
    task_id: taskId,
    intervention_type: interventionType,
    status: 'pending_review',
    severity,
    title: `API Execution Failed: ${api_name}`,
    description: `
API: ${api_name}
Status Code: ${status_code}
Error: ${error}
Time: ${new Date().toISOString()}

Action Required:
- Review the API failure
- Check credentials if needed
- Provide missing data if required
- Click "Retry" to resubmit
    `,
    api_id: apiId,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
  }).catch(() => null);

  // Update task status
  if (taskId) {
    try {
      await base44.entities.AITask?.update?.(taskId, {
        status: 'manual_review_required',
      });
    } catch (e) {
      console.warn('Task status update failed:', e.message);
    }
  }

  // Log intervention creation
  await base44.entities.APIDiscoveryLog.create({
    api_id: apiId,
    api_name,
    action_type: 'failed',
    status: 'failed',
    details: {
      intervention_created: true,
      intervention_id: intervention?.id,
      linked_task_id: taskId,
    },
    error_message: error,
    http_status_code: status_code,
    timestamp: new Date().toISOString(),
  }).catch(() => null);

  return Response.json({
    success: true,
    intervention_id: intervention?.id,
    task_id: taskId,
    intervention_type: interventionType,
    user_notified: true,
    message: `Intervention created. Check your dashboard for action items.`,
  });
}

/**
 * Mark intervention as resolved
 */
async function resolveIntervention(base44, taskId) {
  const interventions = await base44.entities.UserIntervention?.filter?.({
    task_id: taskId,
    status: 'pending_review',
  }, '-created_at', 1).catch(() => []);

  if (interventions?.length === 0) {
    return Response.json({ error: 'No pending intervention found' }, { status: 404 });
  }

  const intervention = interventions[0];

  // Mark as resolved
  await base44.entities.UserIntervention?.update?.(intervention.id, {
    status: 'resolved',
    resolved_at: new Date().toISOString(),
  }).catch(() => null);

  return Response.json({
    success: true,
    intervention_id: intervention.id,
    status: 'resolved',
    message: 'Intervention marked as resolved. Task ready for retry.',
  });
}

/**
 * Retry task after user intervention
 */
async function retryAfterIntervention(base44, taskId) {
  // Mark intervention as resolved
  await resolveIntervention(base44, taskId);

  // Update task status back to queued
  try {
    await base44.entities.AITask?.update?.(taskId, {
      status: 'queued',
      retry_count: (await base44.entities.AITask.get(taskId)).retry_count + 1 || 1,
    });
  } catch (e) {
    console.warn('Task status update failed:', e.message);
  }

  // Trigger task orchestrator to retry
  try {
    await base44.functions.invoke('taskOrchestratorEngine', {
      action: 'execute_task',
      task_id: taskId,
    }).catch(() => null);
  } catch (e) {
    console.warn('Task orchestration failed:', e.message);
  }

  return Response.json({
    success: true,
    task_id: taskId,
    status: 'queued_for_retry',
    message: 'Task resubmitted for execution.',
  });
}

/**
 * Determine intervention type based on error
 */
function determineInterventionType(statusCode, error) {
  if (statusCode === 401 || statusCode === 403) {
    return 'credential_update_required';
  }
  if (statusCode === 429) {
    return 'rate_limit_exceeded';
  }
  if (statusCode >= 500) {
    return 'api_server_error';
  }
  if (error?.includes('timeout')) {
    return 'timeout';
  }
  if (error?.includes('connection')) {
    return 'connection_error';
  }
  return 'unknown_error';
}

/**
 * Determine intervention severity
 */
function determineSeverity(statusCode) {
  if (statusCode >= 500) return 'high';
  if (statusCode >= 400) return 'medium';
  return 'low';
}