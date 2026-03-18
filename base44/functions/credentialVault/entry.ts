/**
 * Credential Vault — AES-256-GCM encrypt/decrypt/access credentials
 * SECURITY: Credentials are encrypted at rest. Key derived from APP_ID + user ID.
 * Never logs raw credentials. Every access is audited.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const APP_ID = Deno.env.get('BASE44_APP_ID') || 'profit_engine';

async function getKey(userId) {
  const raw = new TextEncoder().encode(`${APP_ID}-vault-key-${userId}`);
  const hash = await crypto.subtle.digest('SHA-256', raw);
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function toBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromBase64(str) {
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

async function encryptCredential(userId, data) {
  const key = await getKey(userId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return { encrypted_payload: toBase64(encrypted), iv: toBase64(iv) };
}

async function decryptCredential(userId, encrypted_payload, iv) {
  const key = await getKey(userId);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(iv) },
    key,
    fromBase64(encrypted_payload)
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // ── ACTION: store ─────────────────────────────────────────────────────────
    if (action === 'store') {
      const { platform, credential_type, credentials, linked_account_id, expires_at } = body;
      if (!credentials || !platform) return Response.json({ error: 'platform and credentials required' }, { status: 400 });

      const { encrypted_payload, iv } = await encryptCredential(user.id, credentials);

      const record = await base44.entities.CredentialVault.create({
        platform,
        credential_type: credential_type || 'login',
        encrypted_payload,
        iv,
        linked_account_id: linked_account_id || null,
        is_active: true,
        expires_at: expires_at || null,
        access_count: 0,
        access_log: [{ timestamp: new Date().toISOString(), task_id: 'initial_store', action: 'stored', purpose: 'User stored credential' }]
      });

      // Return only the vault ID — never the payload
      return Response.json({ success: true, vault_id: record.id, platform });
    }

    // ── ACTION: retrieve (AI task use only) ───────────────────────────────────
    if (action === 'retrieve') {
      const { vault_id, task_id, purpose } = body;
      if (!vault_id) return Response.json({ error: 'vault_id required' }, { status: 400 });

      const records = await base44.entities.CredentialVault.filter({ id: vault_id });
      const record = records[0];
      if (!record) return Response.json({ error: 'Credential not found' }, { status: 404 });
      if (!record.is_active) return Response.json({ error: 'Credential is inactive' }, { status: 403 });

      // Check expiry
      if (record.expires_at && new Date(record.expires_at) < new Date()) {
        await base44.entities.CredentialVault.update(vault_id, { is_active: false });
        return Response.json({ error: 'Credential has expired' }, { status: 403 });
      }

      const credentials = await decryptCredential(user.id, record.encrypted_payload, record.iv);

      // Audit the access
      const logs = record.access_log || [];
      logs.push({ timestamp: new Date().toISOString(), task_id: task_id || 'unknown', action: 'retrieved', purpose: purpose || 'AI task execution' });
      // Keep last 50 access logs
      const trimmed = logs.slice(-50);

      await base44.entities.CredentialVault.update(vault_id, {
        last_accessed: new Date().toISOString(),
        access_count: (record.access_count || 0) + 1,
        access_log: trimmed
      });

      await base44.asServiceRole.entities.AIWorkLog.create({
        log_type: 'credential_access',
        task_id: task_id || null,
        platform: record.platform,
        subject: `Credential accessed for ${record.platform}`,
        ai_decision_context: purpose || 'AI task execution',
        metadata: { vault_id, credential_type: record.credential_type }
      });

      return Response.json({ success: true, credentials });
    }

    // ── ACTION: list (metadata only, no payloads) ─────────────────────────────
    if (action === 'list') {
      const records = await base44.entities.CredentialVault.list('-created_date', 50);
      // Strip encrypted data from response
      const safe = records.map(r => ({
        id: r.id,
        platform: r.platform,
        credential_type: r.credential_type,
        linked_account_id: r.linked_account_id,
        is_active: r.is_active,
        access_count: r.access_count,
        last_accessed: r.last_accessed,
        expires_at: r.expires_at,
        created_date: r.created_date
      }));
      return Response.json({ credentials: safe });
    }

    // ── ACTION: delete ────────────────────────────────────────────────────────
    if (action === 'delete') {
      const { vault_id } = body;
      await base44.entities.CredentialVault.update(vault_id, { is_active: false, encrypted_payload: '', iv: '' });
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});