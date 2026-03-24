import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * API CREDENTIAL LIFECYCLE MANAGER
 * Auto-rotates credentials, detects expired/revoked credentials
 * Fallback credential selection, audit credential usage per API call
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, credential_id, api_id, force_rotation } = await req.json();

    if (action === 'check_credential_health') {
      return await checkCredentialHealth(base44, credential_id);
    } else if (action === 'rotate_credentials') {
      return await rotateCredentials(base44, api_id, force_rotation);
    } else if (action === 'select_fallback_credential') {
      return await selectFallbackCredential(base44, api_id);
    } else if (action === 'audit_usage') {
      return await auditCredentialUsage(base44, credential_id);
    } else {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[apiCredentialLifecycleManager]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Check health of a credential
 */
async function checkCredentialHealth(base44, credentialId) {
  const cred = await base44.entities.PlatformCredential?.get?.(credentialId);
  if (!cred) {
    return Response.json({ error: 'Credential not found' }, { status: 404 });
  }

  // Check if expired
  const isExpired = cred.expires_at && new Date(cred.expires_at) < new Date();
  const isInactive = cred.last_accessed && new Date(cred.last_accessed).getTime() < Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days

  // Calculate health score (0-100)
  let healthScore = 100;
  if (isExpired) healthScore -= 100;
  if (isInactive) healthScore -= 30;
  if (!cred.is_active) healthScore -= 50;

  const status = isExpired ? 'expired' : isInactive ? 'inactive' : cred.is_active ? 'active' : 'disabled';

  return Response.json({
    success: true,
    credential_id: credentialId,
    status,
    health_score: Math.max(0, healthScore),
    is_expired: isExpired,
    is_inactive: isInactive,
    is_active: cred.is_active,
    expires_at: cred.expires_at,
    last_accessed: cred.last_accessed,
    recommendation: healthScore < 50 ? 'rotate' : healthScore < 80 ? 'monitor' : 'ok',
  });
}

/**
 * Rotate credentials for an API
 */
async function rotateCredentials(base44, apiId, forceRotation = false) {
  // Find active credentials for this API
  const creds = await base44.entities.PlatformCredential?.filter?.({
    linked_account_id: apiId,
    is_active: true,
  }, '-created_at', 10).catch(() => []);

  if (!creds || creds.length === 0) {
    return Response.json({ error: 'No active credentials found' }, { status: 404 });
  }

  const results = {
    rotated_count: 0,
    failures: [],
    timestamp: new Date().toISOString(),
  };

  for (const cred of creds) {
    // Check if rotation needed
    if (!forceRotation) {
      const health = await checkCredentialHealth(base44, cred.id);
      if (health.data?.health_score > 70) continue; // Good health, no need to rotate
    }

    try {
      // Mark old credential as inactive
      await base44.entities.PlatformCredential?.update?.(cred.id, {
        is_active: false,
      });

      // Log rotation
      await base44.entities.SecretAuditLog?.create?.({
        action: 'credential_rotated',
        credential_id: cred.id,
        api_id: apiId,
        timestamp: new Date().toISOString(),
      }).catch(() => null);

      results.rotated_count++;
    } catch (error) {
      results.failures.push({
        credential_id: cred.id,
        error: error.message,
      });
    }
  }

  return Response.json({
    success: results.failures.length === 0,
    api_id: apiId,
    ...results,
  });
}

/**
 * Select fallback credential when primary fails
 */
async function selectFallbackCredential(base44, apiId) {
  // Find all active credentials for this API
  const creds = await base44.entities.PlatformCredential?.filter?.({
    linked_account_id: apiId,
    is_active: true,
  }, '-created_at', 10).catch(() => []);

  if (!creds || creds.length === 0) {
    return Response.json({ error: 'No fallback credentials available' }, { status: 404 });
  }

  // Rank by health
  const credHealth = [];
  for (const cred of creds) {
    const health = await checkCredentialHealth(base44, cred.id);
    if (health.data) {
      credHealth.push({
        credential_id: cred.id,
        health_score: health.data.health_score,
        platform: cred.platform,
      });
    }
  }

  credHealth.sort((a, b) => b.health_score - a.health_score);

  if (credHealth.length === 0) {
    return Response.json({ error: 'No healthy fallback credentials' }, { status: 404 });
  }

  const selected = credHealth[0];

  return Response.json({
    success: true,
    api_id: apiId,
    selected_credential_id: selected.credential_id,
    health_score: selected.health_score,
    fallback_options: credHealth.length - 1,
  });
}

/**
 * Audit credential usage per API call
 */
async function auditCredentialUsage(base44, credentialId) {
  const cred = await base44.entities.PlatformCredential?.get?.(credentialId);
  if (!cred) {
    return Response.json({ error: 'Credential not found' }, { status: 404 });
  }

  // Get access logs
  const accessLogs = cred.access_log || [];

  // Analyze usage
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentAccess = accessLogs.filter(log => new Date(log.timestamp) > lastWeek);

  const usageByDay = {};
  for (const log of recentAccess) {
    const day = new Date(log.timestamp).toDateString();
    usageByDay[day] = (usageByDay[day] || 0) + 1;
  }

  return Response.json({
    success: true,
    credential_id: credentialId,
    platform: cred.platform,
    total_accesses: accessLogs.length,
    accesses_last_7_days: recentAccess.length,
    last_accessed: cred.last_accessed,
    access_count: cred.access_count || 0,
    usage_by_day: usageByDay,
    expiry_date: cred.expires_at,
  });
}