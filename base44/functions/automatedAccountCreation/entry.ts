/**
 * AUTOMATED ACCOUNT CREATION (Legacy + Enhanced)
 * Routes through masterAccountCredentialEngine for real data.
 * NEVER uses fabricated emails, fake passwords, or simulated usernames.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * SYNC FAILURE RECOVERY ENGINE
 * Implements exponential backoff retry, cascade safety, and health verification
 */
const RETRY_CONFIG = { maxAttempts: 3, baseDelayMs: 500 };

async function withRetry(fn, systemName, platform, maxAttempts = RETRY_CONFIG.maxAttempts) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt < maxAttempts) {
        const delay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt - 1);
        console.warn(`[Sync] ${systemName} retry ${attempt}/${maxAttempts} after ${delay}ms for ${platform}: ${e.message}`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

async function notifyUserOfSyncFailure(base44, userEmail, platform, failedSystems) {
  try {
    await base44.asServiceRole.entities.Notification.create({
      type: 'warning',
      severity: 'warning',
      title: `⚠️ Account Sync Issues for ${platform}`,
      message: `Account was created but failed to sync to: ${failedSystems.join(', ')}. This may impact Autopilot execution.`,
      user_email: userEmail,
      action_type: 'account_sync_failed',
      is_read: false
    }).catch(() => null);
  } catch (e) {
    console.error('Failed to notify user of sync failure:', e.message);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, identity_id, platforms_to_create } = await req.json();

    // ── get_platform_list ──────────────────────────────────────────────────────
    if (action === 'get_platform_list') {
      const platforms = [
        { platform: 'upwork', label: 'Upwork', description: 'Freelance job marketplace', priority: 1, skills_required: true, profile_building: true },
        { platform: 'fiverr', label: 'Fiverr', description: 'Gig-based freelance platform', priority: 2, skills_required: true, profile_building: true },
        { platform: 'freelancer', label: 'Freelancer.com', description: 'Freelance marketplace', priority: 3, skills_required: true, profile_building: true },
        { platform: 'guru', label: 'Guru', description: 'Professional freelance marketplace', priority: 4, skills_required: true, profile_building: true },
        { platform: 'peopleperhour', label: 'PeoplePerHour', description: 'UK-based freelance platform', priority: 5, skills_required: true, profile_building: true },
        { platform: 'github', label: 'GitHub', description: 'Code portfolio & collaboration', priority: 6, skills_required: false, profile_building: false },
        { platform: 'ebay', label: 'eBay', description: 'Buy/sell marketplace', priority: 7, skills_required: false, profile_building: false },
        { platform: 'etsy', label: 'Etsy', description: 'Creative goods marketplace', priority: 8, skills_required: false, profile_building: false },
      ];
      return Response.json({ success: true, platforms, total: platforms.length });
    }

    // ── create_accounts ────────────────────────────────────────────────────────
    if (action === 'create_accounts') {
      if (!identity_id || !Array.isArray(platforms_to_create)) {
        return Response.json({ error: 'identity_id and platforms_to_create array required' }, { status: 400 });
      }

      // Resolve real master credentials — no fabrication allowed
      const credResult = await base44.functions.invoke('masterAccountCredentialEngine', {
        action: 'get_master_credentials',
        identity_id
      }).catch(e => ({ data: { success: false, error: e.message } }));

      if (!credResult.data?.success || !credResult.data?.credentials?.email) {
        // Trigger intervention — cannot proceed without real email
        await base44.asServiceRole.entities.Notification.create({
          type: 'user_action_required',
          severity: 'urgent',
          title: '⚠️ Account Creation Blocked — Missing Identity Data',
          message: 'Autopilot needs your real email and name to create platform accounts. Please complete your Identity profile.',
          user_email: user.email,
          action_type: 'user_input_required',
          is_read: false
        }).catch(() => null);

        return Response.json({
          success: false,
          error: 'Cannot create accounts: identity email missing. Please update your AI Identity profile.',
          requires_onboarding: true,
          created_count: 0,
          skipped_count: platforms_to_create.length
        });
      }

      const masterCreds = credResult.data.credentials;

      // Check existing accounts
      const existingAccounts = await base44.asServiceRole.entities.LinkedAccount.filter(
        { created_by: user.email }, '-created_date', 100
      ).catch(() => []);
      const existingPlatforms = new Set(existingAccounts.map(a => a.platform));

      const createdAccounts = [];
      const skipped = [];
      const syncResults = [];

      for (const platformData of platforms_to_create) {
        const platform = typeof platformData === 'string' ? platformData : platformData.platform;

        if (existingPlatforms.has(platform)) {
          skipped.push({ platform, reason: 'Account already exists' });
          continue;
        }

        // Delegate to autonomous engine for real account creation
        const creationResult = await base44.functions.invoke('autonomousAccountCreationEngine', {
          action: 'auto_create_account',
          identityId: identity_id,
          opportunity: {
            platform,
            url: `https://${platform}.com/signup`,
            id: `manual_${platform}_${Date.now()}`
          }
        }).catch(e => ({ data: { success: false, error: e.message } }));

        if (creationResult.data?.success) {
          const accountData = {
            platform,
            username: masterCreds.username || creationResult.data?.account?.username,
            email: masterCreds.email,
            status: 'created',
            account_id: creationResult.data?.account_id
          };
          createdAccounts.push(accountData);
          existingPlatforms.add(platform);

          // ── SYNC 1: Register in LinkedAccount (with retry) ──
          let linkedAccount = null;
          try {
            linkedAccount = await withRetry(
              () => base44.asServiceRole.entities.LinkedAccount.create({
                platform,
                username: accountData.username,
                profile_url: `https://${platform}.com/user/${accountData.username}`,
                health_status: 'healthy',
                ai_can_use: true,
                performance_score: 50,
                notes: `Auto-created via Autopilot on ${new Date().toISOString()}`,
              }),
              'LinkedAccount',
              platform
            );
            syncResults.push({ system: 'LinkedAccount', platform, status: 'synced', id: linkedAccount.id });
          } catch (e) {
            console.error(`[AutoAccountCreation] LinkedAccount sync permanently failed for ${platform}:`, e.message);
            syncResults.push({ system: 'LinkedAccount', platform, status: 'failed', error: e.message, retries_exhausted: true });
          }

          // ── SYNC 2: Update Identity with linked account (with retry) ──
          if (linkedAccount?.id) {
            try {
              await withRetry(
                async () => {
                  const identity = await base44.entities.AIIdentity.get(identity_id);
                  const updatedLinkedIds = [...(identity.linked_account_ids || []), linkedAccount.id];
                  return base44.asServiceRole.entities.AIIdentity.update(identity_id, {
                    linked_account_ids: updatedLinkedIds,
                  });
                },
                'AIIdentity',
                platform
              );
              syncResults.push({ system: 'AIIdentity', platform, status: 'synced' });
            } catch (e) {
              console.error(`[AutoAccountCreation] AIIdentity sync permanently failed for ${platform}:`, e.message);
              syncResults.push({ system: 'AIIdentity', platform, status: 'failed', error: e.message, retries_exhausted: true });
            }
          } else {
            syncResults.push({ system: 'AIIdentity', platform, status: 'skipped', reason: 'LinkedAccount creation failed' });
          }

          // ── SYNC 3: Create credential vault entry (with retry) ──
          if (linkedAccount?.id) {
            try {
              await withRetry(
                () => base44.asServiceRole.entities.CredentialVault.create({
                  platform,
                  credential_type: 'login',
                  encrypted_payload: JSON.stringify({ username: accountData.username, email: accountData.email }),
                  iv: 'auto',
                  linked_account_id: linkedAccount.id,
                  is_active: true,
                  access_count: 0,
                }),
                'CredentialVault',
                platform
              );
              syncResults.push({ system: 'CredentialVault', platform, status: 'synced' });
            } catch (e) {
              console.error(`[AutoAccountCreation] CredentialVault sync permanently failed for ${platform}:`, e.message);
              syncResults.push({ system: 'CredentialVault', platform, status: 'failed', error: e.message, retries_exhausted: true });
            }
          } else {
            syncResults.push({ system: 'CredentialVault', platform, status: 'skipped', reason: 'LinkedAccount creation failed' });
          }

          // ── SYNC 4: Log in SecretAuditLog (with retry) ──
          try {
            await withRetry(
              () => base44.asServiceRole.entities.SecretAuditLog.create({
                event_type: 'secret_created',
                secret_name: `${platform}_account_${accountData.username}`,
                secret_type: 'login',
                platform,
                identity_id,
                identity_name: masterCreds.identity_name,
                module_source: 'account_creation_engine',
                action_by: user.email,
                status: 'success',
                notes: `Account auto-created for identity ${masterCreds.identity_name}`,
              }),
              'SecretAuditLog',
              platform
            );
            syncResults.push({ system: 'SecretAuditLog', platform, status: 'synced' });
          } catch (e) {
            console.error(`[AutoAccountCreation] SecretAuditLog sync permanently failed for ${platform}:`, e.message);
            syncResults.push({ system: 'SecretAuditLog', platform, status: 'failed', error: e.message, retries_exhausted: true });
          }
        } else {
          skipped.push({ platform, reason: creationResult.data?.error || 'Creation failed' });
        }
      }

      // ── SYNC 5: Resume queued tasks for this identity ──
      let tasksResumed = 0;
      try {
        const queuedTasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
          { identity_id, status: 'needs_review' },
          undefined,
          100
        ).catch(() => []);

        for (const task of queuedTasks) {
          await base44.asServiceRole.entities.TaskExecutionQueue.update(task.id, {
            status: 'queued',
            notes: `${task.notes || ''} [Account(s) created - resuming from needs_review]`,
          }).catch(() => null);
          tasksResumed++;
        }
        if (tasksResumed > 0) {
          syncResults.push({ system: 'TaskExecutionQueue', status: 'synced', resumed_count: tasksResumed });
        }
      } catch (e) {
        syncResults.push({ system: 'TaskExecutionQueue', status: 'failed', error: e.message });
      }

      // ── SYNC 6: Check for sync failures and notify user ──
      const failedSystems = syncResults
        .filter(r => r.status === 'failed')
        .map(r => `${r.system}`);

      if (failedSystems.length > 0) {
        for (const accountData of createdAccounts) {
          const accountFailures = syncResults
            .filter(r => r.status === 'failed' && r.platform === accountData.platform)
            .map(r => r.system);
          if (accountFailures.length > 0) {
            await notifyUserOfSyncFailure(base44, user.email, accountData.platform, accountFailures);
          }
        }
      }

      // ── SYNC 7: Log activity ──
      try {
        const activitySeverity = failedSystems.length > 0 ? 'warning' : 'success';
        const activityMessage = failedSystems.length > 0
          ? `⚠️ Partial sync: Auto-created ${createdAccounts.length} account(s), failed to sync: ${failedSystems.join(', ')}`
          : `✅ Auto-created ${createdAccounts.length} account(s), synced to all systems, resumed ${tasksResumed} tasks`;

        await base44.asServiceRole.entities.ActivityLog.create({
          action_type: 'system',
          message: activityMessage,
          severity: activitySeverity,
          metadata: { identity_id, created_count: createdAccounts.length, sync_systems: syncResults.length, failed_systems: failedSystems.length },
        });
      } catch (e) {
        console.error('Failed to log activity:', e.message);
      }

      const syncedSystems = syncResults.filter(r => r.status === 'synced').length;
      const failedSystemsCount = syncResults.filter(r => r.status === 'failed').length;

      return Response.json({
        success: failedSystemsCount === 0,
        partial_success: failedSystemsCount > 0 && createdAccounts.length > 0,
        created_count: createdAccounts.length,
        skipped_count: skipped.length,
        created_accounts: createdAccounts,
        skipped,
        synced_systems: syncedSystems,
        failed_systems: failedSystemsCount,
        tasks_resumed: tasksResumed,
        sync_results: syncResults,
        identity_name: masterCreds.identity_name,
        message: failedSystemsCount > 0
          ? `✓ Created ${createdAccounts.length} account(s) but ${failedSystemsCount} sync(s) failed. User notified.`
          : `✓ Created ${createdAccounts.length} account(s), synced to ${syncedSystems} systems, resumed ${tasksResumed} tasks`
      });
    }

    // ── get_created_accounts ───────────────────────────────────────────────────
    if (action === 'get_created_accounts') {
      if (!identity_id) return Response.json({ error: 'identity_id required' }, { status: 400 });

      const accounts = await base44.asServiceRole.entities.LinkedAccount.filter(
        { id: { $in: (await base44.entities.AIIdentity.get(identity_id).catch(() => ({ linked_account_ids: [] }))).linked_account_ids || [] } },
        '-created_date',
        50
      ).catch(() => []);

      return Response.json({ success: true, accounts, total: accounts.length });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[AutomatedAccountCreation]', error.message);
    // Log critical failure and notify user
    await Promise.all([
      base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `❌ Auto-account creation failed: ${error.message}`,
        severity: 'critical',
      }).catch(() => null),
      base44.asServiceRole.entities.Notification.create({
        type: 'error',
        severity: 'critical',
        title: '❌ Account Creation Failed',
        message: `Auto-account creation encountered a fatal error: ${error.message}. Please try again or contact support.`,
        user_email: user?.email,
        action_type: 'account_creation_failed',
        is_read: false
      }).catch(() => null)
    ]);
    return Response.json({ error: error.message, recoverable: false }, { status: 500 });
  }
});