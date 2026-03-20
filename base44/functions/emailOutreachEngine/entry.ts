import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, opportunity_id, template_id, recipient_email, draft_params } = await req.json();

    if (action === 'draft_email') {
      // Generate personalized email draft using LLM
      const opportunity = await base44.entities.Opportunity.filter({ id: opportunity_id });
      if (!opportunity || opportunity.length === 0) {
        return Response.json({ error: 'Opportunity not found' }, { status: 404 });
      }

      const opp = opportunity[0];
      const identity = await base44.entities.AIIdentity.filter({ id: opp.identity_id });
      const identityData = identity?.[0] || {};

      // Use AI to generate personalized email
      const emailPrompt = `
You are ${identityData.name || 'a professional outreach specialist'}. Generate a personalized follow-up email for:

Opportunity: ${opp.title}
Platform: ${opp.platform}
Profit Estimate: $${opp.profit_estimate_high}
Description: ${opp.description}

Email Template Style: ${draft_params?.style || 'professional and concise'}
Tone: ${identityData.communication_tone || 'professional'}

Create a compelling, personalized follow-up email that:
1. References specific details from the opportunity
2. Highlights your relevant skills/experience
3. Includes a clear call-to-action
4. Stays under 250 words
5. Maintains a ${identityData.communication_tone || 'professional'} tone

Format as JSON:
{
  "subject": "email subject",
  "body": "email body text"
}
      `.trim();

      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt: emailPrompt,
        response_json_schema: {
          type: 'object',
          properties: {
            subject: { type: 'string' },
            body: { type: 'string' }
          }
        }
      });

      return Response.json({
        success: true,
        draft: aiResponse,
        opportunity_id: opp.id,
        identity_id: opp.identity_id,
        platform: opp.platform
      });
    }

    if (action === 'queue_for_review') {
      // Add email to review queue
      const queueEntry = await base44.entities.EmailOutreachQueue.create({
        opportunity_id: opportunity_id,
        recipient_email: recipient_email,
        subject: draft_params.subject,
        body: draft_params.body,
        status: 'pending_review',
        created_by: user.email,
        template_id: template_id,
        scheduled_send_time: draft_params.scheduled_send_time || new Date(Date.now() + 3600000).toISOString()
      });

      return Response.json({
        success: true,
        queue_id: queueEntry.id,
        message: 'Email queued for review'
      });
    }

    if (action === 'approve_and_send') {
      // Approve and send email
      const queueEntry = await base44.entities.EmailOutreachQueue.filter({ id: draft_params.queue_id });
      if (!queueEntry || queueEntry.length === 0) {
        return Response.json({ error: 'Queue entry not found' }, { status: 404 });
      }

      const entry = queueEntry[0];

      // Send email using Core integration
      const emailResult = await base44.integrations.Core.SendEmail({
        to: entry.recipient_email,
        subject: entry.subject,
        body: entry.body,
        from_name: draft_params.from_name || 'Profit Engine'
      });

      // Update queue entry
      await base44.entities.EmailOutreachQueue.update(entry.id, {
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_by: user.email
      });

      // Create activity log
      await base44.entities.ActivityLog.create({
        user_email: user.email,
        action: 'email_sent',
        entity_type: 'EmailOutreach',
        entity_id: entry.id,
        status: 'completed',
        details: `Email sent to ${entry.recipient_email}`,
        metadata: {
          recipient: entry.recipient_email,
          opportunity_id: entry.opportunity_id,
          subject: entry.subject
        }
      });

      return Response.json({
        success: true,
        message: 'Email sent successfully',
        queue_id: entry.id
      });
    }

    if (action === 'reject_email') {
      // Reject email in queue
      await base44.entities.EmailOutreachQueue.update(draft_params.queue_id, {
        status: 'rejected',
        rejection_reason: draft_params.reason,
        rejected_at: new Date().toISOString(),
        rejected_by: user.email
      });

      return Response.json({
        success: true,
        message: 'Email rejected'
      });
    }

    if (action === 'get_pending_emails') {
      // Get emails waiting for review
      const pending = await base44.entities.EmailOutreachQueue.filter({
        status: 'pending_review'
      });

      return Response.json({
        success: true,
        pending_count: pending.length,
        emails: pending.slice(0, 20)
      });
    }

    if (action === 'get_email_stats') {
      // Get email statistics
      const allEmails = await base44.entities.EmailOutreachQueue.list('-created_date', 100);
      
      const stats = {
        total: allEmails.length,
        sent: allEmails.filter(e => e.status === 'sent').length,
        pending: allEmails.filter(e => e.status === 'pending_review').length,
        rejected: allEmails.filter(e => e.status === 'rejected').length,
        scheduled: allEmails.filter(e => e.status === 'scheduled').length
      };

      return Response.json({
        success: true,
        stats
      });
    }

    if (action === 'send_scheduled_emails') {
      // Autopilot: Send emails that are scheduled and approved
      const now = new Date().toISOString();
      const scheduled = await base44.entities.EmailOutreachQueue.filter({
        status: 'approved'
      });

      const toSend = scheduled.filter(e => e.scheduled_send_time <= now);
      
      let sentCount = 0;
      for (const email of toSend) {
        await base44.integrations.Core.SendEmail({
          to: email.recipient_email,
          subject: email.subject,
          body: email.body,
          from_name: 'Profit Engine Autopilot'
        });

        await base44.entities.EmailOutreachQueue.update(email.id, {
          status: 'sent',
          sent_at: now,
          sent_by: 'autopilot'
        });

        sentCount++;
      }

      // Log autopilot action
      if (sentCount > 0) {
        await base44.entities.ActivityLog.create({
          user_email: 'system@autopilot',
          action: 'batch_email_send',
          entity_type: 'EmailOutreach',
          entity_id: 'batch',
          status: 'completed',
          details: `Autopilot sent ${sentCount} scheduled emails`,
          metadata: { sent_count: sentCount }
        });
      }

      return Response.json({
        success: true,
        sent_count: sentCount,
        message: `Autopilot sent ${sentCount} scheduled emails`
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});