import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Monitor auto-execute rules and trigger notifications when rules fire
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, rule_id } = await req.json();

    // ── NOTIFY RULE TRIGGERED ───────────────────────────────────────────────
    if (action === 'notify_rule_triggered') {
      const { rule_name, opportunity_id, opportunity_title, execution_status } = await req.json();

      if (!rule_name) {
        return Response.json({ error: 'rule_name required' }, { status: 400 });
      }

      // Create notification
      const notif = await base44.asServiceRole.entities.Notification.create({
        type: 'autopilot_execution',
        severity: 'info',
        title: `Auto-Execute Rule Triggered: ${rule_name}`,
        message: `Rule "${rule_name}" has been triggered and is executing.${opportunity_title ? ` Processing opportunity: "${opportunity_title}"` : ''} Status: ${execution_status || 'pending'}`,
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
      }).catch(e => {
        console.error('Notification creation error:', e.message);
        return null;
      });

      // Log execution
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `⚡ Auto-execute rule triggered: ${rule_name}`,
        severity: 'info',
        metadata: {
          rule_id,
          opportunity_id,
          execution_status
        }
      }).catch(e => console.error('Activity log error:', e.message));

      return Response.json({
        success: true,
        notification: notif
      });
    }

    // ── NOTIFY RULE COMPLETION ──────────────────────────────────────────────
    if (action === 'notify_rule_completed') {
      const { rule_name, success, result_count, error_message } = await req.json();

      if (!rule_name) {
        return Response.json({ error: 'rule_name required' }, { status: 400 });
      }

      const notif = await base44.asServiceRole.entities.Notification.create({
        type: 'autopilot_execution',
        severity: success ? 'info' : 'warning',
        title: `Rule Execution ${success ? 'Complete' : 'Failed'}: ${rule_name}`,
        message: success
          ? `Rule "${rule_name}" successfully executed. Processed ${result_count || 0} item(s).`
          : `Rule "${rule_name}" encountered an error: ${error_message || 'Unknown error'}`,
        icon: success ? 'CheckCircle2' : 'AlertCircle',
        color: success ? 'emerald' : 'amber',
        related_entity_type: 'TaskOrchestrationRule',
        related_entity_id: rule_id,
        action_type: success ? 'none' : 'user_input_required',
        is_read: false,
        priority_index: success ? 50 : 85,
        source_module: 'autopilot'
      }).catch(e => {
        console.error('Notification creation error:', e.message);
        return null;
      });

      return Response.json({
        success: true,
        notification: notif
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Auto-execute rule monitor error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});