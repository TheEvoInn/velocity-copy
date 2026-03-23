import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * CREATE USER INTERVENTION
 * Triggered by smartErrorAnalyzer when Autopilot is blocked
 * Creates structured intervention request + notification
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const {
      task_id,
      requirement_type,
      data_schema,
      template_responses,
      direct_link,
      priority = 75
    } = await req.json();

    if (!task_id || !requirement_type) {
      return jsonResponse({ error: 'task_id, requirement_type required' }, 400);
    }

    // Create intervention
    const intervention = await base44.asServiceRole.entities.UserIntervention.create({
      task_id,
      requirement_type,
      required_data: `${requirement_type} is required to proceed`,
      data_schema,
      template_responses,
      direct_link,
      status: 'pending',
      priority,
      expires_at: new Date(Date.now() + 86400000).toISOString() // 24h default
    }).catch((err) => {
      console.error('[Intervention Create]', err.message);
      return null;
    });

    if (!intervention) {
      return jsonResponse({ error: 'Failed to create intervention' }, 500);
    }

    // Create notification
    await base44.functions.invoke('notifyUserOfIntervention', {
      intervention_id: intervention.id,
      user_email: user.email,
      requirement_type,
      direct_link,
      priority
    }).catch(() => {});

    return jsonResponse({
      intervention_id: intervention.id,
      status: 'pending',
      message: 'User intervention required. Notification sent.',
      expires_at: intervention.expires_at
    });

  } catch (error) {
    console.error('[UserIntervention Create]', error.message);
    return jsonResponse({ error: error.message }, 500);
  }
});

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}