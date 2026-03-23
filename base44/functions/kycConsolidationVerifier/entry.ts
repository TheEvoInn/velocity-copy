import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * KYC Consolidation Verifier
 * Verifies consolidation by cross-referencing KYC with goals/identities
 * Updates UserGoals to reflect KYC approval status
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, target_email } = await req.json();

    if (action === 'verify_consolidation') {
      return await verifyConsolidation(base44, user, target_email);
    }

    if (action === 'activate_for_kyc') {
      return await activateForKYC(base44, user, target_email);
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function verifyConsolidation(base44, requestingUser, targetEmail) {
  const verification = {
    target_email: targetEmail,
    timestamp: new Date().toISOString(),
    consolidation_status: 'pending',
    checks: [],
    summary: {}
  };

  try {
    // Check 1: KYC Record Status
    const kycRecords = await base44.asServiceRole.entities.KYCVerification.filter(
      { user_email: targetEmail },
      '-created_date',
      1
    ).catch(() => []);

    if (kycRecords.length === 0) {
      verification.checks.push('❌ No KYC record found');
      verification.consolidation_status = 'no_kyc';
      return Response.json({ success: false, verification });
    }

    const primaryKYC = kycRecords[0];
    verification.summary.kyc_id = primaryKYC.id;
    verification.summary.kyc_status = primaryKYC.status;
    verification.summary.kyc_verified = primaryKYC.status === 'verified' || primaryKYC.status === 'approved';
    
    verification.checks.push(`✓ KYC found - Status: ${primaryKYC.status}`);

    // Check 2: UserGoals alignment
    const goals = await base44.asServiceRole.entities.UserGoals.filter(
      { created_by: targetEmail },
      null,
      1
    ).catch(() => []);

    if (goals.length > 0) {
      const goal = goals[0];
      const goalsAligned = goal.kyc_record_id === primaryKYC.id && 
                          goal.kyc_verified === verification.summary.kyc_verified;
      
      if (goalsAligned) {
        verification.checks.push('✓ UserGoals KYC status synchronized');
      } else {
        verification.checks.push('⚠️ UserGoals KYC status out of sync - will update');
      }
      verification.summary.goals_id = goal.id;
      verification.summary.autopilot_enabled = goal.autopilot_enabled;
    } else {
      verification.checks.push('⚠️ No UserGoals record found');
    }

    // Check 3: AIIdentity records
    const identities = await base44.asServiceRole.entities.AIIdentity.filter(
      { user_email: targetEmail },
      null,
      100
    ).catch(() => []);

    const syncedIdentities = identities.filter(i => 
      i.kyc_verified_data?.kyc_id === primaryKYC.id
    );

    if (identities.length === 0) {
      verification.checks.push('ℹ️ No AIIdentity records found');
    } else if (syncedIdentities.length === identities.length) {
      verification.checks.push(`✓ All ${identities.length} identities KYC synced`);
    } else {
      verification.checks.push(`⚠️ ${syncedIdentities.length}/${identities.length} identities synced - will update`);
    }
    verification.summary.identities_total = identities.length;
    verification.summary.identities_synced = syncedIdentities.length;

    // Determine overall status
    const allChecksPassed = 
      verification.checks.every(c => c.startsWith('✓')) &&
      verification.summary.kyc_verified;

    verification.consolidation_status = allChecksPassed ? 'consolidated' : 'needs_sync';

    // Log verification
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `🔍 KYC consolidation verified for ${targetEmail} - Status: ${verification.consolidation_status}`,
      severity: allChecksPassed ? 'success' : 'warning',
      metadata: { 
        event: 'kyc_consolidation_verify',
        target_email: targetEmail,
        consolidation_status: verification.consolidation_status
      }
    }).catch(() => null);

    return Response.json({ success: true, verification });

  } catch (error) {
    verification.checks.push(`❌ Verification error: ${error.message}`);
    verification.consolidation_status = 'error';
    return Response.json({ success: false, verification }, { status: 500 });
  }
}

