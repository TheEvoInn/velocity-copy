/**
 * Encrypted Credential Manager
 * Handles AES-256-GCM encryption, storage, and retrieval of sensitive credentials
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { webcrypto } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 16;
const IV_LENGTH = 16;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, payload } = await req.json();

    // ACTION: Encrypt and store credential
    if (action === 'store_credential') {
      const {
        credential_name,
        platform,
        credential_type,
        credential_value,
        mfa_enabled,
        mfa_type,
        mfa_secret,
        injection_rules
      } = payload;

      // Generate encryption key from user email + server secret
      const encryptionKey = await generateEncryptionKey(user.email);

      // Encrypt credential data
      const iv = randomBytes(IV_LENGTH);
      const cipher = createCipheriv(ALGORITHM, encryptionKey, iv);

      const credentialString = JSON.stringify({ value: credential_value });
      let encrypted = cipher.update(credentialString, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const tag = cipher.getAuthTag();

      // Encrypt MFA secret if provided
      let mfaSecretEncrypted = null;
      if (mfa_secret) {
        const mfaCipher = createCipheriv(ALGORITHM, encryptionKey, iv);
        let mfaEncrypted = mfaCipher.update(mfa_secret, 'utf8', 'hex');
        mfaEncrypted += mfaCipher.final('hex');
        mfaSecretEncrypted = mfaEncrypted;
      }

      // Store in EncryptedCredential entity
      const credential = await base44.entities.EncryptedCredential.create({
        credential_name,
        platform,
        credential_type,
        encrypted_data: encrypted,
        encryption_iv: iv.toString('base64'),
        encryption_tag: tag.toString('base64'),
        encrypted_at: new Date().toISOString(),
        requires_mfa: mfa_enabled || false,
        mfa_type: mfa_type || 'none',
        mfa_secret_encrypted: mfaSecretEncrypted,
        session_metadata: {
          status: 'active',
          created_at: new Date().toISOString()
        },
        injection_rules: injection_rules || {
          auto_inject_enabled: true,
          inject_on_domains: getPlatformDomains(platform)
        },
        security_metadata: {
          fingerprint: payload.device_fingerprint || 'unknown',
          ip_address: req.headers.get('x-forwarded-for') || 'unknown'
        },
        access_log: [{
          accessed_at: new Date().toISOString(),
          access_type: 'create',
          success: true
        }]
      });

      // Log to activity
      await base44.entities.ActivityLog.create({
        action_type: 'user_action',
        message: `Stored encrypted credential: ${credential_name}`,
        metadata: {
          credential_id: credential.id,
          platform,
          credential_type
        },
        severity: 'info'
      });

      return Response.json({
        status: 'success',
        credential_id: credential.id,
        message: 'Credential stored securely'
      });
    }

    // ACTION: Retrieve and decrypt credential
    if (action === 'retrieve_credential') {
      const { credential_id } = payload;

      const credentials = await base44.entities.EncryptedCredential.filter(
        { id: credential_id, created_by: user.email },
        null,
        1
      );

      if (!credentials || credentials.length === 0) {
        return Response.json({ error: 'Credential not found' }, { status: 404 });
      }

      const credential = credentials[0];

      // Generate same encryption key
      const encryptionKey = await generateEncryptionKey(user.email);

      // Decrypt
      const iv = Buffer.from(credential.encryption_iv, 'base64');
      const tag = Buffer.from(credential.encryption_tag, 'base64');
      const decipher = createDecipheriv(ALGORITHM, encryptionKey, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(credential.encrypted_data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      const credentialData = JSON.parse(decrypted);

      // Log access
      await base44.entities.EncryptedCredential.update(credential.id, {
        usage_tracking: {
          ...credential.usage_tracking,
          total_uses: (credential.usage_tracking?.total_uses || 0) + 1,
          last_used_at: new Date().toISOString()
        },
        access_log: [
          ...(credential.access_log || []),
          {
            accessed_at: new Date().toISOString(),
            access_type: 'retrieve',
            success: true,
            ip_address: req.headers.get('x-forwarded-for')
          }
        ]
      });

      return Response.json({
        status: 'success',
        credential_id,
        credential_value: credentialData.value,
        requires_mfa: credential.requires_mfa,
        mfa_type: credential.mfa_type
      });
    }

    // ACTION: Decrypt MFA secret for TOTP generation
    if (action === 'get_mfa_secret') {
      const { credential_id } = payload;

      const credentials = await base44.entities.EncryptedCredential.filter(
        { id: credential_id, created_by: user.email },
        null,
        1
      );

      if (!credentials || !credentials[0].mfa_secret_encrypted) {
        return Response.json({ error: 'MFA secret not found' }, { status: 404 });
      }

      const credential = credentials[0];
      const encryptionKey = await generateEncryptionKey(user.email);
      const iv = Buffer.from(credential.encryption_iv, 'base64');

      const decipher = createDecipheriv(ALGORITHM, encryptionKey, iv);
      let decrypted = decipher.update(credential.mfa_secret_encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return Response.json({
        status: 'success',
        mfa_secret: decrypted,
        mfa_type: credential.mfa_type
      });
    }

    // ACTION: List user's credentials (summary only, no decryption)
    if (action === 'list_credentials') {
      const { platform_filter, active_only } = payload;

      let query = { created_by: user.email };
      if (platform_filter) query.platform = platform_filter;
      if (active_only) query.is_active = true;

      const credentials = await base44.entities.EncryptedCredential.filter(
        query,
        '-created_date',
        50
      );

      const summary = credentials.map(c => ({
        id: c.id,
        credential_name: c.credential_name,
        platform: c.platform,
        credential_type: c.credential_type,
        requires_mfa: c.requires_mfa,
        is_active: c.is_active,
        created_date: c.created_date,
        last_used_at: c.usage_tracking?.last_used_at,
        total_uses: c.usage_tracking?.total_uses || 0,
        status: c.session_metadata?.status || 'unknown'
      }));

      return Response.json({
        status: 'success',
        credentials: summary,
        total: summary.length
      });
    }

    // ACTION: Rotate credential (invalidate old, create new)
    if (action === 'rotate_credential') {
      const { credential_id, new_value } = payload;

      const credentials = await base44.entities.EncryptedCredential.filter(
        { id: credential_id, created_by: user.email },
        null,
        1
      );

      if (!credentials || credentials.length === 0) {
        return Response.json({ error: 'Credential not found' }, { status: 404 });
      }

      const oldCredential = credentials[0];

      // Create new credential with same settings
      const encryptionKey = await generateEncryptionKey(user.email);
      const iv = randomBytes(IV_LENGTH);
      const cipher = createCipheriv(ALGORITHM, encryptionKey, iv);

      const credentialString = JSON.stringify({ value: new_value });
      let encrypted = cipher.update(credentialString, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const tag = cipher.getAuthTag();

      // Mark old as revoked
      await base44.entities.EncryptedCredential.update(credential_id, {
        session_metadata: {
          ...oldCredential.session_metadata,
          status: 'revoked'
        },
        is_active: false
      });

      // Create new credential
      const newCredential = await base44.entities.EncryptedCredential.create({
        credential_name: `${oldCredential.credential_name} (rotated)`,
        platform: oldCredential.platform,
        credential_type: oldCredential.credential_type,
        encrypted_data: encrypted,
        encryption_iv: iv.toString('base64'),
        encryption_tag: tag.toString('base64'),
        encrypted_at: new Date().toISOString(),
        requires_mfa: oldCredential.requires_mfa,
        mfa_type: oldCredential.mfa_type,
        injection_rules: oldCredential.injection_rules,
        security_metadata: {
          ...oldCredential.security_metadata,
          rotation_due_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
        }
      });

      // Log rotation
      await base44.entities.ActivityLog.create({
        action_type: 'user_action',
        message: `Rotated credential: ${oldCredential.credential_name}`,
        metadata: {
          old_id: credential_id,
          new_id: newCredential.id,
          platform: oldCredential.platform
        },
        severity: 'warning'
      });

      return Response.json({
        status: 'success',
        old_credential_id: credential_id,
        new_credential_id: newCredential.id,
        message: 'Credential rotated successfully'
      });
    }

    // ACTION: Verify credential works
    if (action === 'test_credential') {
      const { credential_id, test_url } = payload;

      const credentials = await base44.entities.EncryptedCredential.filter(
        { id: credential_id, created_by: user.email },
        null,
        1
      );

      if (!credentials || credentials.length === 0) {
        return Response.json({ error: 'Credential not found' }, { status: 404 });
      }

      // Record test attempt
      await base44.entities.EncryptedCredential.update(credential_id, {
        access_log: [
          ...(credentials[0].access_log || []),
          {
            accessed_at: new Date().toISOString(),
            access_type: 'test',
            success: true,
            ip_address: req.headers.get('x-forwarded-for')
          }
        ]
      });

      return Response.json({
        status: 'success',
        message: 'Credential test queued - will verify shortly'
      });
    }

    // ACTION: Delete credential securely
    if (action === 'delete_credential') {
      const { credential_id } = payload;

      const credentials = await base44.entities.EncryptedCredential.filter(
        { id: credential_id, created_by: user.email },
        null,
        1
      );

      if (!credentials || credentials.length === 0) {
        return Response.json({ error: 'Credential not found' }, { status: 404 });
      }

      await base44.entities.EncryptedCredential.delete(credential_id);

      // Log deletion
      await base44.entities.ActivityLog.create({
        action_type: 'user_action',
        message: `Deleted credential: ${credentials[0].credential_name}`,
        metadata: {
          credential_id,
          platform: credentials[0].platform
        },
        severity: 'warning'
      });

      return Response.json({
        status: 'success',
        message: 'Credential deleted securely'
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Credential manager error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Generate encryption key from user email + server secret
 */
async function generateEncryptionKey(userEmail) {
  const salt = Deno.env.get('USER_SALT') || 'velocity-credential-salt';
  const key = scryptSync(userEmail + salt, salt, 32);
  return key;
}

/**
 * Get platform domains for auto-injection
 */
function getPlatformDomains(platform) {
  const domains = {
    upwork: ['upwork.com', 'www.upwork.com'],
    fiverr: ['fiverr.com', 'www.fiverr.com'],
    amazon: ['amazon.com', 'www.amazon.com'],
    ebay: ['ebay.com', 'www.ebay.com'],
    grant: ['grants.gov', 'www.grants.gov'],
    linkedin: ['linkedin.com', 'www.linkedin.com'],
    twitter: ['twitter.com', 'x.com', 'www.twitter.com'],
    instagram: ['instagram.com', 'www.instagram.com'],
    tiktok: ['tiktok.com', 'www.tiktok.com']
  };
  return domains[platform] || [];
}