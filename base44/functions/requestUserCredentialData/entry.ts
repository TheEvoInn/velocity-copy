import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * REQUEST USER CREDENTIAL DATA
 * Creates a User Intervention to request the user re-provide their platform credentials/accounts
 * Guides them to fill in platform_accounts in UserGoals
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const { target_email = 'dawnvernor@yahoo.com' } = body;

    // Create User Intervention requesting credential data
    const intervention = await base44.asServiceRole.entities.UserIntervention.create({
      task_id: 'credential-sync-' + Date.now(), // Synthetic task ID for this data request
      requirement_type: 'missing_data',
      required_data: 'Platform account credentials (Upwork, Fiverr, eBay, Amazon, Etsy usernames/emails)',
      data_schema: {
        type: 'object',
        properties: {
          upwork: { type: 'string', description: 'Upwork email or username' },
          fiverr: { type: 'string', description: 'Fiverr email or username' },
          ebay: { type: 'string', description: 'eBay username' },
          amazon: { type: 'string', description: 'Amazon email or username' },
          etsy: { type: 'string', description: 'Etsy email or username' },
        },
        required: ['upwork', 'fiverr'],
      },
      priority: 95,
      status: 'pending',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      notes: 'User data sync: reconnect stored platform credentials to activate Autopilot',
    }).catch(e => {
      console.error('[REQUEST] Failed to create intervention:', e.message);
      return null;
    });

    // Create notification
    const notification = await base44.asServiceRole.entities.Notification.create({
      user_email: target_email,
      type: 'user_action_required',
      severity: 'urgent',
      title: 'Add Platform Credentials to Activate Autopilot',
      message: 'To activate autonomous execution, please provide your platform account information (Upwork, Fiverr, eBay, Amazon, Etsy).',
      related_entity_type: 'UserIntervention',
      related_entity_id: intervention?.id || null,
      action_type: 'user_input_required',
      delivery_channels: ['in_app'],
    }).catch(e => {
      console.error('[REQUEST] Failed to create notification:', e.message);
      return null;
    });

    // Log the request
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'user_action',
      message: `📋 Credential request created for ${target_email} - awaiting platform account information to complete account sync`,
      severity: 'warning',
      metadata: {
        intervention_id: intervention?.id,
        notification_id: notification?.id,
      },
    }).catch(() => null);

    return Response.json({
      success: true,
      message: 'User intervention created requesting credential data',
      intervention_id: intervention?.id,
      next_step: 'User should visit /VeloIdentityHub and provide platform account information',
    });
  } catch (error) {
    console.error('[requestUserCredentialData]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});