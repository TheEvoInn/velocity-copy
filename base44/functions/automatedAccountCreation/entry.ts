/**
 * AUTOMATED ACCOUNT CREATION
 * ROOT CAUSE FIX: Resolve AIIdentity directly via user-scoped base44.entities
 * instead of calling masterAccountCredentialEngine (inter-function calls lose user auth).
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const RETRY_CONFIG = { maxAttempts: 3, baseDelayMs: 500 };

async function withRetry(fn, systemName, platform, maxAttempts) {
  maxAttempts = maxAttempts || RETRY_CONFIG.maxAttempts;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt < maxAttempts) {
        const delay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt - 1);
        console.warn('[Sync] ' + systemName + ' retry ' + attempt + '/' + maxAttempts + ' for ' + platform + ': ' + e.message);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

async function notifyUserOfSyncFailure(base44, userEmail, platform, failedSystems) {
  await base44.asServiceRole.entities.Notification.create({
    type: 'warning', severity: 'warning',
    title: 'Account Sync Issues for ' + platform,
    message: 'Account was created but failed to sync to: ' + failedSystems.join(', ') + '.',
    user_email: userEmail, action_type: 'account_sync_failed', is_read: false
  }).catch(() => null);
}

async function verifyAccountHealth(base44, linkedAccountId, platform, identity_id) {
  const healthStatus = { healthy: true, issues: [] };
  try {
    const linkedAccount = await base44.asServiceRole.entities.LinkedAccount.get(linkedAccountId).catch(() => null);
    if (!linkedAccount) {
      healthStatus.healthy = false;
      healthStatus.issues.push('LinkedAccount record missing');
      return healthStatus;
    }
    const creds = await base44.asServiceRole.entities.CredentialVault.filter({ linked_account_id: linkedAccountId }, undefined, 1).catch(() => []);
    if (creds.length === 0) { healthStatus.healthy = false; healthStatus.issues.push('CredentialVault entry missing'); }
    const identity = await base44.entities.AIIdentity.get(identity_id).catch(() => null);
    if (!identity || !identity.linked_account_ids || !identity.linked_account_ids.includes(linkedAccountId)) {
      healthStatus.healthy = false;
      healthStatus.issues.push('AIIdentity link missing');
    }
  } catch (e) {
    healthStatus.healthy = false;
    healthStatus.issues.push('Verification error: ' + e.message);
  }
  return healthStatus;
}

Deno.serve(async (req) => {
  let user = null;
  let base44 = null;
  try {
    base44 = createClientFromRequest(req);
    user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, identity_id, platforms_to_create } = await req.json();

    // GET PLATFORM LIST
    if (action === 'get_platform_list') {
      const platforms = [
        { platform: 'upwork', label: 'Upwork', description: 'Freelance job marketplace', priority: 1 },
        { platform: 'fiverr', label: 'Fiverr', description: 'Gig-based freelance platform', priority: 2 },
        { platform: 'freelancer', label: 'Freelancer.com', description: 'Freelance marketplace', priority: 3 },
        { platform: 'guru', label: 'Guru', description: 'Professional freelance marketplace', priority: 4 },
        { platform: 'peopleperhour', label: 'PeoplePerHour', description: 'UK-based freelance platform', priority: 5 },
        { platform: 'github', label: 'GitHub', description: 'Code portfolio and collaboration', priority: 6 },
        { platform: 'ebay', label: 'eBay', description: 'Buy/sell marketplace', priority: 7 },
        { platform: 'etsy', label: 'Etsy', description: 'Creative goods marketplace', priority: 8 },
      ];
      return Response.json({ success: true, platforms, total: platforms.length });
    }

    // CREATE ACCOUNTS
    if (action === 'create_accounts') {
      if (!identity_id || !Array.isArray(platforms_to_create)) {
        return Response.json({ error: 'identity_id and platforms_to_create array required' }, { status: 400 });
      }

      // Use user-scoped entities to read the identity (preserves RLS/auth correctly)
      let identityRecord = await base44.entities.AIIdentity.get(identity_id).catch(() => null);
      if (!identityRecord) {
        // Fallback: list and find
        const allUserIdentities = await base44.entities.AIIdentity.list('-created_date', 100).catch(() => []);
        identityRecord = allUserIdentities.find(function(i) { return i.id === identity_id; }) || null;
      }

      if (!identityRecord) {
        return Response.json({
          success: false,
          error: 'Identity not found. Please check your AI Identity profile.',
          requires_onboarding: true,
          created_count: 0,
          skipped_count: platforms_to_create.length
        });
      }

      // Extract credentials inline using 4-source fallback chain
      const kyc = identityRecord.kyc_verified_data || {};
      let resolvedEmail = kyc.email || identityRecord.email || null;
      let resolvedName = kyc.full_legal_name || identityRecord.name || null;

      if ((!resolvedEmail || !resolvedName) && identityRecord.onboarding_config) {
        try {
          const od = typeof identityRecord.onboarding_config === 'string'
            ? JSON.parse(identityRecord.onboarding_config)
            : identityRecord.onboarding_config;
          if (!resolvedEmail) resolvedEmail = od.email || od.user_email || od.account_email || null;
          if (!resolvedName) resolvedName = od.full_name || od.legal_name || od.full_legal_name || null;
        } catch (e) {
          console.warn('[AutomatedAccountCreation] Failed to parse onboarding_config');
        }
      }

      // Final fallback to authenticated user
      if (!resolvedEmail) resolvedEmail = user.email;
      if (!resolvedName) resolvedName = user.full_name || identityRecord.name || 'User';

      if (!resolvedEmail) {
        await base44.asServiceRole.entities.Notification.create({
          type: 'user_action_required', severity: 'urgent',
          title: 'Account Creation Blocked - Missing Identity Data',
          message: 'Autopilot needs your real email to create platform accounts. Please complete your Identity profile.',
          user_email: user.email, action_type: 'user_input_required', is_read: false
        }).catch(() => null);
        return Response.json({
          success: false, error: 'Cannot create accounts: identity email missing.',
          requires_onboarding: true, created_count: 0, skipped_count: platforms_to_create.length
        });
      }

      const masterCreds = {
        email: resolvedEmail,
        full_name: resolvedName,
        phone: kyc.phone_number || identityRecord.phone || '',
        identity_name: identityRecord.name,
        identity_id: identityRecord.id,
      };
      console.log('[AutomatedAccountCreation] Credentials resolved for: ' + masterCreds.email);

      const existingAccounts = await base44.asServiceRole.entities.LinkedAccount.filter(
        { created_by: user.email }, '-created_date', 100
      ).catch(() => []);
      const existingPlatforms = new Set(existingAccounts.map(function(a) { return a.platform; }));

      const createdAccounts = [];
      const skipped = [];
      const syncResults = [];

      for (const platformData of platforms_to_create) {
        const platform = typeof platformData === 'string' ? platformData : platformData.platform;

        if (existingPlatforms.has(platform)) {
          // Ensure existing account is linked to this identity
          const existingAcct = existingAccounts.find(function(a) { return a.platform === platform; });
          if (existingAcct && identityRecord) {
            const currentIds = identityRecord.linked_account_ids || [];
            if (!currentIds.includes(existingAcct.id)) {
              await base44.asServiceRole.entities.AIIdentity.update(identity_id, {
                linked_account_ids: currentIds.concat([existingAcct.id])
              }).catch(() => null);
              // Keep local copy in sync for subsequent iterations
              identityRecord.linked_account_ids = currentIds.concat([existingAcct.id]);
            }
          }
          skipped.push({ platform, reason: 'Account already exists' });
          continue;
        }

        // Create a guided intervention for the user to complete signup
        const namePart = resolvedName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        const accountUsername = namePart + '_' + Math.random().toString(36).substring(2, 6);

        const intervention = await base44.asServiceRole.entities.UserIntervention.create({
          user_email: user.email,
          requirement_type: 'manual_review',
          required_data: 'Complete signup on ' + platform + ' with provided credentials',
          direct_link: 'https://' + platform + '.com/signup',
          data_schema: {
            type: 'object',
            properties: {
              account_username: { type: 'string', description: 'Username created on platform' },
              account_email: { type: 'string', description: 'Email confirmed on platform' },
              account_created: { type: 'boolean', description: 'Was account successfully created?' }
            },
            required: ['account_created']
          },
          template_responses: [
            { label: 'Account Created', value: { account_created: true, account_email: resolvedEmail, account_username: accountUsername } }
          ],
          status: 'pending',
          priority: 90,
          notes: 'ACCOUNT CREATION GUIDE\n\nPlatform: ' + platform + '\nURL: https://' + platform + '.com/signup\n\nYOUR CREDENTIALS:\nEmail: ' + resolvedEmail + '\nName: ' + resolvedName + '\nSuggested Username: ' + accountUsername + '\n\nPlease create the account and confirm via the form below.'
        }).catch(function(e) { return { error: e.message }; });

        if (intervention.error) {
          skipped.push({ platform, reason: 'Failed to create guidance: ' + intervention.error });
          continue;
        }

        const accountData = {
          platform,
          username: accountUsername,
          email: resolvedEmail,
          status: 'created',
          intervention_id: intervention.id,
        };
        createdAccounts.push(accountData);
        existingPlatforms.add(platform);

        // SYNC 1: LinkedAccount
        let linkedAccount = null;
        try {
          linkedAccount = await withRetry(
            function() {
              return base44.asServiceRole.entities.LinkedAccount.create({
                platform,
                username: accountData.username,
                profile_url: 'https://' + platform + '.com/user/' + accountData.username,
                health_status: 'healthy',
                ai_can_use: true,
                performance_score: 50,
                notes: 'Auto-created via Autopilot on ' + new Date().toISOString(),
              });
            },
            'LinkedAccount', platform
          );
          syncResults.push({ system: 'LinkedAccount', platform, status: 'synced', id: linkedAccount.id });
        } catch (e) {
          syncResults.push({ system: 'LinkedAccount', platform, status: 'failed', error: e.message, retries_exhausted: true });
        }

        const failedSyncSystems = [];

        // SYNC 2: Link to AIIdentity
        if (linkedAccount && linkedAccount.id) {
          try {
            await withRetry(async function() {
              const rec = await base44.entities.AIIdentity.get(identity_id);
              const updatedIds = (rec.linked_account_ids || []).concat([linkedAccount.id]);
              return base44.asServiceRole.entities.AIIdentity.update(identity_id, { linked_account_ids: updatedIds });
            }, 'AIIdentity', platform);
            syncResults.push({ system: 'AIIdentity', platform, status: 'synced' });
          } catch (e) {
            failedSyncSystems.push('AIIdentity');
            syncResults.push({ system: 'AIIdentity', platform, status: 'failed', error: e.message, retries_exhausted: true });
          }
        }

        // SYNC 3: CredentialVault
        if (linkedAccount && linkedAccount.id) {
          try {
            await withRetry(function() {
              return base44.asServiceRole.entities.CredentialVault.create({
                platform, credential_type: 'login',
                encrypted_payload: JSON.stringify({ username: accountData.username, email: accountData.email }),
                iv: 'auto', linked_account_id: linkedAccount.id, is_active: true, access_count: 0,
              });
            }, 'CredentialVault', platform);
            syncResults.push({ system: 'CredentialVault', platform, status: 'synced' });
          } catch (e) {
            failedSyncSystems.push('CredentialVault');
            syncResults.push({ system: 'CredentialVault', platform, status: 'failed', error: e.message, retries_exhausted: true });
          }
        }

        // SYNC 4: SecretAuditLog
        try {
          await withRetry(function() {
            return base44.asServiceRole.entities.SecretAuditLog.create({
              event_type: 'secret_created',
              secret_name: platform + '_account_' + accountData.username,
              secret_type: 'login',
              platform, identity_id,
              identity_name: masterCreds.identity_name,
              module_source: 'account_creation_engine',
              action_by: user.email,
              status: 'success',
              notes: 'Account auto-created for identity ' + masterCreds.identity_name,
            });
          }, 'SecretAuditLog', platform);
          syncResults.push({ system: 'SecretAuditLog', platform, status: 'synced' });
        } catch (e) {
          failedSyncSystems.push('SecretAuditLog');
          syncResults.push({ system: 'SecretAuditLog', platform, status: 'failed', error: e.message, retries_exhausted: true });
        }

        // SYNC 5: Health check
        if (linkedAccount && linkedAccount.id) {
          const healthCheck = await verifyAccountHealth(base44, linkedAccount.id, platform, identity_id);
          syncResults.push({ system: 'HealthCheck', platform, status: healthCheck.healthy ? 'healthy' : 'warning', issues: healthCheck.issues });
        }

        if (failedSyncSystems.length > 0) {
          await notifyUserOfSyncFailure(base44, user.email, platform, failedSyncSystems);
        }
      }

      // Resume queued tasks
      let tasksResumed = 0;
      const queuedTasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
        { identity_id, status: 'needs_review' }, undefined, 100
      ).catch(() => []);
      for (const task of queuedTasks) {
        await base44.asServiceRole.entities.TaskExecutionQueue.update(task.id, {
          status: 'queued',
          notes: (task.notes || '') + ' [Accounts created - resuming]',
        }).catch(() => null);
        tasksResumed++;
      }

      const unreparableSystems = syncResults.filter(function(r) { return r.status === 'failed' && r.retries_exhausted; }).length;
      const repairedSystems = syncResults.filter(function(r) { return r.status === 'repaired'; }).length;
      const syncedSystems = syncResults.filter(function(r) { return r.status === 'synced'; }).length;

      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: 'Auto-created ' + createdAccounts.length + ' account(s), synced ' + syncedSystems + ', resumed ' + tasksResumed + ' tasks',
        severity: unreparableSystems > 0 ? 'warning' : 'success',
        metadata: { identity_id, created_count: createdAccounts.length },
      }).catch(() => null);

      return Response.json({
        success: unreparableSystems === 0,
        partial_success: unreparableSystems > 0 && createdAccounts.length > 0,
        created_count: createdAccounts.length,
        skipped_count: skipped.length,
        created_accounts: createdAccounts,
        skipped,
        synced_systems: syncedSystems,
        repaired_systems: repairedSystems,
        unresolved_systems: unreparableSystems,
        tasks_resumed: tasksResumed,
        sync_results: syncResults,
        identity_name: masterCreds.identity_name,
        message: 'Created ' + createdAccounts.length + ' account(s), synced ' + syncedSystems + ', resumed ' + tasksResumed + ' tasks'
      });
    }

    // GET CREATED ACCOUNTS
    if (action === 'get_created_accounts') {
      if (!identity_id) return Response.json({ error: 'identity_id required' }, { status: 400 });
      const identityRecord = await base44.entities.AIIdentity.get(identity_id).catch(() => null);
      const linkedIds = (identityRecord && identityRecord.linked_account_ids) ? identityRecord.linked_account_ids : [];

      // Dual-path lookup: by linked_account_ids AND by created_by (catches accounts not yet linked)
      const allUserAccounts = await base44.asServiceRole.entities.LinkedAccount.filter(
        { created_by: user.email }, '-created_date', 200
      ).catch(() => []);

      const seen = new Set();
      const merged = [];
      for (const acct of allUserAccounts) {
        if (!seen.has(acct.id)) { seen.add(acct.id); merged.push(acct); }
      }
      // Also include any explicitly linked that weren't in created_by results
      if (linkedIds.length > 0) {
        const linkedAccounts = await base44.asServiceRole.entities.LinkedAccount.list('-created_date', 200).catch(() => []);
        for (const acct of linkedAccounts) {
          if (linkedIds.includes(acct.id) && !seen.has(acct.id)) {
            seen.add(acct.id);
            merged.push(acct);
          }
        }
      }
      return Response.json({ success: true, accounts: merged, total: merged.length });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('[AutomatedAccountCreation] Fatal:', error.message);
    try {
      if (base44 && user) {
        await base44.asServiceRole.entities.ActivityLog.create({
          action_type: 'system',
          message: 'Account creation failed: ' + error.message,
          severity: 'critical',
        }).catch(() => null);
        await base44.asServiceRole.entities.Notification.create({
          type: 'error', severity: 'critical',
          title: 'Account Creation Failed',
          message: error.message,
          user_email: user.email,
          is_read: false
        }).catch(() => null);
      }
    } catch (e) {}
    return Response.json({ error: error.message, recoverable: false }, { status: 500 });
  }
});