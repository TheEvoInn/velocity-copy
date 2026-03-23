/**
 * UNIFIED ONBOARDING ORCHESTRATOR ENGINE
 * Central intake engine for all user data across VELOCITY ecosystem
 * Handles validation, syncing, and immediate Autopilot activation
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const ONBOARDING_STEPS = {
  welcome: { id: 'welcome', title: 'Welcome', order: 1, required: false },
  identity: { id: 'identity', title: 'Legal Identity & Profile', order: 2, required: true },
  kyc: { id: 'kyc', title: 'KYC & Compliance', order: 3, required: true },
  wallet: { id: 'wallet', title: 'Wallet & Financial', order: 4, required: true },
  credentials: { id: 'credentials', title: 'Credentials & Permissions', order: 5, required: true },
  departments: { id: 'departments', title: 'Department Preferences', order: 6, required: false },
  review: { id: 'review', title: 'Review & Activate', order: 7, required: true },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, data = {} } = await req.json();

    switch (action) {
      case 'get_status':
        return await getOnboardingStatus(base44, user);

      case 'submit_step':
        return await submitOnboardingStep(base44, user, data);

      case 'complete_onboarding':
        return await completeOnboarding(base44, user, data);

      case 'validate_data':
        return await validateOnboardingData(base44, user, data);

      case 'sync_to_platforms':
        return await syncToPlatforms(base44, user, data);

      case 'activate_autopilot':
        return await activateAutopilot(base44, user);

      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Onboarding orchestrator error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function getOnboardingStatus(base44, user) {
  try {
    // Get or create UserGoals (contains onboarding state)
    const goals = await base44.asServiceRole.entities.UserGoals.filter({ created_by: user.email }, '-created_date', 1);
    const userGoals = goals?.[0];

    const onboardingState = {
      user_email: user.email,
      steps: Object.values(ONBOARDING_STEPS).sort((a, b) => a.order - b.order),
      completed_steps: userGoals?.onboarded ? Object.keys(ONBOARDING_STEPS) : [],
      is_complete: userGoals?.onboarded || false,
      progress: {
        percent_complete: userGoals?.onboarded ? 100 : 0,
        current_step: userGoals?.onboarded ? null : 'welcome',
        total_steps: Object.keys(ONBOARDING_STEPS).length,
        steps_completed: userGoals?.onboarded ? Object.keys(ONBOARDING_STEPS).length : 0,
      }
    };

    // Fetch collected data
    const kycData = await base44.asServiceRole.entities.KYCVerification.filter({ created_by: user.email }, '-created_date', 1);
    const identities = await base44.asServiceRole.entities.AIIdentity.filter({ created_by: user.email }, '-created_date', 1);
    const wallets = await base44.asServiceRole.entities.CryptoWallet.filter({ created_by: user.email }, '-created_date', 5);
    const credentials = await base44.asServiceRole.entities.EncryptedCredential.filter({ created_by: user.email }, '-created_date', 10);

    return Response.json({
      success: true,
      onboarding: onboardingState,
      collected_data: {
        identity: identities?.[0] || null,
        kyc: kycData?.[0] || null,
        wallets: wallets || [],
        credentials_count: credentials?.length || 0,
        user_goals: userGoals || null,
      }
    });
  } catch (error) {
    console.error('Get status error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function submitOnboardingStep(base44, user, data) {
  try {
    const { step_id, step_data } = data;

    // Validate step exists
    if (!ONBOARDING_STEPS[step_id]) {
      return Response.json({ error: 'Invalid step' }, { status: 400 });
    }

    // Route to appropriate handler
    let result;
    switch (step_id) {
      case 'identity':
        result = await handleIdentityStep(base44, user, step_data);
        break;
      case 'kyc':
        result = await handleKYCStep(base44, user, step_data);
        break;
      case 'wallet':
        result = await handleWalletStep(base44, user, step_data);
        break;
      case 'credentials':
        result = await handleCredentialsStep(base44, user, step_data);
        break;
      case 'departments':
        result = await handleDepartmentsStep(base44, user, step_data);
        break;
      default:
        result = { success: true, message: `Step ${step_id} recorded` };
    }

    // Log step completion
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `✓ Onboarding step "${step_id}" completed`,
      severity: 'success',
      metadata: {
        entity_name: 'Onboarding',
        event_type: 'step_completed',
        step_id,
        timestamp: new Date().toISOString()
      }
    });

    return Response.json({
      success: true,
      step_id,
      result
    });
  } catch (error) {
    console.error('Submit step error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function handleIdentityStep(base44, user, data) {
  const { full_name, date_of_birth, address, preferred_identity } = data;

  // Create/update AIIdentity
  const identities = await base44.asServiceRole.entities.AIIdentity.filter({ created_by: user.email }, '-created_date', 1);
  const identity = identities?.[0];

  const identityData = {
    identity_name: `${user.email}_primary`,
    legal_name: full_name,
    date_of_birth,
    residential_address: address,
    is_active: true,
    verified: false,
    status: 'pending_verification'
  };

  let savedIdentity;
  if (identity) {
    await base44.asServiceRole.entities.AIIdentity.update(identity.id, identityData);
    savedIdentity = identity.id;
  } else {
    const created = await base44.asServiceRole.entities.AIIdentity.create(identityData);
    savedIdentity = created.id;
  }

  // Update UserGoals if specified as preferred
  if (preferred_identity) {
    const goals = await base44.asServiceRole.entities.UserGoals.filter({ created_by: user.email }, '-created_date', 1);
    if (goals?.[0]) {
      await base44.asServiceRole.entities.UserGoals.update(goals[0].id, {
        preferred_identity_id: savedIdentity
      });
    } else {
      await base44.asServiceRole.entities.UserGoals.create({
        preferred_identity_id: savedIdentity,
        onboarded: false
      });
    }
  }

  return { success: true, identity_id: savedIdentity };
}

async function handleKYCStep(base44, user, data) {
  const { government_id_type, government_id_number, id_expiry, government_id_front_url, government_id_back_url, selfie_url } = data;

  const kyc = await base44.asServiceRole.entities.KYCVerification.filter({ created_by: user.email }, '-created_date', 1);
  const existingKYC = kyc?.[0];

  const kycData = {
    user_email: user.email,
    full_legal_name: user.full_name,
    date_of_birth: data.date_of_birth,
    residential_address: data.address || '',
    city: data.city || '',
    state: data.state || '',
    postal_code: data.postal_code || '',
    country: data.country || '',
    phone_number: data.phone || '',
    government_id_type,
    government_id_number,
    government_id_expiry: id_expiry,
    id_document_front_url: government_id_front_url,
    id_document_back_url: government_id_back_url,
    selfie_url,
    status: 'submitted',
    submitted_at: new Date().toISOString()
  };

  let savedKYC;
  if (existingKYC) {
    await base44.asServiceRole.entities.KYCVerification.update(existingKYC.id, kycData);
    savedKYC = existingKYC.id;
  } else {
    const created = await base44.asServiceRole.entities.KYCVerification.create(kycData);
    savedKYC = created.id;
  }

  return { success: true, kyc_id: savedKYC, status: 'submitted' };
}

async function handleWalletStep(base44, user, data) {
  const { crypto_wallets } = data;

  const walletIds = [];
  for (const walletData of (crypto_wallets || [])) {
    const created = await base44.asServiceRole.entities.CryptoWallet.create({
      wallet_name: walletData.name || 'Primary Wallet',
      wallet_type: walletData.type || 'ethereum',
      address: walletData.address,
      is_primary: walletData.is_primary || false,
      status: 'active'
    });
    walletIds.push(created.id);
  }

  // Update UserGoals with wallet info
  const goals = await base44.asServiceRole.entities.UserGoals.filter({ created_by: user.email }, '-created_date', 1);
  if (goals?.[0]) {
    await base44.asServiceRole.entities.UserGoals.update(goals[0].id, {
      available_capital: data.available_capital || 0,
      wallet_balance: data.wallet_balance || 0
    });
  }

  return { success: true, wallet_ids: walletIds, count: walletIds.length };
}

async function handleCredentialsStep(base44, user, data) {
  const { platform_credentials } = data;

  const credentialIds = [];
  for (const cred of (platform_credentials || [])) {
    const created = await base44.asServiceRole.entities.EncryptedCredential.create({
      credential_name: cred.name || cred.platform,
      platform: cred.platform,
      credential_type: cred.type || 'username_password',
      encrypted_data: cred.value || '',
      requires_mfa: cred.requires_mfa || false,
      mfa_type: cred.mfa_type || 'none',
      is_active: true
    });
    credentialIds.push(created.id);
  }

  return { success: true, credential_ids: credentialIds, count: credentialIds.length };
}

async function handleDepartmentsStep(base44, user, data) {
  const { vipz_preferences, ned_preferences, autopilot_preferences, workflow_preferences } = data;

  // Update UserGoals with department preferences
  const goals = await base44.asServiceRole.entities.UserGoals.filter({ created_by: user.email }, '-created_date', 1);
  const updateData = {
    autopilot_enabled: autopilot_preferences?.enabled || true,
    ai_daily_target: autopilot_preferences?.daily_target || 500,
    ai_preferred_categories: autopilot_preferences?.categories || [],
    risk_tolerance: ned_preferences?.risk_tolerance || 'moderate',
    ai_instructions: data.custom_instructions || ''
  };

  if (goals?.[0]) {
    await base44.asServiceRole.entities.UserGoals.update(goals[0].id, updateData);
  }

  return { success: true, preferences_saved: true };
}

async function validateOnboardingData(base44, user, data) {
  const errors = [];

  // Validate identity
  if (!data.identity?.full_name) errors.push('Full name is required');
  if (!data.identity?.date_of_birth) errors.push('Date of birth is required');

  // Validate KYC
  if (!data.kyc?.government_id_type) errors.push('Government ID type is required');
  if (!data.kyc?.government_id_number) errors.push('Government ID number is required');

  // Validate wallet
  if (!data.wallet?.crypto_wallets || data.wallet.crypto_wallets.length === 0) {
    errors.push('At least one crypto wallet is required');
  }

  return Response.json({
    success: errors.length === 0,
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : null
  });
}

async function syncToPlatforms(base44, user, data) {
  try {
    // Trigger ActivityLog entry to cascade syncing via realtimeEventBus
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: '⟳ Onboarding data sync initiated',
      severity: 'info',
      metadata: {
        entity_name: 'Onboarding',
        event_type: 'data_sync',
        sync_targets: ['Autopilot', 'VIPZ', 'NED', 'Workflows', 'Command Center', 'Deep Space'],
        timestamp: new Date().toISOString()
      }
    });

    return Response.json({
      success: true,
      message: 'Sync cascaded to all platforms',
      synced_platforms: ['Autopilot', 'VIPZ', 'NED', 'Workflows', 'Command Center', 'Deep Space']
    });
  } catch (error) {
    console.error('Sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function completeOnboarding(base44, user, data) {
  try {
    // Final validation
    const validation = await validateOnboardingData(base44, user, data);
    if (!validation.success) {
      return Response.json({ error: 'Validation failed', errors: validation.errors }, { status: 400 });
    }

    // Process each step to create/update entities
    await handleIdentityStep(base44, user, data.identity);
    await handleKYCStep(base44, user, data.kyc);
    await handleWalletStep(base44, user, data.wallet);
    await handleCredentialsStep(base44, user, data.credentials);
    await handleDepartmentsStep(base44, user, data.departments);

    // Mark onboarding as complete
    const goals = await base44.asServiceRole.entities.UserGoals.filter({ created_by: user.email }, '-created_date', 1);
    if (goals?.[0]) {
      await base44.asServiceRole.entities.UserGoals.update(goals[0].id, {
        onboarded: true,
        onboarding_completed_at: new Date().toISOString()
      });
    } else {
      await base44.asServiceRole.entities.UserGoals.create({
        onboarded: true,
        onboarding_completed_at: new Date().toISOString()
      });
    }

    // Trigger sync cascade
    await syncToPlatforms(base44, user, data);

    // Activate Autopilot
    await activateAutopilot(base44, user);

    // Log completion
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: '🎉 Onboarding COMPLETE - All systems activated',
      severity: 'success',
      metadata: {
        event_type: 'onboarding_complete',
        timestamp: new Date().toISOString(),
        autopilot_ready: true
      }
    });

    return Response.json({
      success: true,
      message: 'Onboarding complete - Autopilot activated',
      onboarded: true,
      autopilot_ready: true
    });
  } catch (error) {
    console.error('Completion error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function activateAutopilot(base44, user) {
  try {
    // Invoke autopilotOrchestrator to activate
    const response = await base44.asServiceRole.functions.invoke('autopilotOrchestrator', {
      action: 'activate_from_onboarding'
    });
    return response;
  } catch (error) {
    console.error('Autopilot activation error:', error);
    throw error;
  }
}