import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * AUTOMATION FAILURE HANDLER
 * Triggered when automations fail; implements recovery logic
 * Catches transient errors, retries, escalates if persistent
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const { automation_id, function_name, error_message, last_run_status } = body;

    if (!automation_id) {
      return Response.json({ error: 'No automation_id provided' }, { status: 400 });
    }

    // Determine if error is transient
    const transientErrors = [
      'timeout',
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'temporarily unavailable',
      'service unavailable',
      'connection pool exhausted'
    ];

    const isTransient = transientErrors.some(err =>
      error_message?.toLowerCase().includes(err.toLowerCase())
    );

    if (!isTransient) {
      // Persistent error — escalate immediately
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'alert',
        message: `❌ Persistent Error in Automation: ${function_name}`,
        severity: 'critical',
        metadata: { automation_id, error_message }
      }).catch(() => {});

      return Response.json({
        success: false,
        is_transient: false,
        action: 'escalated_to_manual_review',
        message: 'Persistent error detected — requires manual intervention'
      });
    }

    // Transient error — attempt retry
    const retryRes = await base44.asServiceRole.functions.invoke('errorRecoveryOrchestrator', {
      automation_id,
      error_type: 'transient_error',
      attempt: 1,
      max_retries: 3
    }).catch(e => ({ data: { success: false, error: e.message } }));

    return Response.json({
      success: true,
      is_transient: true,
      action: 'retry_scheduled',
      retry_info: retryRes?.data || { message: 'Retry queued' }
    });

  } catch (error) {
    console.error('[automationFailureHandler] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});