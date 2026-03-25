import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * TEST EARNINGS INJECTOR
 * Injects real-shaped test data into Transaction records
 * Allows Tier 3-4 to operate without live platform APIs
 * For development/testing only — swapped with real sync when APIs available
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    if (action === 'inject_test_earnings') {
      return await injectTestEarnings(base44, user);
    }

    if (action === 'inject_linked_accounts') {
      return await injectLinkedAccounts(base44, user);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[TestEarningsInjector]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Inject realistic test earnings across platforms
 */
async function injectTestEarnings(base44, user) {
  try {
    const platforms = [
      { platform: 'upwork', username: 'test-upwork-1', earnings: 450 },
      { platform: 'fiverr', username: 'test-fiverr-1', earnings: 380 },
      { platform: 'freelancer', username: 'test-freelancer-1', earnings: 210 }
    ];

    const created = [];

    for (const platform_info of platforms) {
      // Get or create linked account
      const accounts = await base44.asServiceRole.entities.LinkedAccount.filter(
        { platform: platform_info.platform, created_by: user.email },
        null,
        1
      ).catch(() => []);

      let accountId = accounts[0]?.id;

      if (!accountId) {
        const newAccount = await base44.asServiceRole.entities.LinkedAccount.create({
          platform: platform_info.platform,
          username: platform_info.username,
          profile_url: `https://${platform_info.platform}.com/profile/${platform_info.username}`,
          health_status: 'healthy',
          success_rate: 85,
          rating: 4.8,
          total_earned: 0,
          ai_can_use: true,
          daily_application_limit: 10
        }).catch(() => null);

        accountId = newAccount?.id;
      }

      if (!accountId) continue;

      // Create transaction records
      const fees = { upwork: 0.1, fiverr: 0.2, freelancer: 0.05 };
      const feeRate = fees[platform_info.platform] || 0.1;
      const platformFee = platform_info.earnings * feeRate;
      const netAmount = platform_info.earnings - platformFee;

      const transaction = await base44.asServiceRole.entities.Transaction.create({
        type: 'income',
        platform: platform_info.platform,
        amount: platform_info.earnings,
        net_amount: netAmount,
        platform_fee: platformFee,
        platform_fee_pct: Math.round(feeRate * 100),
        category: 'freelance',
        payout_status: 'available',
        payout_date: new Date().toISOString(),
        linked_account_id: accountId,
        description: `Test earnings from ${platform_info.platform}`,
        notes: 'Injected test data for development'
      }).catch(() => null);

      if (transaction) {
        created.push({
          platform: platform_info.platform,
          amount: platform_info.earnings,
          net_amount: netAmount,
          transaction_id: transaction.id
        });
      }
    }

    // Update user wallet
    const goals = await base44.asServiceRole.entities.UserGoals.filter(
      { created_by: user.email },
      null,
      1
    ).catch(() => []);

    const totalEarned = created.reduce((sum, t) => sum + t.net_amount, 0);
    const currentWallet = goals[0]?.wallet_balance || 0;

    if (goals[0]) {
      await base44.asServiceRole.entities.UserGoals.update(goals[0].id, {
        wallet_balance: currentWallet + totalEarned,
        total_earned: (goals[0].total_earned || 0) + totalEarned
      }).catch(() => null);
    }

    // Log
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `🧪 Test Earnings Injected: $${totalEarned.toFixed(2)} across ${created.length} platforms`,
      severity: 'info',
      metadata: { created, total: totalEarned }
    }).catch(() => null);

    return Response.json({
      success: true,
      injected: created,
      total_earned: totalEarned,
      message: 'Test earnings injected successfully. Real platform APIs will replace this once configured.'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Inject test linked accounts
 */
async function injectLinkedAccounts(base44, user) {
  try {
    const accounts = [
      { platform: 'upwork', username: 'profile-freelancer-1', specialization: 'Web Development', skills: ['React', 'Node.js', 'JavaScript'] },
      { platform: 'fiverr', username: 'seller-designer-1', specialization: 'Graphic Design', skills: ['Figma', 'Photoshop', 'UI/UX'] },
      { platform: 'freelancer', username: 'coder-projects-1', specialization: 'Full Stack Development', skills: ['Python', 'Django', 'PostgreSQL'] }
    ];

    const created = [];

    for (const acc of accounts) {
      const existing = await base44.asServiceRole.entities.LinkedAccount.filter(
        { platform: acc.platform, username: acc.username, created_by: user.email },
        null,
        1
      ).catch(() => []);

      if (!existing.length) {
        const newAcc = await base44.asServiceRole.entities.LinkedAccount.create({
          platform: acc.platform,
          username: acc.username,
          profile_url: `https://${acc.platform}.com/profile/${acc.username}`,
          specialization: acc.specialization,
          skills: acc.skills,
          health_status: 'healthy',
          success_rate: 82,
          rating: 4.7,
          jobs_completed: 24,
          hourly_rate: 45,
          daily_application_limit: 10,
          ai_can_use: true
        }).catch(() => null);

        if (newAcc) created.push(newAcc.id);
      }
    }

    return Response.json({
      success: true,
      created_count: created.length,
      message: 'Test linked accounts created'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}