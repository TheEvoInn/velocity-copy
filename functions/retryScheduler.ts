import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Scheduled function that runs every 5 minutes to process pending retries.
 * Checks if scheduled retry time has arrived and re-queues tasks.
 * Last redeployed: 2026-03-17
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch all pending retries that are due
    const now = new Date();
    const pendingRetries = await base44.asServiceRole.entities.RetryHistory.filter(
      { status: 'pending' },
      '-scheduled_retry_at',
      10  // Hard cap to avoid TIME_LIMIT (502) on 5-min schedule
    );

    if (!pendingRetries || pendingRetries.length === 0) {
      return Response.json({ processed: 0, message: 'No pending retries' });
    }

    let processed = 0;
    let requeued = 0;
    let escalated = 0;

    for (const retry of pendingRetries) {
      const scheduledTime = new Date(retry.scheduled_retry_at);

      // Check if scheduled time has arrived
      if (scheduledTime > now) {
        continue; // Not yet time
      }

      try {
        // Execute pre-retry recovery actions
        const recoverySuccess = await executePreRetryRecovery(base44, retry);

        // Fetch original task
        const tasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
          { id: retry.task_id },
          '-created_date',
          1
        );

        if (!tasks || tasks.length === 0) {
          await updateRetryStatus(base44, retry.id, 'abandoned', 'Original task not found');
          escalated++;
          continue;
        }

        const originalTask = tasks[0];

        // Re-queue task with updated context
        const requeuedTask = await base44.asServiceRole.entities.TaskExecutionQueue.create({
          opportunity_id: originalTask.opportunity_id,
          url: originalTask.url,
          opportunity_type: originalTask.opportunity_type,
          platform: originalTask.platform,
          identity_id: retry.identity_id || originalTask.identity_id,
          identity_name: originalTask.identity_name,
          status: 'queued',
          priority: originalTask.priority + 5, // Slight priority boost for retries
          estimated_value: originalTask.estimated_value,
          deadline: originalTask.deadline,
          execution_log: [
            ...(originalTask.execution_log || []),
            {
              timestamp: new Date().toISOString(),
              step: 'retry_requeued',
              status: 'info',
              details: `Requeued after ${retry.recovery_strategy} (Attempt ${retry.retry_count + 1})`,
            },
          ],
          notes: `Retry #${(retry.retry_count || 0) + 1} via ${retry.recovery_strategy}`,
        });

        // Update retry record
        await base44.asServiceRole.entities.RetryHistory.update(retry.id, {
          status: 'in_progress',
          retry_count: (retry.retry_count || 0) + 1,
        });

        requeued++;
        processed++;

        // Log activity
        await base44.asServiceRole.entities.ActivityLog.create({
          action_type: 'system',
          message: `Task requeued for retry (Attempt ${(retry.retry_count || 0) + 1})`,
          metadata: {
            retry_id: retry.id,
            task_id: retry.task_id,
            strategy: retry.recovery_strategy,
            new_task_id: requeuedTask.id,
          },
          severity: 'info',
        });
      } catch (error) {
        console.error(`Error processing retry ${retry.id}:`, error);
        await updateRetryStatus(base44, retry.id, 'escalated', error.message);
        escalated++;
        processed++;
      }
    }

    return Response.json({
      processed,
      requeued,
      escalated,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('Retry scheduler error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function executePreRetryRecovery(base44, retry) {
  const actions = retry.recovery_actions_taken || [];

  for (const action of actions) {
    try {
      if (action.action === 'refresh_credentials') {
        // Refresh credentials for the identity
        await base44.asServiceRole.entities.CredentialVault.filter(
          { linked_account_id: retry.account_id },
          '-last_accessed',
          1
        );
        // In production, would refresh tokens here
      } else if (action.action === 'rebuild_form_mapping') {
        // Form will be re-analyzed during execution
      } else if (action.action === 'validate_platform_uptime') {
        // Check if platform is back up
        // Would integrate with uptime monitoring service
      }
    } catch (error) {
      console.error(`Recovery action ${action.action} failed:`, error);
    }
  }

  return true;
}

async function updateRetryStatus(base44, retryId, status, details) {
  try {
    await base44.asServiceRole.entities.RetryHistory.update(retryId, {
      status,
      notes: details,
    });
  } catch (error) {
    console.error(`Error updating retry ${retryId}:`, error);
  }
}