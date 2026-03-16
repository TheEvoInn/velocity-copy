import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Module Credential Adapter
 * Provides seamless credential access to Autopilot, Agent Worker, Identity Manager
 * All modules call this to GET credentials instead of storing locally
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, payload } = await req.json();

    if (action === 'get_for_identity_and_platform') {
      return await getCredentialForIdentityAndPlatform(base44, user, payload);
    }

    if (action === 'get_all_active_for_identity') {
      return await getAllActiveCredentialsForIdentity(base44, user, payload);
    }

    if (action === 'request_with_auto_rotation') {
      return await requestWithAutoRotation(base44, user, payload);
    }

    if (action === 'validate_and_refresh') {
      return await validateAndRefreshCredential(base44, user, payload);
    }

    if (action === 'discard_after_use') {
      return await discardCredentialAfterUse(base44, user, payload);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Module Credential Adapter Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Get credential for identity+platform (primary use case)
 */
async function getCredentialForIdentityAndPlatform(base44, user, payload) {
  const { identity_id, platform, secret_type, requesting_module, task_id } = payload;

  if (!identity_id || !platform) {
    return Response.json(
      { error: 'identity_id and platform required' },
      { status: 400 }
    );
  }

  // Query SecretAuditLog for active credential
  const secrets = await base44.entities.SecretAuditLog.filter({
    identity_id,
    platform,
    secret_type: secret_type || undefined,
    is_active: true,
    status: 'success'
  }, '-created_date', 1);

  if (!secrets || secrets.length === 0) {
    return Response.json(
      {
        error: `No active credential found for ${platform}`,
        suggestion: 'Create account or provide credential'
      },
      { status: 404 }
    );
  }

  const secret = secrets[0];

  // Check expiration
  if (secret.expiration_date && new Date(secret.expiration_date) < new Date()) {
    await base44.entities.SecretAuditLog.update(secret.id, {
      is_active: false,
      status: 'expired'
    });

    return Response.json(
      { error: 'Credential expired', action: 'rotation_needed' },
      { status: 401 }
    );
  }

  // Log the access
  await logCredentialAccess(base44, secret.id, requesting_module, task_id);

  return Response.json({
    success: true,
    credential_id: secret.id,
    identity_id: secret.identity_id,
    platform: secret.platform,
    secret_type: secret.secret_type,
    account_identifier: secret.account_identifier,
    expires_at: secret.expiration_date,
    created_at: secret.created_date,
    access_count: secret.access_count,
    last_accessed: secret.last_accessed,
    // IMPORTANT: Real implementation would return decrypted secret here
    // For now, return reference and let caller fetch from Apps Secrets
    secret_reference: `apps_secrets:${platform}_${secret_type}_${identity_id}`,
    instructions: 'Use secret reference to fetch from Apps Secrets tab, use immediately, discard after task'
  });
}

/**
 * Get all active credentials for an identity
 */
async function getAllActiveCredentialsForIdentity(base44, user, payload) {
  const { identity_id } = payload;

  const secrets = await base44.entities.SecretAuditLog.filter({
    identity_id,
    is_active: true,
    status: 'success'
  }, '-created_date', 100);

  const grouped = {};
  secrets.forEach(secret => {
    if (!grouped[secret.platform]) {
      grouped[secret.platform] = [];
    }
    grouped[secret.platform].push({
      id: secret.id,
      secret_type: secret.secret_type,
      account_identifier: secret.account_identifier,
      expires_at: secret.expiration_date,
      needs_rotation: secret.next_rotation_due && new Date(secret.next_rotation_due) < new Date()
    });
  });

  return Response.json({
    success: true,
    identity_id,
    credential_summary: grouped,
    total_count: secrets.length,
    total_platforms: Object.keys(grouped).length
  });
}

/**
 * Request credential with auto-rotation if needed
 */
async function requestWithAutoRotation(base44, user, payload) {
  const { identity_id, platform, secret_type, requesting_module, task_id, on_rotation_callback } = payload;

  // First try to get existing
  const existing = await getCredentialForIdentityAndPlatform(base44, user, {
    identity_id,
    platform,
    secret_type,
    requesting_module,
    task_id
  });

  if (existing.ok || existing.status === 200) {
    return existing;
  }

  // If not found and rotation needed, attempt auto-rotation
  if (existing.status === 401) {
    // Attempt to rotate or create new credential
    if (on_rotation_callback) {
      try {
        const rotated = await base44.functions.invoke(on_rotation_callback, {
          identity_id,
          platform,
          secret_type
        });

        if (rotated.data.success) {
          // Retry getting credential
          return await getCredentialForIdentityAndPlatform(base44, user, {
            identity_id,
            platform,
            secret_type,
            requesting_module,
            task_id
          });
        }
      } catch (rotationError) {
        console.error('Auto-rotation failed:', rotationError);
      }
    }
  }

  return existing;
}

/**
 * Validate credential and attempt refresh if needed
 */
async function validateAndRefreshCredential(base44, user, payload) {
  const { credential_id, validation_result, error_message } = payload;

  if (!validation_result) {
    return Response.json({ error: 'validation_result required' }, { status: 400 });
  }

  if (validation_result === 'failed') {
    // Mark as failed
    const secretLog = await base44.entities.SecretAuditLog.filter(
      { id: credential_id },
      null,
      1
    );

    if (secretLog && secretLog.length > 0) {
      const secret = secretLog[0];

      await base44.entities.SecretAuditLog.update(credential_id, {
        is_active: false,
        status: 'failed_auth',
        error_message
      });

      // Trigger rotation
      return Response.json({
        success: true,
        message: 'Credential marked as failed',
        credential_id,
        platform: secret.platform,
        action_required: 'rotation',
        next_steps: 'System will attempt auto-rotation or flag for manual replacement'
      });
    }
  }

  return Response.json({
    success: true,
    message: 'Credential validation passed',
    credential_id,
    is_valid: true
  });
}

/**
 * Mark credential as discarded after use (cleanup)
 */
async function discardCredentialAfterUse(base44, user, payload) {
  const { credential_id, task_id, used_for, success } = payload;

  // Log the final access
  const auditLog = await base44.entities.SecretAuditLog.create({
    event_type: 'secret_accessed',
    secret_type: 'unknown',
    platform: 'unknown',
    module_source: 'system',
    action_by: user.email,
    task_id,
    status: success ? 'success' : 'failed',
    access_context: {
      function: used_for,
      final_access: true
    },
    notes: `Credential used and discarded for task execution`
  });

  return Response.json({
    success: true,
    message: 'Credential marked as used and discarded from memory',
    credential_id,
    audit_log_id: auditLog.id
  });
}

/**
 * Log credential access
 */
async function logCredentialAccess(base44, credential_id, requesting_module, task_id) {
  try {
    const secret = await base44.entities.SecretAuditLog.filter(
      { id: credential_id },
      null,
      1
    );

    if (secret && secret.length > 0) {
      const s = secret[0];
      await base44.entities.SecretAuditLog.create({
        event_type: 'secret_accessed',
        secret_name: s.secret_name,
        secret_type: s.secret_type,
        platform: s.platform,
        identity_id: s.identity_id,
        module_source: requesting_module || 'system',
        task_id,
        status: 'success',
        access_context: {
          requesting_module,
          task_id
        }
      });
    }
  } catch (error) {
    console.error('Failed to log credential access:', error);
  }
}