async function activateForKYC(base44, requestingUser, targetEmail) {
  const activation = {
    target_email: targetEmail,
    timestamp: new Date().toISOString(),
    activated: false,
    updates: [],
    errors: []
  };

  try {
    // Get verified KYC
    const kycRecords = await base44.asServiceRole.entities.KYCVerification.filter(
      { user_email: targetEmail },
      '-created_date',
      1
    ).catch(() => []);

    if (kycRecords.length === 0) {
      activation.errors.push('No KYC record found');
      return Response.json({ success: false, activation }, { status: 404 });
    }

    const kyc = kycRecords[0];
    const isKYCVerified = kyc.status === 'verified' || kyc.status === 'approved';

    if (!isKYCVerified) {
      activation.errors.push(`KYC status is ${kyc.status}, not approved - cannot activate`);
      return Response.json({ success: false, activation }, { status: 400 });
    }

    // Get/create UserGoals
    let goals = await base44.asServiceRole.entities.UserGoals.filter(
      { created_by: targetEmail },
      null,
      1
    ).catch(() => []);

    let goalId;
    if (goals.length > 0) {
      goalId = goals[0].id;
    } else {
      // Create default UserGoals
      const newGoal = await base44.asServiceRole.entities.UserGoals.create({
        daily_target: 1000,
        available_capital: 0,
        risk_tolerance: 'moderate',
        autopilot_enabled: false,
        wallet_balance: 0,
        total_earned: 0,
        onboarded: false
      }).catch(e => {
        activation.errors.push(`Failed to create UserGoals: ${e.message}`);
        return null;
      });
      
      if (!newGoal) {
        return Response.json({ success: false, activation }, { status: 500 });
      }
      goalId = newGoal.id;
    }

    // Update UserGoals with KYC info and enable autopilot
    const updateData = {
      kyc_record_id: kyc.id,
      kyc_verified: true,
      kyc_status: kyc.status,
      autopilot_enabled: true,
      onboarded: true
    };

    await base44.asServiceRole.entities.UserGoals.update(goalId, updateData)
      .catch(e => {
        activation.errors.push(`Failed to update UserGoals: ${e.message}`);
        throw e;
      });

    activation.updates.push('✓ UserGoals: KYC verified flag set to true');
    activation.updates.push('✓ UserGoals: Autopilot enabled');
    activation.updates.push('✓ UserGoals: Onboarded flag set to true');

    // Update AIIdentities with KYC clearance
    const identities = await base44.asServiceRole.entities.AIIdentity.filter(
      { user_email: targetEmail },
      null,
      100
    ).catch(() => []);

    for (const identity of identities) {
      const kycData = {
        ...identity.kyc_verified_data,
        kyc_id: kyc.id,
        synced_at: new Date().toISOString(),
        kyc_status: kyc.status,
        kyc_tier: 'enhanced',
        autopilot_clearance: {
          can_submit_w9: true,
          can_submit_1099_forms: true,
          can_submit_grant_applications: true,
          can_use_government_portals: true,
          can_submit_financial_onboarding: true,
          can_attach_id_documents: true
        }
      };

      await base44.asServiceRole.entities.AIIdentity.update(identity.id, {
        kyc_verified_data: kycData
      }).catch(e => {
        activation.errors.push(`Failed to update AIIdentity ${identity.id}: ${e.message}`);
      });
    }

    if (identities.length > 0) {
      activation.updates.push(`✓ Updated ${identities.length} identities with autopilot clearance`);
    }

    // Log activation
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `🚀 KYC-based autopilot activation for ${targetEmail} - All systems ready`,
      severity: 'success',
      metadata: {
        event: 'kyc_autopilot_activation',
        target_email: targetEmail,
        kyc_id: kyc.id,
        identities_cleared: identities.length
      }
    }).catch(() => null);

    activation.activated = activation.errors.length === 0;
    return Response.json({ success: activation.activated, activation });

  } catch (error) {
    activation.errors.push(`Fatal activation error: ${error.message}`);
    return Response.json({ success: false, activation }, { status: 500 });
  }
}