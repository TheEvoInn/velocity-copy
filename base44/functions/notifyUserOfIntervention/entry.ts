import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * NOTIFY USER OF INTERVENTION
 * Create real-time notification when intervention created
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const {
      intervention_id,
      user_email,
      requirement_type,
      direct_link,
      priority
    } = await req.json();

    if (!intervention_id || !user_email) {
      return jsonResponse({ error: 'intervention_id, user_email required' }, 400);
    }

    // Create notification
    const notification = await base44.asServiceRole.entities.Notification.create({
      type: 'user_intervention_required',
      severity: priority > 80 ? 'urgent' : 'warning',
      title: `Action Required: ${requirement_type}`,
      message: `Your task needs input to proceed. ${direct_link ? 'Visit the external page if needed.' : 'Provide the required information.'}`,
      user_email,
      related_entity_type: 'UserIntervention',
      related_entity_id: intervention_id,
      action_type: 'user_input_required',
      is_read: false,
      delivery_channels: ['in_app']
    }).catch((err) => {
      console.error('[Notification Create]', err.message);
      return null;
    });

    return jsonResponse({
      notification_id: notification?.id || null,
      user_notified: !!notification,
      message: 'User notification created'
    });

  } catch (error) {
    console.error('[Notify User]', error.message);
    return jsonResponse({ error: error.message }, 500);
  }
});

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}