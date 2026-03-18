import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Called before every Autopilot execution to load user's persistent preferences
 * Ensures Autopilot always operates with the user's saved settings, not defaults
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user's persistent data store
    const stores = await base44.entities.UserDataStore.filter(
      { user_email: user.email },
      '-created_date',
      1
    );

    if (!stores || !stores[0]) {
      // No persistent data - create a default one
      const defaultStore = await base44.entities.UserDataStore.create({
        user_email: user.email,
        autopilot_preferences: {
          enabled: false,
          mode: 'continuous',
          execution_mode: 'review_required',
          max_concurrent_tasks: 3,
          retry_preferences: {
            auto_retry_enabled: true,
            max_retries: 5,
          },
        },
        ui_preferences: {
          theme: 'dark',
          sidebar_collapsed: false,
          notification_sound: true,
        },
        identity_preferences: {
          auto_switch_identities: false,
          identity_routing_enabled: true,
        },
        security_preferences: {
          two_factor_enabled: true,
          session_timeout_minutes: 60,
        },
        wallet_preferences: {
          payout_frequency: 'weekly',
          currency_preference: 'USD',
        },
        execution_rules: {
          skip_opportunities_with_captcha: true,
          minimum_success_probability: 60,
          minimum_profit_threshold: 10,
        },
      });

      return Response.json({
        status: 'created',
        preferences: defaultStore,
      });
    }

    const store = stores[0];

    // Log that Autopilot accessed the persistent data
    await base44.entities.UserDataAuditLog.create({
      user_email: user.email,
      event_type: 'system_access',
      entity_type: 'UserDataStore',
      entity_id: store.id,
      modification_source: 'autopilot',
      timestamp: new Date().toISOString(),
      change_description: 'Autopilot loaded persistent configuration',
    });

    return Response.json({
      status: 'loaded',
      preferences: {
        autopilot: store.autopilot_preferences,
        identity: store.identity_preferences,
        execution: store.execution_rules,
        security: store.security_preferences,
        wallet: store.wallet_preferences,
      },
      timestamp: store.last_modified_at,
    });
  } catch (error) {
    console.error('Autopilot persistence sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});