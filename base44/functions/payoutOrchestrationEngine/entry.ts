import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * PAYOUT ORCHESTRATION ENGINE — TIER 3
 * Autonomous payout orchestration across multi-account platforms
 * Intelligently routes payouts based on account health, fees, delivery time
 * Integrates with load balancing, credential vault, withdrawal policies
 * Triggers autonomous withdrawals when thresholds are met
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // ── Route multi-platform earnings to best withdrawal destination ──────────
    if (action === 'orchestrate_payout') {
      return await orchestratePayout(base44, user, body);
    }

    // ── Auto-trigger withdrawal when policy thresholds met ───────────────────
    if (action === 'trigger_auto_withdrawal') {
      return await triggerAutoWithdrawal(base44, user, body);
    }

    // ── Batch multiple pending payouts for efficiency ──────────────────────────
    if (action === 'batch_pending_payouts') {
      return await batchPendingPayouts(base44, user);
    }

    // ── Get optimal payout routes (cheapest, fastest, safest) ────────────────
    if (action === 'get_payout_routes') {
      return await getPayoutRoutes(base44, user, body);
    }

    // ── Monitor in-flight payouts and handle delays ──────────────────────────
    if (action === 'monitor_payout_status') {
      return await monitorPayoutStatus(base44, user);
    }

    // ── Sync earned income from platform and auto-withdraw if eligible ───────
    if (action === 'sync_and_auto_withdraw') {
      return await syncAndAutoWithdraw(base44, user, body);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[PayoutOrchestrationEngine]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Main orchestration: route earnings across accounts intelligently
 */
async function orchestratePayout(base44, user, payload) {
  const { platforms = ['upwork', 'fiverr', 'freelancer'], amount } = payload;

  try {
    // Fetch all accounts across platforms
    const accounts = await base44.asServiceRole.entities.LinkedAccount.filter(
      { platform: { $in: platforms }, ai_can_use: true },
      '-total_earned',
      100
    ).catch(() => []);

    if (!accounts.length) {
      return Response.json({ error: 'No accounts available' }, { status: 400 });
    }

    // Score accounts by: health, fees, delivery time, earnings
    const scored = await Promise.all(
      accounts.map(async (account) => {
        const score = await scorePayoutRoute(base44, account, amount);
        return { account, ...score };
      })
    );

    // Get withdrawal policy for fee preferences
    const policies = await base44.asServiceRole.entities.WithdrawalPolicy.filter(
      { created_by: user.email },
      null,
      1
    ).catch(() => []);
    const policy = policies[0];

    // Sort by optimal route (preferred platforms in policy)
    const viable = scored
      .filter(s => s.available)
      .sort((a, b) => {
        // Prefer accounts in user's preferred_reinvestment_categories
        if (policy?.preferred_reinvestment_categories) {
          const aPreferred = policy.preferred_reinvestment_categories.includes(a.account.platform) ? 1 : 0;
          const bPreferred = policy.preferred_reinvestment_categories.includes(b.account.platform) ? 1 : 0;
          if (aPreferred !== bPreferred) return bPreferred - aPreferred;
        }
        return b.total_score - a.total_score;
      });

    if (!viable.length) {
      return Response.json({
        success: false,
        error: 'No viable accounts (all unhealthy or rate-limited)',
        recommendations: scored.map(s => ({ platform: s.account.platform, reason: s.reason }))
      });
    }

    const best = viable[0];

    // Create payout record
    const payout = await base44.asServiceRole.entities.Transaction.create({
      type: 'income',
      amount: amount || best.account.total_earned || 0,
      platform: best.account.platform,
      payout_status: 'pending',
      category: 'payout_routing',
      description: `Orchestrated payout routed to ${best.account.platform} account: ${best.account.username}`,
      linked_account_id: best.account.id,
      net_amount: (amount || best.account.total_earned || 0) * (1 - (best.platform_fee_pct / 100)),
      platform_fee: (amount || best.account.total_earned || 0) * (best.platform_fee_pct / 100),
      platform_fee_pct: best.platform_fee_pct,
      notes: `Best route: ${best.account.platform} (health: ${best.account.health_status}, fee: ${best.platform_fee_pct}%, delivery: ${best.estimated_delivery} days)`
    });

    // Log orchestration
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `🎯 Payout orchestrated to ${best.account.platform} (${best.account.username}) - Score: ${best.total_score}/100`,
      severity: 'success',
      metadata: {
        payout_id: payout.id,
        account: best.account.id,
        platform: best.account.platform,
        score: best.total_score,
        net_amount: payout.net_amount
      }
    }).catch(() => null);

    return Response.json({
      success: true,
      payout_id: payout.id,
      routed_to: best.account.platform,
      account: best.account.username,
      net_amount: payout.net_amount,
      platform_fee: payout.platform_fee,
      estimated_delivery_days: best.estimated_delivery,
      health_status: best.account.health_status,
      routing_score: best.total_score
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Trigger autonomous withdrawal based on policy thresholds
 */
async function triggerAutoWithdrawal(base44, user, payload) {
  const { force_amount = null } = payload;

  try {
    // Fetch user's withdrawal policy
    const policies = await base44.asServiceRole.entities.WithdrawalPolicy.filter(
      { created_by: user.email },
      null,
      1
    ).catch(() => []);

    if (!policies.length) {
      return Response.json({ error: 'No withdrawal policy configured' }, { status: 400 });
    }

    const policy = policies[0];

    // Check if auto-withdrawal is enabled
    if (!policy.engine_enabled) {
      return Response.json({ error: 'Auto-withdrawal disabled' }, { status: 400 });
    }

    // Check if emergency stop is active
    if (policy.emergency_stop) {
      return Response.json({ error: 'Emergency stop active' }, { status: 403 });
    }

    // Get user's current wallet balance
    const goals = await base44.asServiceRole.entities.UserGoals.filter(
      { created_by: user.email },
      null,
      1
    ).catch(() => []);

    const goal = goals[0];
    if (!goal) {
      return Response.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Determine withdrawal amount
    const withdrawalAmount = force_amount || calculateWithdrawalAmount(goal, policy);

    // Validate thresholds
    if (goal.wallet_balance < policy.min_withdrawal_threshold) {
      return Response.json({
        success: false,
        reason: 'balance_below_threshold',
        current_balance: goal.wallet_balance,
        threshold: policy.min_withdrawal_threshold,
        needed: policy.min_withdrawal_threshold - goal.wallet_balance
      });
    }

    // Check daily limit
    const withdrawalsToday = await base44.asServiceRole.entities.EngineAuditLog.filter(
      {
        action_type: 'withdrawal_completed',
        created_date: { $gte: new Date(new Date().setHours(0, 0, 0, 0)).toISOString() }
      },
      null,
      1000
    ).catch(() => []);

    const totalWithdrawnToday = withdrawalsToday.reduce((sum, w) => sum + (w.amount || 0), 0);
    if (totalWithdrawnToday + withdrawalAmount > policy.daily_withdrawal_limit) {
      return Response.json({
        success: false,
        reason: 'daily_limit_exceeded',
        limit: policy.daily_withdrawal_limit,
        already_withdrawn: totalWithdrawnToday,
        requested: withdrawalAmount
      });
    }

    // Execute withdrawal
    const withdrawal = await base44.asServiceRole.entities.Transaction.create({
      type: 'withdrawal',
      amount: withdrawalAmount,
      net_amount: withdrawalAmount,
      payout_status: 'pending',
      category: 'auto_withdrawal',
      description: `Autonomous withdrawal triggered by policy threshold`,
      balance_after: goal.wallet_balance - withdrawalAmount
    });

    // Update wallet
    await base44.asServiceRole.entities.UserGoals.update(goal.id, {
      wallet_balance: goal.wallet_balance - withdrawalAmount
    });

    // Log audit trail
    await base44.asServiceRole.entities.EngineAuditLog.create({
      action_type: 'withdrawal_triggered',
      amount: withdrawalAmount,
      status: 'pending',
      ai_reasoning: `Auto-withdrawal triggered: wallet ${goal.wallet_balance} > threshold ${policy.min_withdrawal_threshold}`,
      wallet_balance_before: goal.wallet_balance,
      wallet_balance_after: goal.wallet_balance - withdrawalAmount,
      linked_transaction_id: withdrawal.id
    }).catch(() => null);

    return Response.json({
      success: true,
      withdrawal_id: withdrawal.id,
      amount: withdrawalAmount,
      status: 'triggered',
      next_eligible: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Batch multiple pending payouts for efficiency
 */
async function batchPendingPayouts(base44, user) {
  try {
    // Get all pending payouts
    const pending = await base44.asServiceRole.entities.Transaction.filter(
      { payout_status: 'pending', type: 'withdrawal' },
      'created_date',
      1000
    ).catch(() => []);

    if (!pending.length) {
      return Response.json({ success: true, batched: 0, message: 'No pending payouts' });
    }

    // Group by platform
    const byPlatform = pending.reduce((acc, payout) => {
      const platform = payout.platform || 'unknown';
      if (!acc[platform]) acc[platform] = [];
      acc[platform].push(payout);
      return acc;
    }, {});

    // Create batch record
    const batches = [];
    for (const [platform, payouts] of Object.entries(byPlatform)) {
      const totalAmount = payouts.reduce((sum, p) => sum + (p.amount || 0), 0);
      const totalFee = payouts.reduce((sum, p) => sum + (p.platform_fee || 0), 0);

      batches.push({
        platform,
        count: payouts.length,
        total_amount: totalAmount,
        total_fee: totalFee,
        net_amount: totalAmount - totalFee,
        payout_ids: payouts.map(p => p.id)
      });
    }

    // Log batch operation
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `📦 Batched ${pending.length} pending payouts across ${batches.length} platforms`,
      severity: 'info',
      metadata: { batches, total_payouts: pending.length }
    }).catch(() => null);

    return Response.json({
      success: true,
      batched: pending.length,
      batches,
      total_value: pending.reduce((sum, p) => sum + (p.amount || 0), 0)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get optimal payout routes (cost, speed, safety)
 */
async function getPayoutRoutes(base44, user, payload) {
  const { amount = 1000 } = payload;

  try {
    const accounts = await base44.asServiceRole.entities.LinkedAccount.filter(
      { ai_can_use: true },
      '-total_earned',
      50
    ).catch(() => []);

    const routes = await Promise.all(
      accounts.map(async (account) => {
        const score = await scorePayoutRoute(base44, account, amount);
        return {
          platform: account.platform,
          account: account.username,
          ...score
        };
      })
    );

    const sorted = routes.sort((a, b) => b.total_score - a.total_score);

    return Response.json({
      success: true,
      routes: sorted,
      fastest: sorted.find(r => r.estimated_delivery === 1),
      cheapest: sorted.reduce((min, r) => !min || r.platform_fee < min.platform_fee ? r : min),
      safest: sorted.find(r => r.account.health_status === 'healthy')
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Monitor in-flight payouts
 */
async function monitorPayoutStatus(base44, user) {
  try {
    const inFlight = await base44.asServiceRole.entities.Transaction.filter(
      { payout_status: { $in: ['processing', 'in_transit'] } },
      '-created_date',
      100
    ).catch(() => []);

    const delayed = inFlight.filter(p => {
      const created = new Date(p.created_date);
      const now = new Date();
      const hours = (now - created) / (1000 * 60 * 60);
      return hours > 48; // Delayed if >48h
    });

    if (delayed.length > 0) {
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `⚠️ ${delayed.length} payouts delayed (>48h in processing)`,
        severity: 'warning',
        metadata: { delayed_count: delayed.length }
      }).catch(() => null);
    }

    return Response.json({
      success: true,
      in_flight: inFlight.length,
      delayed: delayed.length,
      payouts: inFlight.map(p => ({
        id: p.id,
        amount: p.amount,
        platform: p.platform,
        status: p.payout_status,
        created: p.created_date
      }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Sync earnings AND trigger auto-withdrawal if thresholds met
 */
async function syncAndAutoWithdraw(base44, user, payload) {
  try {
    // Step 1: Sync earnings
    const syncResult = await base44.asServiceRole.functions.invoke('platformEarningsSyncEngine', {
      action: 'sync_all'
    }).catch(e => ({ error: e.message }));

    if (syncResult.error) {
      return Response.json({
        success: false,
        error: 'Earnings sync failed',
        details: syncResult.error
      });
    }

    // Step 2: Check if auto-withdrawal is eligible
    const policies = await base44.asServiceRole.entities.WithdrawalPolicy.filter(
      { created_by: user.email },
      null,
      1
    ).catch(() => []);

    if (!policies.length || !policies[0].engine_enabled) {
      return Response.json({
        success: true,
        sync_result: syncResult,
        withdrawal: { skipped: true, reason: 'auto_withdrawal_disabled' }
      });
    }

    // Step 3: Trigger auto-withdrawal
    const withdrawalResult = await triggerAutoWithdrawal(base44, user, {});

    return Response.json({
      success: true,
      sync_result: syncResult,
      withdrawal_result: withdrawalResult
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Score a payout route based on multiple factors
 */
async function scorePayoutRoute(base44, account, amount) {
  let score = 100;
  const reasons = [];

  // Factor 1: Account health
  if (account.health_status === 'suspended' || account.health_status === 'banned') {
    return { available: false, total_score: 0, platform_fee_pct: 0, estimated_delivery: 999, reason: 'Account unavailable' };
  }
  if (account.health_status === 'warning') score -= 15;
  if (account.health_status !== 'healthy') reasons.push(`Health: ${account.health_status}`);

  // Factor 2: Platform fee
  const platformFees = {
    upwork: 10,
    fiverr: 20,
    freelancer: 5,
    stripe: 2.9,
    paypal: 3.8,
    bank_transfer: 1
  };
  const feePercent = platformFees[account.platform] || 5;
  score -= feePercent * 0.5; // Fee reduces score
  reasons.push(`Fee: ${feePercent}%`);

  // Factor 3: Delivery time
  const deliveryDays = {
    upwork: 14,
    fiverr: 14,
    freelancer: 7,
    stripe: 1,
    paypal: 1,
    bank_transfer: 3
  };
  const delivery = deliveryDays[account.platform] || 5;
  score -= (delivery - 1) * 2; // Faster delivery = higher score
  reasons.push(`Delivery: ${delivery} days`);

  // Factor 4: Total earned (indicator of reliability)
  if (account.total_earned && account.total_earned > 5000) score += 10;
  if (account.total_earned && account.total_earned > 10000) score += 15;

  // Factor 5: Rating
  if (account.rating && account.rating >= 4.5) score += 20;
  if (account.rating && account.rating < 3.5) score -= 15;

  return {
    available: true,
    total_score: Math.max(0, Math.min(100, score)),
    platform_fee_pct: feePercent,
    estimated_delivery: delivery,
    reason: reasons.join('; ')
  };
}

/**
 * Calculate optimal withdrawal amount based on policy
 */
function calculateWithdrawalAmount(goal, policy) {
  const available = goal.wallet_balance - policy.safety_buffer;
  const maxReinvest = goal.wallet_balance * (policy.max_reinvestment_pct / 100);
  return Math.min(available, maxReinvest);
}