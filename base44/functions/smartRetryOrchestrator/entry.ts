import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const {
      task_id,
      analysis,
      force_retry = false,
    } = payload;

    if (!task_id || !analysis) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch the failed task
    const tasks = await base44.entities.TaskExecutionQueue.filter(
      { id: task_id },
      '-created_date',
      1
    );

    if (!tasks || tasks.length === 0) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }

    const task = tasks[0];

    // Check retry limits
    const retryCheck = await checkRetryLimits(base44, task_id, analysis.error_type);
    if (retryCheck.exceeded && !force_retry) {
      return Response.json({
        status: 'escalated',
        reason: retryCheck.reason,
        message: 'Retry limit exceeded - escalating to manual review',
      });
    }

    // Attempt recovery actions
    const recoveryResults = await executeRecoveryActions(base44, task, analysis);

    // Determine new identity/account if needed
    let new_identity_id = task.identity_id;
    let new_account_id = task.linked_account_id;

    if (analysis.requires_identity_switch) {
      new_identity_id = await switchToAlternativeIdentity(base44, task.identity_id, task.platform);
    }

    if (analysis.requires_account_switch) {
      new_account_id = await switchToAlternativeAccount(base44, task.linked_account_id, task.platform);
    }

    // Schedule retry
    const scheduledTime = new Date(Date.now() + analysis.calculated_delay_seconds * 1000);

    const retryRecord = await base44.entities.RetryHistory.create({
      task_id,
      opportunity_id: task.opportunity_id,
      platform: task.platform,
      error_type: analysis.error_type,
      error_message: analysis.error_details?.message || '',
      http_status_code: analysis.error_details?.http_status,
      is_recoverable: analysis.is_recoverable,
      recovery_strategy: analysis.recovery_strategy,
      calculated_delay_seconds: analysis.calculated_delay_seconds,
      delay_reason: analysis.delay_reason,
      scheduled_retry_at: scheduledTime.toISOString(),
      recovery_actions_taken: recoveryResults,
      identity_id: new_identity_id,
      account_id: new_account_id,
      historical_success_rate: analysis.historical_success_rate,
      confidence_score: analysis.confidence_score,
      status: 'pending',
      notes: `Retry scheduled after ${analysis.recovery_strategy}`,
    });

    // Update original task with retry reference
    await base44.entities.TaskExecutionQueue.update(task_id, {
      status: 'needs_review',
      error_message: analysis.error_details?.message,
      notes: `Scheduled for retry at ${scheduledTime.toISOString()}`,
    });

    // Notify user
    await notifyUserOfRetry(base44, task, analysis, scheduledTime, recoveryResults);

    return Response.json({
      status: 'retry_scheduled',
      retry_id: retryRecord.id,
      scheduled_at: scheduledTime.toISOString(),
      recovery_strategy: analysis.recovery_strategy,
      confidence: analysis.confidence_score,
      recovery_actions: recoveryResults,
      new_identity_id,
      new_account_id,
    });
  } catch (error) {
    console.error('Retry orchestration failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function checkRetryLimits(base44, taskId, errorType) {
  try {
    const histories = await base44.entities.RetryHistory.filter(
      { task_id: taskId },
      '-created_date',
      10
    );

    const retryCount = histories?.length || 0;
    const maxRetries = 5;

    if (retryCount >= maxRetries) {
      return {
        exceeded: true,
        reason: `Max retries (${maxRetries}) exceeded for this task`,
      };
    }

    return { exceeded: false };
  } catch (error) {
    console.error('Error checking retry limits:', error);
    return { exceeded: false };
  }
}

async function executeRecoveryActions(base44, task, analysis) {
  const actions = [];

  try {
    // Refresh credentials if needed
    if (analysis.requires_credential_refresh) {
      actions.push({
        action: 'refresh_credentials',
        status: 'pending',
        timestamp: new Date().toISOString(),
        details: 'Will refresh credentials before retry',
      });
    }

    // Rebuild form mapping if needed
    if (analysis.requires_form_rebuild) {
      actions.push({
        action: 'rebuild_form_mapping',
        status: 'pending',
        timestamp: new Date().toISOString(),
        details: 'Will re-scan and re-map form fields',
      });
    }

    // Validate platform status
    if (analysis.error_type === 'platform_downtime') {
      actions.push({
        action: 'validate_platform_uptime',
        status: 'pending',
        timestamp: new Date().toISOString(),
        details: 'Will check platform status before retry',
      });
    }
  } catch (error) {
    console.error('Error planning recovery actions:', error);
  }

  return actions;
}

async function switchToAlternativeIdentity(base44, currentIdentityId, platform) {
  try {
    // Fetch all active identities
    const identities = await base44.entities.AIIdentity.filter(
      { is_active: true },
      '-created_date',
      10
    );

    // Find alternative identity that:
    // 1. Is different from current
    // 2. Has the required platform
    // 3. Has good health status
    const alternative = identities?.find(
      i => i.id !== currentIdentityId &&
           i.preferred_platforms?.includes(platform) &&
           i.health_status === 'healthy'
    );

    return alternative?.id || currentIdentityId;
  } catch (error) {
    console.error('Error switching identity:', error);
    return currentIdentityId;
  }
}

async function switchToAlternativeAccount(base44, currentAccountId, platform) {
  try {
    // Fetch alternative accounts on same platform
    const accounts = await base44.entities.LinkedAccount.filter(
      { platform, health_status: 'healthy', ai_can_use: true },
      '-performance_score',
      5
    );

    // Find one that's different and has better performance
    const alternative = accounts?.find(
      a => a.id !== currentAccountId && a.performance_score > 50
    );

    return alternative?.id || currentAccountId;
  } catch (error) {
    console.error('Error switching account:', error);
    return currentAccountId;
  }
}

async function notifyUserOfRetry(base44, task, analysis, scheduledTime, recoveryActions) {
  try {
    const delayMinutes = Math.round(analysis.calculated_delay_seconds / 60);
    const message = `
Task Retry Scheduled
━━━━━━━━━━━━━━━━━
Opportunity: ${task.platform}
Error: ${analysis.error_type}
Strategy: ${analysis.recovery_strategy}
Scheduled Retry: ${scheduledTime.toLocaleString()} (in ${delayMinutes} min)
Success Probability: ${analysis.confidence_score}%
Recovery Actions: ${recoveryActions.length} planned

Status: Automatically handling. No action needed unless you want to force retry.
    `;

    // Log notification
    await base44.entities.ActivityLog.create({
      action_type: 'alert',
      message,
      metadata: {
        task_id: task.id,
        error_type: analysis.error_type,
        scheduled_time: scheduledTime.toISOString(),
        confidence: analysis.confidence_score,
      },
      severity: analysis.is_recoverable ? 'info' : 'warning',
    });

    console.log('User notified:', message);
  } catch (error) {
    console.error('Error notifying user:', error);
  }
}