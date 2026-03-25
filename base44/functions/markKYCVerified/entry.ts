/**
 * MARK KYC VERIFIED
 * Admin function to mark a user's KYC as verified when they've completed it
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { user_email } = body;

    if (!user_email) {
      return Response.json({ error: 'user_email required' }, { status: 400 });
    }

    // Find KYC record
    const kycRecords = await base44.asServiceRole.entities.KYCVerification.filter(
      { created_by: user_email },
      '-created_date',
      1
    ).catch(() => []);

    if (!kycRecords.length) {
      return Response.json({ 
        success: false, 
        error: 'No KYC record found for this user' 
      }, { status: 404 });
    }

    const kyc = kycRecords[0];

    // Update to verified
    const updated = await base44.asServiceRole.entities.KYCVerification.update(kyc.id, {
      verification_status: 'verified',
      verified_at: new Date().toISOString()
    });

    // Now sync to identity
    const identities = await base44.asServiceRole.entities.AIIdentity.filter(
      { user_email, is_active: true },
      null,
      1
    ).catch(() => []);

    if (identities[0]) {
      const kycVerifiedData = {
        kyc_id: updated.id,
        synced_at: new Date().toISOString(),
        kyc_tier: 'enhanced',
        full_legal_name: updated.full_legal_name,
        date_of_birth: updated.date_of_birth,
        residential_address: updated.residential_address,
        city: updated.city,
        state: updated.state,
        postal_code: updated.postal_code,
        country: updated.country,
        phone_number: updated.phone_number,
        email: updated.email || user_email,
        government_id_type: updated.government_id_type,
        government_id_number: updated.government_id_number,
        government_id_expiry: updated.government_id_expiry,
        autopilot_clearance: {
          can_submit_w9: true,
          can_submit_1099_forms: true,
          can_submit_grant_applications: true,
          can_use_government_portals: true,
          can_submit_financial_onboarding: true,
          can_attach_id_documents: true
        }
      };

      await base44.asServiceRole.entities.AIIdentity.update(identities[0].id, {
        kyc_verified_data: kycVerifiedData,
        onboarding_complete: true
      });

      // Also mark UserGoals as onboarded
      const userGoals = await base44.asServiceRole.entities.UserGoals.filter(
        { created_by: user_email },
        null,
        1
      ).catch(() => []);

      if (userGoals[0]) {
        await base44.asServiceRole.entities.UserGoals.update(userGoals[0].id, {
          onboarded: true
        }).catch(() => null);
      }
    }

    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `✅ KYC marked verified for ${user_email} and synced to identity`,
      severity: 'success',
      metadata: { user_email }
    }).catch(() => null);

    return Response.json({
      success: true,
      user_email,
      kyc_status: 'verified',
      message: 'KYC verified and synced to identity'
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});