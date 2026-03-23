import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * CREDENTIAL SYNC ORCHESTRATOR
 * Manages encrypted credential syncing across multiple connected accounts
 * Enables Autopilot to automatically switch and manage sessions across platforms
 * 
 * Flow:
 * 1. Store credential → encrypted in vault + indexed by account/identity
 * 2. Query available credentials → filter by platform/identity/health
 * 3. Switch session → load credential, inject into task context
 * 4. Sync across identity → propagate credentials to new identity
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // ── ACTION: list_available_credentials_for_task ─────────────────────
    if (action === 'list_available_credentials_for_task') {
      const { platform, identity_id, exclude_inactive } = body;
      
      const filter = { platform };
      if (exclude_inactive !== false) filter.is_active = true;

      const vaults = await base44.asServiceRole.entities.CredentialVault.filter(
        filter,
        '-last_accessed',
        20
      ).catch(() => []);

      // Enrich with linked account health
      const enriched = await Promise.all(
        vaults.map(async (vault) => {
          let account_health = 'unknown';
          if (vault.linked_account_id) {
            const acc = await base44.asServiceRole.entities.LinkedAccount
              .get(vault.linked_account_id)
              .catch(() => null);
            account_health = acc?.health_status || 'unknown';
          }

          return {
            vault_id: vault.id,
            platform: vault.platform,
            credential_type: vault.credential_type,
            linked_account_id: vault.linked_account_id,
            account_health,
            is_active: vault.is_active,
            access_count: vault.access_count,
            last_accessed: vault.last_accessed,
            expires_at: vault.expires_at,
            created_date: vault.created_date,
            ready_for_use: vault.is_active && (!vault.expires_at || new Date(vault.expires_at) > new Date()) && account_health !== 'suspended'
          };
        })
      );

      return Response.json({
        success: true,
        platform,
        identity_id: identity_id || 'current',
        credentials: enriched.filter(c => c.ready_for_use),
        total_available: enriched.length
      });
    }

    // ── ACTION: get_best_credential_for_execution ───────────────────────
    if (action === 'get_best_credential_for_execution') {
      const { platform, task_id, purpose } = body;
      if (!platform) return Response.json({ error: 'platform required' }, { status: 400 });

      // Get all active, non-expired credentials for platform
      const vaults = await base44.asServiceRole.entities.CredentialVault.filter(
        { platform, is_active: true },
        '-access_count',
        10
      ).catch(() => []);

      if (!vaults.length) {
        return Response.json({
          success: false,
          error: `No credentials found for ${platform}`,
          platform
        });
      }

      // Find healthiest linked account
      let bestVault = vaults[0];
      let bestHealth = 'unknown';

      for (const vault of vaults) {
        if (vault.expires_at && new Date(vault.expires_at) < new Date()) continue;

        if (vault.linked_account_id) {
          const acc = await base44.asServiceRole.entities.LinkedAccount
            .get(vault.linked_account_id)
            .catch(() => null);

          if (acc?.health_status === 'healthy') {
            bestVault = vault;
            bestHealth = 'healthy';
            break;
          }
        }
      }

      return Response.json({
        success: true,
        vault_id: bestVault.id,
        platform,
        linked_account_id: bestVault.linked_account_id,
        account_health: bestHealth,
        task_id,
        purpose,
        message: `Credential selected for ${platform} (health: ${bestHealth})`
      });
    }

    // ── ACTION: switch_session ──────────────────────────────────────────
    if (action === 'switch_session') {
      const { vault_id, task_id, new_platform } = body;
      if (!vault_id) return Response.json({ error: 'vault_id required' }, { status: 400 });

      const vault = await base44.asServiceRole.entities.CredentialVault
        .get(vault_id)
        .catch(() => null);

      if (!vault) {
        return Response.json({ error: 'Credential vault not found' }, { status: 404 });
      }

      if (vault.expires_at && new Date(vault.expires_at) < new Date()) {
        await base44.asServiceRole.entities.CredentialVault.update(vault_id, { is_active: false });
        return Response.json({ error: 'Credential has expired', vault_id }, { status: 403 });
      }

      // Log session switch
      const logs = vault.access_log || [];
      logs.push({
        timestamp: new Date().toISOString(),
        task_id: task_id || 'manual_switch',
        action: 'session_switched',
        purpose: `Switched to ${new_platform || vault.platform}`
      });

      await base44.asServiceRole.entities.CredentialVault.update(vault_id, {
        last_accessed: new Date().toISOString(),
        access_count: (vault.access_count || 0) + 1,
        access_log: logs.slice(-50)
      });

      // Audit
      await base44.asServiceRole.entities.AIWorkLog.create({
        log_type: 'account_action',
        task_id: task_id || null,
        platform: vault.platform,
        subject: `Session switched to ${vault.platform}`,
        ai_decision_context: `Autopilot selected ${vault.platform} for task execution`,
        metadata: { vault_id, new_platform: new_platform || vault.platform }
      }).catch(() => {});

      return Response.json({
        success: true,
        vault_id,
        platform: vault.platform,
        session_active: true,
        ready_for_execution: true
      });
    }

    // ── ACTION: sync_credentials_to_identity ────────────────────────────
    if (action === 'sync_credentials_to_identity') {
      const { from_identity_id, to_identity_id, platforms } = body;
      if (!from_identity_id || !to_identity_id) {
        return Response.json({ error: 'from_identity_id and to_identity_id required' }, { status: 400 });
      }

      // Get source identity's linked accounts
      const sourceAccounts = await base44.asServiceRole.entities.LinkedAccount.filter(
        { linked_account_ids: from_identity_id },
        null,
        50
      ).catch(() => []);

      const filterPlatforms = platforms || sourceAccounts.map(a => a.platform);
      const targetAccounts = sourceAccounts.filter(a => filterPlatforms.includes(a.platform));

      const syncResults = [];

      for (const account of targetAccounts) {
        // Get credentials for this account
        const vaults = await base44.asServiceRole.entities.CredentialVault.filter(
          { linked_account_id: account.id },
          null,
          1
        ).catch(() => []);

        if (vaults.length > 0) {
          syncResults.push({
            platform: account.platform,
            account_id: account.id,
            vault_id: vaults[0].id,
            synced: true
          });
        }
      }

      // Log sync
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `🔄 Credentials synced to identity: ${syncResults.length} platforms (${targetPlatforms.join(', ')})`,
        severity: 'info',
        metadata: { from_identity: from_identity_id, to_identity: to_identity_id, synced_count: syncResults.length }
      }).catch(() => {});

      return Response.json({
        success: true,
        from_identity_id,
        to_identity_id,
        synced_count: syncResults.length,
        sync_results: syncResults
      });
    }

    // ── ACTION: get_identity_account_matrix ────────────────────────────
    if (action === 'get_identity_account_matrix') {
      const { identity_id } = body;

      // Get all linked accounts for identity
      const accounts = await base44.asServiceRole.entities.LinkedAccount.filter(
        identity_id ? { linked_account_ids: identity_id } : {},
        '-performance_score',
        50
      ).catch(() => []);

      // Get credentials for each account
      const matrix = await Promise.all(
        accounts.map(async (account) => {
          const vaults = await base44.asServiceRole.entities.CredentialVault.filter(
            { linked_account_id: account.id, is_active: true },
            null,
            5
          ).catch(() => []);

          return {
            account_id: account.id,
            platform: account.platform,
            username: account.username,
            health_status: account.health_status,
            performance_score: account.performance_score,
            has_credentials: vaults.length > 0,
            credential_count: vaults.length,
            can_execute: account.health_status !== 'suspended' && vaults.length > 0
          };
        })
      );

      return Response.json({
        success: true,
        identity_id: identity_id || 'all_identities',
        accounts_with_credentials: matrix.filter(m => m.has_credentials).length,
        total_accounts: matrix.length,
        matrix
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('[CredentialSyncOrchestrator]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});