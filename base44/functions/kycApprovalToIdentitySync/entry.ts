import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * KYC APPROVAL TO IDENTITY SYNC
 * Triggered when KYCVerification.status becomes "verified"
 * Syncs verified KYC data to AIIdentity.kyc_verified_data
 * Sets autopilot_clearance flags based on KYC tier
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { kyc_id, identity_id } = await req.json();
    if (!kyc_id) return Response.json({ error: 'kyc_id required' }, { status: 400 });
    if (!identity_id) return Response.json({ error: 'identity_id required' }, { status: 400 });

    // Fetch KYC verification record
    const kycRecord = await base44.asServiceRole.entities.KYCVerification.get(kyc_id).catch(() => null);
    if (!kycRecord) return Response.json({ error: 'KYC record not found' }, { status: 404 });
    if (kycRecord.status !== 'verified') {
      return Response.json({ error: 'KYC not verified' }, { status: 400 });
    }

    // Fetch identity
    const identity = await base44.entities.AIIdentity.get(identity_id);
    if (!identity) return Response.json({ error: 'Identity not found' }, { status: 404 });

    // Build clearance flags based on KYC tier
    const clearanceMap = {
      'none': { can_submit_w9: false, can_submit_1099_forms: false, can_submit_grant_applications: false, can_use_government_portals: false, can_submit_financial_onboarding: false, can_attach_id_documents: false },
      'basic': { can_submit_w9: true, can_submit_1099_forms: true, can_submit_grant_applications: false, can_use_government_portals: false, can_submit_financial_onboarding: false, can_attach_id_documents: true },
      'standard': { can_submit_w9: true, can_submit_1099_forms: true, can_submit_grant_applications: true, can_use_government_portals: true, can_submit_financial_onboarding: true, can_attach_id_documents: true },
      'enhanced': { can_submit_w9: true, can_submit_1099_forms: true, can_submit_grant_applications: true, can_use_government_portals: true, can_submit_financial_onboarding: true, can_attach_id_documents: true }
    };

    const kyc_tier = kycRecord.kyc_tier || 'basic';
    const autopilot_clearance = clearanceMap[kyc_tier] || clearanceMap['basic'];

    // Update identity with KYC data
    const kycVerifiedData = {
      kyc_id,
      synced_at: new Date().toISOString(),
      kyc_tier,
      full_legal_name: kycRecord.full_legal_name,
      date_of_birth: kycRecord.date_of_birth,
      residential_address: kycRecord.residential_address,
      city: kycRecord.city,
      state: kycRecord.state,
      postal_code: kycRecord.postal_code,
      country: kycRecord.country,
      phone_number: kycRecord.phone_number,
      email: kycRecord.email,
      government_id_type: kycRecord.government_id_type,
      government_id_number: kycRecord.government_id_number,
      government_id_expiry: kycRecord.government_id_expiry,
      tax_id: kycRecord.tax_id,
      ssn_last4: kycRecord.ssn_last4,
      id_document_front_url: kycRecord.id_document_front_url,
      id_document_back_url: kycRecord.id_document_back_url,
      selfie_url: kycRecord.selfie_url,
      autopilot_clearance
    };

    await base44.asServiceRole.entities.AIIdentity.update(identity_id, {
      kyc_verified_data: kycVerifiedData
    });

    // Find any tasks waiting on KYC and resume them
    const waitingTasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
      { identity_id, status: 'needs_review', error_type: 'missing_kyc' },
      undefined,
      50
    ).catch(() => []);

    let tasksResumed = 0;
    for (const task of waitingTasks) {
      await base44.asServiceRole.entities.TaskExecutionQueue.update(task.id, {
        status: 'queued',
        notes: `${task.notes || ''} [KYC approval received - resuming]`,
        last_retry_at: new Date().toISOString()
      });
      tasksResumed++;
    }

    // Log activity
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `✅ KYC verification synced to identity "${identity.name}" (tier: ${kyc_tier}), resumed ${tasksResumed} tasks`,
      severity: 'success',
      metadata: { identity_id, kyc_id, kyc_tier, tasks_resumed: tasksResumed }
    }).catch(() => null);

    // Notify user
    await base44.asServiceRole.entities.Notification.create({
      type: 'success',
      severity: 'info',
      title: '✅ KYC Verified',
      message: `Your KYC verification (${kyc_tier} tier) has been synced to your identity. ${tasksResumed > 0 ? `${tasksResumed} waiting task(s) have been resumed.` : 'You can now use this identity for Autopilot execution.'}`,
      user_email: user.email,
      action_type: 'kyc_verified',
      is_read: false
    }).catch(() => null);

    return Response.json({
      success: true,
      message: 'KYC synced to identity successfully',
      identity_id,
      kyc_tier,
      clearance_level: kyc_tier,
      tasks_resumed: tasksResumed,
      autopilot_ready: true
    });
  } catch (error) {
    console.error('[KYCApprovalToIdentitySync]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});