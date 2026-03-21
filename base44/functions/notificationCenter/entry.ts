import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Centralized notification hub for auto-execute rules, verification alerts, and errors
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, notification_type, related_entity_type, related_entity_id, title, message, severity, action_type, action_data, notification_id, filter_type, filter_severity, limit = 100 } = body;

    // ── CREATE NOTIFICATION ──────────────────────────────────────────────────
    if (action === 'create_notification') {
      if (!title || !message) {
        return Response.json({ error: 'title and message required' }, { status: 400 });
      }

      const notif = await base44.asServiceRole.entities.Notification.create({
        type: notification_type || 'user_action_required',
        severity: severity || 'info',
        title,
        message,
        icon: getIconForType(notification_type),
        color: getColorForSeverity(severity),
        related_entity_type,
        related_entity_id,
        action_type: action_type || 'none',
        action_data: action_data || {},
        is_read: false,
        is_dismissed: false,
        delivery_channels: ['in_app'],
        priority_index: getPriorityIndex(severity),
        source_module: identifySourceModule(notification_type),
        metadata: {}
      });

      // Trigger real-time delivery if subscribed
      await deliverNotificationRealtime(base44, user.email, notif);

      return Response.json({
        success: true,
        notification: notif
      });
    }

    // ── GET UNREAD NOTIFICATIONS ────────────────────────────────────────────
    if (action === 'get_unread') {
      const limit = 50;
      const unread = (await base44.asServiceRole.entities.Notification.filter(
        { is_read: false, is_dismissed: false },
        '-priority_index',
        limit
      ).catch(() => [])) || [];

      const safeUnread = Array.isArray(unread) ? unread : [];

      return Response.json({
        success: true,
        notifications: safeUnread,
        unread_count: safeUnread.length
      });
    }

    // ── GET ALL NOTIFICATIONS WITH FILTERS ──────────────────────────────────
    if (action === 'get_notifications') {
      let query = {};
      if (filter_type) query.type = filter_type;
      if (filter_severity) query.severity = filter_severity;

      const notifs = (await base44.asServiceRole.entities.Notification.filter(
        query,
        '-created_date',
        limit
      ).catch(() => [])) || [];

      const safeNotifs = Array.isArray(notifs) ? notifs : [];

      return Response.json({
        success: true,
        notifications: safeNotifs,
        total: safeNotifs.length
      });
    }

    // ── MARK AS READ ────────────────────────────────────────────────────────
    if (action === 'mark_read') {
      if (!notification_id) return Response.json({ error: 'notification_id required' }, { status: 400 });

      const updated = await base44.asServiceRole.entities.Notification.update(notification_id, {
        is_read: true,
        read_at: new Date().toISOString()
      }).catch(e => {
        console.error('Mark read error:', e.message);
        return null;
      });

      return Response.json({
        success: !!updated,
        notification: updated
      });
    }

    // ── DISMISS NOTIFICATION ────────────────────────────────────────────────
    if (action === 'dismiss') {
      if (!notification_id) return Response.json({ error: 'notification_id required' }, { status: 400 });

      const updated = await base44.asServiceRole.entities.Notification.update(notification_id, {
        is_dismissed: true,
        dismissed_at: new Date().toISOString()
      }).catch(e => {
        console.error('Dismiss error:', e.message);
        return null;
      });

      return Response.json({
        success: !!updated,
        notification: updated
      });
    }

    // ── RULE TRIGGERED NOTIFICATION ─────────────────────────────────────────
    if (action === 'rule_triggered') {
      const { rule_id, rule_name, opportunity_id, opportunity_title, execution_status } = await req.json().catch(() => ({}));

      if (!rule_id || !rule_name) {
        return Response.json({ error: 'rule_id and rule_name required' }, { status: 400 });
      }

      const notif = await base44.asServiceRole.entities.Notification.create({
        type: 'autopilot_execution',
        severity: 'info',
        title: `Auto-Execute Rule Triggered: ${rule_name}`,
        message: `Rule "${rule_name}" has been triggered and is executing. Status: ${execution_status || 'pending'}${opportunity_title ? ` for "${opportunity_title}"` : ''}`,
        icon: 'Zap',
        color: 'cyan',
        related_entity_type: 'TaskOrchestrationRule',
        related_entity_id: rule_id,
        action_type: 'review_required',
        action_data: {
          rule_id,
          opportunity_id,
          execution_status
        },
        is_read: false,
        delivery_channels: ['in_app'],
        priority_index: 75,
        source_module: 'autopilot'
      });

      return Response.json({
        success: true,
        notification: notif
      });
    }

    // ── VERIFICATION REQUIRED NOTIFICATION ──────────────────────────────────
    if (action === 'verification_required') {
      const { account_id, platform, verification_type, required_steps } = await req.json().catch(() => ({}));

      if (!account_id || !platform) {
        return Response.json({ error: 'account_id and platform required' }, { status: 400 });
      }

      const notif = await base44.asServiceRole.entities.Notification.create({
        type: 'user_action_required',
        severity: 'warning',
        title: `Verification Required: ${platform}`,
        message: `Your ${platform} account requires manual verification. ${required_steps?.length || 0} step(s) need attention.`,
        icon: 'AlertCircle',
        color: 'amber',
        related_entity_type: 'LinkedAccountCreation',
        related_entity_id: account_id,
        action_type: 'user_input_required',
        action_data: {
          account_id,
          platform,
          verification_type,
          required_steps: required_steps || []
        },
        is_read: false,
        delivery_channels: ['in_app', 'email'],
        priority_index: 85,
        source_module: 'account_creation'
      });

      return Response.json({
        success: true,
        notification: notif
      });
    }

    // ── ONBOARDING ERROR NOTIFICATION ───────────────────────────────────────
    if (action === 'onboarding_error') {
      const { account_id, platform, step_id, error_message, error_type, recovery_action } = await req.json().catch(() => ({}));

      if (!account_id || !platform || !error_message) {
        return Response.json({ error: 'account_id, platform, and error_message required' }, { status: 400 });
      }

      const notif = await base44.asServiceRole.entities.Notification.create({
        type: 'compliance_alert',
        severity: 'urgent',
        title: `Onboarding Error: ${platform}`,
        message: `Critical error during ${platform} onboarding at step "${step_id}": ${error_message}`,
        icon: 'AlertTriangle',
        color: 'red',
        related_entity_type: 'LinkedAccountCreation',
        related_entity_id: account_id,
        action_type: 'user_input_required',
        action_data: {
          account_id,
          platform,
          step_id,
          error_type,
          recovery_action
        },
        is_read: false,
        delivery_channels: ['in_app', 'email'],
        priority_index: 100,
        source_module: 'account_creation'
      });

      return Response.json({
        success: true,
        notification: notif
      });
    }

    // ── BULK DISMISS ────────────────────────────────────────────────────────
    if (action === 'dismiss_all_by_type') {
      const { notification_type } = await req.json().catch(() => ({}));
      if (!notification_type) return Response.json({ error: 'notification_type required' }, { status: 400 });

      const notifs = (await base44.asServiceRole.entities.Notification.filter(
        { type: notification_type, is_dismissed: false },
        '-created_date',
        1000
      ).catch(() => [])) || [];

      const safeNotifs = Array.isArray(notifs) ? notifs : [];
      let dismissed = 0;

      for (const n of safeNotifs) {
        try {
          await base44.asServiceRole.entities.Notification.update(n.id, {
            is_dismissed: true,
            dismissed_at: new Date().toISOString()
          }).catch(() => {});
          dismissed++;
        } catch (e) {
          console.error('Batch dismiss error:', e.message);
        }
      }

      return Response.json({
        success: true,
        dismissed_count: dismissed
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Notification center error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Helper functions
function getIconForType(type) {
  const icons = {
    autopilot_execution: 'Zap',
    user_action_required: 'AlertCircle',
    compliance_alert: 'AlertTriangle',
    system_alert: 'AlertOctagon',
    opportunity_alert: 'Target',
    integration_alert: 'Plug'
  };
  return icons[type] || 'Bell';
}

function getColorForSeverity(severity) {
  const colors = {
    info: 'blue',
    warning: 'amber',
    urgent: 'orange',
    critical: 'red'
  };
  return colors[severity] || 'blue';
}

function getPriorityIndex(severity) {
  const priorities = {
    info: 25,
    warning: 50,
    urgent: 75,
    critical: 100
  };
  return priorities[severity] || 25;
}

function identifySourceModule(type) {
  if (type === 'autopilot_execution') return 'autopilot';
  if (type === 'compliance_alert') return 'compliance';
  if (type === 'system_alert') return 'system';
  if (type === 'opportunity_alert') return 'opportunity_engine';
  if (type === 'integration_alert') return 'integration';
  return 'manual';
}

async function deliverNotificationRealtime(base44, userEmail, notification) {
  // Placeholder for real-time delivery (WebSocket/SSE)
  // In a production system, this would publish to a real-time channel
  try {
    // Log for audit
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `🔔 Notification: ${notification.title}`,
      severity: notification.severity,
      metadata: {
        notification_id: notification.id,
        type: notification.type,
        user_email: userEmail
      }
    }).catch(e => console.error('Activity log error:', e.message));
  } catch (e) {
    console.error('Real-time delivery error:', e.message);
  }
}