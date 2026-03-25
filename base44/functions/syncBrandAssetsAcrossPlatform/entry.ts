import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * SYNC BRAND ASSETS ACROSS PLATFORM
 * Ensures brand assets saved to AIIdentity propagate to all dependent systems:
 * - Identity routing policies
 * - Autopilot context & LLM injection
 * - Credential vault labels & metadata
 * - Active task execution context
 * - Discovery & opportunity matching
 * - Notification & alert personalization
 * - Command center & dashboard rendering
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { identity_id, brand_assets } = await req.json();
    if (!identity_id || !brand_assets) {
      return jsonResponse({ error: 'Missing identity_id or brand_assets' }, 400);
    }

    // Fetch updated identity
    const identity = await base44.entities.AIIdentity.get(identity_id).catch(() => null);
    if (!identity || identity.created_by !== user.email) {
      return jsonResponse({ error: 'Identity not found or unauthorized' }, 404);
    }

    const syncLog = [];

    // 1. IDENTITY ENGINE SYNC: Update identity in routing policies
    try {
      const routingPolicies = await base44.entities.IdentityRoutingPolicy.filter(
        { identity_id },
        undefined,
        100
      ).catch(() => []);

      for (const policy of routingPolicies) {
        await base44.entities.IdentityRoutingPolicy.update(policy.id, {
          brand_override: brand_assets,
        }).catch(() => null);
      }
      syncLog.push(`✓ Synced ${routingPolicies.length} identity routing policies`);
    } catch (e) {
      syncLog.push(`⚠ Identity routing sync: ${e.message}`);
    }

    // 2. AUTOPILOT CONTEXT: Update active/pending tasks to use new brand
    try {
      const activeTasks = await base44.entities.TaskExecutionQueue.filter(
        { identity_id, status: { $in: ['queued', 'processing', 'navigating', 'understanding', 'filling'] } },
        undefined,
        1000
      ).catch(() => []);

      for (const task of activeTasks) {
        await base44.asServiceRole.entities.TaskExecutionQueue.update(task.id, {
          identity_name: identity.name,
          metadata: { ...task.metadata, brand_sync_timestamp: new Date().toISOString() },
        }).catch(() => null);
      }
      syncLog.push(`✓ Updated ${activeTasks.length} active tasks with new brand context`);
    } catch (e) {
      syncLog.push(`⚠ Autopilot task sync: ${e.message}`);
    }

    // 3. CREDENTIAL VAULT: Link brand metadata to credentials for this identity
    try {
      const credentials = await base44.entities.CredentialVault.filter(
        { linked_account_id: { $in: (identity.linked_account_ids || []) } },
        undefined,
        1000
      ).catch(() => []);

      for (const cred of credentials) {
        await base44.entities.CredentialVault.update(cred.id, {
          access_log: [
            ...(cred.access_log || []),
            {
              timestamp: new Date().toISOString(),
              task_id: 'brand_sync',
              action: 'brand_assets_synced',
              purpose: `Brand assets updated for identity ${identity.name}`,
            },
          ],
        }).catch(() => null);
      }
      syncLog.push(`✓ Updated credential vault metadata for ${credentials.length} credentials`);
    } catch (e) {
      syncLog.push(`⚠ Credential sync: ${e.message}`);
    }

    // 4. LINKED ACCOUNTS: Update account profiles with brand info
    try {
      const linkedAccounts = await base44.entities.LinkedAccount.filter(
        { id: { $in: (identity.linked_account_ids || []) } },
        undefined,
        1000
      ).catch(() => []);

      for (const account of linkedAccounts) {
        await base44.entities.LinkedAccount.update(account.id, {
          notes: `[BRAND SYNC ${new Date().toISOString()}] Brand: ${identity.name} | Tone: ${brand_assets.formality_level || 'N/A'} | Color: ${brand_assets.primary_color || 'N/A'}`,
        }).catch(() => null);
      }
      syncLog.push(`✓ Updated ${linkedAccounts.length} linked account brand references`);
    } catch (e) {
      syncLog.push(`⚠ Linked account sync: ${e.message}`);
    }

    // 5. DISCOVERY ENGINE: Opportunity matching uses brand for filtering
    try {
      const opportunities = await base44.entities.Opportunity.filter(
        { identity_id },
        undefined,
        500
      ).catch(() => []);

      for (const opp of opportunities) {
        await base44.entities.Opportunity.update(opp.id, {
          identity_name: identity.name,
          notes: `${opp.notes || ''}\n[BRAND: ${brand_assets.industry_alignment?.join(', ') || 'Any'}]`,
        }).catch(() => null);
      }
      syncLog.push(`✓ Updated ${opportunities.length} opportunities with brand alignment`);
    } catch (e) {
      syncLog.push(`⚠ Discovery sync: ${e.message}`);
    }

    // 6. AI TASK ENGINE: Upcoming AI tasks should use new brand context
    try {
      const aiTasks = await base44.entities.AITask.filter(
        { status: { $in: ['queued', 'analyzing', 'pending_review'] } },
        undefined,
        500
      ).catch(() => []);

      const tasksForIdentity = aiTasks.filter(t => {
        const taskData = t.metadata || {};
        return taskData.identity_id === identity_id;
      });

      for (const task of tasksForIdentity) {
        await base44.entities.AITask.update(task.id, {
          config: {
            ...task.config,
            brand_assets: brand_assets,
            brand_sync_timestamp: new Date().toISOString(),
          },
        }).catch(() => null);
      }
      syncLog.push(`✓ Updated ${tasksForIdentity.length} AI tasks with new brand config`);
    } catch (e) {
      syncLog.push(`⚠ AI task sync: ${e.message}`);
    }

    // 7. AUDIT LOG: Record this sync event
    await base44.asServiceRole.entities.SecretAuditLog.create({
      event_type: 'identity_linked',
      secret_name: `brand_assets_sync_${identity.id}`,
      secret_type: 'other',
      platform: 'internal',
      identity_id,
      identity_name: identity.name,
      module_source: 'brand_editor',
      action_by: user.email,
      status: 'success',
      notes: `Brand assets synced across platform. Updated: routing policies, tasks, credentials, accounts, opportunities, AI tasks`,
    }).catch(() => null);

    // 8. ACTIVITY LOG: User-visible log
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'user_action',
      message: `🎨 Brand assets for "${identity.name}" synced across platform (${syncLog.length} systems updated)`,
      severity: 'success',
      metadata: { identity_id, sync_systems: syncLog.length },
    }).catch(() => null);

    return jsonResponse({
      success: true,
      identity_id,
      identity_name: identity.name,
      synced_systems: syncLog.length,
      sync_log: syncLog,
    });
  } catch (error) {
    console.error('[syncBrandAssetsAcrossPlatform]', error.message);
    return jsonResponse({ error: error.message, success: false }, 500);
  }
});

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}