import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Manages secure credential storage and encryption for the Credential Vault
 * All credentials are encrypted at rest with AES-256-GCM
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Derive encryption key from user email for consistent encryption
 */
async function deriveKey(email) {
  const data = encoder.encode(email + Deno.env.get('BASE44_APP_ID'));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return crypto.subtle.importKey('raw', hashBuffer, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/**
 * Encrypt sensitive data using AES-256-GCM
 */
async function encryptField(value, key) {
  if (!value) return { encrypted: null, iv: null };
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = encoder.encode(value);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  
  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

/**
 * Decrypt sensitive data
 */
async function decryptField(encryptedBase64, ivBase64, key) {
  if (!encryptedBase64 || !ivBase64) return null;
  
  try {
    const encrypted = new Uint8Array(atob(encryptedBase64).split('').map(c => c.charCodeAt(0)));
    const iv = new Uint8Array(atob(ivBase64).split('').map(c => c.charCodeAt(0)));
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
}

/**
 * Log credential access for audit trail
 */
async function logAccess(base44, credentialId, action, taskId, success, error) {
  const accessEntry = {
    timestamp: new Date().toISOString(),
    action,
    module: 'credential_vault',
    task_id: taskId || null,
    success,
    error_message: error ? error.substring(0, 200) : null,
  };
  
  const credential = await base44.asServiceRole.entities.PlatformCredential.read(credentialId);
  const updatedLog = [...(credential.access_log || []), accessEntry];
  
  await base44.asServiceRole.entities.PlatformCredential.update(credentialId, {
    access_log: updatedLog,
    last_used_at: new Date().toISOString(),
    access_count: (credential.access_count || 0) + 1,
  });
}

/**
 * Check if Autopilot is allowed to perform an action
 */
function isActionAllowed(credential, action) {
  // Check explicit allowed actions
  if (credential.allowed_actions && credential.allowed_actions.includes(action)) {
    return true;
  }
  
  // Check restricted actions
  if (credential.restricted_actions && credential.restricted_actions.includes(action)) {
    return false;
  }
  
  // Default based on permission level
  const basicActions = ['login', 'read_data', 'scan'];
  if (basicActions.includes(action)) return true;
  
  return credential.permission_level === 'full_automation';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, credentialId, payload, taskId } = await req.json();
    const encryptionKey = await deriveKey(user.email);

    // ─── STORE: Save new credential ───────────────────────────────────────
    if (action === 'store') {
      const { 
        platform, account_label, login_url, username_email, password,
        two_factor_method, two_factor_backup, api_key, api_secret,
        special_instructions, permission_level, fully_auto_enabled
      } = payload;

      // Encrypt sensitive fields
      const [pwdEncrypted, twoFaEncrypted, apiKeyEncrypted, apiSecretEncrypted] = await Promise.all([
        encryptField(password, encryptionKey),
        encryptField(two_factor_backup, encryptionKey),
        encryptField(api_key, encryptionKey),
        encryptField(api_secret, encryptionKey),
      ]);

      // Determine allowed/restricted actions based on permission level
      let allowed_actions = [];
      let restricted_actions = [];

      if (permission_level === 'view_only') {
        allowed_actions = ['login', 'read_data', 'scan', 'retrieve_info'];
        restricted_actions = ['apply', 'edit', 'submit', 'communicate', 'change_settings'];
      } else if (permission_level === 'limited_automation') {
        allowed_actions = ['login', 'read_data', 'scan', 'select', 'prepare_content', 'fill_forms'];
        restricted_actions = ['submit', 'communicate', 'change_settings'];
      } else if (permission_level === 'full_automation') {
        allowed_actions = ['login', 'read_data', 'scan', 'select', 'apply', 'communicate', 'submit', 'execute', 'retrieve_earnings', 'manage_workflows'];
        restricted_actions = [];
      }

      const credential = await base44.entities.PlatformCredential.create({
        platform,
        account_label,
        login_url,
        username_email,
        password_encrypted: pwdEncrypted.encrypted,
        encryption_iv: pwdEncrypted.iv,
        two_factor_method,
        two_factor_secret_encrypted: twoFaEncrypted.encrypted,
        api_key_encrypted: apiKeyEncrypted.encrypted,
        api_secret_encrypted: apiSecretEncrypted.encrypted,
        special_instructions,
        permission_level,
        fully_auto_enabled,
        allowed_actions,
        restricted_actions,
        user_consent_timestamp: new Date().toISOString(),
        user_consent_acknowledged: true,
        is_active: true,
        access_log: [],
      });

      return Response.json({ success: true, credentialId: credential.id });
    }

    // ─── UPDATE: Modify credential ───────────────────────────────────────
    if (action === 'update') {
      const credential = await base44.entities.PlatformCredential.read(credentialId);
      
      if (credential.created_by !== user.email) {
        return Response.json({ error: 'Forbidden: Not your credential' }, { status: 403 });
      }

      const updates = { ...payload };

      // Re-encrypt changed sensitive fields
      if (payload.password) {
        const encrypted = await encryptField(payload.password, encryptionKey);
        updates.password_encrypted = encrypted.encrypted;
        updates.encryption_iv = encrypted.iv;
        delete updates.password;
      }

      if (payload.two_factor_backup) {
        const encrypted = await encryptField(payload.two_factor_backup, encryptionKey);
        updates.two_factor_secret_encrypted = encrypted.encrypted;
        delete updates.two_factor_backup;
      }

      if (payload.api_key) {
        const encrypted = await encryptField(payload.api_key, encryptionKey);
        updates.api_key_encrypted = encrypted.encrypted;
        delete updates.api_key;
      }

      if (payload.api_secret) {
        const encrypted = await encryptField(payload.api_secret, encryptionKey);
        updates.api_secret_encrypted = encrypted.encrypted;
        delete updates.api_secret;
      }

      await base44.entities.PlatformCredential.update(credentialId, updates);
      return Response.json({ success: true });
    }

    // ─── RETRIEVE: Get decrypted credential (for Autopilot only) ────────
    if (action === 'retrieve') {
      const credential = await base44.entities.PlatformCredential.read(credentialId);
      
      if (credential.created_by !== user.email) {
        return Response.json({ error: 'Forbidden: Not your credential' }, { status: 403 });
      }

      // Check if action is allowed
      if (!isActionAllowed(credential, payload.requestedAction)) {
        await logAccess(base44, credentialId, payload.requestedAction, payload.taskId, false, 'Action not allowed for this credential');
        return Response.json({ error: 'Action not permitted for this credential' }, { status: 403 });
      }

      if (!credential.is_active) {
        await logAccess(base44, credentialId, payload.requestedAction, payload.taskId, false, 'Credential is inactive');
        return Response.json({ error: 'This credential is disabled' }, { status: 403 });
      }

      // Decrypt sensitive fields
      const [password, twoFaSecret, apiKey, apiSecret] = await Promise.all([
        decryptField(credential.password_encrypted, credential.encryption_iv, encryptionKey),
        decryptField(credential.two_factor_secret_encrypted, credential.encryption_iv, encryptionKey),
        decryptField(credential.api_key_encrypted, credential.encryption_iv, encryptionKey),
        decryptField(credential.api_secret_encrypted, credential.encryption_iv, encryptionKey),
      ]);

      // Log access
      await logAccess(base44, credentialId, payload.requestedAction, payload.taskId, true);

      return Response.json({
        success: true,
        data: {
          platform: credential.platform,
          login_url: credential.login_url,
          username_email: credential.username_email,
          password,
          two_factor_method: credential.two_factor_method,
          two_factor_secret: twoFaSecret,
          api_key: apiKey,
          api_secret: apiSecret,
          special_instructions: credential.special_instructions,
          permission_level: credential.permission_level,
          fully_auto_enabled: credential.fully_auto_enabled,
        },
      });
    }

    // ─── VALIDATE: Check if credential is ready for Autopilot ────────────
    if (action === 'validate') {
      const credential = await base44.entities.PlatformCredential.read(credentialId);
      
      if (credential.created_by !== user.email) {
        return Response.json({ error: 'Forbidden: Not your credential' }, { status: 403 });
      }

      const isValid = credential.is_active && 
                      credential.user_consent_acknowledged &&
                      credential.permission_level !== 'view_only';

      return Response.json({
        success: true,
        isValid,
        permissionLevel: credential.permission_level,
        fullyAutoEnabled: credential.fully_auto_enabled,
        reason: !isValid ? 'Credential inactive or not authorized' : 'Ready for use',
      });
    }

    // ─── DELETE: Remove credential ────────────────────────────────────────
    if (action === 'delete') {
      const credential = await base44.entities.PlatformCredential.read(credentialId);
      
      if (credential.created_by !== user.email) {
        return Response.json({ error: 'Forbidden: Not your credential' }, { status: 403 });
      }

      await base44.entities.PlatformCredential.delete(credentialId);
      return Response.json({ success: true });
    }

    // ─── LIST: Get all credentials for current user ─────────────────────
    if (action === 'list') {
      const credentials = await base44.entities.PlatformCredential.filter(
        { created_by: user.email },
        '-created_date',
        100
      );

      // Don't return encrypted fields to frontend
      const sanitized = credentials.map(c => ({
        ...c,
        password_encrypted: undefined,
        two_factor_secret_encrypted: undefined,
        api_key_encrypted: undefined,
        api_secret_encrypted: undefined,
      }));

      return Response.json({ success: true, credentials: sanitized });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Credential vault error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});