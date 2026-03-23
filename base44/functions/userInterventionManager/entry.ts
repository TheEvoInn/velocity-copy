import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * USER INTERVENTION MANAGER
 * Phase 11: Complete handler for user intervention lifecycle
 * Collects missing data, syncs back to Autopilot, persists credentials
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const { action, intervention_id } = body;

    if (action === 'get_pending_interventions') {
      return await getPendingInterventions(base44, user);
    }

    if (action === 'provide_missing_data') {
      return await provideMissingData(base44, user, intervention_id, body.data);
    }

    if (action === 'approve_intervention') {
      return await approveIntervention(base44, user, intervention_id);
    }

    if (action === 'reject_intervention') {
      return await rejectIntervention(base44, user, intervention_id, body.reason);
    }

    if (action === 'resume_after_intervention') {
      return await resumeAfterIntervention(base44, user, intervention_id);
    }

    return jsonResponse({ error: 'Unknown action' }, 400);

  } catch (error) {
    console.error('[UserInterventionManager]', error.message);
    return jsonResponse({ error: error.message }, 500);
  }
});

/**
 * Get pending interventions for user
 */
async function getPendingInterventions(base44, user) {
  try {
    const interventions = await base44.entities.UserIntervention?.filter?.({
      created_by: user.email,
      status: { $in: ['pending', 'in_progress'] }
    }, '-created_date', 50).catch(() => []);

    const pending = {
      timestamp: new Date().toISOString(),
      total_pending: interventions.length,
      by_type: {},
      interventions: []
    };

    for (const intervention of interventions) {
      if (!pending.by_type[intervention.requirement_type]) {
        pending.by_type[intervention.requirement_type] = 0;
      }
      pending.by_type[intervention.requirement_type]++;

      pending.interventions.push({
        id: intervention.id,
        task_id: intervention.task_id,
        requirement_type: intervention.requirement_type,
        status: intervention.status,
        priority: intervention.priority,
        created_at: intervention.created_date,
        expires_at: intervention.expires_at,
        required_data: intervention.required_data,
        data_schema: intervention.data_schema,
        template_responses: intervention.template_responses,
        direct_link: intervention.direct_link,
        description: intervention.required_data || 'Action required from user'
      });
    }

    return jsonResponse(pending);

  } catch (error) {
    return jsonResponse({ error: 'Failed to get interventions', details: error.message }, 500);
  }
}

/**
 * Provide missing data for intervention
 */
async function provideMissingData(base44, user, interventionId, data) {
  if (!interventionId || !data) {
    return jsonResponse({ error: 'intervention_id, data required' }, 400);
  }

  try {
    const intervention = await base44.entities.UserIntervention?.get?.(interventionId).catch(() => null);

    if (!intervention) {
      return jsonResponse({ error: 'Intervention not found' }, 404);
    }

    if (intervention.created_by !== user.email) {
      return jsonResponse({ error: 'Unauthorized access to intervention' }, 403);
    }

    // Update intervention with provided data
    await base44.asServiceRole.entities.UserIntervention?.update?.(interventionId, {
      status: 'resolved',
      user_response: data,
      resolved_at: new Date().toISOString()
    }).catch(() => {});

    // Log data submission
    await base44.asServiceRole.entities.AuditLog?.create?.({
      entity_type: 'UserIntervention',
      entity_id: interventionId,
      action_type: 'user_data_provided',
      user_email: user.email,
      details: {
        intervention_id: interventionId,
        task_id: intervention.task_id,
        data_fields: Object.keys(data)
      },
      severity: 'info',
      timestamp: new Date().toISOString()
    }).catch(() => {});

    // Trigger task resumption
    await base44.functions.invoke('resumeTaskAfterIntervention', {
      intervention_id: interventionId
    }).catch(() => {});

    return jsonResponse({
      intervention_id: interventionId,
      data_received: true,
      status: 'resolved',
      message: 'Data received. Task execution resuming...'
    });

  } catch (error) {
    return jsonResponse({ error: 'Data submission failed', details: error.message }, 500);
  }
}

/**
 * Approve intervention (user confirms)
 */
