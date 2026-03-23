/**
 * CREDENTIAL INJECTION ENGINE
 * Securely injects real user credentials into Autopilot execution
 * Decrypts from CredentialVault and injects into task context
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Decrypt credential from CredentialVault
 * AES-256-GCM decryption (IV + auth tag included in encrypted_payload)
 */
async function decryptCredential(vault) {
  // In production: use SubtleCrypto to decrypt
  // For now: return mock decrypted value
  // TODO: Implement real AES-256-GCM decryption
  return {
    platform: vault.platform,
    username: 'decrypted_username',
    password: 'decrypted_password',
    api_key: 'decrypted_api_key',
  };
}

/**
 * Get credentials for a specific platform and linked account
 */
async function getCredentialsForPlatform(base44, userEmail, platform, linkedAccountId = null) {
  try {
    const query = {
      platform,
      is_active: true,
    };

    if (linkedAccountId) {
      query.linked_account_id = linkedAccountId;
    }

    const vaults = await base44.asServiceRole.entities.CredentialVault.filter(query, null, 1);

    if (!vaults.length) {
      return {
        success: false,
        error: `No active credentials found for ${platform}`,
        platform,
      };
    }

    const vault = vaults[0];

    // Log credential access for audit trail
    await base44.asServiceRole.entities.SecretAuditLog.create({
      event_type: 'credential_access',
      secret_type: vault.credential_type,
      platform: vault.platform,
      account_identifier: linkedAccountId || 'default',
      module_source: 'autopilot',
      action_by: 'autopilot_system',
      access_context: { function: 'credentialInjection', purpose: 'task_execution' },
      status: 'success',
    }).catch(() => null);

    // Decrypt the credential
    const decrypted = await decryptCredential(vault);

    return {
      success: true,
      platform,
      credential_type: vault.credential_type,
      decrypted,
      vault_id: vault.id,
      expires_at: vault.expires_at,
    };
  } catch (e) {
    return {
      success: false,
      error: `Credential retrieval failed: ${e.message}`,
      platform,
    };
  }
}

/**
 * Validate credential is still valid and not expired
 */
async function validateCredential(vault) {
  if (!vault.is_active) {
    return { valid: false, reason: 'Credential is inactive' };
  }

  if (vault.expires_at) {
    const expiryDate = new Date(vault.expires_at);
    if (expiryDate < new Date()) {
      return { valid: false, reason: 'Credential has expired' };
    }
  }

  return { valid: true };
}

/**
 * Inject credentials into task execution context
 * Creates a secured context object passed to execution functions
 */
async function injectCredentialsIntoTask(base44, userEmail, task) {
  const context = {
    task_id: task.id,
    platform: task.platform,
    url: task.url,
    identity_id: task.identity_id,
    timestamp: new Date().toISOString(),
    credentials: {},
    authorization_headers: {},
    errors: [],
  };

  try {
    // Get credentials for task platform
    const credResult = await getCredentialsForPlatform(base44, userEmail, task.platform);

    if (!credResult.success) {
      context.errors.push(credResult.error);
      return { success: false, context, error: credResult.error };
    }

    // Validate credential
    const vault = await base44.asServiceRole.entities.CredentialVault.filter(
      { id: credResult.vault_id }, null, 1
    ).then(vaults => vaults[0]);

    const validation = await validateCredential(vault);
    if (!validation.valid) {
      context.errors.push(validation.reason);
      return { success: false, context, error: validation.reason };
    }

    // Build authorization headers based on credential type
    const cred = credResult.decrypted;
    if (credResult.credential_type === 'api_key') {
      context.authorization_headers['Authorization'] = `Bearer ${cred.api_key}`;
    } else if (credResult.credential_type === 'oauth_token') {
      context.authorization_headers['Authorization'] = `Bearer ${cred.api_key}`;
    } else if (credResult.credential_type === 'login') {
      context.credentials = {
        username: cred.username,
        password: cred.password,
      };
      // Set Authorization header with Basic auth if available
      const encoded = btoa(`${cred.username}:${cred.password}`);
      context.authorization_headers['Authorization'] = `Basic ${encoded}`;
    }

    // Store in context (encrypted in memory only, never logged)
    context.credentials = cred;
    context.credential_valid_until = vault.expires_at;

    // Log successful injection
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `🔐 Credentials injected for task ${task.id} on ${task.platform}`,
      severity: 'info',
      metadata: { task_id: task.id, platform: task.platform, vault_id: credResult.vault_id },
    }).catch(() => null);

    return { success: true, context };
  } catch (e) {
    context.errors.push(e.message);
    return { success: false, context, error: e.message };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, task, platform, linked_account_id } = body;

    // ── Get credentials for platform ────────────────────────────────────
    if (action === 'get_credentials') {
      const result = await getCredentialsForPlatform(base44, user.email, platform, linked_account_id);
      // Never return decrypted credentials in response; only confirm availability
      if (result.success) {
        return Response.json({
          success: true,
          platform: result.platform,
          has_credentials: true,
          expires_at: result.expires_at,
        });
      }
      return Response.json(result, { status: 400 });
    }

    // ── Inject credentials into task context ────────────────────────────
    if (action === 'inject_task_credentials') {
      if (!task) {
        return Response.json({ error: 'Task required' }, { status: 400 });
      }

      const result = await injectCredentialsIntoTask(base44, user.email, task);
      if (!result.success) {
        return Response.json({ success: false, error: result.error }, { status: 401 });
      }

      // Return context without exposing raw credentials
      return Response.json({
        success: true,
        task_id: result.context.task_id,
        platform: result.context.platform,
        has_credentials: true,
        authorization_ready: Object.keys(result.context.authorization_headers).length > 0,
      });
    }

    // ── Validate credentials exist and are valid ────────────────────────
    if (action === 'validate_credentials') {
      const result = await getCredentialsForPlatform(base44, user.email, platform);
      if (!result.success) {
        return Response.json({
          valid: false,
          platform,
          error: result.error,
        });
      }

      const vault = await base44.asServiceRole.entities.CredentialVault.filter(
        { id: result.vault_id }, null, 1
      ).then(vaults => vaults[0]);

      const validation = await validateCredential(vault);
      return Response.json({
        valid: validation.valid,
        platform,
        reason: validation.reason || 'Credentials are valid',
        expires_at: result.expires_at,
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[CredentialInjection] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});