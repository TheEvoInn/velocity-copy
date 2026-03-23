import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * AUTOMATED CONFLICT RESOLVER
 * Detects and auto-resolves duplicate/conflicting identities with 24h warning
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'detect_conflicts';

    if (action === 'detect_conflicts') {
      return await detectConflicts(base44, user);
    }

    if (action === 'get_pending_resolutions') {
      return await getPendingResolutions(base44, user);
    }

    if (action === 'resolve_conflict' || action === 'merge' || action === 'revoke') {
      return await resolveConflict(base44, user, body);
    }

    if (action === 'auto_resolve_all') {
      return await autoResolveAll(base44, user);
    }

    return jsonResponse({ error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('[AutomatedConflictResolver]', error.message);
    return jsonResponse({ error: error.message }, 500);
  }
});

/**
 * Detect identity conflicts (duplicates, overlapping accounts, etc.)
 */
async function detectConflicts(base44, user) {
  try {
    const identities = await base44.entities.AIIdentity
      .filter({ user_email: user.email }, null, 100)
      .catch((err) => {
        console.error('[AIIdentity Detect]', err.message);
        return [];
      });

    const conflicts = [];

    // Check 1: Duplicate KYC data
    const kycMap = {};
    identities.forEach(id => {
      const kycKey = id.kyc_status + '|' + (id.ssn_hash || 'none');
      if (kycMap[kycKey]) {
        conflicts.push({
          type: 'duplicate_kyc',
          identity_1: kycMap[kycKey].id,
          identity_1_name: kycMap[kycKey].name,
          identity_2: id.id,
          identity_2_name: id.name,
          severity: 'critical'
        });
      } else {
        kycMap[kycKey] = id;
      }
    });

    // Check 2: Linked account overlap
    const linkedAccounts = await base44.entities.LinkedAccount
      .filter({ created_by: user.email }, null, 200)
      .catch((err) => {
        console.error('[LinkedAccount Detect]', err.message);
        return [];
      });

    const accountMap = {};
    linkedAccounts.forEach(acc => {
      const key = acc.platform + '|' + acc.username;
      if (accountMap[key]) {
        const id1 = identities.find(id => id.linked_accounts?.includes(accountMap[key].id));
        const id2 = identities.find(id => id.linked_accounts?.includes(acc.id));
        if (id1 && id2 && id1.id !== id2.id) {
          conflicts.push({
            type: 'account_overlap',
            identity_1: id1.id,
            identity_1_name: id1.name,
            identity_2: id2.id,
            identity_2_name: id2.name,
            platform: acc.platform,
            username: acc.username,
            severity: 'high'
          });
        }
      } else {
        accountMap[key] = acc;
      }
    });

    // Check 3: Simultaneous cooldown (both on same platform with cooldown)
    const platformCooldowns = {};
    identities.forEach(id => {
      if (id.cooldown_until && new Date(id.cooldown_until) > new Date()) {
        const platform = id.preferred_platform || 'unknown';
        if (platformCooldowns[platform]) {
          conflicts.push({
            type: 'simultaneous_cooldown',
            identity_1: platformCooldowns[platform].id,
            identity_1_name: platformCooldowns[platform].name,
            identity_2: id.id,
            identity_2_name: id.name,
            platform,
            severity: 'medium'
          });
        } else {
          platformCooldowns[platform] = id;
        }
      }
    });

    // Log conflicts detected
    if (conflicts.length > 0) {
      await base44.entities.ComplianceAuditLog
        .create({
          user_email: user.email,
          action_type: 'conflict_detection',
          entity_type: 'AIIdentity',
          details: { conflicts_found: conflicts.length, conflicts },
          risk_level: conflicts.some(c => c.severity === 'critical') ? 'critical' : 'high',
          timestamp: new Date().toISOString()
        })
        .catch((err) => {
          console.error('[ConflictLog Create]', err.message);
        });
    }

    return jsonResponse({
      total_conflicts: conflicts.length,
      conflicts: conflicts,
      action_required: conflicts.length > 0
    });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

/**
 * Get pending resolutions (24h warning period)
 */
async function getPendingResolutions(base44, user) {
  try {
    const logs = await base44.entities.ComplianceAuditLog
      .filter({ user_email: user.email, action_type: 'conflict_detection' }, '-timestamp', 100)
      .catch((err) => {
        console.error('[ConflictLog Get]', err.message);
        return [];
      });

    const last24h = new Date(Date.now() - 86400000).toISOString();
    const pending = logs.filter(l => l.timestamp > last24h).map(l => ({
      logged_at: l.timestamp,
      conflicts: l.details?.conflicts || [],
      warning_expires_at: new Date(new Date(l.timestamp).getTime() + 86400000).toISOString()
    }));

    return jsonResponse({
      pending_resolutions: pending.length,
      resolutions: pending
    });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

/**
 * Resolve specific conflict
 */
async function resolveConflict(base44, user, data) {
  const { identity_1, identity_2, action = 'merge' } = data;

  if (!identity_1 || !identity_2) {
    return jsonResponse({ error: 'identity_1 and identity_2 required' }, 400);
  }

  try {
    const id1 = await base44.entities.AIIdentity
      .filter({ id: identity_1 }, null, 1)
      .then(r => r[0])
      .catch(() => null);

    const id2 = await base44.entities.AIIdentity
      .filter({ id: identity_2 }, null, 1)
      .then(r => r[0])
      .catch(() => null);

    if (!id1 || !id2) {
      return jsonResponse({ error: 'One or both identities not found' }, 404);
    }

    if (action === 'merge') {
      // Merge id2 into id1 (keep higher performer)
      const keeper = id1.performance_score >= id2.performance_score ? id1 : id2;
      const deactivate = keeper.id === id1.id ? id2 : id1;

      await base44.entities.AIIdentity
        .update(deactivate.id, { is_active: false })
        .catch((err) => {
          console.error('[Identity Deactivate]', err.message);
        });

      await base44.entities.ComplianceAuditLog
        .create({
          user_email: user.email,
          action_type: 'conflict_resolved',
          entity_type: 'AIIdentity',
          entity_id: keeper.id,
          details: {
            resolution_type: 'merge',
            keeper_id: keeper.id,
            deactivated_id: deactivate.id
          },
          risk_level: 'medium',
          timestamp: new Date().toISOString()
        })
        .catch((err) => {
          console.error('[ResolutionLog Create]', err.message);
        });

      return jsonResponse({
        message: 'Conflict resolved via merge',
        keeper_identity: keeper.id,
        deactivated_identity: deactivate.id
      });
    }

    if (action === 'revoke') {
      // Deactivate identity_2 (lower performer)
      const deactivate = id1.performance_score >= id2.performance_score ? id2 : id1;

      await base44.entities.AIIdentity
        .update(deactivate.id, { is_active: false })
        .catch((err) => {
          console.error('[Identity Revoke]', err.message);
        });

      await base44.entities.ComplianceAuditLog
        .create({
          user_email: user.email,
          action_type: 'conflict_resolved',
          entity_type: 'AIIdentity',
          entity_id: deactivate.id,
          details: { resolution_type: 'revoke', deactivated_id: deactivate.id },
          risk_level: 'medium',
          timestamp: new Date().toISOString()
        })
        .catch((err) => {
          console.error('[ResolutionLog Create]', err.message);
        });

      return jsonResponse({
        message: 'Conflict resolved via revocation',
        deactivated_identity: deactivate.id
      });
    }

    return jsonResponse({ error: 'Invalid action' }, 400);
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

/**
 * Auto-resolve all conflicts (after 24h warning)
 */
async function autoResolveAll(base44, user) {
  try {
    const conflictDetection = await detectConflicts(base44, user);
    const body = await conflictDetection.json();

    if (!body.conflicts || body.conflicts.length === 0) {
      return jsonResponse({ message: 'No conflicts to resolve', resolved: 0 });
    }

    const last24h = new Date(Date.now() - 86400000).toISOString();
    const logs = await base44.entities.ComplianceAuditLog
      .filter({ user_email: user.email, action_type: 'conflict_detection' }, '-timestamp', 100)
      .catch((err) => {
        console.error('[AutoResolveLog]', err.message);
        return [];
      });

    const eligibleForResolution = logs
      .filter(l => l.timestamp < last24h)
      .flatMap(l => l.details?.conflicts || []);

    let resolved = 0;

    for (const conflict of eligibleForResolution.slice(0, 20)) {
      try {
        await base44.asServiceRole.entities.AIIdentity
          .update(conflict.identity_2, { is_active: false })
          .catch(() => {});

        await base44.entities.ComplianceAuditLog
          .create({
            user_email: user.email,
            action_type: 'conflict_auto_resolved',
            entity_type: 'AIIdentity',
            entity_id: conflict.identity_2,
            details: { type: conflict.type, deactivated_id: conflict.identity_2 },
            risk_level: 'low',
            timestamp: new Date().toISOString()
          })
          .catch(() => {});

        resolved++;
      } catch (err) {
        console.error('[AutoResolve Item]', err.message);
      }
    }

    return jsonResponse({
      message: 'Auto-resolution complete',
      resolved,
      eligible_for_resolution: eligibleForResolution.length
    });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}