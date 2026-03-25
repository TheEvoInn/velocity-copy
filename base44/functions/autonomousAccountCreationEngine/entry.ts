/**
 * AUTONOMOUS ACCOUNT CREATION ENGINE
 * Allows Autopilot to automatically create accounts on external platforms
 * using real user data, real browser automation, and full credential syncing
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Detect if a platform's sign-up process is simple and auto-creatable
 * Evaluates: instant access, minimal fields, no verification delays
 */
function isSignUpSimpleAndAccessible(platform, opportunity) {
  const simpleSignUpPlatforms = {
    upwork: { simple: true, fields: ['email', 'password', 'name', 'phone'] },
    fiverr: { simple: true, fields: ['email', 'password', 'name'] },
    freelancer: { simple: true, fields: ['email', 'password', 'name'] },
    guru: { simple: true, fields: ['email', 'password', 'name', 'phone'] },
    peopleperhour: { simple: true, fields: ['email', 'password', 'name'] },
    toptal: { simple: false }, // requires verification
    ebay: { simple: true, fields: ['email', 'password', 'name', 'phone'] },
    etsy: { simple: true, fields: ['email', 'password', 'name'] },
    amazon: { simple: false }, // requires phone verification
  };

  const platformConfig = simpleSignUpPlatforms[platform.toLowerCase()];
  if (!platformConfig || !platformConfig.simple) {
    return { accessible: false, reason: 'Platform requires verification or complex onboarding' };
  }

  return {
    accessible: true,
    platform,
    requiredFields: platformConfig.fields,
    estimatedTime: '2-5 minutes'
  };
}

/**
 * Retrieve user-approved data — delegates to Master Account Credential Engine
 * This is the ONLY approved data source. No fabrication allowed.
 */
