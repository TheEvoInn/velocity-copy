/**
 * identityOnboardingTrigger
 * Entity automation: fires on AIIdentity CREATE
 * Ensures every new identity is placed into pending onboarding state
 * and a notification is sent to guide the user.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { event, data } = body;

    // Only process create events
    if (event?.type !== 'create') {
      return Response.json({ ok: true, skipped: 'not a create event' });
    }

    const identity = data;
    if (!identity?.id) {
      return Response.json({ ok: true, skipped: 'no identity data' });
    }

    // Enforce onboarding state — ensure it's never skipped
    const needsUpdate = identity.onboarding_complete !== false || identity.onboarding_status !== 'pending';
    if (identity.onboarding_complete !== false) {
      await base44.asServiceRole.entities.AIIdentity.update(identity.id, {
        is_active: false,
        onboarding_complete: false,
        onboarding_status: 'pending',
      });
    }

    // Send notification to the identity creator
    const userEmail = identity.created_by;
    if (userEmail) {
      await base44.asServiceRole.entities.Notification.create({
        user_email: userEmail,
        title: `🤖 New Identity Created: ${identity.name}`,
        message: `Your identity "${identity.name}" has been created. Complete the 6-step onboarding to activate it for Autopilot and task execution. The identity is currently inactive until onboarding is finished.`,
        type: 'action_required',
        is_read: false,
        created_by: userEmail,
      });
    }

    // Log the event
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `Identity "${identity.name}" created by ${userEmail} — onboarding cycle initiated`,
      severity: 'info',
      metadata: { identity_id: identity.id, identity_name: identity.name, user_email: userEmail },
    }).catch(() => null);

    return Response.json({
      ok: true,
      identity_id: identity.id,
      onboarding_initiated: true,
      notification_sent: !!userEmail,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});