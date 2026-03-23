import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Notification Subscription Manager
 * Manages real-time notification subscriptions and routing
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, notification_type, delivery_channels, enabled } = await req.json();

    if (action === 'get_subscriptions') {
      return await getSubscriptions(base44, user);
    }

    if (action === 'set_subscription') {
      return await setSubscription(base44, user, notification_type, delivery_channels, enabled);
    }

    if (action === 'get_notification_preferences') {
      return await getNotificationPreferences(base44, user);
    }

    if (action === 'update_preferences') {
      return await updatePreferences(base44, user, await req.json());
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Subscription manager error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function getSubscriptions(base44, user) {
  try {
    const prefs = await base44.auth.me();
    const subscriptions = prefs?.notification_subscriptions || {};

    const defaultSubscriptions = {
      compliance_alert: { in_app: true, email: true, push: false },
      autopilot_execution: { in_app: true, email: false, push: false },
      system_alert: { in_app: true, email: false, push: false },
      opportunity_alert: { in_app: true, email: true, push: false },
      integration_alert: { in_app: true, email: true, push: false },
      user_action_required: { in_app: true, email: true, push: false }
    };

    return Response.json({
      success: true,
      subscriptions: { ...defaultSubscriptions, ...subscriptions }
    });
  } catch (error) {
    return Response.json(
      { error: `Failed to get subscriptions: ${error.message}` },
      { status: 500 }
    );
  }
}

async function setSubscription(base44, user, notificationType, deliveryChannels, enabled) {
  try {
    const currentPrefs = await base44.auth.me();
    const subscriptions = currentPrefs?.notification_subscriptions || {};

    subscriptions[notificationType] = {
      in_app: enabled && deliveryChannels.includes('in_app'),
      email: enabled && deliveryChannels.includes('email'),
      push: enabled && deliveryChannels.includes('push')
    };

    await base44.auth.updateMe({
      notification_subscriptions: subscriptions
    });

    return Response.json({
      success: true,
      message: `Subscription updated for ${notificationType}`,
      subscription: subscriptions[notificationType]
    });
  } catch (error) {
    return Response.json(
      { error: `Failed to update subscription: ${error.message}` },
      { status: 500 }
    );
  }
}

async function getNotificationPreferences(base44, user) {
  try {
    const prefs = await base44.auth.me();

    return Response.json({
      success: true,
      preferences: {
        quiet_hours_enabled: prefs?.notification_quiet_hours_enabled || false,
        quiet_hours_start: prefs?.notification_quiet_hours_start || '22:00',
        quiet_hours_end: prefs?.notification_quiet_hours_end || '08:00',
        batch_digest: prefs?.notification_batch_digest || false,
        digest_frequency: prefs?.notification_digest_frequency || 'daily',
        notification_subscriptions: prefs?.notification_subscriptions || {}
      }
    });
  } catch (error) {
    return Response.json(
      { error: `Failed to get preferences: ${error.message}` },
      { status: 500 }
    );
  }
}

async function updatePreferences(base44, user, preferences) {
  try {
    await base44.auth.updateMe({
      notification_quiet_hours_enabled: preferences.quiet_hours_enabled,
      notification_quiet_hours_start: preferences.quiet_hours_start,
      notification_quiet_hours_end: preferences.quiet_hours_end,
      notification_batch_digest: preferences.batch_digest,
      notification_digest_frequency: preferences.digest_frequency,
      notification_subscriptions: preferences.notification_subscriptions
    });

    return Response.json({
      success: true,
      message: 'Preferences updated successfully'
    });
  } catch (error) {
    return Response.json(
      { error: `Failed to update preferences: ${error.message}` },
      { status: 500 }
    );
  }
}