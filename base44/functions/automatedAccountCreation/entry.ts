/**
 * AUTOMATED ACCOUNT CREATION (Legacy + Enhanced)
 * Routes through masterAccountCredentialEngine for real data.
 * NEVER uses fabricated emails, fake passwords, or simulated usernames.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, identity_id, platforms_to_create } = await req.json();

    // ── get_platform_list ──────────────────────────────────────────────────────
    if (action === 'get_platform_list') {
      const platforms = [
        { platform: 'upwork', label: 'Upwork', description: 'Freelance job marketplace', priority: 1, skills_required: true, profile_building: true },
        { platform: 'fiverr', label: 'Fiverr', description: 'Gig-based freelance platform', priority: 2, skills_required: true, profile_building: true },
        { platform: 'freelancer', label: 'Freelancer.com', description: 'Freelance marketplace', priority: 3, skills_required: true, profile_building: true },
        { platform: 'guru', label: 'Guru', description: 'Professional freelance marketplace', priority: 4, skills_required: true, profile_building: true },
        { platform: 'peopleperhour', label: 'PeoplePerHour', description: 'UK-based freelance platform', priority: 5, skills_required: true, profile_building: true },
        { platform: 'github', label: 'GitHub', description: 'Code portfolio & collaboration', priority: 6, skills_required: false, profile_building: false },
        { platform: 'ebay', label: 'eBay', description: 'Buy/sell marketplace', priority: 7, skills_required: false, profile_building: false },
        { platform: 'etsy', label: 'Etsy', description: 'Creative goods marketplace', priority: 8, skills_required: false, profile_building: false },
      ];
      return Response.json({ success: true, platforms, total: platforms.length });
    }

    // ── create_accounts ────────────────────────────────────────────────────────
    if (action === 'create_accounts') {
      if (!identity_id || !Array.isArray(platforms_to_create)) {
        return Response.json({ error: 'identity_id and platforms_to_create array required' }, { status: 400 });
      }

      // Resolve real master credentials — no fabrication allowed
      const credResult = await base44.functions.invoke('masterAccountCredentialEngine', {
        action: 'get_master_credentials',
        identity_id
      }).catch(e => ({ data: { success: false, error: e.message } }));

      if (!credResult.data?.success || !credResult.data?.credentials?.email) {
        // Trigger intervention — cannot proceed without real email
        await base44.asServiceRole.entities.Notification.create({
          type: 'user_action_required',
          severity: 'urgent',
          title: '⚠️ Account Creation Blocked — Missing Identity Data',
          message: 'Autopilot needs your real email and name to create platform accounts. Please complete your Identity profile.',
          user_email: user.email,
          action_type: 'user_input_required',
          is_read: false
        }).catch(() => null);

        return Response.json({
          success: false,
          error: 'Cannot create accounts: identity email missing. Please update your AI Identity profile.',
          requires_onboarding: true,
          created_count: 0,
          skipped_count: platforms_to_create.length
        });
      }

      const masterCreds = credResult.data.credentials;

      // Check existing accounts
      const existingAccounts = await base44.asServiceRole.entities.LinkedAccount.filter(
        { created_by: user.email }, '-created_date', 100
      ).catch(() => []);
      const existingPlatforms = new Set(existingAccounts.map(a => a.platform));

      const createdAccounts = [];
      const skipped = [];

      for (const platformData of platforms_to_create) {
        const platform = typeof platformData === 'string' ? platformData : platformData.platform;

        if (existingPlatforms.has(platform)) {
          skipped.push({ platform, reason: 'Account already exists' });
          continue;
        }

        // Delegate to autonomous engine for real account creation
        const creationResult = await base44.functions.invoke('autonomousAccountCreationEngine', {
          action: 'auto_create_account',
          identityId: identity_id,
          opportunity: {
            platform,
            url: `https://${platform}.com/signup`,
            id: `manual_${platform}_${Date.now()}`
          }
        }).catch(e => ({ data: { success: false, error: e.message } }));

        if (creationResult.data?.success) {
          createdAccounts.push({
            platform,
            username: masterCreds.username || creationResult.data?.account?.username,
            email: masterCreds.email,
            status: 'created',
            account_id: creationResult.data?.account_id
          });
          existingPlatforms.add(platform);
        } else {
          skipped.push({ platform, reason: creationResult.data?.error || 'Creation failed' });
        }
      }

      return Response.json({
        success: true,
        created_count: createdAccounts.length,
        skipped_count: skipped.length,
        created_accounts: createdAccounts,
        skipped,
        identity_name: masterCreds.identity_name,
        message: `Created ${createdAccounts.length} account(s) using verified identity data`
      });
    }

    // ── get_created_accounts ───────────────────────────────────────────────────
    if (action === 'get_created_accounts') {
      if (!identity_id) return Response.json({ error: 'identity_id required' }, { status: 400 });

      const accounts = await base44.entities.LinkedAccountCreation.filter(
        { identity_id, is_ai_created: true }, '-created_date', 50
      ).catch(() => []);

      return Response.json({ success: true, accounts, total: accounts.length });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[AutomatedAccountCreation]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});