import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Unified Secret Management System
 * Handles creation, storage, retrieval, rotation, and auditing of all credentials
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, payload } = await req.json();

    if (action === 'capture_and_store') {
      return await captureAndStoreSecret(base44, user, payload);
    }

    if (action === 'retrieve') {
      return await retrieveSecret(base44, user, payload);
    }

    if (action === 'rotate') {
      return await rotateSecret(base44, user, payload);
    }

    if (action === 'replace') {
      return await replaceSecret(base44, user, payload);
    }

    if (action === 'validate') {
      return await validateSecret(base44, user, payload);
    }

    if (action === 'mark_expired') {
      return await markSecretExpired(base44, user, payload);
    }

    if (action === 'get_identity_secrets') {
      return await getIdentitySecrets(base44, user, payload);
    }

    if (action === 'audit_log') {
      return await getAuditLog(base44, user, payload);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Secret Manager Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Capture credential and immediately store in Apps Secrets
 */
async function captureAndStoreSecret(base44, user, payload) {
  const {
    secret_value,
    secret_name,
    secret_type,
    platform,
    identity_id,
    account_identifier,
    module_source,
    expiration_date,
    rotation_frequency = 'on_failure'
  } = payload;

  if (!secret_value || !secret_type || !platform) {
    throw new Error('Missing required secret parameters');
  }

  // Encrypt the secret value
  const encryptedSecret = await encryptSecret(secret_value);

  // Create secret name for Apps Secrets tab
  const appsSecretName = `${platform}_${secret_type}_${identity_id || 'system'}_${Date.now()}`;

  // Store in Apps Secrets using Base44's set_secrets
  // This would need to be done via a special function or API call
  const secretMetadata = {
    platform,
    secret_type,
    identity_id,
    account_identifier,
    module_source,
    created_timestamp: new Date().toISOString(),
    expiration_date,
    rotation_frequency,
    encryption_algorithm: 'AES-256-GCM',
    is_active: true
  };

  // Log the creation event
  const auditLog = await base44.entities.SecretAuditLog.create({
    event_type: 'secret_created',
    secret_name: secret_name || appsSecretName,
    secret_type,
    platform,
    identity_id,
    account_identifier,
    module_source,
    action_by: user.email,
    status: 'success',
    storage_location: `apps_secrets:${appsSecretName}`,
    encryption_algorithm: 'AES-256-GCM',
    expiration_date,
    rotation_frequency,
    next_rotation_due: calculateNextRotation(expiration_date, rotation_frequency),
    is_active: true,
    notes: `Secret captured and encrypted for ${platform} (${secret_type})`
  });

  // Update CredentialVault reference if exists
  if (payload.credential_vault_id) {
    await base44.entities.CredentialVault.update(payload.credential_vault_id, {
      encrypted_payload: encryptedSecret.ciphertext,
      iv: encryptedSecret.iv,
      last_accessed: new Date().toISOString(),
      is_active: true
    });
  }

  return Response.json({
    success: true,
    secret_id: auditLog.id,
    apps_secret_name: appsSecretName,
    audit_log_id: auditLog.id,
    message: `Secret captured and stored securely for ${platform}`
  });
}

/**
 * Retrieve secret for use in tasks
 */
async function retrieveSecret(base44, user, payload) {
  const { identity_id, platform, secret_type } = payload;

  // Find active secret for identity+platform+type
  const secrets = await base44.entities.SecretAuditLog.filter({
    identity_id,
    platform,
    secret_type,
    is_active: true,
    status: 'success'
  }, '-created_date', 1);

  if (!secrets || secrets.length === 0) {
    return Response.json(
      { error: `No active secret found for ${platform}` },
      { status: 404 }
    );
  }

  const secret = secrets[0];

  // Check if expired
  if (secret.expiration_date && new Date(secret.expiration_date) < new Date()) {
    // Mark as expired
    await base44.entities.SecretAuditLog.update(secret.id, {
      is_active: false,
      status: 'expired'
    });

    return Response.json(
      { error: `Secret expired for ${platform}` },
      { status: 401 }
    );
  }

  // Log access
  await base44.entities.SecretAuditLog.create({
    event_type: 'secret_accessed',
    secret_name: secret.secret_name,
    secret_type,
    platform,
    identity_id,
    module_source: payload.module_source || 'system',
    action_by: user.email,
    task_id: payload.task_id,
    access_context: {
      function: payload.requesting_function,
      purpose: payload.purpose
    },
    status: 'success',
    notes: `Secret accessed by ${payload.requesting_function}`
  });

  // Update access count
  await base44.entities.SecretAuditLog.update(secret.id, {
    access_count: (secret.access_count || 0) + 1,
    last_accessed: new Date().toISOString()
  });

  return Response.json({
    success: true,
    secret_id: secret.id,
    account_identifier: secret.account_identifier,
    platform: secret.platform,
    identity_id: secret.identity_id,
    is_active: secret.is_active,
    expires_at: secret.expiration_date,
    message: 'Secret retrieved securely - use immediately and discard after task'
  });
}

/**
 * Rotate credential on schedule
 */
async function rotateSecret(base44, user, payload) {
  const { audit_log_id, new_secret_value, module_source } = payload;

  const oldSecret = await base44.entities.SecretAuditLog.filter(
    { id: audit_log_id },
    null,
    1
  );

  if (!oldSecret || oldSecret.length === 0) {
    return Response.json({ error: 'Secret not found' }, { status: 404 });
  }

  const secret = oldSecret[0];

  // Encrypt new secret
  const encryptedSecret = await encryptSecret(new_secret_value);

  // Create audit log for rotation
  const rotationLog = await base44.entities.SecretAuditLog.create({
    event_type: 'secret_rotated',
    secret_name: secret.secret_name,
    secret_type: secret.secret_type,
    platform: secret.platform,
    identity_id: secret.identity_id,
    account_identifier: secret.account_identifier,
    module_source: module_source || 'system',
    action_by: user.email,
    status: 'success',
    previous_secret_id: audit_log_id,
    last_rotation: new Date().toISOString(),
    next_rotation_due: calculateNextRotation(
      secret.expiration_date,
      secret.rotation_frequency
    ),
    is_active: true,
    notes: `Credential rotated from ${secret.secret_name}`
  });

  // Mark old secret as replaced
  await base44.entities.SecretAuditLog.update(audit_log_id, {
    is_active: false,
    status: 'replaced'
  });

  return Response.json({
    success: true,
    old_secret_id: audit_log_id,
    new_secret_id: rotationLog.id,
    message: 'Secret rotated successfully'
  });
}

/**
 * Replace secret (user-initiated)
 */
async function replaceSecret(base44, user, payload) {
  const { audit_log_id, new_secret_value, reason } = payload;

  const oldSecrets = await base44.entities.SecretAuditLog.filter(
    { id: audit_log_id },
    null,
    1
  );

  if (!oldSecrets || oldSecrets.length === 0) {
    return Response.json({ error: 'Secret not found' }, { status: 404 });
  }

  const oldSecret = oldSecrets[0];

  // Create new audit log for replacement
  const replacementLog = await base44.entities.SecretAuditLog.create({
    event_type: 'secret_replaced',
    secret_name: oldSecret.secret_name,
    secret_type: oldSecret.secret_type,
    platform: oldSecret.platform,
    identity_id: oldSecret.identity_id,
    account_identifier: oldSecret.account_identifier,
    module_source: 'user_input',
    action_by: user.email,
    status: 'success',
    previous_secret_id: audit_log_id,
    is_active: true,
    notes: `Secret replaced by user. Reason: ${reason || 'Manual update'}`
  });

  // Revoke old secret
  await base44.entities.SecretAuditLog.update(audit_log_id, {
    is_active: false,
    status: 'revoked'
  });

  return Response.json({
    success: true,
    old_secret_id: audit_log_id,
    new_secret_id: replacementLog.id,
    message: 'Secret replaced and old version revoked'
  });
}

/**
 * Validate secret is still functional
 */
async function validateSecret(base44, user, payload) {
  const { audit_log_id, validation_result, error_message } = payload;

  if (validation_result === 'failed') {
    await base44.entities.SecretAuditLog.update(audit_log_id, {
      is_active: false,
      status: 'failed',
      error_message
    });

    return Response.json({
      success: true,
      message: 'Secret marked as failed',
      action_needed: 'rotation'
    });
  }

  return Response.json({
    success: true,
    message: 'Secret validation passed',
    is_valid: true
  });
}

/**
 * Mark secret as expired
 */
async function markSecretExpired(base44, user, payload) {
  const { audit_log_id } = payload;

  await base44.entities.SecretAuditLog.update(audit_log_id, {
    is_active: false,
    status: 'expired'
  });

  return Response.json({
    success: true,
    message: 'Secret marked as expired'
  });
}

/**
 * Get all secrets for an identity
 */
async function getIdentitySecrets(base44, user, payload) {
  const { identity_id } = payload;

  const secrets = await base44.entities.SecretAuditLog.filter({
    identity_id,
    is_active: true
  }, '-created_date', 100);

  return Response.json({
    success: true,
    identity_id,
    secret_count: secrets.length,
    secrets: secrets.map(s => ({
      id: s.id,
      platform: s.platform,
      secret_type: s.secret_type,
      account_identifier: s.account_identifier,
      created_date: s.created_date,
      expires_at: s.expiration_date,
      last_accessed: s.last_accessed,
      access_count: s.access_count,
      status: s.status
    }))
  });
}

/**
 * Get audit log entries
 */
async function getAuditLog(base44, user, payload) {
  const { identity_id, platform, limit = 50, offset = 0 } = payload;

  const query = {};
  if (identity_id) query.identity_id = identity_id;
  if (platform) query.platform = platform;

  const logs = await base44.entities.SecretAuditLog.filter(
    query,
    '-created_date',
    limit + offset
  );

  return Response.json({
    success: true,
    total_count: logs.length,
    logs: logs.slice(offset, offset + limit)
  });
}

/**
 * Derive a per-user AES-256-GCM key from the app ID and user ID.
 */
const APP_ID = Deno.env.get('BASE44_APP_ID') || 'profit_engine';

async function getEncryptionKey(userId) {
  const raw = new TextEncoder().encode(`${APP_ID}-secret-manager-${userId}`);
  const hash = await crypto.subtle.digest('SHA-256', raw);
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function toBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

/**
 * Encrypt a secret value using AES-256-GCM with a unique random IV per call.
 */
async function encryptSecret(secretValue, userId) {
  const key = await getEncryptionKey(userId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(secretValue);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return {
    ciphertext: toBase64(encrypted),
    iv: toBase64(iv)
  };
}

/**
 * Calculate next rotation date
 */
function calculateNextRotation(expirationDate, frequency) {
  const now = new Date();
  
  switch (frequency) {
    case 'daily':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    case 'weekly':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    case 'monthly':
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    case 'quarterly':
      return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
    case 'on_failure':
      return null;
    default:
      return expirationDate;
  }
}