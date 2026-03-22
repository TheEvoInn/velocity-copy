/**
 * Email Orchestration Engine
 * - Handles autonomous and user-initiated emails
 * - Integrates with notification center
 * - Manages email queues, templates, and tracking
 * - Supports both AI-generated and user-written content
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, mode = 'manual', data } = body;

    // ─── SEND EMAIL ──────────────────────────────────────────────────────
    if (action === 'send_email') {
      const { to, subject, body: content, template_id, auto_generated, campaign_id } = data;

      if (!to || !subject) {
        return Response.json({ error: 'Missing required fields: to, subject' }, { status: 400 });
      }

      try {
        // Send via Core integration
        await base44.integrations.Core.SendEmail({
          to,
          subject,
          body: content,
          from_name: user.full_name || 'Velocity System',
        });

        // Log email in system
        const emailLog = await base44.asServiceRole.entities.AIWorkLog.create({
          log_type: 'email_sent',
          subject,
          recipient: to,
          content_preview: content.substring(0, 300),
          full_content: content,
          status: 'sent',
          metadata: {
            mode,
            auto_generated: auto_generated || false,
            template_id,
            campaign_id,
            user_email: user.email,
            sent_at: new Date().toISOString(),
          },
        }).catch(() => null);

        // Create notification for user
        await base44.asServiceRole.entities.Notification.create({
          user_email: user.email,
          type: 'email_sent',
          title: `Email sent to ${to}`,
          message: subject,
          severity: 'info',
          metadata: { email_log_id: emailLog?.id, to, subject },
        }).catch(() => null);

        // Track in marketing if campaign
        if (campaign_id) {
          await base44.asServiceRole.entities.EmailCampaignLead.create({
            campaign_id,
            lead_email: to,
            email_sent_at: new Date().toISOString(),
            status: 'sent',
            email_subject: subject,
          }).catch(() => null);
        }

        return Response.json({
          success: true,
          message: `Email sent to ${to}`,
          email_id: emailLog?.id,
        });
      } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
    }

    // ─── QUEUE EMAIL FOR LATER ──────────────────────────────────────────
    if (action === 'queue_email') {
      const { to, subject, body: content, send_at, template_id, campaign_id } = data;

      if (!to || !subject || !send_at) {
        return Response.json({ error: 'Missing required fields: to, subject, send_at' }, { status: 400 });
      }

      try {
        const queued = await base44.asServiceRole.entities.EmailOutreachQueue.create({
          recipient_email: to,
          subject,
          content,
          scheduled_send_time: send_at,
          status: 'queued',
          source: mode === 'autonomous' ? 'autopilot' : 'manual',
          template_id,
          campaign_id,
          metadata: {
            user_email: user.email,
            auto_generated: mode === 'autonomous',
          },
        }).catch(() => null);

        return Response.json({
          success: true,
          message: `Email queued for ${send_at}`,
          queue_id: queued?.id,
        });
      } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
    }

    // ─── GENERATE EMAIL FROM TEMPLATE ───────────────────────────────────
    if (action === 'generate_from_template') {
      const { template_id, recipient_name, recipient_email, variables = {} } = data;

      if (!template_id) {
        return Response.json({ error: 'Missing template_id' }, { status: 400 });
      }

      try {
        const templates = await base44.asServiceRole.entities.EmailTemplate.filter(
          { id: template_id }, null, 1
        ).catch(() => []);

        const template = templates?.[0];
        if (!template) {
          return Response.json({ error: 'Template not found' }, { status: 404 });
        }

        // Replace variables in template
        let subject = template.subject || '';
        let body = template.body || '';

        Object.entries(variables).forEach(([key, value]) => {
          subject = subject.replace(`{{${key}}}`, value);
          body = body.replace(`{{${key}}}`, value);
        });

        // Replace default variables
        subject = subject.replace('{{recipient_name}}', recipient_name || 'There');
        body = body.replace('{{recipient_name}}', recipient_name || 'There');

        return Response.json({
          success: true,
          subject,
          body,
          recipient_email,
          template_id,
        });
      } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
    }

    // ─── GET EMAIL HISTORY ──────────────────────────────────────────────
    if (action === 'get_history') {
      const { limit = 20, offset = 0 } = data;

      try {
        const emails = await base44.asServiceRole.entities.AIWorkLog.filter(
          { log_type: 'email_sent' },
          '-created_date',
          limit,
        ).catch(() => []);

        return Response.json({
          success: true,
          emails: emails.map(e => ({
            id: e.id,
            to: e.recipient,
            subject: e.subject,
            sent_at: e.created_date,
            status: e.status,
            preview: e.content_preview,
          })),
          count: emails.length,
        });
      } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
    }

    // ─── AUTONOMOUS EMAIL CYCLE ─────────────────────────────────────────
    if (action === 'autonomous_email_cycle') {
      try {
        // Get queued emails for this user
        const queued = await base44.asServiceRole.entities.EmailOutreachQueue.filter(
          { status: 'queued', source: 'autopilot' },
          'scheduled_send_time',
          50,
        ).catch(() => []);

        const now = new Date();
        let sent = 0;
        const errors = [];

        for (const email of queued) {
          if (!email?.scheduled_send_time || new Date(email.scheduled_send_time) > now) {
            continue;
          }

          try {
            await base44.integrations.Core.SendEmail({
              to: email.recipient_email,
              subject: email.subject,
              body: email.content,
              from_name: 'Velocity Autopilot',
            });

            await base44.asServiceRole.entities.EmailOutreachQueue.update(email.id, {
              status: 'sent',
              sent_at: now.toISOString(),
            }).catch(() => null);

            sent++;
          } catch (e) {
            errors.push(`${email.recipient_email}: ${e.message}`);
            await base44.asServiceRole.entities.EmailOutreachQueue.update(email.id, {
              status: 'failed',
              error_message: e.message,
            }).catch(() => null);
          }
        }

        return Response.json({
          success: true,
          sent,
          total_processed: queued.length,
          errors,
        });
      } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
    }

    // ─── GET EMAIL TEMPLATES ────────────────────────────────────────────
    if (action === 'list_templates') {
      try {
        const templates = await base44.asServiceRole.entities.EmailTemplate.list(
          '-created_date', 50
        ).catch(() => []);

        return Response.json({
          success: true,
          templates: templates.map(t => ({
            id: t.id,
            name: t.name,
            subject: t.subject,
            category: t.category,
            created_date: t.created_date,
          })),
        });
      } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
    }

    // ─── CREATE EMAIL TEMPLATE ──────────────────────────────────────────
    if (action === 'create_template') {
      const { name, subject, body, category } = data;

      if (!name || !subject || !body) {
        return Response.json({ error: 'Missing required fields' }, { status: 400 });
      }

      try {
        const template = await base44.asServiceRole.entities.EmailTemplate.create({
          name,
          subject,
          body,
          category: category || 'general',
        }).catch(() => null);

        return Response.json({
          success: true,
          template_id: template?.id,
          message: 'Template created',
        });
      } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('[EmailOrchestrationEngine]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});