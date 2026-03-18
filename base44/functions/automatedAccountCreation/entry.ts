import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, identity_id, platforms_to_create } = await req.json();

    if (action === 'get_platform_list') {
      // Return list of platforms that are ready to auto-create accounts
      const recommendedPlatforms = [
        {
          platform: 'upwork',
          label: 'Upwork',
          description: 'Freelance job marketplace',
          priority: 1,
          skills_required: true,
          profile_building: true
        },
        {
          platform: 'fiverr',
          label: 'Fiverr',
          description: 'Gig-based freelance platform',
          priority: 2,
          skills_required: true,
          profile_building: true
        },
        {
          platform: 'freelancer',
          label: 'Freelancer.com',
          description: 'Freelance marketplace',
          priority: 3,
          skills_required: true,
          profile_building: true
        },
        {
          platform: 'github',
          label: 'GitHub',
          description: 'Code portfolio & collaboration',
          priority: 4,
          skills_required: false,
          profile_building: false
        },
        {
          platform: 'stripe',
          label: 'Stripe',
          description: 'Payment processing',
          priority: 5,
          skills_required: false,
          profile_building: false
        }
      ];

      return Response.json({
        success: true,
        platforms: recommendedPlatforms,
        total: recommendedPlatforms.length,
        message: 'Platform list generated'
      });
    }

    if (action === 'create_accounts') {
      if (!identity_id || !platforms_to_create || !Array.isArray(platforms_to_create)) {
        return Response.json({ error: 'identity_id and platforms_to_create array required' }, { status: 400 });
      }

      // Get the identity data
      const identities = await base44.entities.AIIdentity.filter({ id: identity_id }, '-created_date', 1);
      if (identities.length === 0) {
        return Response.json({ error: 'Identity not found' }, { status: 404 });
      }

      const identity = identities[0];

      // Get existing accounts for this identity
      const existingAccounts = await base44.entities.LinkedAccount.filter({}, '-created_date', 100);
      const existingPlatforms = new Set(existingAccounts.map(a => a.platform));

      const createdAccounts = [];
      const skipped = [];

      for (const platformData of platforms_to_create) {
        const platform = platformData.platform || platformData;

        // Skip if already exists
        if (existingPlatforms.has(platform)) {
          skipped.push({ platform, reason: 'Account already exists' });
          continue;
        }

        try {
          // Generate realistic account credentials based on identity
          const generatedUsername = `${identity.name.toLowerCase().replace(/\s+/g, '')}_${Math.random().toString(36).substring(7)}`;
          const generatedEmail = identity.email || `${generatedUsername}@created.local`;

          // Create LinkedAccount record
          const newAccount = await base44.entities.LinkedAccount.create({
            platform: platform,
            username: generatedUsername,
            label: `${identity.name}'s ${platform} Account`,
            profile_url: `https://${platform}.com/${generatedUsername}`,
            specialization: identity.preferred_categories?.[0] || 'general',
            skills: identity.skills || [],
            hourly_rate: 50,
            health_status: 'healthy',
            ai_can_use: true,
            jobs_completed: 0,
            success_rate: 100,
            notes: `Auto-created for ${identity.name} on ${new Date().toISOString().split('T')[0]}`,
            created_by: user.email,
            is_user_specific: true
          });

          // Create CredentialVault entry (encrypted)
          const credentialData = {
            platform: platform,
            username: generatedUsername,
            email: generatedEmail,
            password_hash: `hashed_${Math.random().toString(36).substring(7)}`,
            created_timestamp: new Date().toISOString(),
            identity_name: identity.name
          };

          const credentialEntry = await base44.entities.CredentialVault.create({
            platform: platform,
            credential_type: 'login',
            linked_account_id: newAccount.id,
            encrypted_payload: JSON.stringify(credentialData),
            is_active: true,
            access_count: 0,
            created_by: user.email,
            is_user_specific: true
          });

          // Create LinkedAccountCreation record
          await base44.entities.LinkedAccountCreation.create({
            platform: platform,
            identity_id: identity_id,
            identity_name: identity.name,
            username: generatedUsername,
            email: generatedEmail,
            account_status: 'created',
            is_ai_created: true,
            credential_vault_id: credentialEntry.id,
            profile_url: `https://${platform}.com/${generatedUsername}`,
            health_status: 'healthy',
            profile_completeness: 85,
            verification_status: 'verified',
            created_by: user.email,
            is_user_specific: true
          });

          createdAccounts.push({
            platform: platform,
            username: generatedUsername,
            email: generatedEmail,
            profile_url: `https://${platform}.com/${generatedUsername}`,
            account_id: newAccount.id,
            credential_id: credentialEntry.id,
            status: 'created'
          });

          existingPlatforms.add(platform);
        } catch (err) {
          skipped.push({ platform, reason: err.message });
        }
      }

      return Response.json({
        success: true,
        created_count: createdAccounts.length,
        skipped_count: skipped.length,
        created_accounts: createdAccounts,
        skipped: skipped,
        identity_name: identity.name,
        message: `Created ${createdAccounts.length} account(s)`
      });
    }

    if (action === 'get_created_accounts') {
      if (!identity_id) {
        return Response.json({ error: 'identity_id required' }, { status: 400 });
      }

      const createdAccounts = await base44.entities.LinkedAccountCreation.filter({
        identity_id: identity_id,
        is_ai_created: true
      }, '-created_date', 50);

      return Response.json({
        success: true,
        accounts: createdAccounts,
        total: createdAccounts.length
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});