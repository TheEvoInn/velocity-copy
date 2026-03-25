/**
 * SYNC KYC TO IDENTITY
 * Links verified KYC data to AI identity and marks it operational
 * Called after KYC verification or when identity needs activation
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { user_email, identity_id } = body;

    if (!user_email) {
      return Response.json({ error: 'user_email required' }, { status: 400 });
    }

    const result = await syncKYCToIdentity(base44, user_email, identity_id);
    return Response.json(result);

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function syncKYCToIdentity(base44, userEmail, identityId) {
  // Fetch verified KYC
  const kycRecords = await base44.asServiceRole.entities.KYCVerification.filter(
    { created_by: userEmail },
    '-created_date',
    1
  ).catch(() => []);

  if (!kycRecords.length || kycRecords[0].verification_status !== 'verified') {
    return {
      success: false,
      error: 'No verified KYC found for this user',
      user_email: userEmail
    };
  }

  const kyc = kycRecords[0];

  // Get identity (use provided ID or find active)
  let identity = null;
  if (identityId) {
    const ids = await base44.asServiceRole.entities.AIIdentity.filter(
      { id: identityId },
      null,
      1
    ).catch(() => []);
    identity = ids[0];
  } else {
    const ids = await base44.asServiceRole.entities.AIIdentity.filter(
      { user_email: userEmail, is_active: true },
      null,
      1
    ).catch(() => []);
    identity = ids[0];
  }

  if (!identity) {
    return {
      success: false,
      error: 'No active AI identity found',
      user_email: userEmail
    };
  }

  // Build KYC verified data object
  const kycVerifiedData = {
    kyc_id: kyc.id,
    synced_at: new Date().toISOString(),
    kyc_tier: kyc.verification_status === 'verified' ? 'enhanced' : 'basic',
    full_legal_name: kyc.full_legal_name,
    date_of_birth: kyc.date_of_birth,
    residential_address: kyc.residential_address,
    city: kyc.city,
    state: kyc.state,
    postal_code: kyc.postal_code,
    country: kyc.country,
    phone_number: kyc.phone_number,
    email: kyc.email || userEmail,
    government_id_type: kyc.government_id_type,
    government_id_number: kyc.government_id_number,
    government_id_expiry: kyc.government_id_expiry,
    tax_id: kyc.tax_id,
    ssn_last4: kyc.ssn_last4,
    id_document_front_url: kyc.id_document_front_url,
    id_document_back_url: kyc.id_document_back_url,
    selfie_url: kyc.selfie_url,
    face_match_score: kyc.face_match_score,
    autopilot_clearance: {
      can_submit_w9: true,
      can_submit_1099_forms: true,
      can_submit_grant_applications: true,
      can_use_government_portals: true,
      can_submit_financial_onboarding: true,
      can_attach_id_documents: true
    }
  };

  // Update identity with KYC data
  const updateData = {
    kyc_verified_data: kycVerifiedData,
    onboarding_complete: true,
    is_active: true
  };

  const updatedIdentity = await base44.asServiceRole.entities.AIIdentity.update(
    identity.id,
    updateData
  );

  // Log the sync
  await base44.asServiceRole.entities.ActivityLog.create({
    action_type: 'system',
    message: `✅ KYC synced to identity "${identity.name}" for ${userEmail}. Account operational for autopilot.`,
    severity: 'success',
    metadata: {
      user_email: userEmail,
      identity_id: identity.id,
      kyc_id: kyc.id,
      kyc_tier: kycVerifiedData.kyc_tier
    }
  }).catch(() => null);

  // Update UserGoals to confirm readiness
  const userGoals = await base44.asServiceRole.entities.UserGoals.filter(
    { created_by: userEmail },
    null,
    1
  ).catch(() => []);

  if (userGoals[0]) {
    await base44.asServiceRole.entities.UserGoals.update(userGoals[0].id, {
      onboarded: true
    }).catch(() => null);
  }

  return {
    success: true,
    identity: {
      id: updatedIdentity.id,
      name: updatedIdentity.name,
      onboarding_complete: updatedIdentity.onboarding_complete,
      is_active: updatedIdentity.is_active,
      kyc_tier: kycVerifiedData.kyc_tier
    },
    kyc_synced: {
      legal_name: kycVerifiedData.full_legal_name,
      country: kycVerifiedData.country,
      government_id: kycVerifiedData.government_id_type,
      email: kycVerifiedData.email
    },
    user_email: userEmail,
    message: `Identity "${updatedIdentity.name}" is now fully operational for autopilot.`
  };
}