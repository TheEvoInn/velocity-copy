import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * PERSIST INTERVENTION CREDENTIALS
 * Store user-submitted credentials to CredentialVault for reuse
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const { intervention_id, data, user_email } = await req.json();

    if (!intervention_id || !data) {
      return jsonResponse({ error: 'intervention_id, data required' }, 400);
    }

    // Fetch intervention for context
    const intervention = await base44.asServiceRole.entities.UserIntervention.get(intervention_id).catch(() => null);

    if (!intervention) {
      return jsonResponse({ error: 'Intervention not found' }, 404);
    }

    // Extract platform + credential type from requirement_type
    let platform = 'unknown';
    let credential_type = 'login';

    if (intervention.requirement_type === 'credential') {
      platform = data.platform || 'unknown';
      credential_type = data.credential_type || 'login';
    }

    // Encrypt payload (basic example - in production use proper encryption)
    const encrypted = Buffer.from(JSON.stringify(data)).toString('base64');

    // Store in CredentialVault
    const vault = await base44.asServiceRole.entities.CredentialVault.create({
      platform,
      credential_type,
      encrypted_payload: encrypted,
      iv: 'base64_encoded_iv', // Simplified
      linked_account_id: data.linked_account_id || null,
      is_active: true,
      access_log: [{
        timestamp: new Date().toISOString(),
        task_id: intervention.task_id,
        action: 'created_from_intervention',
        purpose: intervention.requirement_type
      }]
    }).catch((err) => {
      console.error('[CredentialVault Create]', err.message);
      return null;
    });

    return jsonResponse({
      credential_stored: !!vault,
      vault_id: vault?.id || null,
      platform,
      message: 'Credentials persisted for reuse'
    });

  } catch (error) {
    console.error('[Persist Credentials]', error.message);
    return jsonResponse({ error: error.message }, 500);
  }
});

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}