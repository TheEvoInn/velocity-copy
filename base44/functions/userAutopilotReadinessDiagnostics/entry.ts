/**
 * USER AUTOPILOT READINESS DIAGNOSTICS
 * Analyzes user account for full operational readiness
 * Identifies gaps and requests missing data via UserIntervention
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

    const analysis = await analyzeUserReadiness(base44, user_email);
    return Response.json(analysis);

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function analyzeUserReadiness(base44, userEmail) {
  const report = {
    user_email: userEmail,
    timestamp: new Date().toISOString(),
    readiness_score: 0,
    is_ready_for_autopilot: false,
    sections: {},
    missing_requirements: [],
    intervention_required: false,
    action_items: []
  };

  try {
    // 1. ONBOARDING STATUS
    const userGoals = await base44.asServiceRole.entities.UserGoals.filter(
      { created_by: userEmail },
      null,
      1
    ).catch(() => []);

    const onboarded = userGoals[0]?.onboarded || false;
    report.sections.onboarding = {
      status: onboarded ? 'COMPLETE' : 'INCOMPLETE',
      completed: onboarded,
      wallet_balance: userGoals[0]?.wallet_balance || 0,
      autopilot_enabled: userGoals[0]?.autopilot_enabled ?? true,
      daily_target: userGoals[0]?.daily_target || 1000,
      risk_tolerance: userGoals[0]?.risk_tolerance || 'moderate'
    };

    if (!onboarded) {
      report.missing_requirements.push('ONBOARDING_INCOMPLETE');
      report.action_items.push('User must complete onboarding wizard (identity, KYC, banking, preferences)');
    }

    // 2. KYC STATUS — check both KYCVerification and AIIdentity kyc_verified_data
    const kycRecords = await base44.asServiceRole.entities.KYCVerification.filter(
      { created_by: userEmail },
      '-created_date',
      5  // Check multiple records
    ).catch(() => []);

    // Find verified or synced record
    let kycStatus = kycRecords.find(k => k.verification_status === 'verified');
    if (!kycStatus && kycRecords.length > 0) {
      kycStatus = kycRecords[0];
    }
    
    const kycComplete = kycStatus?.verification_status === 'verified' || kycStatus?.verified_at;

    report.sections.kyc = {
      status: kycComplete ? 'VERIFIED' : (kycStatus?.verification_status || 'NOT_STARTED'),
      verified: kycComplete,
      full_name: kycStatus?.full_legal_name || null,
      dob: kycStatus?.date_of_birth || null,
      government_id: kycStatus?.government_id_type || null,
      address: kycStatus?.residential_address || null,
      last_verified: kycStatus?.verified_at || null
    };

    if (!kycComplete) {
      report.missing_requirements.push('KYC_VERIFICATION');
      report.action_items.push(`KYC status: ${kycStatus?.verification_status || 'not started'}. User must submit identity documents and pass verification.`);
    }

    // 3. AI IDENTITY
    const identities = await base44.asServiceRole.entities.AIIdentity.filter(
      { user_email: userEmail },
      '-created_date',
      5
    ).catch(() => []);

    const activeIdentity = identities.find(i => i.is_active);
    const onboardingComplete = activeIdentity?.onboarding_complete || identities.some(i => i.onboarding_complete === true) || (activeIdentity?.kyc_verified_data?.kyc_tier && activeIdentity.kyc_verified_data.kyc_tier !== 'none');

    report.sections.ai_identity = {
      total_identities: identities.length,
      active_identity: activeIdentity ? {
        id: activeIdentity.id,
        name: activeIdentity.name,
        role_label: activeIdentity.role_label,
        onboarding_complete: activeIdentity.onboarding_complete,
        kyc_tier: activeIdentity.kyc_verified_data?.kyc_tier || 'none',
        tasks_executed: activeIdentity.tasks_executed || 0,
        total_earned: activeIdentity.total_earned || 0
      } : null,
      onboarding_complete: onboardingComplete
    };

    if (!activeIdentity) {
      report.missing_requirements.push('NO_ACTIVE_IDENTITY');
      report.action_items.push('No active AI identity found. User must create and activate an identity for autopilot operation.');
    }

    if (activeIdentity && !activeIdentity.onboarding_complete) {
      report.missing_requirements.push('IDENTITY_ONBOARDING_INCOMPLETE');
      report.action_items.push(`Identity "${activeIdentity.name}" onboarding incomplete. Must complete: ${activeIdentity.onboarding_status || 'unknown'}`);
    }

    // 4. CREDENTIAL VAULT
    const credentials = await base44.asServiceRole.entities.CredentialVault.filter(
      { created_by: userEmail },
      '-created_date',
      10
    ).catch(() => []);

    const activeCredentials = credentials.filter(c => c.is_active);

    report.sections.credential_vault = {
      total_credentials: credentials.length,
      active_credentials: activeCredentials.length,
      by_platform: {}
    };

    for (const cred of credentials) {
      const platform = cred.platform || 'unknown';
      report.sections.credential_vault.by_platform[platform] = (report.sections.credential_vault.by_platform[platform] || 0) + 1;
    }

    if (activeCredentials.length === 0) {
      report.missing_requirements.push('NO_ACTIVE_CREDENTIALS');
      report.action_items.push('No active credentials in vault. User must securely store platform credentials (email passwords, API keys, etc.).');
    }

    // 5. LINKED ACCOUNTS (Upwork, Fiverr, etc.)
    const linkedAccounts = await base44.asServiceRole.entities.LinkedAccount.filter(
      { created_by: userEmail },
      '-created_date',
      10
    ).catch(() => []);

    const healthyAccounts = linkedAccounts.filter(a => a.health_status === 'healthy');

    report.sections.linked_accounts = {
      total_accounts: linkedAccounts.length,
      healthy_accounts: healthyAccounts.length,
      by_platform: {}
    };

    for (const acc of linkedAccounts) {
      if (!report.sections.linked_accounts.by_platform[acc.platform]) {
        report.sections.linked_accounts.by_platform[acc.platform] = [];
      }
      report.sections.linked_accounts.by_platform[acc.platform].push({
        username: acc.username,
        health: acc.health_status,
        rating: acc.rating,
        jobs_completed: acc.jobs_completed,
        can_use: acc.ai_can_use
      });
    }

    if (linkedAccounts.length === 0) {
      report.missing_requirements.push('NO_LINKED_ACCOUNTS');
      report.action_items.push('No platform accounts linked. User should link at least one account (Upwork, Fiverr, etc.) for autopilot to execute on.');
    }

    // 6. WITHDRAWAL POLICY / BANKING
    const withdrawalPolicy = await base44.asServiceRole.entities.WithdrawalPolicy.filter(
      { created_by: userEmail },
      null,
      1
    ).catch(() => []);

    const policy = withdrawalPolicy[0];
    const hasBankAccounts = policy?.bank_accounts?.length > 0;

    report.sections.banking = {
      policy_configured: !!policy,
      engine_enabled: policy?.engine_enabled || false,
      bank_accounts: hasBankAccounts ? policy.bank_accounts.length : 0,
      withdrawal_threshold: policy?.min_withdrawal_threshold || 100,
      safety_buffer: policy?.safety_buffer || 200
    };

    if (!hasBankAccounts) {
      report.missing_requirements.push('NO_BANK_ACCOUNTS');
      report.action_items.push('No bank accounts configured. User should set up at least one bank account for automated payouts.');
    }

    // 7. SPENDING POLICY
    const spendingPolicies = await base44.asServiceRole.entities.SpendingPolicy.filter(
      { created_by: userEmail },
      null,
      10
    ).catch(() => []);

    const globalPolicy = spendingPolicies.find(p => p.category === 'global');

    report.sections.spending_policy = {
      policies_configured: spendingPolicies.length,
      global_policy: globalPolicy ? {
        max_per_task: globalPolicy.max_per_task,
        max_per_day: globalPolicy.max_per_day,
        min_roi_pct: globalPolicy.min_roi_pct,
        enabled: globalPolicy.enabled
      } : null
    };

    if (!globalPolicy?.enabled) {
      report.missing_requirements.push('SPENDING_POLICY_NOT_CONFIGURED');
      report.action_items.push('Global spending policy not configured or disabled. Autopilot needs spending limits to operate autonomously.');
    }

    // 8. PLATFORM STATE / AUTOPILOT CONFIG
    const platformState = await base44.asServiceRole.entities.PlatformState.filter(
      { created_by: userEmail },
      null,
      1
    ).catch(() => []);

    const state = platformState[0];

    report.sections.autopilot_state = {
      autopilot_enabled: state?.autopilot_enabled ?? true,
      autopilot_mode: state?.autopilot_mode || 'continuous',
      emergency_stop: state?.emergency_stop_engaged || false,
      current_queue_count: state?.current_queue_count || 0,
      system_health: state?.system_health || 'healthy',
      last_cycle: state?.last_cycle_timestamp || null
    };

    if (state?.emergency_stop_engaged) {
      report.missing_requirements.push('EMERGENCY_STOP_ENGAGED');
      report.action_items.push('Emergency stop is engaged. User must disengage before autopilot can run.');
    }

    // Calculate readiness score
    let score = 100;
    score -= onboarded ? 0 : 20;
    score -= kycComplete ? 0 : 20;
    score -= activeIdentity ? 0 : 15;
    score -= activeCredentials.length > 0 ? 0 : 15;
    score -= linkedAccounts.length > 0 ? 0 : 15;
    score -= hasBankAccounts ? 0 : 10;
    score -= globalPolicy?.enabled ? 0 : 5;

    report.readiness_score = Math.max(0, score);
    report.is_ready_for_autopilot = report.readiness_score >= 80 && report.missing_requirements.length === 0;

    // Create intervention if not ready
    if (!report.is_ready_for_autopilot && report.action_items.length > 0) {
      report.intervention_required = true;

      // No intervention creation — just report gaps for admin review
      // UserIntervention requires task_id, so we skip it here
      report.action_required = true;
    }

    // Log to activity
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `📊 Readiness check for ${userEmail}: ${report.readiness_score}% ready. ${report.is_ready_for_autopilot ? '✅ READY' : '⚠️ NOT READY'}`,
      severity: report.is_ready_for_autopilot ? 'success' : 'warning',
      metadata: {
        user_email: userEmail,
        score: report.readiness_score,
        ready: report.is_ready_for_autopilot,
        missing_count: report.missing_requirements.length
      }
    }).catch(() => null);

    return { success: true, ...report };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      user_email: userEmail
    };
  }
}