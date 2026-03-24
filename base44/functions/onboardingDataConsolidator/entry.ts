import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * ONBOARDING DATA CONSOLIDATOR
 * Syncs onboarding data across fragmented entities into unified UserDataStore
 * Runs on-demand or post-onboarding to ensure data visibility across platform
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, user_email } = body;

    if (action === 'consolidate_user_data') {
      return await consolidateUserData(base44, user_email || user.email);
    }

    if (action === 'sync_all_users') {
      if (user.role !== 'admin') {
        return Response.json({ error: 'Admin access required' }, { status: 403 });
      }
      return await syncAllUsers(base44);
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('[onboardingDataConsolidator]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function consolidateUserData(base44, userEmail) {
  console.log(`[onboardingDataConsolidator] Consolidating onboarding data for ${userEmail}`);

  try {
    // Fetch all related entities
    const [userGoals, aiIdentities, kycRecords, withdrawalPolicies] = await Promise.all([
      base44.asServiceRole.entities.UserGoals.filter({ created_by: userEmail }, '-created_date', 1)
        .catch(() => []),
      base44.asServiceRole.entities.AIIdentity.filter({ user_email: userEmail }, '-created_date', 5)
        .catch(() => []),
      base44.asServiceRole.entities.KYCVerification.filter({ user_email: userEmail }, '-created_date', 1)
        .catch(() => []),
      base44.asServiceRole.entities.WithdrawalPolicy.filter({ created_by: userEmail }, '-created_date', 1)
        .catch(() => []),
    ]);

    const goals = userGoals[0];
    const primaryIdentity = aiIdentities[0];
    const kyc = kycRecords[0];
    const withdrawal = withdrawalPolicies[0];

    // Build consolidated record
    const consolidatedData = {
      onboarding_completed: goals?.onboarded || false,
      onboarding_completed_at: goals?.created_date,
      identity_created: !!primaryIdentity?.id,
      identity_id: primaryIdentity?.id,
      identity_name: primaryIdentity?.name,
      kyc_submitted: !!kyc?.id,
      kyc_id: kyc?.id,
      kyc_status: kyc?.status,
      user_goals_saved: !!goals?.id,
      daily_target: goals?.daily_target,
      autopilot_enabled: goals?.autopilot_enabled,
      withdrawal_policy_created: !!withdrawal?.id,
      banking_configured: !!withdrawal?.bank_accounts?.length,
      onboarding_data: {
        identity: {
          name: primaryIdentity?.name,
          email: primaryIdentity?.email,
          skills: primaryIdentity?.skills,
          communication_tone: primaryIdentity?.communication_tone,
          is_active: primaryIdentity?.is_active,
        },
        preferences: {
          daily_target: goals?.daily_target,
          risk_tolerance: goals?.risk_tolerance,
          autopilot_enabled: goals?.autopilot_enabled,
          preferred_categories: goals?.preferred_categories,
          hours_per_day: goals?.hours_per_day,
        },
        banking: {
          configured: !!withdrawal?.bank_accounts?.length,
          method: withdrawal?.bank_accounts?.[0]?.account_type,
          payout_frequency: withdrawal?.auto_transfer_frequency,
        },
        kyc: {
          submitted: !!kyc?.id,
          status: kyc?.status,
          verified: kyc?.status === 'approved',
        },
      },
      all_identities: aiIdentities.map(id => ({ id: id.id, name: id.name, is_active: id.is_active })),
      data_sync_timestamp: new Date().toISOString(),
    };

    // Upsert UserDataStore with consolidated data
    const stores = await base44.asServiceRole.entities.UserDataStore.filter(
      { user_email: userEmail },
      '-created_date',
      1
    ).catch(() => []);

    let storeId;
    if (stores.length > 0) {
      await base44.asServiceRole.entities.UserDataStore.update(stores[0].id, {
        onboarding_data: consolidatedData,
        last_modified_at: new Date().toISOString(),
      });
      storeId = stores[0].id;
    } else {
      const newStore = await base44.asServiceRole.entities.UserDataStore.create({
        user_email: userEmail,
        onboarding_data: consolidatedData,
        last_modified_at: new Date().toISOString(),
      });
      storeId = newStore.id;
    }

    // Log consolidation
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `📊 Onboarding data consolidated for ${userEmail}: identity=${!!primaryIdentity?.id}, kyc=${!!kyc?.id}, goals=${!!goals?.id}, banking=${!!withdrawal?.id}`,
      severity: 'info',
      metadata: {
        user_email: userEmail,
        store_id: storeId,
        consolidated_data: consolidatedData,
      },
    }).catch(() => null);

    console.log(`[onboardingDataConsolidator] Data consolidated: ${storeId}`);

    return Response.json({
      success: true,
      user_email: userEmail,
      store_id: storeId,
      consolidated: {
        identity: !!primaryIdentity?.id,
        kyc: !!kyc?.id,
        goals: !!goals?.id,
        banking: !!withdrawal?.id,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[onboardingDataConsolidator] Consolidation failed:', error.message);
    throw error;
  }
}

async function syncAllUsers(base44) {
  const results = {
    timestamp: new Date().toISOString(),
    users_synced: 0,
    errors: [],
  };

  try {
    const users = await base44.asServiceRole.entities.User.list('-created_date', 1000)
      .catch(() => []);

    for (const user of users) {
      try {
        const result = await base44.asServiceRole.functions.invoke('onboardingDataConsolidator', {
          action: 'consolidate_user_data',
          user_email: user.email,
        });
        if (result.data?.success) results.users_synced++;
      } catch (err) {
        results.errors.push(`${user.email}: ${err.message}`);
      }
    }

    console.log(`[onboardingDataConsolidator] Synced ${results.users_synced} users`);
    return Response.json({ success: true, ...results });

  } catch (error) {
    console.error('[onboardingDataConsolidator] Bulk sync failed:', error.message);
    throw error;
  }
}