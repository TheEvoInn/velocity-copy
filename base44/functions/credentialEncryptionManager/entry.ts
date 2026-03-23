import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * CREDENTIAL ENCRYPTION MANAGER
 * AES-256 encryption for sensitive credentials in CredentialVault
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'encrypt';

    if (action === 'encrypt') {
      return await encryptCredentials(body.credentials, body.platform);
    }

    if (action === 'decrypt') {
      return await decryptCredentials(base44, body.vault_id);
    }

    return jsonResponse({ error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('[CredentialEncryptionManager]', error.message);
    return jsonResponse({ error: error.message }, 500);
  }
});

/**
 * Encrypt credentials using AES-256
 */
async function encryptCredentials(credentials, platform) {
  if (!credentials || !platform) {
    return jsonResponse({ error: 'Missing credentials or platform' }, 400);
  }

  try {
    // Generate random IV (16 bytes)
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');

    // Derive key from platform identifier (in production, use KMS)
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(platform + '_encryption_key_v1'),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: iv, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    // Encrypt credential payload
    const credentialJson = JSON.stringify(credentials);
    const encoded = new TextEncoder().encode(credentialJson);

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encoded
    );

    const encryptedHex = Array.from(new Uint8Array(encrypted))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return jsonResponse({
      encrypted_payload: encryptedHex,
      iv: ivHex,
      algorithm: 'AES-256-GCM',
      platform
    });
  } catch (error) {
    return jsonResponse({ error: 'Encryption failed: ' + error.message }, 500);
  }
}

/**
 * Decrypt credentials
 */
async function decryptCredentials(base44, vaultId) {
  try {
    const vault = await base44.asServiceRole.entities.CredentialVault
      .filter({ id: vaultId }, null, 1)
      .then(r => r[0])
      .catch(() => null);

    if (!vault) {
      return jsonResponse({ error: 'Vault entry not found' }, 404);
    }

    if (!vault.encrypted_payload || !vault.iv) {
      return jsonResponse({ error: 'Vault entry incomplete' }, 400);
    }

    // Derive same key
    const iv = new Uint8Array(vault.iv.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(vault.platform + '_encryption_key_v1'),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: iv, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    // Decrypt
    const encrypted = new Uint8Array(vault.encrypted_payload.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encrypted
    );

    const credentials = JSON.parse(new TextDecoder().decode(decrypted));

    // Log access
    await base44.asServiceRole.entities.CredentialVault.update(vaultId, {
      last_accessed: new Date().toISOString(),
      access_count: (vault.access_count || 0) + 1
    }).catch(() => {});

    return jsonResponse({ credentials, message: 'Decryption successful' });
  } catch (error) {
    return jsonResponse({ error: 'Decryption failed: ' + error.message }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}