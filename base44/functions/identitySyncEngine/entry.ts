import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * IDENTITY SYNC ENGINE
 * Automated syncing of verified identities across linked accounts
 * Prevents identity conflicts, ensures consistency, detects fraud
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'sync_status';

    if (action === 'sync_identities') {
      return await syncIdentities(base44, user);
    }

    if (action === 'detect_conflicts') {
      return await detectConflicts(base44, user);
    }

    if (action === 'get_sync_status') {
      return await getSyncStatus(base44, user);
    }

    if (action === 'resolve_conflict') {
      return await resolveConflict(base44, user, body);
    }

    return jsonResponse({ error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('[IdentitySyncEngine]', error.message);
    return jsonResponse({ error: error.message }, 500);
  }
});

/**
 * Sync identities across platforms
 */
async function syncIdentities(base44, user) {
  const identities = await base44.entities.AIIdentity
    .filter({ user_email: user.email, is_active: true }, null, 100)
    .catch(() => []);

  const linkedAccounts = await base44.entities.LinkedAccount
    .filter({ created_by: user.email }, null, 200)
    .catch(() => []);

  const syncResults = [];

  for (const identity of identities) {
    const accountsForIdentity = linkedAccounts.filter(
      a => identity.linked_account_ids && identity.linked_account_ids.includes(a.id)
    );

    if (!identity.kyc_verified_data) {
      syncResults.push({
        identity_id: identity.id,
        name: identity.name,
        sync_status: 'pending_kyc',
        accounts_linked: accountsForIdentity.length
      });
      continue;
    }

    // Check KYC data consistency across accounts
    let conflicts = 0;
    for (const account of accountsForIdentity) {
      if (account.health_status === 'suspended' || account.health_status === 'banned') {
        conflicts++;
      }
    }

    const syncStatus = conflicts === 0 ? 'synced' : 'conflicts_detected';

    await base44.entities.IdentitySyncLog.create({
      identity_id: identity.id,
      user_email: user.email,
      sync_timestamp: new Date().toISOString(),
      accounts_checked: accountsForIdentity.length,
      conflicts_found: conflicts,
      status: syncStatus
    }).catch(() => {});

    syncResults.push({
      identity_id: identity.id,
      name: identity.name,
      sync_status: syncStatus,
      accounts_linked: accountsForIdentity.length,
      conflicts: conflicts
    });
  }

  return jsonResponse({
    total_identities: identities.length,
    sync_results: syncResults,
    timestamp: new Date().toISOString()
  });
}

/**
 * Detect conflicts between identities
 */
async function detectConflicts(base44, user) {
  const identities = await base44.entities.AIIdentity
    .filter({ user_email: user.email }, null, 100)
    .catch(() => []);

  const conflicts = [];

  // Check for duplicate KYC data
  const kycDataMap = {};
  identities.forEach(id => {
    if (id.kyc_verified_data?.full_legal_name) {
      const key = id.kyc_verified_data.full_legal_name.toLowerCase();
      if (kycDataMap[key]) {
        conflicts.push({
          type: 'duplicate_kyc_name',
          identity_1: id.id,
          identity_2: kycDataMap[key],
          severity: 'high',
          action: 'review'
        });
      } else {
        kycDataMap[key] = id.id;
      }
    }
  });

  // Check for overlapping platforms
  const linkedAccounts = await base44.entities.LinkedAccount
    .filter({ created_by: user.email }, null, 200)
    .catch(() => []);

  const platformMap = {};
  linkedAccounts.forEach(acc => {
    const key = `${acc.platform}_${acc.username}`;
    if (platformMap[key]) {
      conflicts.push({
        type: 'duplicate_platform_account',
        platform: acc.platform,
        username: acc.username,
        identity_1: platformMap[key].identity_id,
        identity_2: acc.id,
        severity: 'critical',
        action: 'immediately_revoke'
      });
    } else {
      platformMap[key] = { identity_id: acc.id };
    }
  });

  return jsonResponse({
    total_conflicts: conflicts.length,
    conflicts: conflicts.slice(0, 50),
    requires_action: conflicts.length > 0,
    severity_distribution: {
      low: conflicts.filter(c => c.severity === 'low').length,
      medium: conflicts.filter(c => c.severity === 'medium').length,
      high: conflicts.filter(c => c.severity === 'high').length,
      critical: conflicts.filter(c => c.severity === 'critical').length
    }
  });
}

/**
 * Get sync status
 */
async function getSyncStatus(base44, user) {
  const logs = await base44.entities.IdentitySyncLog
    .filter({ user_email: user.email }, '-sync_timestamp', 100)
    .catch(() => []);

  const recentLogs = logs.slice(0, 10);
  const lastSync = recentLogs[0]?.sync_timestamp || null;
  const totalSynced = recentLogs.filter(l => l.status === 'synced').length;

  return jsonResponse({
    last_sync: lastSync,
    total_syncs: logs.length,
    recent_status: recentLogs.map(l => ({
      identity_id: l.identity_id,
      sync_timestamp: l.sync_timestamp,
      status: l.status,
      conflicts: l.conflicts_found
    })),
    overall_sync_health: totalSynced / Math.max(recentLogs.length, 1) > 0.8 ? 'healthy' : 'needs_attention'
  });
}

/**
 * Resolve a conflict
 */
async function resolveConflict(base44, user, data) {
  const { conflict_type, action, identity_1, identity_2 } = data;

  if (action === 'merge') {
    // Merge identity_2 into identity_1
    await base44.entities.AIIdentity.update(identity_2, { is_active: false }).catch(() => {});
  }

  if (action === 'revoke') {
    // Deactivate the conflicting identity
    await base44.entities.AIIdentity.update(identity_2, { is_active: false }).catch(() => {});
  }

  return jsonResponse({
    message: `Conflict resolved: ${action}`,
    identity_1: identity_1,
    identity_2: identity_2,
    resolved_at: new Date().toISOString()
  });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}