async function approveIntervention(base44, user, interventionId) {
  if (!interventionId) {
    return jsonResponse({ error: 'intervention_id required' }, 400);
  }

  try {
    const intervention = await base44.entities.UserIntervention?.get?.(interventionId).catch(() => null);

    if (!intervention) {
      return jsonResponse({ error: 'Intervention not found' }, 404);
    }

    if (intervention.created_by !== user.email) {
      return jsonResponse({ error: 'Unauthorized access to intervention' }, 403);
    }

    // Update status
    await base44.asServiceRole.entities.UserIntervention?.update?.(interventionId, {
      status: 'approved',
      approved_at: new Date().toISOString()
    }).catch(() => {});

    // Log approval
    await base44.asServiceRole.entities.AuditLog?.create?.({
      entity_type: 'UserIntervention',
      entity_id: interventionId,
      action_type: 'intervention_approved',
      user_email: user.email,
      details: { intervention_id: interventionId },
      severity: 'info',
      timestamp: new Date().toISOString()
    }).catch(() => {});

    return jsonResponse({
      intervention_id: interventionId,
      approved: true,
      status: 'approved',
      message: 'Intervention approved. Task execution will resume.'
    });

  } catch (error) {
    return jsonResponse({ error: 'Approval failed', details: error.message }, 500);
  }
}

/**
 * Reject intervention
 */
async function rejectIntervention(base44, user, interventionId, reason = '') {
  if (!interventionId) {
    return jsonResponse({ error: 'intervention_id required' }, 400);
  }

  try {
    const intervention = await base44.entities.UserIntervention?.get?.(interventionId).catch(() => null);

    if (!intervention) {
      return jsonResponse({ error: 'Intervention not found' }, 404);
    }

    if (intervention.created_by !== user.email) {
      return jsonResponse({ error: 'Unauthorized access to intervention' }, 403);
    }

    // Update status
    await base44.asServiceRole.entities.UserIntervention?.update?.(interventionId, {
      status: 'rejected',
      rejection_reason: reason,
      rejected_at: new Date().toISOString()
    }).catch(() => {});

    // Log rejection
    await base44.asServiceRole.entities.AuditLog?.create?.({
      entity_type: 'UserIntervention',
      entity_id: interventionId,
      action_type: 'intervention_rejected',
      user_email: user.email,
      details: {
        intervention_id: interventionId,
        reason: reason
      },
      severity: 'warning',
      timestamp: new Date().toISOString()
    }).catch(() => {});

    return jsonResponse({
      intervention_id: interventionId,
      rejected: true,
      status: 'rejected',
      reason: reason,
      message: 'Intervention rejected. Task execution will be cancelled.'
    });

  } catch (error) {
    return jsonResponse({ error: 'Rejection failed', details: error.message }, 500);
  }
}

/**
 * Resume task after intervention is complete
 */
async function resumeAfterIntervention(base44, user, interventionId) {
  if (!interventionId) {
    return jsonResponse({ error: 'intervention_id required' }, 400);
  }

  try {
    const intervention = await base44.entities.UserIntervention?.get?.(interventionId).catch(() => null);

    if (!intervention) {
      return jsonResponse({ error: 'Intervention not found' }, 404);
    }

    if (intervention.created_by !== user.email) {
      return jsonResponse({ error: 'Unauthorized access to intervention' }, 403);
    }

    // Mark as resolved
    await base44.asServiceRole.entities.UserIntervention?.update?.(interventionId, {
      status: 'resolved',
      resolved_at: new Date().toISOString()
    }).catch(() => {});

    // Find related task by task_id (direct reference)
    const relatedTask = await base44.asServiceRole.entities.TaskExecutionQueue?.get?.(intervention.task_id).catch(() => null);

    let taskResumed = false;
    if (relatedTask) {
      // Inject user-provided data into task context
      await base44.asServiceRole.entities.TaskExecutionQueue?.update?.(intervention.task_id, {
        status: 'queued',
        intervention_data: intervention.user_response,
        resumed_after_intervention: true,
        resumed_at: new Date().toISOString()
      }).catch(() => {});
      taskResumed = true;
    }

    // Persist credentials if provided
    if (intervention.user_response && intervention.requirement_type === 'credential') {
      await base44.functions.invoke('persistInterventionCredentials', {
        intervention_id: interventionId,
        data: intervention.user_response,
        user_email: user.email
      }).catch(() => {});
    }

    // Log resumption
    await base44.asServiceRole.entities.AuditLog?.create?.({
      entity_type: 'UserIntervention',
      entity_id: interventionId,
      action_type: 'execution_resumed',
      user_email: user.email,
      details: {
        intervention_id: interventionId,
        task_id: intervention.task_id,
        task_resumed: taskResumed
      },
      severity: 'info',
      timestamp: new Date().toISOString()
    }).catch(() => {});

    return jsonResponse({
      intervention_id: interventionId,
      execution_resumed: taskResumed,
      task_id: intervention.task_id,
      status: 'resolved',
      message: taskResumed ? 'Intervention resolved. Task execution resumed.' : 'Intervention resolved but task not found for resumption.'
    });

  } catch (error) {
    return jsonResponse({ error: 'Resume failed', details: error.message }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}