import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Scheduled function that runs every 5 minutes to process pending retries.
 * Checks if scheduled retry time has arrived and re-queues tasks.
 * Last redeployed: 2026-03-17
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();

    const pendingRetries = await base44.asServiceRole.entities.RetryHistory.filter(
      { status: 'pending' },
      '-scheduled_retry_at',
      10
    );

    if (!pendingRetries || pendingRetries.length === 0) {
      return Response.json({ processed: 0, message: 'No pending retries' });
    }

    let processed = 0;
    let requeued = 0;
    let escalated = 0;

    for (const retry of pendingRetries) {
      const scheduledTime = new Date(retry.scheduled_retry_at);
      if (scheduledTime > now) continue;

      try {
        const tasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
          { id: retry.task_id },
          '-created_date',
          1
        );

        if (!tasks || tasks.length === 0) {
          await base44.asServiceRole.entities.RetryHistory.update(retry.id, {
            status: 'abandoned',
            notes: 'Original task not found',
          });
          escalated++;
          processed++;
          continue;
        }

        const originalTask = tasks[0];

        await base44.asServiceRole.entities.TaskExecutionQueue.create({
          opportunity_id: originalTask.opportunity_id,
          url: originalTask.url,
          opportunity_type: originalTask.opportunity_type,
          platform: originalTask.platform,
          identity_id: retry.identity_id || originalTask.identity_id,
          identity_name: originalTask.identity_name,
          status: 'queued',
          priority: (originalTask.priority || 50) + 5,
          estimated_value: originalTask.estimated_value,
          deadline: originalTask.deadline,
          execution_log: [
            ...(originalTask.execution_log || []),
            {
              timestamp: now.toISOString(),
              step: 'retry_requeued',
              status: 'info',
              details: `Requeued after ${retry.recovery_strategy} (Attempt ${(retry.retry_count || 0) + 1})`,
            },
          ],
          notes: `Retry #${(retry.retry_count || 0) + 1} via ${retry.recovery_strategy}`,
        });

        await base44.asServiceRole.entities.RetryHistory.update(retry.id, {
          status: 'in_progress',
          retry_count: (retry.retry_count || 0) + 1,
        });

        requeued++;
        processed++;
      } catch (err) {
        console.error(`Error processing retry ${retry.id}:`, err.message);
        await base44.asServiceRole.entities.RetryHistory.update(retry.id, {
          status: 'escalated',
          notes: err.message,
        });
        escalated++;
        processed++;
      }
    }

    return Response.json({ processed, requeued, escalated, timestamp: now.toISOString() });
  } catch (error) {
    console.error('Retry scheduler error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});