/**
 * Email Autopilot Cycle — Scheduled autonomous email delivery
 * - Runs every 15 minutes
 * - Sends queued emails when scheduled time arrives
 * - Updates campaign metrics
 * - Sends notifications on completion
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Run autonomous email cycle
    const result = await base44.asServiceRole.functions.invoke('emailOrchestrationEngine', {
      action: 'autonomous_email_cycle',
      data: {},
    });

    if (result.data?.success) {
      // Log activity
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `📧 Email Autopilot: ${result.data.sent} emails sent · ${result.data.errors.length} errors`,
        severity: result.data.errors.length > 0 ? 'warning' : 'success',
        metadata: result.data,
      }).catch(() => null);

      return Response.json({
        success: true,
        emails_sent: result.data.sent,
        errors: result.data.errors,
      });
    } else {
      throw new Error(result.data?.error || 'Email cycle failed');
    }
  } catch (error) {
    console.error('[EmailAutopilotCycle]', error.message);

    // Log error
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'alert',
      message: `⚠️ Email Autopilot Error: ${error.message}`,
      severity: 'warning',
    }).catch(() => null);

    return Response.json({ error: error.message }, { status: 500 });
  }
});