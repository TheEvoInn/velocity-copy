import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * RESUME TASK AFTER INTERVENTION
 * Bridges the gap: intervention → queued task → agent execution
 * This function MUST be called after provideMissingData to ensure proper task re-engagement
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const { intervention_id, task_id } = body;

    if (!intervention_id || !task_id) {
      return jsonResponse({ error: 'intervention_id and task_id required' }, 400);
    }

    // 1. Verify intervention resolved with user data
    const intervention = await base44.asServiceRole.entities.UserIntervention.get(intervention_id).catch(() => null);
    if (!intervention) {
      return jsonResponse({ error: 'Intervention not found' }, 404);
    }

    if (intervention.status !== 'resolved') {
      return jsonResponse({ error: 'Intervention not yet resolved' }, 400);
    }

    // 2. Get task and verify it's queued with data
    const task = await base44.asServiceRole.entities.TaskExecutionQueue.get(task_id).catch(() => null);
    if (!task) {
      return jsonResponse({ error: 'Task not found' }, 404);
    }

    // 3. Ensure task has intervention data injected
    if (!task.intervention_data && intervention.user_response) {
      await base44.asServiceRole.entities.TaskExecutionQueue.update(task_id, {
        intervention_data: intervention.user_response
      }).catch(() => null);
    }

    // 4. CRITICAL: Directly invoke agentWorker to re-engage task execution
    let agentResult = null;
    try {
      agentResult = await base44.asServiceRole.functions.invoke('agentWorker', {
        action: 'execute_task_by_id',
        task_id: task_id,
        from_intervention: true,
        data: intervention.user_response
      });
    } catch (e) {
      console.error('[resumeTaskAfterIntervention] Agent execution failed:', e.message);
      // Task is queued—will be picked up on next polling cycle
    }

    // 5. Log resumption event with full context
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'user_action',
      message: `📋 Task resumed from intervention: ${task.opportunity_type} (${task.platform})`,
      metadata: {
        intervention_id,
        task_id,
        requirement_type: intervention.requirement_type,
        agent_engaged: !!agentResult?.data?.success,
        user_email: user.email
      },
      severity: 'info'
    }).catch(() => null);

    return jsonResponse({
      success: true,
      intervention_id,
      task_id,
      execution_state: {
        task_status: 'queued',
        intervention_data_injected: !!task.intervention_data,
        agent_engaged: !!agentResult?.data?.success,
        resumption_timestamp: new Date().toISOString()
      },
      message: 'Task queued and agent re-engaged after intervention data provided.'
    });

  } catch (error) {
    console.error('[resumeTaskAfterIntervention]', error.message);
    return jsonResponse({ error: error.message }, 500);
  }
});

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}