/**
 * AUTOPILOT NOTIFIER
 * Entity automation handler — triggered on WorkOpportunity updates.
 * Sends email summaries for:
 *   - High-value task completions (estimated_pay >= $25)
 *   - Critical errors requiring manual attention (status = 'rejected')
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const HIGH_VALUE_THRESHOLD = 25; // USD — only email for tasks worth this or more

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const { event, data, old_data } = body;

    // Only care about WorkOpportunity updates
    if (event?.entity_name !== 'WorkOpportunity' || event?.type !== 'update') {
      return Response.json({ skipped: true, reason: 'Not a WorkOpportunity update' });
    }

    const opp = data;
    if (!opp) return Response.json({ skipped: true, reason: 'No data' });

    const prevStatus = old_data?.status;
    const newStatus = opp.status;

    // Determine if we should send an email
    const isHighValueCompletion =
      newStatus === 'active' &&
      prevStatus !== 'active' &&
      (opp.estimated_pay || 0) >= HIGH_VALUE_THRESHOLD;

    const isCriticalError =
      newStatus === 'rejected' &&
      prevStatus !== 'rejected';

    if (!isHighValueCompletion && !isCriticalError) {
      return Response.json({ skipped: true, reason: 'No email trigger condition met' });
    }

    // Get the owner's email
    const userEmail = opp.user_email || opp.created_by;
    if (!userEmail) {
      return Response.json({ skipped: true, reason: 'No user email on opportunity' });
    }

    // Build email content
    let subject, body_html;

    if (isHighValueCompletion) {
      const netEarned = ((opp.estimated_pay || 0) * 0.85).toFixed(2);
      subject = `✅ Autopilot earned $${netEarned} — "${opp.title}"`;
      body_html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0f2a; color: #e2e8f0; padding: 32px; border-radius: 12px;">
          <div style="border-left: 4px solid #10b981; padding-left: 16px; margin-bottom: 24px;">
            <h2 style="color: #10b981; margin: 0 0 8px; font-size: 20px;">✅ High-Value Task Completed</h2>
            <p style="color: #94a3b8; margin: 0; font-size: 14px;">Your Autopilot has successfully executed a high-value task.</p>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; background: rgba(255,255,255,0.04); border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.08);">
              <td style="padding: 12px 16px; color: #64748b; font-size: 13px; width: 40%;">Task</td>
              <td style="padding: 12px 16px; color: #e2e8f0; font-size: 13px; font-weight: bold;">${opp.title}</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.08);">
              <td style="padding: 12px 16px; color: #64748b; font-size: 13px;">Platform</td>
              <td style="padding: 12px 16px; color: #e2e8f0; font-size: 13px;">${opp.platform || 'Unknown'}</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.08);">
              <td style="padding: 12px 16px; color: #64748b; font-size: 13px;">Category</td>
              <td style="padding: 12px 16px; color: #e2e8f0; font-size: 13px; text-transform: capitalize;">${(opp.category || '').replace(/_/g, ' ')}</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.08);">
              <td style="padding: 12px 16px; color: #64748b; font-size: 13px;">Gross Value</td>
              <td style="padding: 12px 16px; color: #f9d65c; font-size: 13px; font-weight: bold;">$${opp.estimated_pay?.toFixed(2) || '0.00'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; color: #64748b; font-size: 13px;">Net Earned (after 15% fee)</td>
              <td style="padding: 12px 16px; color: #10b981; font-size: 16px; font-weight: bold;">$${netEarned}</td>
            </tr>
          </table>

          <p style="color: #64748b; font-size: 12px; text-align: center; margin: 0;">
            Earnings have been added to your Velocity wallet. Log in to view your updated balance.
          </p>
        </div>
      `;
    } else {
      // Critical error
      subject = `⚠️ Manual Attention Required — "${opp.title}"`;
      body_html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0f2a; color: #e2e8f0; padding: 32px; border-radius: 12px;">
          <div style="border-left: 4px solid #ef4444; padding-left: 16px; margin-bottom: 24px;">
            <h2 style="color: #ef4444; margin: 0 0 8px; font-size: 20px;">⚠️ Task Requires Manual Attention</h2>
            <p style="color: #94a3b8; margin: 0; font-size: 14px;">Your Autopilot encountered an issue it could not resolve automatically.</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; background: rgba(255,255,255,0.04); border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.08);">
              <td style="padding: 12px 16px; color: #64748b; font-size: 13px; width: 40%;">Task</td>
              <td style="padding: 12px 16px; color: #e2e8f0; font-size: 13px; font-weight: bold;">${opp.title}</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.08);">
              <td style="padding: 12px 16px; color: #64748b; font-size: 13px;">Platform</td>
              <td style="padding: 12px 16px; color: #e2e8f0; font-size: 13px;">${opp.platform || 'Unknown'}</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.08);">
              <td style="padding: 12px 16px; color: #64748b; font-size: 13px;">Status</td>
              <td style="padding: 12px 16px; color: #ef4444; font-size: 13px; font-weight: bold;">Rejected / Failed</td>
            </tr>
            ${opp.url ? `
            <tr>
              <td style="padding: 12px 16px; color: #64748b; font-size: 13px;">Task URL</td>
              <td style="padding: 12px 16px; font-size: 13px;"><a href="${opp.url}" style="color: #00e8ff;">${opp.url}</a></td>
            </tr>` : ''}
          </table>

          <div style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25); border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <p style="color: #fca5a5; font-size: 13px; margin: 0;">
              <strong>Action Required:</strong> Please log into Velocity and review this task in the Discovery Engine. 
              You may need to manually complete or re-queue this task.
            </p>
          </div>

          <p style="color: #64748b; font-size: 12px; text-align: center; margin: 0;">
            Go to <strong>Discovery → Work Opportunities</strong> to review and re-queue this task.
          </p>
        </div>
      `;
    }

    // Send email via Base44 SendEmail integration
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: userEmail,
      subject,
      body: body_html,
      from_name: 'Velocity Autopilot',
    });

    // Log to ActivityLog
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: isHighValueCompletion ? 'system' : 'alert',
      message: isHighValueCompletion
        ? `📧 Email sent: High-value task completed — "${opp.title}" ($${(opp.estimated_pay * 0.85).toFixed(2)}) → ${userEmail}`
        : `📧 Email sent: Critical error notification for "${opp.title}" → ${userEmail}`,
      severity: isHighValueCompletion ? 'success' : 'critical',
      metadata: { opportunity_id: opp.id, user_email: userEmail, trigger: newStatus }
    }).catch(() => null);

    return Response.json({
      success: true,
      email_sent_to: userEmail,
      trigger: isHighValueCompletion ? 'high_value_completion' : 'critical_error',
    });

  } catch (error) {
    console.error('[AutopilotNotifier] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});