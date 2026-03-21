import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { action, data } = payload;

    if (action === 'create_notification') {
      // Create a new notification
      const notification = await base44.asServiceRole.entities.Notification.create({
        created_by: user.email,
        type: data.type || 'system_alert',
        severity: data.severity || 'info',
        title: data.title,
        message: data.message,
        icon: data.icon,
        color: data.color,
        related_entity_type: data.related_entity_type,
        related_entity_id: data.related_entity_id,
        action_type: data.action_type || 'none',
        action_data: data.action_data,
        delivery_channels: data.delivery_channels || ['in_app'],
        source_module: data.source_module || 'system',
        priority_index: data.priority_index || 0
      });

      return Response.json({
        success: true,
        notification_id: notification.id
      });
    }

    if (action === 'autopilot_task_complete') {
      // Generate autopilot completion notification
      const notif = await base44.asServiceRole.entities.Notification.create({
        created_by: user.email,
        type: 'autopilot_execution',
        severity: 'info',
        title: 'Task Completed',
        message: `Autopilot completed: ${data.task_title || 'A task'}. Earned $${data.earnings || 0}`,
        icon: 'CheckCircle',
        color: 'green',
        related_entity_type: 'TaskExecutionQueue',
        related_entity_id: data.task_id,
        source_module: 'autopilot',
        delivery_channels: ['in_app'],
        priority_index: 1
      });

      return Response.json({ success: true, notification_id: notif.id });
    }

    if (action === 'compliance_alert') {
      // Generate compliance alert
      const notif = await base44.asServiceRole.entities.Notification.create({
        created_by: user.email,
        type: 'compliance_alert',
        severity: 'urgent',
        title: data.title || 'Compliance Action Required',
        message: data.message,
        icon: 'AlertCircle',
        color: 'red',
        action_type: data.action_type || 'review_required',
        source_module: 'compliance',
        delivery_channels: ['in_app', 'email'],
        priority_index: 5
      });

      return Response.json({ success: true, notification_id: notif.id });
    }

    if (action === 'opportunity_alert') {
      // Generate opportunity alert
      const notif = await base44.asServiceRole.entities.Notification.create({
        created_by: user.email,
        type: 'opportunity_alert',
        severity: data.severity || 'info',
        title: data.title || 'New Opportunity',
        message: data.message,
        icon: 'Sparkles',
        color: 'blue',
        related_entity_type: 'Opportunity',
        related_entity_id: data.opportunity_id,
        source_module: 'opportunity_engine',
        delivery_channels: ['in_app'],
        priority_index: 2
      });

      return Response.json({ success: true, notification_id: notif.id });
    }

    if (action === 'mission_ai_prompt') {
      // Generate mission AI prompt notification
      const notif = await base44.asServiceRole.entities.Notification.create({
        created_by: user.email,
        type: 'user_action_required',
        severity: 'urgent',
        title: 'Mission AI: Action Needed',
        message: data.message,
        icon: 'Zap',
        color: 'purple',
        action_type: 'mission_ai_prompt',
        action_data: {
          prompt: data.prompt,
          fields: data.fields
        },
        source_module: 'mission_ai',
        delivery_channels: ['in_app'],
        priority_index: 4
      });

      return Response.json({ success: true, notification_id: notif.id });
    }

    if (action === 'get_pending_notifications') {
      // Fetch pending notifications for user
      const notifs = await base44.asServiceRole.entities.Notification.filter({
        created_by: user.email,
        is_dismissed: false
      }, '-created_date', 50);

      return Response.json({
        notifications: notifs,
        unread_count: notifs.filter(n => !n.is_read).length,
        critical_count: notifs.filter(n => n.severity === 'critical').length
      });
    }

    return Response.json({
      error: 'Invalid action'
    }, { status: 400 });
  } catch (error) {
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
});