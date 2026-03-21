import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Setup Completion Trigger
 * Entity automation on UserGoals.update that detects when:
 * - KYC status changes to 'verified'
 * - Identity is selected (is_active = true)
 * - Autopilot toggle is turned ON
 * 
 * Then immediately calls autopilotActivationTrigger
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));

    // This is an entity automation payload
    const { event, data, old_data } = payload;

    if (event?.type !== 'update' || !data) {
      return Response.json({ success: true, message: 'Not a setup completion event' });
    }

    // Check if autopilot was just enabled
    const autopilotJustEnabled = !old_data?.autopilot_enabled && data.autopilot_enabled;

    if (!autopilotJustEnabled) {
      return Response.json({ success: true, message: 'Autopilot toggle not changed' });
    }

    // Get the user email from created_by
    const userEmail = data.created_by;

    // Verify KYC status
    const kycRecords = await base44.asServiceRole.entities.KYCVerification.filter({
      created_by: userEmail,
      status: 'verified'
    });

    if (kycRecords.length === 0) {
      return Response.json({
        success: true,
        message: 'KYC not yet verified, deferring activation'
      });
    }

    // Verify identity is active
    const identities = await base44.asServiceRole.entities.AIIdentity.filter({
      created_by: userEmail,
      is_active: true
    });

    if (identities.length === 0) {
      return Response.json({
        success: true,
        message: 'No active identity selected, deferring activation'
      });
    }

    const activeIdentity = identities[0];

    // ━━━━ ALL SETUP STEPS COMPLETE ━━━━
    // Trigger immediate autopilot activation
    try {
      const activationRes = await base44.asServiceRole.functions.invoke('autopilotActivationTrigger', {
        trigger_type: 'setup_completion',
        kyc_id: kycRecords[0].id,
        identity_id: activeIdentity.id,
        force_immediate: true
      });

      return Response.json({
        success: true,
        message: 'Autopilot activation triggered',
        activation_response: activationRes.data
      });
    } catch (error) {
      return Response.json({
        success: false,
        error: error.message,
        message: 'Failed to trigger autopilot activation'
      }, { status: 500 });
    }

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});