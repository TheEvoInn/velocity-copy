import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * TASK QUEUE POLLER
 * Scheduled automation that polls for queued tasks and triggers execution
 * Runs every 10 seconds to keep task pipeline moving
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    
    // If no authenticated user, skip polling (RLS will block updates anyway)
    if (!user) {
      return jsonResponse({ polled: false, reason: 'No authenticated user' });
    }

    // Get all queued tasks using user context (not service role) to respect RLS
    const queuedTasks = await base44.entities.TaskExecutionQueue.filter(
      { status: 'queued' },
      '-priority',
      100
    ).catch(() => []);

    if (!queuedTasks || queuedTasks.length === 0) {
      return jsonResponse({ polled: true, queued_count: 0, triggered: 0 });
    }

    // Trigger execution for top-priority tasks (max 5 per cycle to avoid overload)
    const toExecute = queuedTasks.slice(0, 5);
    let triggered = 0;

    for (const task of toExecute) {
      try {
        // Skip if task not created by current user (RLS will block update anyway)
        if (task.created_by !== user.email) continue;

        // Mark as processing using user context
        await base44.entities.TaskExecutionQueue.update(task.id, {
          status: 'processing',
          started_processing_at: new Date().toISOString()
        }).catch(() => null);

        // Invoke Autopilot executor
        await base44.functions.invoke('unifiedAutopilot', {
          task_id: task.id,
          action: 'execute_queued_task',
          opportunity_id: task.opportunity_id
        }).catch((e) => {
          console.error(`Task ${task.id} execution failed:`, e.message);
          // Revert to queued if execution fails
          base44.entities.TaskExecutionQueue.update(task.id, {
            status: 'queued'
          }).catch(() => null);
        });

        triggered++;
      } catch (e) {
        console.warn(`Failed to process task ${task.id}:`, e.message);
      }
    }

    // Log polling activity
    await base44.entities.ActivityLog.create({
      action_type: 'system',
      message: `📋 Task queue poll: ${queuedTasks.length} queued, triggered ${triggered}`,
      severity: 'info',
      metadata: { queued_count: queuedTasks.length, triggered_count: triggered }
    }).catch(() => null);

    return jsonResponse({
      polled: true,
      queued_count: queuedTasks.length,
      triggered,
      message: `Polled queue and triggered ${triggered} tasks`
    });

  } catch (error) {
    console.error('[TaskQueuePoller]', error.message);
    return jsonResponse({ error: error.message, polled: false }, 500);
  }
});

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}