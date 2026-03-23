import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * NOTIFICATION OPTIMIZER
 * Batched notification processing with preference caching
 * - Bulk query for preference checks
 * - Consolidated escalation logic
 * - Cached auto-dismiss rules
 */

const AUTO_DISMISS_RULES = {
  info: { after_hours: 72 },
  warning: { after_days: 30 },
  urgent: { after_days: 90 },
  critical: { never: true }
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action } = await req.json();

    if (action === 'batch_process_queue') {
      const allNotifications = await base44.entities.Notification.filter(
        { is_dismissed: false },
        '-created_date'
      );

      const preferences = await base44.entities.NotificationPreference.filter(
        {},
        null,
        1000
      ).then(prefs => {
        const map = {};
        prefs.forEach(p => map[p.user_email] = p);
        return map;
      });

      let processed = 0;
      let dismissed = 0;
      let escalated = 0;

      for (const notif of allNotifications) {
        processed++;
        const pref = preferences[notif.user_email] || {};
        const ageHours = (Date.now() - new Date(notif.created_date).getTime()) / (1000 * 3600);
        const ageDays = ageHours / 24;

        // Apply auto-dismiss rules
        if (notif.severity === 'info' && ageHours > 72) {
          await base44.entities.Notification.update(notif.id, { is_dismissed: true });
          dismissed++;
          continue;
        }

        if (notif.severity === 'warning' && ageDays > 30) {
          await base44.entities.Notification.update(notif.id, { is_dismissed: true });
          dismissed++;
          continue;
        }

        // Escalate critical if unread > 24h
        if (notif.severity === 'critical' && !notif.is_read && ageHours > 24 && !notif.email_sent) {
          await base44.functions.invoke('notificationOptimizer', {
            action: 'send_notification_email',
            notification_id: notif.id,
            user_email: notif.user_email
          });
          escalated++;
        }
      }

      return Response.json({
        success: true,
        processed,
        dismissed,
        escalated,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'send_notification_email') {
      const { notification_id, user_email } = await req.json();

      const notif = await base44.entities.Notification.filter({
        id: notification_id
      }).then(r => r[0]);

      if (!notif) {
        return Response.json({ error: 'Not found' }, { status: 404 });
      }

      const emailBody = `
[${notif.severity.toUpperCase()}] ${notif.title}

${notif.message}

Action: ${notif.action_type || 'No action required'}

---
VELOCITY Platform
      `.trim();

      await base44.integrations.Core.SendEmail({
        to: user_email,
        subject: `[${notif.severity.toUpperCase()}] ${notif.title}`,
        body: emailBody
      });

      await base44.entities.Notification.update(notification_id, {
        email_sent: true,
        email_sent_at: new Date().toISOString()
      });

      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Notification optimizer error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});