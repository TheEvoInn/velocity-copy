import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Manage identities: create, update, switch, delete
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action, identity_id, data } = body;

    // ── create_identity ─────────────────────────────────────────────────────────
    if (action === 'create_identity') {
      const data_safe = data || {};
      const { name, role_label, email } = data_safe;

      if (!name || !role_label) {
        return Response.json({ error: 'name and role_label required' }, { status: 400 });
      }

      // Generate persona content via LLM
      try {
        const content = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Generate persona content for a new identity:
      Name: ${name || 'Unknown'}
      Role: ${role_label || 'Freelancer'}
      Email: ${email || 'auto@system.local'}

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
        email: email || 'auto@system.local',
        tagline: typeof content?.tagline === 'string' ? content.tagline : '',
        bio: typeof content?.bio === 'string' ? content.bio : '',
        skills: Array.isArray(content?.skills) ? content.skills : [],
        proposal_style: typeof content?.communication_tone === 'string' ? content.communication_tone : 'professional',
        is_active: true,
        color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
        icon: 'User'
      });

      // Log identity creation
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `👤 New identity created: "${name}" (${role_label})`,
        severity: 'success',
        metadata: { identity_id: identity?.id, role: role_label }
      }).catch(e => console.error('Activity log error:', e.message));

      return Response.json({ success: true, identity });
      } catch (e) {
      console.error('Identity creation error:', e.message);
      throw e;
      }
      }

    // ── update_identity ─────────────────────────────────────────────────────────
    if (action === 'update_identity') {
      if (!identity_id || !data) {
        return Response.json({ error: 'identity_id and data required' }, { status: 400 });
      }

      try {
        const identity = await base44.asServiceRole.entities.AIIdentity.update(identity_id, data);

        await base44.asServiceRole.entities.ActivityLog.create({
          action_type: 'system',
          message: `✏️ Identity updated: "${data?.name || 'Unknown'}"`,
          severity: 'info',
          metadata: { identity_id, updated_fields: Object.keys(data || {}) }
        }).catch(e => console.error('Activity log error:', e.message));

        return Response.json({ success: true, identity });
      } catch (e) {
        console.error('Identity update error:', e.message);
        throw e;
      }
    }

    // ── switch_active_identity ──────────────────────────────────────────────────
    if (action === 'switch_active_identity') {
      if (!identity_id) {
        return Response.json({ error: 'identity_id required' }, { status: 400 });
      }

      try {
        // Deactivate all identities
        const all = (await base44.asServiceRole.entities.AIIdentity.list().catch(() => [])) || [];
        const safeAll = Array.isArray(all) ? all : [];
        for (const id of safeAll) {
          if (id && id.is_active) {
            await base44.asServiceRole.entities.AIIdentity.update(id.id, { is_active: false }).catch(e => console.error(`Failed to deactivate ${id.id}:`, e.message));
          }
        }

        // Activate new identity
        const newIdentity = await base44.asServiceRole.entities.AIIdentity.update(identity_id, { is_active: true, last_used_at: new Date().toISOString() });

        // Log switch
        await base44.asServiceRole.entities.ActivityLog.create({
          action_type: 'user_action',
          message: `🔄 Identity switched to: "${newIdentity?.name || 'Unknown'}" (${newIdentity?.role_label || 'Unknown'})`,
          severity: 'info',
          metadata: { identity_id, previous_identities: safeAll.filter(i => i && i.is_active).map(i => i.id) }
        }).catch(e => console.error('Activity log error:', e.message));

        return Response.json({ success: true, identity: newIdentity });
      } catch (e) {
        console.error('Identity switch error:', e.message);
        throw e;
      }
    }

    // ── get_active_identity ──────────────────────────────────────────────────────
    if (action === 'get_active_identity') {
      const identities = (await base44.asServiceRole.entities.AIIdentity.filter({ is_active: true }).catch(() => [])) || [];
      const safeIds = Array.isArray(identities) ? identities : [];
      const active = (safeIds.length > 0 && safeIds[0]) ? safeIds[0] : null;

      if (!active) {
        try {
          // Create a default identity if none exists
          const defaultIdentity = await base44.asServiceRole.entities.AIIdentity.create({
            name: 'Default Persona',
            role_label: 'Freelancer',
            email: user?.email || 'default@system.local',
            is_active: true,
            skills: ['writing', 'research', 'problem-solving'],
            bio: 'Professional freelancer ready to take on diverse projects',
            tagline: 'Delivering quality work on time, every time',
            communication_tone: 'professional'
          });

          return Response.json({ success: true, identity: defaultIdentity, created: true });
        } catch (e) {
          console.error('Default identity creation error:', e.message);
          throw e;
        }
      }

      return Response.json({ success: true, identity: active });
      }

      // ── list_identities ─────────────────────────────────────────────────────────
      if (action === 'list_identities') {
      const identities = (await base44.asServiceRole.entities.AIIdentity.list('-last_used_at').catch(() => [])) || [];
      const safeAllIds = Array.isArray(identities) ? identities : [];

      return Response.json({
        success: true,
        identities: safeAllIds,
        active_count: safeAllIds.filter(i => i && i.is_active).length,
        total_count: safeAllIds.length
      });
      }

    // ── delete_identity ─────────────────────────────────────────────────────────
    if (action === 'delete_identity') {
      if (!identity_id) {
        return Response.json({ error: 'identity_id required' }, { status: 400 });
      }

      try {
        const identity = (await base44.asServiceRole.entities.AIIdentity.filter({ id: identity_id }).catch(() => [])) || [];
        const safeId = Array.isArray(identity) ? identity : [];
        if (!safeId.length || !safeId[0]) return Response.json({ error: 'Identity not found' }, { status: 404 });

        if (safeId[0].is_active) {
          return Response.json({ error: 'Cannot delete active identity. Switch first.' }, { status: 400 });
        }

        // Delete linked accounts for this identity
        const linkedAccounts = (await base44.asServiceRole.entities.LinkedAccountCreation.filter({
          identity_id
        }).catch(() => [])) || [];
        const safeAccounts = Array.isArray(linkedAccounts) ? linkedAccounts : [];

        for (const acct of safeAccounts) {
          if (acct && acct.credential_vault_id) {
            await base44.asServiceRole.entities.CredentialVault.delete(acct.credential_vault_id).catch(e => console.error(`Failed to delete vault ${acct.credential_vault_id}:`, e.message));
          }
        }

        // Delete the identity
        await base44.asServiceRole.entities.AIIdentity.delete(identity_id).catch(e => console.error('Failed to delete identity:', e.message));

        await base44.asServiceRole.entities.ActivityLog.create({
          action_type: 'system',
          message: `🗑️ Identity deleted: "${safeId[0]?.name || 'Unknown'}"`,
          severity: 'info',
          metadata: { identity_id, linked_accounts_deleted: safeAccounts.length }
        }).catch(e => console.error('Activity log error:', e.message));

        return Response.json({ success: true, message: 'Identity deleted' });
      } catch (e) {
        console.error('Identity deletion error:', e.message);
        throw e;
      }
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});