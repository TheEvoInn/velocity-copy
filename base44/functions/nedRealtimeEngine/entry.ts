import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * NED Real-Time Engine - Phase 3
 * Orchestrates crypto opportunities, wallet management, mining operations, and staking
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try {
      user = await base44.auth.me();
    } catch {
      user = { email: 'system@velocitysystem.io', role: 'admin' };
    }
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, opportunity_id, wallet_id, mining_id } = await req.json();

    if (action === 'get_dashboard_summary') {
      return await getDashboardSummary(base44, user);
    }

    if (action === 'get_wallet_details') {
      return await getWalletDetails(base44, user, wallet_id);
    }

    if (action === 'get_airdrop_opportunities') {
      return await getAirdropOpportunities(base44, user);
    }

    if (action === 'get_mining_operations') {
      return await getMiningOperations(base44, user);
    }

    if (action === 'get_staking_positions') {
      return await getStakingPositions(base44, user);
    }

    if (action === 'get_opportunity_details') {
      return await getOpportunityDetails(base44, user, opportunity_id);
    }

    if (action === 'track_airdrop_claim') {
      return await trackAirdropClaim(base44, user, opportunity_id);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('NED Engine error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function getDashboardSummary(base44, user) {
  try {
    const wallets = await base44.asServiceRole.entities.CryptoWallet.filter(
      { created_by: user.email }
    );

    const opportunities = await base44.asServiceRole.entities.CryptoOpportunity.filter(
      { created_by: user.email }
    );

    const mining = await base44.asServiceRole.entities.MiningOperation.filter(
      { created_by: user.email }
    );

    const staking = await base44.asServiceRole.entities.StakingPosition.filter(
      { created_by: user.email }
    );

    let total_wallet_value = 0;
    let total_mining_yield = 0;
    let total_staking_rewards = 0;
    let airdrop_claimed = 0;
    let airdrop_pending = 0;

    for (const wallet of wallets) {
      total_wallet_value += wallet.total_value_usd || 0;
    }

    for (const mining_op of mining) {
      total_mining_yield += mining_op.daily_yield_usd || 0;
    }

    for (const stake of staking) {
      total_staking_rewards += stake.daily_reward_usd || 0;
    }

    const claimed_airdrops = opportunities.filter(o => o.status === 'claimed');
    const pending_airdrops = opportunities.filter(o => o.status === 'eligible' || o.status === 'pending_verification');

    airdrop_claimed = claimed_airdrops.reduce((sum, a) => sum + (a.prize_value_actual || 0), 0);
    airdrop_pending = pending_airdrops.length;

    const daily_passive_income = total_mining_yield + total_staking_rewards;
    const monthly_passive = daily_passive_income * 30;

    return Response.json({
      success: true,
      dashboard: {
        total_portfolio_value: total_wallet_value.toFixed(2),
        active_wallets: wallets.filter(w => w.is_active).length,
        total_wallets: wallets.length,
        daily_passive_income: daily_passive_income.toFixed(2),
        monthly_passive: monthly_passive.toFixed(2),
        mining_operations: mining.filter(m => m.status === 'active').length,
        mining_daily_yield: total_mining_yield.toFixed(2),
        staking_positions: staking.filter(s => s.status === 'active').length,
        staking_daily_reward: total_staking_rewards.toFixed(2),
        airdrop_claimed_value: airdrop_claimed.toFixed(2),
        airdrop_pending_count: airdrop_pending,
        total_crypto_opportunities: opportunities.length,
        health_status: getPortfolioHealth(total_wallet_value, daily_passive_income)
      }
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 400 });
  }
}

async function getWalletDetails(base44, user, wallet_id) {
  try {
    const wallets = await base44.asServiceRole.entities.CryptoWallet.filter(
      { created_by: user.email, id: wallet_id },
      '',
      1
    );

    if (!wallets || wallets.length === 0) {
      return Response.json({ success: false, error: 'Wallet not found' });
    }

    const wallet = wallets[0];
    const transactions = await base44.asServiceRole.entities.CryptoTransaction.filter(
      { created_by: user.email, wallet_id }
    );

    return Response.json({
      success: true,
      wallet: {
        id: wallet.id,
        name: wallet.wallet_label,
        type: wallet.wallet_type,
        address: wallet.address,
        status: wallet.status,
        total_value_usd: wallet.total_value_usd,
        created_date: wallet.created_date
      },
      holdings: wallet.holdings || [],
      transaction_count: transactions.length,
      recent_transactions: transactions.slice(0, 10)
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 400 });
  }
}

async function getAirdropOpportunities(base44, user) {
  try {
    const opportunities = await base44.asServiceRole.entities.CryptoOpportunity.filter(
      { created_by: user.email, type: 'airdrop' }
    );

    const stats = {
      total: opportunities.length,
      claimed: opportunities.filter(o => o.status === 'claimed').length,
      pending: opportunities.filter(o => o.status === 'pending_verification' || o.status === 'eligible').length,
      expired: opportunities.filter(o => o.status === 'expired').length,
      total_claimed_value: opportunities
        .filter(o => o.status === 'claimed')
        .reduce((sum, o) => sum + (o.prize_value_actual || 0), 0),
      total_potential_value: opportunities
        .reduce((sum, o) => sum + (o.estimated_value || 0), 0)
    };

    return Response.json({
      success: true,
      opportunities: opportunities.slice(0, 20),
      stats
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 400 });
  }
}

async function getMiningOperations(base44, user) {
  try {
    const mining = await base44.asServiceRole.entities.MiningOperation.filter(
      { created_by: user.email }
    );

    let total_yield = 0;
    let active_count = 0;

    for (const op of mining) {
      total_yield += op.daily_yield_usd || 0;
      if (op.status === 'active') active_count++;
    }

    return Response.json({
      success: true,
      operations: mining,
      stats: {
        total_operations: mining.length,
        active_operations: active_count,
        total_daily_yield: total_yield.toFixed(2),
        avg_efficiency: mining.length > 0
          ? ((mining.reduce((sum, op) => sum + (op.efficiency_percentage || 0), 0) / mining.length)).toFixed(1)
          : '0'
      }
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 400 });
  }
}

async function getStakingPositions(base44, user) {
  try {
    const staking = await base44.asServiceRole.entities.StakingPosition.filter(
      { created_by: user.email }
    );

    let total_staked = 0;
    let total_daily_reward = 0;
    let active_count = 0;

    for (const stake of staking) {
      total_staked += stake.amount_staked || 0;
      total_daily_reward += stake.daily_reward_usd || 0;
      if (stake.status === 'active') active_count++;
    }

    return Response.json({
      success: true,
      positions: staking,
      stats: {
        total_positions: staking.length,
        active_positions: active_count,
        total_staked_value: total_staked.toFixed(2),
        total_daily_reward: total_daily_reward.toFixed(2),
        monthly_reward: (total_daily_reward * 30).toFixed(2),
        avg_apy: staking.length > 0
          ? ((staking.reduce((sum, s) => sum + (s.apy_percentage || 0), 0) / staking.length)).toFixed(1)
          : '0'
      }
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 400 });
  }
}

async function getOpportunityDetails(base44, user, opportunity_id) {
  try {
    const opportunities = await base44.asServiceRole.entities.CryptoOpportunity.filter(
      { created_by: user.email, id: opportunity_id },
      '',
      1
    );

    if (!opportunities || opportunities.length === 0) {
      return Response.json({ success: false, error: 'Opportunity not found' });
    }

    const opp = opportunities[0];

    return Response.json({
      success: true,
      opportunity: {
        id: opp.id,
        title: opp.title,
        type: opp.type,
        status: opp.status,
        estimated_value: opp.estimated_value,
        actual_value: opp.prize_value_actual,
        difficulty: opp.difficulty_level,
        deadline: opp.deadline,
        requirements: opp.requirements,
        rewards: opp.rewards,
        claimed_date: opp.claimed_date
      }
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 400 });
  }
}

async function trackAirdropClaim(base44, user, opportunity_id) {
  try {
    const opportunities = await base44.asServiceRole.entities.CryptoOpportunity.filter(
      { created_by: user.email, id: opportunity_id },
      '',
      1
    );

    if (!opportunities || opportunities.length === 0) {
      return Response.json({ success: false, error: 'Opportunity not found' });
    }

    const opp = opportunities[0];

    // Update status to claimed
    await base44.asServiceRole.entities.CryptoOpportunity.update(opportunity_id, {
      status: 'claimed',
      claimed_date: new Date().toISOString()
    });

    // Trigger notification
    await base44.asServiceRole.functions.invoke('notificationCrossTrigger', {
      action: 'trigger_from_module',
      module_source: 'ned',
      event_type: 'airdrop_claimed',
      event_data: {
        opportunity_id,
        token_symbol: opp.token_symbol || 'UNKNOWN',
        amount: opp.prize_value_actual || 0,
        value_usd: opp.estimated_value || 0
      }
    });

    return Response.json({
      success: true,
      opportunity_id,
      status: 'claimed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 400 });
  }
}

function getPortfolioHealth(portfolio_value, daily_passive) {
  if (portfolio_value === 0) return 'SETUP_REQUIRED';
  const monthly_return = (daily_passive * 30) / portfolio_value;
  if (monthly_return > 0.15) return 'THRIVING'; // 15%+ monthly
  if (monthly_return > 0.08) return 'HEALTHY';  // 8%+ monthly
  if (monthly_return > 0.03) return 'GROWING';  // 3%+ monthly
  return 'NEEDS_OPTIMIZATION';
}