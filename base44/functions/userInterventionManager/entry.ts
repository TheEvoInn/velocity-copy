import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * USER INTERVENTION MANAGER
 * Phase 3: Handles cases where autopilot needs human input
 * Escalates issues, collects missing data, resumes execution
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
      status: { $in: ['pending_approval', 'pending_data', 'pending_user_input'] }
    }, '-created_date', 50).catch(() => []);

    const pending = {
      timestamp: new Date().toISOString(),
      total_pending: interventions.length,
      by_type: {},
      interventions: []
    };

    for (const intervention of interventions) {
      if (!pending.by_type[intervention.entity_type]) {
        pending.by_type[intervention.entity_type] = 0;
      }
      pending.by_type[intervention.entity_type]++;

      pending.interventions.push({
        id: intervention.id,
        entity_type: intervention.entity_type,
        entity_id: intervention.entity_id,
        status: intervention.status,
        action_required: intervention.action_type || 'respond',
        created_at: intervention.created_date,
        description: intervention.description || 'Action required from user'
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
      status: 'data_provided',
      user_provided_data: data,
      data_provided_at: new Date().toISOString()
    }).catch(() => {});

    // Log data submission
    await base44.asServiceRole.entities.AuditLog?.create?.({
      entity_type: 'UserIntervention',
      entity_id: interventionId,
      action_type: 'user_data_provided',
      user_email: user.email,
      details: {
        intervention_id: interventionId,
        data_fields: Object.keys(data)
      },
      severity: 'info',
      timestamp: new Date().toISOString()
    }).catch(() => {});

    return jsonResponse({
      intervention_id: interventionId,
      data_received: true,
      status: 'data_provided',
      next_step: 'resume_execution',
      message: 'Data received. Ready to resume task execution.'
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

    // Find related task and requeue it
    const relatedTasks = await base44.asServiceRole.entities.AITask?.filter?.({
      webhook_id: intervention.entity_id
    }, '-created_date', 5).catch(() => []);

    let taskResumed = false;
    if (relatedTasks && relatedTasks.length > 0) {
      const task = relatedTasks[0];
      await base44.asServiceRole.entities.AITask?.update?.(task.id, {
        status: 'queued',
        resumed_after_intervention: true,
        resumed_at: new Date().toISOString()
      }).catch(() => {});
      taskResumed = true;
    }

    // Log resumption
    await base44.asServiceRole.entities.AuditLog?.create?.({
      entity_type: 'UserIntervention',
      entity_id: interventionId,
      action_type: 'execution_resumed',
      user_email: user.email,
      details: {
        intervention_id: interventionId,
        task_resumed: taskResumed
      },
      severity: 'info',
      timestamp: new Date().toISOString()
    }).catch(() => {});

    return jsonResponse({
      intervention_id: interventionId,
      execution_resumed: true,
      status: 'resolved',
      message: 'Intervention resolved. Task execution resumed.'
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