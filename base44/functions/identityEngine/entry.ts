/**
 * Identity Engine
 * Actions:
 *   get_active          — returns the currently active identity with full context
 *   switch_identity     — switches the active identity and propagates to all modules
 *   inject_identity     — returns identity-injected context for an AI action
 *   auto_select         — AI picks best identity for a given task type
 *   create_account      — autonomously creates a platform account using active identity
 *   log_identity_action — appends an audit event for this identity
 *   get_audit_log       — returns filtered identity audit events
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ── get_active ─────────────────────────────────────────────────────────────
    if (action === 'get_active') {
      const identities = await base44.entities.AIIdentity.filter({ created_by: user.email }, '-updated_date', 50);
      const active = identities.find(i => i.is_active) || identities[0];

      if (!active) return Response.json({ identity: null, has_identity: false });

      // Enrich with linked accounts
      const linkedAccounts = active.linked_account_ids?.length
        ? await base44.asServiceRole.entities.LinkedAccount.list()
        : [];
      const accounts = linkedAccounts.filter(a => active.linked_account_ids?.includes(a.id));

      // Credential metadata (no payload)
      let bankMeta = null;
      if (active.bank_vault_credential_id) {
        const vaultRes = await base44.functions.invoke('credentialVault', {
          action: 'list'
        });
        const creds = vaultRes?.data?.credentials || [];
        bankMeta = creds.find(c => c.id === active.bank_vault_credential_id) || null;
      }

      return Response.json({
        identity: active,
        linked_accounts: accounts,
        bank_meta: bankMeta,
        all_identities: identities,
        has_identity: true
      });
    }

    // ── switch_identity ────────────────────────────────────────────────────────
    if (action === 'switch_identity') {
      const { identity_id } = body;
      if (!identity_id) return Response.json({ error: 'identity_id required' }, { status: 400 });

      // Deactivate all, activate the target
      const all = await base44.entities.AIIdentity.filter({ created_by: user.email });
      await Promise.all(all.map(id =>
        base44.entities.AIIdentity.update(id.id, { is_active: id.id === identity_id })
      ));

      const updated = await base44.entities.AIIdentity.filter({ id: identity_id });
      const newIdentity = updated[0];

      // Propagate: update UserGoals ai_instructions with identity context
      const goals = await base44.asServiceRole.entities.UserGoals.list();
      if (goals[0] && newIdentity) {
        await base44.asServiceRole.entities.UserGoals.update(goals[0].id, {
          ai_instructions: `Active Identity: ${newIdentity.name}. Tone: ${newIdentity.communication_tone}. ${newIdentity.proposal_style || ''} ${newIdentity.bio || ''}`.trim()
        });
      }

      // Propagate to LinkedAccounts: set ai_can_use based on linked_account_ids
      if (newIdentity?.linked_account_ids?.length) {
        const allAccounts = await base44.asServiceRole.entities.LinkedAccount.list();
        await Promise.all(allAccounts.map(acc =>
          base44.asServiceRole.entities.LinkedAccount.update(acc.id, {
            ai_can_use: newIdentity.linked_account_ids.includes(acc.id)
          })
        ));
      }

      // Update last_used_at
      await base44.entities.AIIdentity.update(identity_id, {
        last_used_at: new Date().toISOString()
      });

      // Audit log
      await base44.asServiceRole.entities.AIWorkLog.create({
        log_type: 'account_action',
        subject: `Identity switched to: ${newIdentity?.name}`,
        content_preview: `Role: ${newIdentity?.role_label} | Tone: ${newIdentity?.communication_tone}`,
        ai_decision_context: `User manually switched active identity to "${newIdentity?.name}"`,
        metadata: { identity_id, identity_name: newIdentity?.name, switched_by: user.email }
      });

      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'user_action',
        message: `🎭 Identity switched to "${newIdentity?.name}" (${newIdentity?.role_label || 'custom'})`,
        severity: 'info',
        metadata: { identity_id, identity_name: newIdentity?.name }
      });

      return Response.json({ success: true, identity: newIdentity });
    }

    // ── inject_identity ────────────────────────────────────────────────────────
    if (action === 'inject_identity') {
      const { task_type, platform, action_type } = body;

      const identities = await base44.entities.AIIdentity.filter({ created_by: user.email });
      let identity = identities.find(i => i.is_active) || identities[0];

      if (!identity) {
        return Response.json({ injected: false, reason: 'No identity configured' });
      }

      // Auto-select best identity for this task if not manually overridden
      if (identity.auto_select_for_task_types?.length > 0) {
        const better = identities.find(i =>
          i.auto_select_for_task_types?.includes(task_type) ||
          i.preferred_platforms?.includes(platform)
        );
        if (better) identity = better;
      }

      const context = {
        name: identity.name,
        email: identity.email || user.email,
        phone: identity.phone || null,
        tone: identity.communication_tone || 'professional',
        signature: identity.email_signature || `Best regards,\n${identity.name}`,
        bio: identity.bio || '',
        tagline: identity.tagline || '',
        skills: identity.skills || [],
        proposal_instructions: identity.proposal_style || `Write in a ${identity.communication_tone || 'professional'} tone as ${identity.name}.`,
        bank_label: identity.bank_label || null,
        spending_limit: identity.spending_limit_per_task || 100,
        identity_id: identity.id,
        identity_name: identity.name,
        restricted_categories: identity.earning_restriction_categories || []
      };

      // Log credential access if needed
      await base44.asServiceRole.entities.AIWorkLog.create({
        log_type: 'account_action',
        subject: `Identity context injected for ${action_type || 'task'}`,
        content_preview: `Using identity "${identity.name}" on ${platform || 'unknown'}`,
        ai_decision_context: `Identity injection for task_type: ${task_type}, platform: ${platform}`,
        metadata: { identity_id: identity.id, task_type, platform, action_type }
      });

      return Response.json({ injected: true, context, identity_id: identity.id });
    }

    // ── auto_select ────────────────────────────────────────────────────────────
    if (action === 'auto_select') {
      const { task_type, platform, category, description } = body;

      const identities = await base44.entities.AIIdentity.filter({ created_by: user.email });
      if (!identities.length) return Response.json({ identity: null });

      // Use LLM to pick best identity
      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are selecting the best AI identity profile for a task.

Available identities:
${identities.map((id, i) => `${i + 1}. "${id.name}" (${id.role_label}) — Platforms: ${id.preferred_platforms?.join(', ') || 'any'} | Categories: ${id.preferred_categories?.join(', ') || 'any'} | Tone: ${id.communication_tone} | Auto-select for: ${id.auto_select_for_task_types?.join(', ') || 'none'}`).join('\n')}

Task details:
- Type: ${task_type || 'unknown'}
- Platform: ${platform || 'unknown'}
- Category: ${category || 'unknown'}
- Description: ${description?.slice(0, 200) || 'N/A'}

Select the best identity index (1-based). Consider specialization, platform match, and category fit.

Return JSON: { "selected_index": number, "reasoning": string }`,
        response_json_schema: {
          type: "object",
          properties: {
            selected_index: { type: "number" },
            reasoning: { type: "string" }
          }
        }
      });

      const idx = Math.max(0, Math.min((result?.selected_index || 1) - 1, identities.length - 1));
      const selected = identities[idx];

      return Response.json({
        identity: selected,
        reasoning: result?.reasoning || 'Best match selected',
        auto_selected: true
      });
    }

    // ── create_account ─────────────────────────────────────────────────────────
    if (action === 'create_account') {
      const { platform, purpose, identity_id } = body;

      const identities = await base44.entities.AIIdentity.filter({ created_by: user.email });
      const identity = identity_id
        ? identities.find(i => i.id === identity_id)
        : identities.find(i => i.is_active) || identities[0];

      if (!identity) return Response.json({ error: 'No identity available' }, { status: 400 });

      // Check if account already exists
      const existingAccounts = await base44.asServiceRole.entities.LinkedAccount.filter({ platform });
      if (existingAccounts.length > 0) {
        return Response.json({
          already_exists: true,
          account: existingAccounts[0],
          message: `Account already exists for ${platform}`
        });
      }

      // Use LLM to generate account details
      const generated = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are creating a new freelance platform account for an AI agent operating under the identity "${identity.name}".

Identity details:
- Name: ${identity.name}
- Email: ${identity.email || 'will be assigned'}
- Bio: ${identity.bio || 'Professional freelancer'}
- Skills: ${identity.skills?.join(', ') || 'general'}
- Tagline: ${identity.tagline || ''}
- Tone: ${identity.communication_tone}

Platform: ${platform}
Purpose: ${purpose || 'General freelancing'}

Generate realistic account details that would be used to register on this platform. Create a strong username derived from the identity name, a secure password, profile headline, and setup instructions.

Return JSON:
{
  "username": string,
  "email": string,
  "password": string,
  "profile_headline": string,
  "profile_description": string,
  "setup_steps": [string],
  "specialization": string
}`,
        response_json_schema: {
          type: "object",
          properties: {
            username: { type: "string" },
            email: { type: "string" },
            password: { type: "string" },
            profile_headline: { type: "string" },
            profile_description: { type: "string" },
            setup_steps: { type: "array", items: { type: "string" } },
            specialization: { type: "string" }
          }
        }
      });

      // Store credentials in vault
      const vaultResult = await base44.functions.invoke('credentialVault', {
        action: 'store',
        platform,
        credential_type: 'login',
        credentials: {
          username: generated.username,
          password: generated.password,
          email: generated.email
        }
      });

      // Create LinkedAccount record
      const newAccount = await base44.asServiceRole.entities.LinkedAccount.create({
        platform,
        username: generated.username,
        label: `${identity.name} — ${platform}`,
        specialization: generated.specialization || purpose,
        skills: identity.skills || [],
        health_status: 'healthy',
        ai_can_use: true,
        encrypted_credential_id: vaultResult?.data?.vault_id || null,
        notes: `Auto-created by identity engine for identity "${identity.name}". Purpose: ${purpose}`,
        profile_url: null,
        performance_score: 50
      });

      // Link account to identity
      const updatedLinkedIds = [...(identity.linked_account_ids || []), newAccount.id];
      await base44.entities.AIIdentity.update(identity.id, {
        linked_account_ids: updatedLinkedIds
      });

      // Audit
      await base44.asServiceRole.entities.AIWorkLog.create({
        log_type: 'account_action',
        linked_account_id: newAccount.id,
        platform,
        subject: `New account created on ${platform} for identity "${identity.name}"`,
        content_preview: `Username: ${generated.username} | ${generated.profile_headline}`,
        ai_decision_context: `Autonomous account creation triggered. Purpose: ${purpose}`,
        metadata: {
          identity_id: identity.id, platform, vault_id: vaultResult?.data?.vault_id,
          setup_steps: generated.setup_steps
        }
      });

      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `🤖 Auto-created ${platform} account "@${generated.username}" for identity "${identity.name}"`,
        severity: 'success',
        metadata: { platform, account_id: newAccount.id, identity_id: identity.id }
      });

      return Response.json({
        success: true,
        account: newAccount,
        vault_id: vaultResult?.data?.vault_id,
        generated_profile: {
          username: generated.username,
          headline: generated.profile_headline,
          specialization: generated.specialization,
          setup_steps: generated.setup_steps
        }
      });
    }

    // ── log_identity_action ────────────────────────────────────────────────────
    if (action === 'log_identity_action') {
      const { identity_id, event_type, details, amount } = body;
      await base44.asServiceRole.entities.AIWorkLog.create({
        log_type: 'account_action',
        subject: event_type,
        content_preview: details,
        ai_decision_context: details,
        revenue_associated: amount || 0,
        metadata: { identity_id, event_type }
      });
      return Response.json({ success: true });
    }

    // ── get_audit_log ──────────────────────────────────────────────────────────
    if (action === 'get_audit_log') {
      const { identity_id, limit = 50 } = body;
      const logs = await base44.asServiceRole.entities.AIWorkLog.list('-created_date', limit);
      const filtered = identity_id
        ? logs.filter(l => l.metadata?.identity_id === identity_id)
        : logs;
      return Response.json({ logs: filtered });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});