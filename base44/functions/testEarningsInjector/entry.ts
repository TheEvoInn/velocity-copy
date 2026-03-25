import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * TEST EARNINGS INJECTOR
 * Creates realistic test transaction data when real API credentials are unavailable
 * Enables full platform testing without requiring real freelancer accounts
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const { action } = body;

    if (action === 'inject_test_earnings') {
      return await injectTestEarnings(base44, user);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[TestEarningsInjector]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function injectTestEarnings(base44, user) {
  try {
    const testEarnings = [
      {
        type: 'income',
        platform: 'upwork',
        amount: 250,
        net_amount: 225,
        platform_fee: 25,
        platform_fee_pct: 10,
        category: 'freelance',
        description: 'Test: Web Development Project',
        payout_status: 'cleared',
        payout_date: new Date().toISOString(),
        notes: 'Injected test data (real APIs not configured)'
      },
      {
        type: 'income',
        platform: 'fiverr',
        amount: 100,
        net_amount: 80,
        platform_fee: 20,
        platform_fee_pct: 20,
        category: 'freelance',
        description: 'Test: Logo Design Gig',
        payout_status: 'cleared',
        payout_date: new Date().toISOString(),
        notes: 'Injected test data (real APIs not configured)'
      },
      {
        type: 'income',
        platform: 'freelancer',
        amount: 150,
        net_amount: 142,
        platform_fee: 8,
        platform_fee_pct: 5,
        category: 'freelance',
        description: 'Test: Content Writing Task',
        payout_status: 'cleared',
        payout_date: new Date().toISOString(),
        notes: 'Injected test data (real APIs not configured)'
      }
    ];

    // Check if test data already exists for today
    const today = new Date().toDateString();
    const existing = await base44.entities.Transaction.filter(
      {
        created_by: user.email,
        notes: { $contains: 'Injected test data' }
      },
      '-created_date',
      100
    ).catch(() => []);

    const alreadyInjected = existing.filter(t => 
      new Date(t.created_date).toDateString() === today
    );

    if (alreadyInjected.length > 0) {
      return Response.json({
        success: true,
        message: 'Test data already injected today',
        count: alreadyInjected.length,
        total_amount: alreadyInjected.reduce((sum, t) => sum + (t.amount || 0), 0)
      });
    }

    // Inject test earnings
    const created = await Promise.all(
      testEarnings.map(earning =>
        base44.asServiceRole.entities.Transaction.create(earning).catch(() => null)
      )
    );

    const successCount = created.filter(c => c !== null).length;
    const totalAmount = created
      .filter(c => c !== null)
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    // Update wallet
    const goals = await base44.entities.UserGoals.filter(
      { created_by: user.email },
      null,
      1
    ).catch(() => []);

    if (goals.length > 0 && goals[0].id) {
      const goal = goals[0];
      await base44.entities.UserGoals.update(goal.id, {
        wallet_balance: (goal.wallet_balance || 0) + totalAmount
      }).catch(() => null);
    }

    // Log
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `🧪 Test earnings injected: ${successCount} transactions, $${totalAmount.toFixed(2)}`,
      severity: 'info',
      metadata: { count: successCount, total: totalAmount }
    }).catch(() => null);

    return Response.json({
      success: true,
      message: 'Test earnings injected successfully',
      count: successCount,
      total_amount: totalAmount,
      note: 'Real API credentials not configured. For production, set UPWORK_API_KEY, UPWORK_API_SECRET, FIVERR_API_KEY'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}