import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * ONBOARDING COMPLETION HANDLER
 * Triggered when AIIdentity.onboarding_complete = true
 * Syncs KYC data, marks onboarding done, initializes Autopilot readiness
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { identity_id } = await req.json();
    if (!identity_id) return Response.json({ error: 'identity_id required' }, { status: 400 });

    // Get the identity
    const identity = await base44.entities.AIIdentity.get(identity_id);
    if (!identity) return Response.json({ error: 'Identity not found' }, { status: 404 });
    if (!identity.onboarding_complete) {
      return Response.json({ error: 'Onboarding not marked complete' }, { status: 400 });
    }

    // Step 1: Mark UserGoals as onboarded
    const userGoals = await base44.asServiceRole.entities.UserGoals.filter(
      { created_by: user.email },
      undefined,
      1
    ).then(r => r[0]);

    if (userGoals) {
      await base44.asServiceRole.entities.UserGoals.update(userGoals.id, {
        onboarded: true
      });
    }

    // Step 2: Sync KYC data if available (from onboarding_config)
    if (identity.kyc_verified_data?.kyc_id) {
      const kycData = identity.kyc_verified_data;
      
      // Create KYCVerification record if not exists
      const existingKyc = await base44.asServiceRole.entities.KYCVerification.filter(
        { user_email: user.email },
        undefined,
        1
      ).then(r => r[0]).catch(() => null);

      if (!existingKyc) {
        await base44.asServiceRole.entities.KYCVerification.create({
          user_email: user.email,
          identity_id,
          kyc_tier: kycData.kyc_tier || 'basic',
          status: 'verified',
          full_legal_name: kycData.full_legal_name,
          date_of_birth: kycData.date_of_birth,
          country: kycData.country,
          verified_at: new Date().toISOString()
        }).catch(() => null);
      }
    }

    // Step 3: Mark identity as active and ready for Autopilot
    await base44.asServiceRole.entities.AIIdentity.update(identity_id, {
      is_active: true,
      onboarding_status: 'complete'
    });

    // Step 4: Initialize spending policies for identity
    const existingPolicy = await base44.asServiceRole.entities.SpendingPolicy.filter(
      { category: 'global', created_by: user.email },
      undefined,
      1
    ).then(r => r[0]).catch(() => null);

    if (!existingPolicy) {
      await base44.asServiceRole.entities.SpendingPolicy.create({
        category: 'global',
        max_per_task: 50,
        max_per_day: 200,
        auto_approve_threshold: 10,
        min_roi_pct: 20,
        enabled: true,
        max_chain_depth: 3,
        max_daily_transactions: 10
      }).catch(() => null);
    }

    // Step 5: Log activity
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `✅ Onboarding completed for identity "${identity.name}" - Autopilot enabled`,
      severity: 'success',
      metadata: { identity_id, user_email: user.email }
    }).catch(() => null);

    // Step 6: Notify user
    await base44.asServiceRole.entities.Notification.create({
      type: 'success',
      severity: 'info',
      title: '🎉 Onboarding Complete!',
      message: `Identity "${identity.name}" is now active and ready for Autopilot. You can start discovering opportunities!`,
      user_email: user.email,
      action_type: 'onboarding_complete',
      is_read: false
    }).catch(() => null);

    return Response.json({
      success: true,
      message: 'Onboarding completed successfully',
      identity_id,
      status: 'active',
      autopilot_ready: true
    });
  } catch (error) {
    console.error('[OnboardingCompletionHandler]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});