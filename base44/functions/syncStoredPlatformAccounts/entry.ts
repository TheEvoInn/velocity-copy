import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * SYNC STORED PLATFORM ACCOUNTS
 * Reads platform_accounts from UserGoals and creates/activates CredentialVault entries
 * Bridges the gap between user-provided setup data and executable credentials
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const { target_email = 'dawnvernor@yahoo.com' } = body;

    const sync = {
      timestamp: new Date().toISOString(),
      target_email,
      stored_accounts_found: null,
      credentials_created: 0,
      credentials_activated: 0,
      errors: [],
    };

    // 1. Get user's UserGoals to read platform_accounts
    const userGoals = await base44.asServiceRole.entities.UserGoals.filter(
      { created_by: target_email },
      '-created_date',
      1
    ).catch(() => []);

    const goals = Array.isArray(userGoals) && userGoals.length > 0 ? userGoals[0] : null;

    if (!goals) {
      return Response.json({ 
        success: false, 
        message: 'No UserGoals found for user',
        sync 
      }, { status: 400 });
    }

    if (!goals.platform_accounts) {
      return Response.json({ 
        success: false, 
        message: 'No platform_accounts data stored in UserGoals',
        sync 
      }, { status: 400 });
    }

    const accounts = goals.platform_accounts;
    sync.stored_accounts_found = Object.keys(accounts).filter(k => accounts[k]).length;

    console.log(`[SYNC] Found ${sync.stored_accounts_found} stored platform accounts`);

    // 2. For each platform account, create a CredentialVault entry
    const platformsWithData = Object.entries(accounts).filter(([platform, value]) => {
      return value && typeof value === 'string' && value.length > 0;
    });

    for (const [platform, accountInfo] of platformsWithData) {
      try {
        console.log(`[SYNC] Creating credential for platform: ${platform}`);

        // Parse account info if it's JSON, otherwise treat as username
        let credentialData = {
          platform,
          is_active: true,
          created_by: target_email,
        };

        if (accountInfo.includes('@') || accountInfo.includes(':')) {
          // Likely email or email:username format
          if (accountInfo.includes(':')) {
            const [email, username] = accountInfo.split(':');
            credentialData.email = email;
            credentialData.username = username;
          } else {
            credentialData.email = accountInfo;
            credentialData.username = accountInfo.split('@')[0];
          }
        } else {
          // Just a username
          credentialData.username = accountInfo;
        }

        // Try to find or create identity for this credential
        const allIdentities = await base44.asServiceRole.entities.AIIdentity.list('-created_date', 10).catch(() => []);
        const identitiesArray = Array.isArray(allIdentities) ? allIdentities : [];
        const userIdentity = identitiesArray.find(id => id.created_by === target_email && id.is_active);

        if (userIdentity) {
          credentialData.identity_id = userIdentity.id;
          credentialData.identity_name = userIdentity.name;
        }

        // Create the credential
        const credential = await base44.asServiceRole.entities.CredentialVault.create(credentialData).catch(e => {
          sync.errors.push(`Failed to create ${platform} credential: ${e.message}`);
          return null;
        });

        if (credential) {
          sync.credentials_created++;
          console.log(`[SYNC] Created credential ${credential.id} for ${platform}`);
        }
      } catch (e) {
        sync.errors.push(`Error processing ${platform}: ${e.message}`);
      }
    }

    // 3. Activate any existing but inactive credentials for these platforms
    const existingCreds = await base44.asServiceRole.entities.CredentialVault.list('-created_date', 100).catch(() => []);
    const credsArray = Array.isArray(existingCreds) ? existingCreds : [];

    for (const cred of credsArray) {
      if (!cred.is_active && platformsWithData.some(([p]) => p === cred.platform)) {
        await base44.asServiceRole.entities.CredentialVault.update(cred.id, {
          is_active: true,
        }).catch(e => {
          sync.errors.push(`Failed to activate credential ${cred.id}: ${e.message}`);
        });
        sync.credentials_activated++;
      }
    }

    // 4. Log sync operation
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `✅ Platform Accounts Synced for ${target_email}: ${sync.credentials_created} created, ${sync.credentials_activated} activated from stored platform_accounts data`,
      severity: sync.errors.length === 0 ? 'success' : 'warning',
      metadata: sync,
    }).catch(() => null);

    return Response.json({ success: true, sync });
  } catch (error) {
    console.error('[syncStoredPlatformAccounts]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});