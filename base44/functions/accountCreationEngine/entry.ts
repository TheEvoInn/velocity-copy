import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ── Real AES-256-GCM encryption helpers ──────────────────────────────────────
async function encryptCredentials(data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode((Deno.env.get('CREDENTIAL_ENCRYPTION_KEY') || 'velocity-secure-key-32-chars-pad').substring(0, 32).padEnd(32, '0')),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    keyMaterial,
    new TextEncoder().encode(JSON.stringify(data))
  );
  return {
    encrypted_payload: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv))
  };
}

function generateSecurePassword(length = 18) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*_+-=';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  let pwd = '';
  for (let i = 0; i < length; i++) pwd += charset[array[i] % charset.length];
  return pwd;
}

// ── Deduplication guard ───────────────────────────────────────────────────────
async function accountAlreadyExists(base44, platform, identityId) {
  const [inLinkedAccount, inLinkedAccountCreation] = await Promise.all([
    base44.asServiceRole.entities.LinkedAccount.filter({ platform }).catch(() => []),
    base44.asServiceRole.entities.LinkedAccountCreation.filter({
      platform,
      identity_id: identityId,
      account_status: { $ne: 'banned' }
    }).catch(() => [])
  ]);
  const existing = inLinkedAccountCreation.find(a => a.identity_id === identityId);
  return { exists: !!(inLinkedAccount.length || existing), record: existing || inLinkedAccount[0] || null };
}

// ── Get or create default Autopilot identity ────────────────────────────────
async function getOrCreateAutopilotIdentity(base44, userEmail) {
  try {
    const existing = await base44.asServiceRole.entities.AIIdentity.filter(
      { user_email: userEmail, name: 'Autopilot Default' },
      '-created_date',
      1
    ).catch(() => []);
    
    if (existing && existing.length > 0) return existing[0];
    
    const newIdentity = await base44.asServiceRole.entities.AIIdentity.create({
      user_email: userEmail,
      name: 'Autopilot Default',
      role_label: 'Autonomous Agent',
      is_active: true,
      onboarding_complete: false,
      email: userEmail,
      communication_tone: 'professional',
      skills: ['general', 'automation', 'account_creation'],
      preferred_platforms: ['upwork', 'fiverr', 'generic']
    });
    return newIdentity;
  } catch (e) {
    console.error('getOrCreateAutopilotIdentity error:', e.message);
    return null;
  }
}

