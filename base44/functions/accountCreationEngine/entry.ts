import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Multi-step automated account creation wizard with onboarding
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action, platform, identity_id, on_demand } = body;

    // ── check_and_create_account ────────────────────────────────────────────────
    if (action === 'check_and_create_account') {
      if (!platform || !identity_id) {
        return Response.json({ error: 'platform and identity_id required' }, { status: 400 });
      }

      const identity = (await base44.asServiceRole.entities.AIIdentity.filter({ id: identity_id }).catch(() => [])) || [];
      if (!Array.isArray(identity) || !identity.length) return Response.json({ error: 'Identity not found' }, { status: 404 });

      const ident = identity[0];
      if (!ident || !ident.id) return Response.json({ error: 'Invalid identity data' }, { status: 400 });

      // Check if account already exists
      const existing = (await base44.asServiceRole.entities.LinkedAccountCreation.filter({
        platform,
        identity_id,
        account_status: { $ne: 'banned' }
      }).catch(() => [])) || [];

      const safeExisting = Array.isArray(existing) ? existing : [];
      if (safeExisting.length && safeExisting[0] && safeExisting[0].is_user_override) {
        return Response.json({
          success: true,
          exists: true,
          account: existing[0],
          message: 'User account already linked'
        });
      }

      if (safeExisting.length && safeExisting[0] && safeExisting[0].onboarding_completed) {
        return Response.json({
          success: true,
          exists: true,
          account: safeExisting[0],
          message: 'Account already created and active'
        });
      }

      // Generate account creation strategy
      try {
        const strategy = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Generate account creation strategy for:

      Platform: ${platform || 'unknown'}
      Identity: ${ident?.name || 'Unknown'} (${ident?.role_label || 'Freelancer'})
      Email: ${ident?.email || 'auto@system.local'}
      Skills: ${Array.isArray(ident?.skills) ? ident.skills.join(', ') : 'General'}
      Bio: ${ident?.bio || ''}

Provide a step-by-step strategy including:
1. Username generation (3 suggestions)
2. Password requirements
3. Required profile fields
4. Verification steps
5. Initial profile content (using the identity's skills and bio)
6. Platform-specific considerations
7. Time estimate to full activation

Return JSON:
{
  "username_suggestions": [string],
  "password_requirements": string,
  "required_fields": [{ name: string, value: string }],
  "verification_steps": [string],
  "profile_content": {
    "bio": string,
    "tagline": string,
    "headline": string
  },
  "estimated_hours_to_activate": number,
  "critical_warnings": [string]
}`,
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

      // Create account record
      const suggestions = Array.isArray(strategy?.username_suggestions) ? strategy.username_suggestions : [];
      const username = (suggestions.length > 0 && suggestions[0]) ? String(suggestions[0]) : `${String(ident?.name || 'user').toLowerCase().replace(/\s+/g, '')}_${Math.random().toString(36).substr(2, 9)}`;
      const password = btoa(`${username}${Date.now()}`).slice(0, 16);

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

      // Store encrypted credentials
      const vault = await base44.asServiceRole.entities.CredentialVault.create({
        platform,
        credential_type: 'login',
        linked_account_id: account.id,
        encrypted_payload: btoa(JSON.stringify({ username, password, email: ident?.email || 'auto@system.local' })),
        iv: 'placeholder',
        is_active: true
      });

      // Update account with vault reference
      await base44.asServiceRole.entities.LinkedAccountCreation.update(account.id, {
        credential_vault_id: vault.id
      }).catch(e => console.error('Failed to link vault:', e.message));
      } catch (e) {
      console.error('Account creation error:', e.message);
      throw e;
      }

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

      const account = (await base44.asServiceRole.entities.LinkedAccountCreation.filter({ id: account_id }).catch(() => [])) || [];
      const safeAccount = Array.isArray(account) ? account : [];
      if (!safeAccount.length || !safeAccount[0]) {
        return Response.json({ error: 'Account not found' }, { status: 404 });
      }

      const acct = safeAccount[0];
      const identity = (await base44.asServiceRole.entities.AIIdentity.filter({ id: acct.identity_id }).catch(() => [])) || [];
      const safeIdentity = Array.isArray(identity) && identity.length ? identity[0] : null;

      // Initialize onboarding steps if not present
      if (!acct.onboarding_steps) {
        acct.onboarding_steps = generateOnboardingSteps(acct.platform, safeIdentity);
      }

      // Update current step
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

      const account = (await base44.asServiceRole.entities.LinkedAccountCreation.filter({ id: account_id }).catch(() => [])) || [];
      const safeAccount = Array.isArray(account) ? account : [];
      if (!safeAccount.length || !safeAccount[0]) {
        return Response.json({ error: 'Account not found' }, { status: 404 });
      }

      const acct = safeAccount[0];
      const identity = (await base44.asServiceRole.entities.AIIdentity.filter({ id: acct.identity_id }).catch(() => [])) || [];
      const safeIdentity = Array.isArray(identity) && identity.length ? identity[0] : null;

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

      const account = (await base44.asServiceRole.entities.LinkedAccountCreation.filter({ id: account_id }).catch(() => [])) || [];
      const safeAccount = Array.isArray(account) ? account : [];
      if (!safeAccount.length || !safeAccount[0]) return Response.json({ error: 'Account not found' }, { status: 404 });

      try {
        // Store user's credentials in vault
        const newVault = await base44.asServiceRole.entities.CredentialVault.create({
          platform: safeAccount[0]?.platform || 'unknown',
          credential_type: 'login',
          linked_account_id: account_id,
          encrypted_payload: btoa(JSON.stringify(user_credential_data || {})),
          iv: 'placeholder',
          is_active: true
        });

        // Delete old vault if exists
        if (safeAccount[0]?.credential_vault_id) {
          try {
            await base44.asServiceRole.entities.CredentialVault.delete(safeAccount[0].credential_vault_id).catch(() => {});
          } catch (e) {
            console.error('Vault deletion error:', e.message);
          }
        }

        // Update account as user-overridden
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
      } catch (e) {
        console.error('Override error:', e.message);
        throw e;
      }

      return Response.json({
        success: true,
        account: updated,
        message: 'User account linked successfully'
      });
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
      checklist: [
        'Add profile photo',
        'Fill in bio/headline',
        'Add professional summary'
      ]
    },
    {
      step_id: 'identity_verification',
      title: 'Identity Verification',
      description: 'Verify email and identity',
      category: 'verification',
      status: 'pending',
      required: true,
      checklist: [
        'Verify email address',
        'Add phone number',
        'Complete identity check'
      ]
    },
    {
      step_id: 'skills_experience',
      title: 'Skills & Experience',
      description: 'Add your skills and work history',
      category: 'profile',
      status: 'pending',
      required: identity?.skills?.length > 0,
      checklist: [
        'Add professional skills',
        'Add work experience',
        'Upload portfolio samples'
      ]
    },
    {
      step_id: 'payment_setup',
      title: 'Payment Settings',
      description: 'Configure payment and payout methods',
      category: 'financial',
      status: 'pending',
      required: true,
      checklist: [
        'Add payment method',
        'Configure payout account',
        'Set up tax information'
      ]
    },
    {
      step_id: 'preferences',
      title: 'Preferences',
      description: 'Set platform preferences and settings',
      category: 'settings',
      status: 'pending',
      required: false,
      checklist: [
        'Set availability/hours',
        'Configure notifications',
        'Set rate/pricing'
      ]
    }
  ];

  // Add platform-specific steps
  const platformSteps = {
    upwork: [
      {
        step_id: 'proposals_setup',
        title: 'Proposals & Cover Letter',
        description: 'Create professional proposal templates',
        category: 'profile',
        status: 'pending',
        required: true,
        checklist: [
          'Write default cover letter',
          'Create proposal templates',
          'Set proposal rate'
        ]
      }
    ],
    fiverr: [
      {
        step_id: 'gigs_setup',
        title: 'Create Gigs',
        description: 'Create your service offerings',
        category: 'profile',
        status: 'pending',
        required: true,
        checklist: [
          'Create at least 1 gig',
          'Add gig description',
          'Set pricing tiers'
        ]
      }
    ],
    github: [
      {
        step_id: 'repositories_setup',
        title: 'Repository Setup',
        description: 'Create showcase repositories',
        category: 'profile',
        status: 'pending',
        required: false,
        checklist: [
          'Create public repositories',
          'Add project README files',
          'Configure profile README'
        ]
      }
    ]
  };

  return [...baseSteps, ...(platformSteps[platform] || [])];
}