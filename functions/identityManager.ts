import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Manage identities: create, update, switch, delete
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, identity_id, data } = await req.json();

    // ── create_identity ─────────────────────────────────────────────────────────
    if (action === 'create_identity') {
      const { name, role_label, email } = data;

      // Generate persona content via LLM
      const content = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Generate persona content for a new identity:
Name: ${name}
Role: ${role_label}
Email: ${email}

Create:
1. A compelling tagline (10-15 words)
2. A 50-word bio
3. A skills list (5-8 skills relevant to "${role_label}")
4. A professional "About Me" section (30 words)
5. Upwork-style profile summary
6. Fiverr-style profile description
7. Suggested communication tone (professional, friendly, technical, casual, persuasive, etc.)

Return JSON:
{
  "tagline": string,
  "bio": string,
  "skills": [string],
  "about_me": string,
  "upwork_profile": string,
  "fiverr_profile": string,
  "communication_tone": string
}`,
        response_json_schema: {
          type: 'object',
          properties: {
            tagline: { type: 'string' },
            bio: { type: 'string' },
            skills: { type: 'array', items: { type: 'string' } },
            about_me: { type: 'string' },
            upwork_profile: { type: 'string' },
            fiverr_profile: { type: 'string' },
            communication_tone: { type: 'string' }
          }
        }
      });

      // Create identity record
      const identity = await base44.asServiceRole.entities.AIIdentity.create({
        name,
        role_label,
        email,
        tagline: content?.tagline || '',
        bio: content?.bio || '',
        skills: content?.skills || [],
        proposal_style: content?.communication_tone || 'professional',
        is_active: false,
        color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
        icon: 'User'
      });

      // Log identity creation
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `👤 New identity created: "${name}" (${role_label})`,
        severity: 'success',
        metadata: { identity_id: identity.id, role: role_label }
      });

      return Response.json({ success: true, identity });
    }

    // ── update_identity ─────────────────────────────────────────────────────────
    if (action === 'update_identity') {
      const identity = await base44.asServiceRole.entities.AIIdentity.update(identity_id, data);
      
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `✏️ Identity updated: "${data.name || 'Unknown'}"`,
        severity: 'info',
        metadata: { identity_id, updated_fields: Object.keys(data) }
      });

      return Response.json({ success: true, identity });
    }

    // ── switch_active_identity ──────────────────────────────────────────────────
    if (action === 'switch_active_identity') {
      // Deactivate all identities
      const all = await base44.asServiceRole.entities.AIIdentity.list();
      for (const id of all) {
        if (id.is_active) {
          await base44.asServiceRole.entities.AIIdentity.update(id.id, { is_active: false });
        }
      }

      // Activate new identity
      const newIdentity = await base44.asServiceRole.entities.AIIdentity.update(identity_id, { is_active: true, last_used_at: new Date().toISOString() });

      // Log switch
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'user_action',
        message: `🔄 Identity switched to: "${newIdentity.name}" (${newIdentity.role_label})`,
        severity: 'info',
        metadata: { identity_id, previous_identities: all.filter(i => i.is_active).map(i => i.id) }
      });

      return Response.json({ success: true, identity: newIdentity });
    }

    // ── get_active_identity ──────────────────────────────────────────────────────
    if (action === 'get_active_identity') {
      const identities = await base44.asServiceRole.entities.AIIdentity.filter({ is_active: true });
      const active = identities[0] || null;

      if (!active) {
        // Create a default identity if none exists
        const defaultIdentity = await base44.asServiceRole.entities.AIIdentity.create({
          name: 'Default Persona',
          role_label: 'Freelancer',
          email: user.email,
          is_active: true,
          skills: ['writing', 'research', 'problem-solving'],
          bio: 'Professional freelancer ready to take on diverse projects',
          tagline: 'Delivering quality work on time, every time',
          communication_tone: 'professional'
        });

        return Response.json({ success: true, identity: defaultIdentity, created: true });
      }

      return Response.json({ success: true, identity: active });
    }

    // ── list_identities ─────────────────────────────────────────────────────────
    if (action === 'list_identities') {
      const identities = await base44.asServiceRole.entities.AIIdentity.list('-last_used_at');
      
      return Response.json({
        success: true,
        identities,
        active_count: identities.filter(i => i.is_active).length,
        total_count: identities.length
      });
    }

    // ── delete_identity ─────────────────────────────────────────────────────────
    if (action === 'delete_identity') {
      const identity = await base44.asServiceRole.entities.AIIdentity.filter({ id: identity_id });
      if (!identity.length) return Response.json({ error: 'Identity not found' }, { status: 404 });

      if (identity[0].is_active) {
        return Response.json({ error: 'Cannot delete active identity. Switch first.' }, { status: 400 });
      }

      // Delete linked accounts for this identity
      const linkedAccounts = await base44.asServiceRole.entities.LinkedAccountCreation.filter({
        identity_id
      });

      for (const acct of linkedAccounts) {
        // Delete from CredentialVault too
        if (acct.credential_vault_id) {
          await base44.asServiceRole.entities.CredentialVault.delete(acct.credential_vault_id);
        }
      }

      // Delete the identity
      await base44.asServiceRole.entities.AIIdentity.delete(identity_id);

      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `🗑️ Identity deleted: "${identity[0].name}"`,
        severity: 'info',
        metadata: { identity_id, linked_accounts_deleted: linkedAccounts.length }
      });

      return Response.json({ success: true, message: 'Identity deleted' });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});