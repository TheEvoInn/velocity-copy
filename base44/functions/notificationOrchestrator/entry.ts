import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await req.json();

    if (action === 'create_notification') {
      const { type, severity, title, message, related_entity_type, related_entity_id, action_type, delivery_channels } = await req.json();

      const notification = await base44.entities.Notification.create({
        type: type || 'system_alert',
        severity: severity || 'info',
        title,
        message,
        related_entity_type,
        related_entity_id,
        action_type: action_type || 'none',
        delivery_channels: delivery_channels || ['in_app'],
        is_read: false,
        is_dismissed: false,
        user_email: user.email,
        created_date: new Date().toISOString()
      });

      // Route to notification delivery pipeline
      if (delivery_channels?.includes('email')) {
        await base44.functions.invoke('notificationOrchestrator', {
          action: 'send_email_notification',
          notification_id: notification.id,
          user_email: user.email
        });
      }

      return Response.json({ success: true, notification_id: notification.id });
    }

    if (action === 'get_user_notifications') {
      const { limit = 50, unread_only = false } = await req.json();

      let query = { user_email: user.email };
      if (unread_only) {
        query.is_read = false;
      }

      const notifications = await base44.entities.Notification.filter(query, '-created_date', limit);

      return Response.json({ 
        success: true, 
        notifications,
        unread_count: notifications.filter(n => !n.is_read).length
      });
    }

    if (action === 'mark_as_read') {
      const { notification_id } = await req.json();

      await base44.entities.Notification.update(notification_id, {
        is_read: true,
        read_at: new Date().toISOString()
      });

      return Response.json({ success: true });
    }

    if (action === 'dismiss_notification') {
      const { notification_id } = await req.json();

      await base44.entities.Notification.update(notification_id, {
        is_dismissed: true,
        dismissed_at: new Date().toISOString()
      });

      return Response.json({ success: true });
    }

    if (action === 'check_escalation') {
      const notifications = await base44.entities.Notification.filter({
        user_email: user.email,
        is_read: false,
        severity: { $in: ['critical', 'urgent'] }
      });

      const criticalCount = notifications.filter(n => n.severity === 'critical').length;
      const urgentCount = notifications.filter(n => n.severity === 'urgent').length;
      const oldestCritical = notifications.find(n => n.severity === 'critical');

      const escalation = {
        has_escalation: criticalCount > 0,
        critical_count: criticalCount,
        urgent_count: urgentCount,
        oldest_critical_age: oldestCritical ? 
          Math.floor((Date.now() - new Date(oldestCritical.created_date).getTime()) / 1000 / 60) : 0,
        should_escalate_to_admin: criticalCount > 3 || (oldestCritical && 
          Math.floor((Date.now() - new Date(oldestCritical.created_date).getTime()) / 1000 / 3600) > 24)
      };

      if (escalation.should_escalate_to_admin) {
        await base44.entities.Notification.create({
          type: 'compliance_alert',
          severity: 'critical',
          title: 'Escalation Required - Multiple Critical Alerts',
          message: `User ${user.email} has ${criticalCount} unresolved critical alerts`,
          is_read: false,
          user_email: 'admin@velocity.io',
          delivery_channels: ['in_app', 'email']
        });
      }

      return Response.json({ success: true, escalation });
    }

    if (action === 'send_email_notification') {
      const { notification_id, user_email } = await req.json();

      const notification = await base44.entities.Notification.filter({
        id: notification_id
      }).then(r => r[0]);

      if (!notification) {
        return Response.json({ error: 'Notification not found' }, { status: 404 });
      }

      const emailBody = `
Dear User,

${notification.title}

${notification.message}

Severity: ${notification.severity.toUpperCase()}

${notification.action_type !== 'none' ? `Action Required: ${notification.action_type}` : 'No action required.'}

Please log in to your account to view more details.

Best regards,
VELOCITY Platform
      `;

      await base44.integrations.Core.SendEmail({
        to: user_email,
        subject: `[${notification.severity.toUpperCase()}] ${notification.title}`,
        body: emailBody
      });

      await base44.entities.Notification.update(notification_id, {
        email_sent: true,
        email_sent_at: new Date().toISOString()
      });

      return Response.json({ success: true });
    }

    if (action === 'process_alert_queue') {
      // Process pending notifications and apply escalation rules
      const pendingNotifications = await base44.entities.Notification.filter({
        is_dismissed: false
      }, '-created_date');

      let escalated = 0;
      for (const notif of pendingNotifications) {
        // Auto-dismiss old info-level notifications
        if (notif.severity === 'info') {
          const ageHours = (Date.now() - new Date(notif.created_date).getTime()) / 1000 / 3600;
          if (ageHours > 72) {
            await base44.entities.Notification.update(notif.id, { is_dismissed: true });
            continue;
          }
        }

        // Auto-dismiss warning-level after 30 days
        if (notif.severity === 'warning') {
          const ageDays = (Date.now() - new Date(notif.created_date).getTime()) / 1000 / 86400;
          if (ageDays > 30) {
            await base44.entities.Notification.update(notif.id, { is_dismissed: true });
            continue;
          }
        }

        // Escalate critical alerts that are > 24h old
        if (notif.severity === 'critical' && !notif.is_read) {
          const ageHours = (Date.now() - new Date(notif.created_date).getTime()) / 1000 / 3600;
          if (ageHours > 24) {
            escalated++;
            // Send escalation email to user
            if (!notif.email_sent) {
              await base44.functions.invoke('notificationOrchestrator', {
                action: 'send_email_notification',
                notification_id: notif.id,
                user_email: notif.user_email
              });
            }
          }
        }
      }

      return Response.json({ 
        success: true, 
        processed: pendingNotifications.length,
        escalated 
      });
    }

    if (action === 'get_notification_preferences') {
      const prefs = await base44.entities.NotificationPreference.filter({
        user_email: user.email
      }).then(r => r[0]) || {
        user_email: user.email,
        email_enabled: true,
        in_app_enabled: true,
        critical_alerts: true,
        urgent_alerts: true,
        warning_alerts: false,
        info_alerts: false,
        daily_digest: true,
        quiet_hours_start: '22:00',
        quiet_hours_end: '08:00'
      };

      return Response.json({ success: true, preferences: prefs });
    }

    if (action === 'update_notification_preferences') {
      const { email_enabled, in_app_enabled, critical_alerts, urgent_alerts, warning_alerts, info_alerts, daily_digest, quiet_hours_start, quiet_hours_end } = await req.json();

      const prefs = await base44.entities.NotificationPreference.filter({
        user_email: user.email
      }).then(r => r[0]);

      if (prefs) {
        await base44.entities.NotificationPreference.update(prefs.id, {
          email_enabled,
          in_app_enabled,
          critical_alerts,
          urgent_alerts,
          warning_alerts,
          info_alerts,
          daily_digest,
          quiet_hours_start,
          quiet_hours_end
        });
      } else {
        await base44.entities.NotificationPreference.create({
          user_email: user.email,
          email_enabled,
          in_app_enabled,
          critical_alerts,
          urgent_alerts,
          warning_alerts,
          info_alerts,
          daily_digest,
          quiet_hours_start,
          quiet_hours_end
        });
      }

      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Notification orchestrator error:', error);
    return Response.json(
      { error: error.message || 'Notification operation failed' },
      { status: 500 }
    );
  }
});