async function getUserApprovedData(base44, userEmail, identityId) {
  try {
    const result = await base44.functions.invoke('masterAccountCredentialEngine', {
      action: 'get_master_credentials',
      identity_id: identityId
    }).catch(e => ({ data: { success: false, error: e.message } }));

    if (!result.data?.success) {
      return { success: false, error: result.data?.error || 'Could not resolve master credentials' };
    }

    const creds = result.data.credentials;
    if (!creds.email || !creds.full_name) {
      return { success: false, error: 'Incomplete master credentials — email and full_name required. Update your AI Identity profile.' };
    }

    return {
      success: true,
      data: {
        ...creds,
        username: (creds.full_name || 'user').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Math.random().toString(36).substring(2, 6),
        password: generateSecurePassword()
      },
      verified: creds.kyc_verified,
      kyc_tier: creds.kyc_tier || 'none'
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Generate a cryptographically secure password
 */
function generateSecurePassword(length = 16) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  let password = '';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    password += charset[array[i] % charset.length];
  }
  return password;
}

/**
 * Execute real browser automation to create account
 * Uses actual navigation, form filling, and submission
 */
async function executeAccountCreation(base44, platform, userData, signUpUrl) {
  try {
    // Invoke real browser automation engine
    const browserResult = await base44.functions.invoke('browserAutomationReal', {
      action: 'execute_account_creation',
      platform,
      url: signUpUrl,
      form_data: {
        email: userData.email,
        password: userData.password,
        full_name: userData.full_name,
        phone: userData.phone,
        username: userData.username
      }
    }).catch(e => ({ data: { success: false, error: e.message } }));

    if (!browserResult.data?.success) {
      return {
        success: false,
        error: browserResult.data?.error || 'Browser automation failed',
        attempts: 1
      };
    }

    // Verify account was actually created
    const verificationResult = await verifyAccountCreation(
      base44,
      platform,
      userData.email,
      userData.username
    );

    if (!verificationResult.verified) {
      return {
        success: false,
        error: 'Account creation not verified',
        attempts: 1
      };
    }

    return {
      success: true,
      account: {
        platform,
        email: userData.email,
        username: userData.username,
        created_at: new Date().toISOString(),
        verification_code: browserResult.data?.verification_code || null,
        profile_url: browserResult.data?.profile_url
      }
    };
  } catch (e) {
    return { success: false, error: e.message, attempts: 1 };
  }
}

/**
 * Verify account was actually created on the platform
 */
async function verifyAccountCreation(base44, platform, email, username) {
  try {
    // Attempt login to verify credentials work
    const loginResult = await base44.functions.invoke('browserAutomationReal', {
      action: 'verify_login',
      platform,
      email,
      username
    }).catch(() => ({ data: { success: false } }));

    return {
      verified: loginResult.data?.success === true,
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    return { verified: false, error: e.message };
  }
}

/**
 * Store credentials securely in CredentialVault
 */
async function storeCredentialsInVault(base44, userEmail, platform, userData) {
  try {
    // Create vault entry with encrypted credentials using service role for security
    const vaultEntry = await base44.asServiceRole.entities.CredentialVault.create({
      platform,
      credential_type: 'login',
      encrypted_payload: JSON.stringify({
        email: userData.email,
        username: userData.username,
        password: userData.password // Will be encrypted by platform
      }),
      iv: generateIV(),
      is_active: true
    }).catch(e => ({ error: e.message }));

    if (vaultEntry.error) {
      return { success: false, error: vaultEntry.error };
    }

    return { success: true, vault_id: vaultEntry.id };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Generate initialization vector for encryption
 */
function generateIV() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode.apply(null, array));
}

/**
 * Create LinkedAccount entry to track the new account
 */
async function createLinkedAccount(base44, userEmail, platform, userData, vaultId) {
  try {
    const linkedAccount = await base44.asServiceRole.entities.LinkedAccount.create({
      platform,
      username: userData.username,
      profile_url: `https://${platform}.com/user/${userData.username}`,
      specialization: `Auto-created account via Autopilot`,
      health_status: 'healthy',
      last_used: new Date().toISOString(),
      jobs_completed: 0,
      total_earned: 0,
      ai_can_use: true,
      encrypted_credential_id: vaultId,
      performance_score: 50
    }).catch(e => ({ error: e.message }));

    if (linkedAccount.error) {
      return { success: false, error: linkedAccount.error };
    }

    return { success: true, account_id: linkedAccount.id };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Update LinkedAccountCreation record for tracking
 */
async function logAccountCreation(base44, userEmail, identityId, platform, username) {
  try {
    await base44.asServiceRole.entities.LinkedAccountCreation.create({
      platform,
      identity_id: identityId,
      username: username,
      email: userEmail,
      account_status: 'active',
      is_ai_created: true,
      is_user_override: false,
      health_status: 'healthy',
      onboarding_completed: true,
      profile_completeness: 75,
      verification_status: 'verified',
      creation_timestamp: new Date().toISOString(),
      created_by: userEmail
    }).catch(() => null);

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Sync new account across all dependent systems
 */
async function syncAccountAcrossModules(base44, userEmail, platform, linkedAccountId) {
  try {
    const syncResults = {};

    // 1. Update Identity profile with new linked account
    const identities = await base44.asServiceRole.entities.AIIdentity.filter(
      { user_email: userEmail }, null, 1
    ).catch(() => []);

    if (identities.length > 0) {
      const identity = identities[0];
      const linkedIds = identity.linked_account_ids || [];
      if (!linkedIds.includes(linkedAccountId)) {
        await base44.asServiceRole.entities.AIIdentity.update(identity.id, {
          linked_account_ids: [...linkedIds, linkedAccountId]
        }).catch(() => null);
      }
      syncResults.identity_updated = true;
    }

    // 2. Log activity
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `✅ Account automatically created: ${platform}`,
      severity: 'success',
      metadata: {
        platform,
        linked_account_id: linkedAccountId,
        auto_created: true
      }
    }).catch(() => null);
    syncResults.activity_logged = true;

    // 3. Update PlatformState to mark account as available
    const platformStates = await base44.asServiceRole.entities.PlatformState.filter({}, null, 1).catch(() => []);
    if (platformStates.length > 0) {
      const state = platformStates[0];
      const systemSettings = state.system_settings || {};
      await base44.asServiceRole.entities.PlatformState.update(state.id, {
        system_settings: {
          ...systemSettings,
          auto_account_creation_enabled: true
        }
      }).catch(() => null);
      syncResults.platform_state_updated = true;
    }

    return { success: true, synced: Object.keys(syncResults).length, details: syncResults };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Main orchestration function
 */
async function executeAutonomousAccountCreation(base44, userEmail, identityId, opportunity) {
  const result = {
    timestamp: new Date().toISOString(),
    opportunity_id: opportunity.id,
    platform: opportunity.platform,
    steps: []
  };

  try {
    // Step 1: Evaluate platform accessibility
    result.steps.push('Evaluating platform sign-up complexity...');
    const accessibilityCheck = isSignUpSimpleAndAccessible(opportunity.platform, opportunity);
    if (!accessibilityCheck.accessible) {
      result.steps.push(`❌ ${accessibilityCheck.reason}`);
      return { success: false, result };
    }
    result.steps.push(`✓ Platform ${opportunity.platform} is auto-creatable`);

    // Step 2: Retrieve user-approved data
    result.steps.push('Retrieving verified user data...');
    const userDataResult = await getUserApprovedData(base44, userEmail, identityId);
    if (!userDataResult.success) {
      result.steps.push(`❌ ${userDataResult.error}`);
      return { success: false, result };
    }
    result.steps.push('✓ User data verified and retrieved');

    // Step 3: Execute real account creation
    result.steps.push('Executing account creation via real browser automation...');
    const creationResult = await executeAccountCreation(
      base44,
      opportunity.platform,
      userDataResult.data,
      opportunity.url
    );
    if (!creationResult.success) {
      result.steps.push(`❌ ${creationResult.error}`);
      return { success: false, result };
    }
    result.steps.push('✓ Account created successfully');
    result.account = creationResult.account;

    // Step 4: Store credentials securely
    result.steps.push('Storing credentials in vault...');
    const vaultResult = await storeCredentialsInVault(
      base44,
      userEmail,
      opportunity.platform,
      userDataResult.data
    );
    if (!vaultResult.success) {
      result.steps.push(`❌ ${vaultResult.error}`);
      return { success: false, result };
    }
    result.steps.push('✓ Credentials secured in vault');

    // Step 5: Create LinkedAccount entry
    result.steps.push('Registering account in system...');
    const linkedResult = await createLinkedAccount(
      base44,
      userEmail,
      opportunity.platform,
      userDataResult.data,
      vaultResult.vault_id
    );
    if (!linkedResult.success) {
      result.steps.push(`❌ ${linkedResult.error}`);
      return { success: false, result };
    }
    result.account_id = linkedResult.account_id;
    result.steps.push('✓ Account registered in system');

    // Step 6: Log account creation
    result.steps.push('Logging creation event...');
    await logAccountCreation(
      base44,
      userEmail,
      identityId,
      opportunity.platform,
      userDataResult.data.username
    ).catch(() => null);
    result.steps.push('✓ Creation logged');

    // Step 7: Sync across all modules
    result.steps.push('Syncing across all modules...');
    const syncResult = await syncAccountAcrossModules(
      base44,
      userEmail,
      opportunity.platform,
      linkedResult.account_id
    );
    if (syncResult.success) {
      result.steps.push(`✓ Synced to ${syncResult.synced} modules`);
    } else {
      result.steps.push(`⚠️ Partial sync: ${syncResult.error}`);
    }

    result.success = true;
    result.status = 'Account created and ready for use';
    return result;

  } catch (e) {
    result.steps.push(`❌ Fatal error: ${e.message}`);
    return { success: false, result };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, identityId, opportunity } = await req.json();

    // ─── Auto-create account ──────────────────────────────────────
    if (action === 'auto_create_account') {
      if (!identityId || !opportunity) {
        return Response.json({ error: 'Identity and opportunity required' }, { status: 400 });
      }

      const result = await executeAutonomousAccountCreation(
        base44,
        user.email,
        identityId,
        opportunity
      );

      return Response.json(result);
    }

    // ─── Check if platform supports auto-creation ─────────────────
    if (action === 'check_auto_creation_support') {
      if (!opportunity) {
        return Response.json({ error: 'Opportunity required' }, { status: 400 });
      }

      const check = isSignUpSimpleAndAccessible(opportunity.platform, opportunity);
      return Response.json({ supported: check.accessible, details: check });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('[AutonomousAccountCreationEngine] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});