// Multi-step automated account creation wizard with onboarding
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    let { action, platform, identity_id, on_demand } = body;
    
    // AUTO-RESOLVE: If identity_id is missing or invalid, use/create default Autopilot identity
    if (!identity_id || identity_id === 'autopilot-default') {
      const autopilotIdentity = await getOrCreateAutopilotIdentity(base44, user.email);
      if (!autopilotIdentity) {
        return Response.json({ error: 'Failed to resolve or create Autopilot identity' }, { status: 500 });
      }
      identity_id = autopilotIdentity.id;
    }

    // ── check_and_create_account ────────────────────────────────────────────────
    if (action === 'check_and_create_account') {
      if (!platform || !identity_id) {
        return Response.json({ error: 'platform and identity_id required' }, { status: 400 });
      }

      const dupCheck = await accountAlreadyExists(base44, platform, identity_id);
      if (dupCheck.exists) {
        return Response.json({
          success: true,
          exists: true,
          account: dupCheck.record,
          message: 'Account already exists (dedup guard)'
        });
      }

      const identities = await base44.asServiceRole.entities.AIIdentity.filter({ id: identity_id }).catch(() => []);
      if (!Array.isArray(identities) || !identities.length) return Response.json({ error: 'Identity not found' }, { status: 404 });

      const ident = identities[0];
      if (!ident || !ident.id) return Response.json({ error: 'Invalid identity data' }, { status: 400 });

      // Generate account creation strategy
      let strategy;
      try {
        strategy = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Generate account creation strategy for:\n\n      Platform: ${platform || 'unknown'}\n      Identity: ${ident?.name || 'Unknown'} (${ident?.role_label || 'Freelancer'})\n      Email: ${ident?.email || 'auto@system.local'}\n      Skills: ${Array.isArray(ident?.skills) ? ident.skills.join(', ') : 'General'}\n      Bio: ${ident?.bio || ''}\n\nProvide a step-by-step strategy including:\n1. Username generation (3 suggestions)\n2. Password requirements\n3. Required profile fields\n4. Verification steps\n5. Initial profile content (using the identity's skills and bio)\n6. Platform-specific considerations\n7. Time estimate to full activation\n\nReturn JSON:\n{\n  "username_suggestions": [string],\n  "password_requirements": string,\n  "required_fields": [{ name: string, value: string }],\n  "verification_steps": [string],\n  "profile_content": {\n    "bio": string,\n    "tagline": string,\n    "headline": string\n  },\n  "estimated_hours_to_activate": number,\n  "critical_warnings": [string]\n}`,
          response_json_schema: {
            type: 'object',
            properties: {
              username_suggestions: { type: 'array', items: { type: 'string' } },
              password_requirements: { type: 'string' },
              required_fields: { type: 'array', items: { type: 'object' } },
              verification_steps: { type: 'array', items: { type: 'string' } },
              profile_content: { type: 'object' },
              estimated_hours_to_activate: { type: 'number' },
              critical_warnings: { type: 'array', items: { type: 'string' } }
            }
          }
        });
      } catch (e) {
        console.error('Strategy generation error:', e.message);
        throw e;
      }

      // Create account record
      const suggestions = Array.isArray(strategy?.username_suggestions) ? strategy.username_suggestions : [];
      const username = (suggestions.length > 0 && suggestions[0]) ? String(suggestions[0]) : `${String(ident?.name || 'user').toLowerCase().replace(/\s+/g, '')}_${Math.random().toString(36).substr(2, 9)}`;
      const password = generateSecurePassword();

      const account = await base44.asServiceRole.entities.LinkedAccountCreation.create({
        platform,
        identity_id,
        identity_name: ident?.name || 'Unknown',
        username,
        email: ident?.email || 'auto@system.local',
        account_status: 'activating',
        is_ai_created: true,
        creation_timestamp: new Date().toISOString(),
        creation_logs: [{
          timestamp: new Date().toISOString(),
          event: 'created',
          details: `Account auto-created for identity "${ident?.name || 'Unknown'}"`
        }]
      });

      // Store credentials with real AES-256-GCM encryption
      const { encrypted_payload, iv } = await encryptCredentials({ username, password, email: ident?.email || '' });
      const vault = await base44.asServiceRole.entities.CredentialVault.create({
        platform,
        credential_type: 'login',
        linked_account_id: account.id,
        encrypted_payload,
        iv,
        is_active: true
      });

      // Update account with vault reference
      await base44.asServiceRole.entities.LinkedAccountCreation.update(account.id, {
        credential_vault_id: vault.id
      }).catch(e => console.error('Failed to link vault:', e.message));

      // Log account creation
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `🔑 Account auto-created: ${platform} for "${ident.name}"`,
        severity: 'success',
        metadata: {
          platform,
          identity_id,
          account_id: account.id,
          username,
          is_ai_created: true
        }
      });

      return Response.json({
        success: true,
        created: true,
        account,
        strategy,
        next_steps: 'Onboarding workflow ready. Use account_onboarding action to proceed.'
      });
    }

    // ── multi_step_onboarding ───────────────────────────────────────────────────
    if (action === 'multi_step_onboarding') {
      const { account_id, step, step_data } = body;

      if (!account_id || !step) {
        return Response.json({ error: 'account_id and step required' }, { status: 400 });
      }

      const accounts = await base44.asServiceRole.entities.LinkedAccountCreation.filter({ id: account_id }).catch(() => []);
      const safeAccount = Array.isArray(accounts) ? accounts : [];
      if (!safeAccount.length || !safeAccount[0]) {
        return Response.json({ error: 'Account not found' }, { status: 404 });
      }

      const acct = safeAccount[0];
      const identities = await base44.asServiceRole.entities.AIIdentity.filter({ id: acct.identity_id }).catch(() => []);
      const safeIdentity = Array.isArray(identities) && identities.length ? identities[0] : null;

      if (!acct.onboarding_steps) {
        acct.onboarding_steps = generateOnboardingSteps(acct.platform, safeIdentity);
      }

      const steps = acct.onboarding_steps || [];
      const stepIndex = steps.findIndex(s => s.step_id === step);
      
      if (stepIndex === -1) {
        return Response.json({ error: 'Step not found' }, { status: 404 });
      }

      steps[stepIndex].status = 'completed';
      steps[stepIndex].completed_at = new Date().toISOString();
      steps[stepIndex].data = step_data || {};

      const completedSteps = steps.filter(s => s.status === 'completed').length;
      const progressPercent = Math.round((completedSteps / steps.length) * 100);

      const updated = await base44.asServiceRole.entities.LinkedAccountCreation.update(account_id, {
        onboarding_steps: steps,
        profile_completeness: progressPercent,
        activation_status: progressPercent === 100 ? 'active' : 'onboarding',
        last_onboarding_step: step,
        last_onboarding_update: new Date().toISOString()
      });

      return Response.json({
        success: true,
        account: updated,
        progress: {
          current_step: stepIndex + 1,
          total_steps: steps.length,
          percent_complete: progressPercent,
          steps_completed: completedSteps
        },
        next_step: stepIndex + 1 < steps.length ? steps[stepIndex + 1] : null,
        is_complete: progressPercent === 100
      });
    }

    // ── get_onboarding_status ──────────────────────────────────────────────────
    if (action === 'get_onboarding_status') {
      const { account_id } = body;

      if (!account_id) return Response.json({ error: 'account_id required' }, { status: 400 });

      const accounts = await base44.asServiceRole.entities.LinkedAccountCreation.filter({ id: account_id }).catch(() => []);
      const safeAccount = Array.isArray(accounts) ? accounts : [];
      if (!safeAccount.length || !safeAccount[0]) {
        return Response.json({ error: 'Account not found' }, { status: 404 });
      }

      const acct = safeAccount[0];
      const identities = await base44.asServiceRole.entities.AIIdentity.filter({ id: acct.identity_id }).catch(() => []);
      const safeIdentity = Array.isArray(identities) && identities.length ? identities[0] : null;

      if (!acct.onboarding_steps) {
        acct.onboarding_steps = generateOnboardingSteps(acct.platform, safeIdentity);
      }

      const steps = acct.onboarding_steps;
      const completedSteps = steps.filter(s => s.status === 'completed').length;
      const progressPercent = Math.round((completedSteps / steps.length) * 100);

      return Response.json({
        success: true,
        account_id,
        platform: acct.platform,
        activation_status: acct.activation_status || 'pending',
        progress: {
          percent_complete: progressPercent,
          current_step: completedSteps + 1,
          total_steps: steps.length,
          steps_completed: completedSteps
        },
        steps,
        is_complete: progressPercent === 100,
        profile_completeness: acct.profile_completeness || 0
      });
    }

    // ── override_with_user_account ──────────────────────────────────────────────
    if (action === 'override_with_user_account') {
      const body3 = await req.json().catch(() => ({}));
      const { account_id, user_username, user_credential_data } = body3;

      if (!account_id || !user_credential_data) {
        return Response.json({ error: 'account_id and user_credential_data required' }, { status: 400 });
      }

      const accounts = await base44.asServiceRole.entities.LinkedAccountCreation.filter({ id: account_id }).catch(() => []);
      const safeAccount = Array.isArray(accounts) ? accounts : [];
      if (!safeAccount.length || !safeAccount[0]) return Response.json({ error: 'Account not found' }, { status: 404 });

      try {
        const { encrypted_payload: ep, iv: encIv } = await encryptCredentials(user_credential_data || {});
        const newVault = await base44.asServiceRole.entities.CredentialVault.create({
          platform: safeAccount[0]?.platform || 'unknown',
          credential_type: 'login',
          linked_account_id: account_id,
          encrypted_payload: ep,
          iv: encIv,
          is_active: true
        });

        if (safeAccount[0]?.credential_vault_id) {
          try {
            await base44.asServiceRole.entities.CredentialVault.delete(safeAccount[0].credential_vault_id).catch(() => {});
          } catch (e) {
            console.error('Vault deletion error:', e.message);
          }
        }

        const updated = await base44.asServiceRole.entities.LinkedAccountCreation.update(account_id, {
          is_user_override: true,
          user_override_username: user_username || 'user',
          credential_vault_id: newVault.id,
          account_status: 'active'
        });

        await base44.asServiceRole.entities.ActivityLog.create({
          action_type: 'user_action',
          message: `🔄 User account override: "${safeAccount[0]?.platform || 'unknown'}"`,
          severity: 'info',
          metadata: { account_id, platform: safeAccount[0]?.platform, is_user_account: true }
        }).catch(e => console.error('Activity log error:', e.message));

        return Response.json({
          success: true,
          account: updated,
          message: 'User account linked successfully'
        });
      } catch (e) {
        console.error('Override error:', e.message);
        throw e;
      }
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('Account creation engine error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Helper: Generate platform-specific onboarding steps
function generateOnboardingSteps(platform, identity) {
  const baseSteps = [
    {
      step_id: 'profile_setup',
      title: 'Profile Setup',
      description: 'Configure basic profile information',
      category: 'profile',
      status: 'pending',
      required: true,
      checklist: ['Add profile photo', 'Fill in bio/headline', 'Add professional summary']
    },
    {
      step_id: 'identity_verification',
      title: 'Identity Verification',
      description: 'Verify email and identity',
      category: 'verification',
      status: 'pending',
      required: true,
      checklist: ['Verify email address', 'Add phone number', 'Complete identity check']
    },
    {
      step_id: 'skills_experience',
      title: 'Skills & Experience',
      description: 'Add your skills and work history',
      category: 'profile',
      status: 'pending',
      required: identity?.skills?.length > 0,
      checklist: ['Add professional skills', 'Add work experience', 'Upload portfolio samples']
    },
    {
      step_id: 'payment_setup',
      title: 'Payment Settings',
      description: 'Configure payment and payout methods',
      category: 'financial',
      status: 'pending',
      required: true,
      checklist: ['Add payment method', 'Configure payout account', 'Set up tax information']
    },
    {
      step_id: 'preferences',
      title: 'Preferences',
      description: 'Set platform preferences and settings',
      category: 'settings',
      status: 'pending',
      required: false,
      checklist: ['Set availability/hours', 'Configure notifications', 'Set rate/pricing']
    }
  ];

  const platformSteps = {
    upwork: [{
      step_id: 'proposals_setup',
      title: 'Proposals & Cover Letter',
      description: 'Create professional proposal templates',
      category: 'profile',
      status: 'pending',
      required: true,
      checklist: ['Write default cover letter', 'Create proposal templates', 'Set proposal rate']
    }],
    fiverr: [{
      step_id: 'gigs_setup',
      title: 'Create Gigs',
      description: 'Create your service offerings',
      category: 'profile',
      status: 'pending',
      required: true,
      checklist: ['Create at least 1 gig', 'Add gig description', 'Set pricing tiers']
    }],
    github: [{
      step_id: 'repositories_setup',
      title: 'Repository Setup',
      description: 'Create showcase repositories',
      category: 'profile',
      status: 'pending',
      required: false,
      checklist: ['Create public repositories', 'Add project README files', 'Configure profile README']
    }]
  };

  return [...baseSteps, ...(platformSteps[platform] || [])];
}