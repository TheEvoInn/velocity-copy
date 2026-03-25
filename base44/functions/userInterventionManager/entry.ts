import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * USER INTERVENTION MANAGER - Phase 12
 * Complete handler for user intervention lifecycle with proper status sync
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
 * Provide missing data for intervention — THIS MARKS AS RESOLVED AND RESUMES TASK
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

    // Check for rate-limit detected and rotate identity if needed
    let rotateIdentity = false;
    if (data.error_type === 'rate_limit' || data.error_type === 'blocked') {
      rotateIdentity = true;
    }

    // Update intervention: mark as RESOLVED with user data
    await base44.asServiceRole.entities.UserIntervention?.update?.(interventionId, {
      status: 'resolved',
      user_response: data,
      resolved_at: new Date().toISOString(),
      requires_identity_rotation: rotateIdentity
    }).catch(() => null);

    // If rate-limited, trigger identity rotation
    if (rotateIdentity) {
      try {
        const identities = await base44.asServiceRole.entities.AIIdentity.filter(
          { is_active: true },
          'created_date',
          20
        ).catch(() => []);

        if (identities && identities.length > 1) {
          const currentIdentity = identities[0];
          const nextIdentity = identities[1];

          await base44.asServiceRole.entities.AIIdentity.update(currentIdentity.id, {
            is_active: false,
            last_rate_limit_at: new Date().toISOString()
          }).catch(() => null);

          await base44.asServiceRole.entities.AIIdentity.update(nextIdentity.id, {
            is_active: true
          }).catch(() => null);

          await base44.asServiceRole.entities.ActivityLog.create({
            action_type: 'system',
            message: `🔄 Identity rotated: ${currentIdentity.name} → ${nextIdentity.name} (rate-limit detected)`,
            severity: 'warning',
            metadata: { reason: 'rate_limit', old_identity: currentIdentity.id, new_identity: nextIdentity.id }
          }).catch(() => null);
        }
      } catch (e) {
        console.warn('Identity rotation failed:', e.message);
      }
    }

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
    }).catch(() => null);

    // CRITICAL: Resume task immediately (inject data + mark task as queued)
    let taskResumed = false;
    try {
      const relatedTask = await base44.asServiceRole.entities.TaskExecutionQueue?.get?.(intervention.task_id).catch(() => null);
      if (relatedTask) {
        await base44.asServiceRole.entities.TaskExecutionQueue?.update?.(intervention.task_id, {
          status: 'queued',
          intervention_data: data,
          resumed_after_intervention: true,
          resumed_at: new Date().toISOString()
        }).catch(() => null);
        taskResumed = true;
      }
    } catch (e) {
      console.error('Task resumption error:', e.message);
    }

    // Persist credentials if provided
    if (data && intervention.requirement_type === 'credential') {
      try {
        await base44.asServiceRole.functions.invoke('persistInterventionCredentials', {
          intervention_id: interventionId,
          data: data,
          user_email: user.email
        }).catch(() => null);
      } catch (e) {
        console.error('Credential persistence error:', e.message);
      }
    }

    return jsonResponse({
      intervention_id: interventionId,
      data_received: true,
      status: 'resolved',
      task_resumed: taskResumed,
      identity_rotated: rotateIdentity,
      message: 'Data submitted. Intervention resolved and task resumed.'
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

    // Mark as approved and resume task
    await base44.asServiceRole.entities.UserIntervention?.update?.(interventionId, {
      status: 'resolved',
      approved_at: new Date().toISOString()
    }).catch(() => null);

    // Resume related task
    if (intervention.task_id) {
      await base44.asServiceRole.entities.TaskExecutionQueue?.update?.(intervention.task_id, {
        status: 'queued',
        resumed_after_intervention: true,
        resumed_at: new Date().toISOString()
      }).catch(() => null);
    }

    // Log approval
    await base44.asServiceRole.entities.AuditLog?.create?.({
      entity_type: 'UserIntervention',
      entity_id: interventionId,
      action_type: 'intervention_approved',
      user_email: user.email,
      details: { intervention_id: interventionId },
      severity: 'info',
      timestamp: new Date().toISOString()
    }).catch(() => null);

    return jsonResponse({
      intervention_id: interventionId,
      approved: true,
      status: 'resolved',
      message: 'Intervention approved and task resumed.'
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

    // Mark as resolved (rejected)
    await base44.asServiceRole.entities.UserIntervention?.update?.(interventionId, {
      status: 'resolved',
      rejection_reason: reason,
      rejected_at: new Date().toISOString()
    }).catch(() => null);

    // Cancel related task
    if (intervention.task_id) {
      await base44.asServiceRole.entities.TaskExecutionQueue?.update?.(intervention.task_id, {
        status: 'cancelled',
        cancellation_reason: 'User rejected intervention',
        cancelled_at: new Date().toISOString()
      }).catch(() => null);
    }

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
    }).catch(() => null);

    return jsonResponse({
      intervention_id: interventionId,
      rejected: true,
      status: 'resolved',
      reason: reason,
      message: 'Intervention rejected and task cancelled.'
    });

  } catch (error) {
    return jsonResponse({ error: 'Rejection failed', details: error.message }, 500);
  }
}

/**
 * Resume task after intervention (legacy—now integrated into provideMissingData)
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

    // Already marked as resolved in provideMissingData, but handle for completeness
    let taskResumed = false;
    if (intervention.task_id) {
      const relatedTask = await base44.asServiceRole.entities.TaskExecutionQueue?.get?.(intervention.task_id).catch(() => null);
      if (relatedTask) {
        await base44.asServiceRole.entities.TaskExecutionQueue?.update?.(intervention.task_id, {
          status: 'queued',
          intervention_data: intervention.user_response,
          resumed_after_intervention: true,
          resumed_at: new Date().toISOString()
        }).catch(() => null);
        taskResumed = true;
      }
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
    }).catch(() => null);

    return jsonResponse({
      intervention_id: interventionId,
      execution_resumed: taskResumed,
      task_id: intervention.task_id,
      status: 'resolved',
      message: 'Task execution resumed.'
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