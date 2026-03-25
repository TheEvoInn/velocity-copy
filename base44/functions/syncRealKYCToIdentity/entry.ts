/**
 * SYNC REAL KYC TO IDENTITY
 * Pulls verified KYC records and syncs actual user data to AIIdentity.kyc_verified_data
 * NO fake data — only real records from KYCVerification entity
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch real KYC record for this user
    const kycRecords = await base44.asServiceRole.entities.KYCVerification.filter(
      { user_email: user.email, status: 'verified' },
      '-verified_at',
      1
    ).catch(() => []);

    if (!kycRecords.length) {
      return Response.json({
        success: false,
        error: 'No verified KYC record found',
        user_email: user.email
      }, { status: 404 });
    }

    const kycRecord = kycRecords[0];

    // Validate real data exists
    if (!kycRecord.full_legal_name || !kycRecord.date_of_birth || !kycRecord.residential_address) {
      return Response.json({
        success: false,
        error: 'KYC record incomplete — missing required legal information',
        missing: {
          full_legal_name: !kycRecord.full_legal_name,
          date_of_birth: !kycRecord.date_of_birth,
          residential_address: !kycRecord.residential_address
        }
      }, { status: 400 });
    }

    // Get user's active identity
    const identities = await base44.asServiceRole.entities.AIIdentity.filter(
      { user_email: user.email, is_active: true },
      null,
      1
    ).catch(() => []);

    if (!identities.length) {
      return Response.json({
        success: false,
        error: 'No active AI identity found for user'
      }, { status: 404 });
    }

    const identity = identities[0];

    // Sync real KYC data to identity
    const syncedKYC = {
      kyc_id: kycRecord.id,
      synced_at: new Date().toISOString(),
      kyc_tier: kycRecord.verification_type || 'standard',
      full_legal_name: kycRecord.full_legal_name,
      date_of_birth: kycRecord.date_of_birth,
      residential_address: kycRecord.residential_address,
      city: kycRecord.city,
      state: kycRecord.state,
      postal_code: kycRecord.postal_code,
      country: kycRecord.country,
      phone_number: kycRecord.phone_number,
      email: kycRecord.user_email,
      government_id_type: kycRecord.government_id_type,
      government_id_number: kycRecord.government_id_number,
      government_id_expiry: kycRecord.government_id_expiry,
      tax_id: kycRecord.tax_id,
      id_document_front_url: kycRecord.id_document_front_url,
      id_document_back_url: kycRecord.id_document_back_url,
      selfie_url: kycRecord.selfie_url,
      autopilot_clearance: {
        can_submit_w9: kycRecord.doc_approvals?.tax_id === true,
        can_submit_1099_forms: kycRecord.doc_approvals?.tax_id === true,
        can_submit_grant_applications: kycRecord.verification_type === 'enhanced',
        can_use_government_portals: kycRecord.doc_approvals?.id_front === true && kycRecord.doc_approvals?.id_back === true,
        can_attach_id_documents: kycRecord.doc_approvals?.id_front === true
      }
    };

    // Update identity with synced KYC
    await base44.asServiceRole.entities.AIIdentity.update(identity.id, {
      kyc_verified_data: syncedKYC,
      is_active: true
    });

    // Log the sync
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `✅ Real KYC data synced to identity "${identity.name}" for user ${user.email}`,
      severity: 'success',
      metadata: {
        identity_id: identity.id,
        kyc_id: kycRecord.id,
        full_name: syncedKYC.full_legal_name,
        kyc_tier: syncedKYC.kyc_tier
      }
    }).catch(() => null);

    return Response.json({
      success: true,
      user_email: user.email,
      identity_name: identity.name,
      kyc_synced: {
        full_legal_name: syncedKYC.full_legal_name,
        date_of_birth: syncedKYC.date_of_birth,
        city: syncedKYC.city,
        state: syncedKYC.state,
        country: syncedKYC.country,
        government_id_type: syncedKYC.government_id_type,
        kyc_tier: syncedKYC.kyc_tier
      }
    });

  } catch (error) {
    console.error('[syncRealKYCToIdentity]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});