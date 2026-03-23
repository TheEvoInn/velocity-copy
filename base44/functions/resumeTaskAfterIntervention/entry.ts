import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * RESUME TASK AFTER INTERVENTION
 * Triggered when user provides data through intervention
 * Re-queues task with user-provided data
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { intervention_id } = await req.json();

    if (!intervention_id) {
      return jsonResponse({ error: 'intervention_id required' }, 400);
    }

    // Fetch intervention
    const intervention = await base44.asServiceRole.entities.UserIntervention.get(intervention_id).catch(() => null);

    if (!intervention) {
      return jsonResponse({ error: 'Intervention not found' }, 404);
    }

    if (intervention.status !== 'resolved') {
      return jsonResponse({ error: 'Intervention not resolved yet' }, 400);
    }

    // Fetch task
    const task = await base44.asServiceRole.entities.TaskExecutionQueue.get(intervention.task_id).catch(() => null);

    if (!task) {
      return jsonResponse({ error: 'Task not found' }, 404);
    }

    // Re-queue task with intervention data
    await base44.asServiceRole.entities.TaskExecutionQueue.update(intervention.task_id, {
      status: 'queued',
      intervention_data: intervention.user_response,
      resumed_after_intervention: true,
      resumed_at: new Date().toISOString()
    }).catch(() => {});

    // Trigger Autopilot resumption
    await base44.functions.invoke('unifiedAutopilot', {
      task_id: intervention.task_id,
      resume_after_intervention: true,
      intervention_data: intervention.user_response
    }).catch(() => {});

    return jsonResponse({
      intervention_id,
      task_id: intervention.task_id,
      resumed: true,
      message: 'Task resumption triggered'
    });

  } catch (error) {
    console.error('[Resume Task]', error.message);
    return jsonResponse({ error: error.message }, 500);
  }
});

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}