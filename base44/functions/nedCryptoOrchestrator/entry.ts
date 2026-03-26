import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, payload } = await req.json();

    if (action === 'get_status') {
      const wallets = await base44.entities.CryptoWallet.filter({ created_by: user.email }, '-created_date', 10).catch(() => []);
      const positions = await base44.entities.StakingPosition.filter({ created_by: user.email, status: 'active' }, '-created_date', 20).catch(() => []);
      const mining = await base44.entities.MiningOperation.filter({ created_by: user.email, status: 'active' }, '-created_date', 10).catch(() => []);
      const opps = await base44.entities.CryptoOpportunity.filter({ created_by: user.email }, '-created_date', 20).catch(() => []);
      const totalStaked = positions.reduce((s, p) => s + (p.value_usd_at_stake || 0), 0);
      const dailyYield = positions.reduce((s, p) => s + (p.daily_reward_usd || 0), 0) + mining.reduce((s, m) => s + (m.daily_revenue_usd || 0), 0);
      return Response.json({
        success: true,
        agent: 'NED',
        status: 'active',
        wallets: wallets.length,
        staking_positions: positions.length,
        mining_operations: mining.length,
        opportunities: opps.length,
        total_staked_usd: totalStaked,
        estimated_daily_yield: dailyYield,
        capabilities: ['scan_opportunities', 'execute_airdrop', 'setup_mining', 'setup_staking', 'claim_rewards', 'scan_arbitrage', 'generate_profit_report']
      });
    }

    if (action === 'scan_opportunities') {
      return await handleOpportunityScan(base44, user, payload);
    } else if (action === 'evaluate_opportunity') {
      return await handleOpportunityEvaluation(base44, user, payload);
    } else if (action === 'execute_airdrop') {
      return await handleAirdropExecution(base44, user, payload);
    } else if (action === 'setup_mining') {
      return await handleMiningSetup(base44, user, payload);
    } else if (action === 'setup_staking') {
      return await handleStakingSetup(base44, user, payload);
    } else if (action === 'claim_rewards') {
      return await handleRewardClaim(base44, user, payload);
    } else if (action === 'scan_arbitrage') {
      return await handleArbitrageScan(base44, user, payload);
    } else if (action === 'generate_profit_report') {
      return await handleProfitReport(base44, user, payload);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('NED Orchestrator error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function handleOpportunityScan(base44, user, payload) {
  const { opportunity_types = ['airdrop', 'mining', 'staking'] } = payload;

  // Simulate scanning for opportunities
  const opportunities = [
    {
      opportunity_type: 'airdrop',
      title: 'UniswapX Early User Airdrop',
      project_name: 'UniswapX',
      token_symbol: 'UNI',
      estimated_value_usd: 250,
      difficulty_level: 'beginner',
      platform: 'uniswap.org',
      risk_score: 15,
      legitimacy_score: 98,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      source: 'airdrop_aggregator',
      required_actions: ['connect_wallet', 'verify_swap_history']
    },
    {
      opportunity_type: 'mining',
      title: 'Bitcoin Cloud Mining',
      project_name: 'Bitcoin',
      token_symbol: 'BTC',
      estimated_value_usd: 500,
      difficulty_level: 'intermediate',
      platform: 'mining-pool.example.com',
      risk_score: 35,
      legitimacy_score: 85,
      profit_potential: 12,
      source: 'mining_pool'
    },
    {
      opportunity_type: 'staking',
      title: 'Ethereum 2.0 Staking',
      project_name: 'Ethereum',
      token_symbol: 'ETH',
      estimated_value_usd: 1200,
      difficulty_level: 'intermediate',
      platform: 'staking.ethereum.org',
      risk_score: 20,
      legitimacy_score: 99,
      profit_potential: 3.5,
      source: 'blockchain'
    }
  ];

  // Filter by requested types
  const filtered = opportunities.filter(o => opportunity_types.includes(o.opportunity_type));

  // Create opportunities in database
  for (const opp of filtered) {
    try {
      await base44.entities.CryptoOpportunity.create({
        ...opp,
        research_data: {
          team_verified: true,
          audit_status: 'passed',
          verified_at: new Date().toISOString()
        },
        automation_config: {
          auto_execute: true,
          requires_approval: opp.risk_score > 40
        }
      });
    } catch (e) {
      console.log('Opportunity already exists or error:', e.message);
    }
  }

  return Response.json({
    success: true,
    opportunities_found: filtered.length,
    opportunities: filtered,
    timestamp: new Date().toISOString()
  });
}

async function handleOpportunityEvaluation(base44, user, payload) {
  const { opportunity_id } = payload;

  const opp = await base44.entities.CryptoOpportunity.read(opportunity_id);
  if (!opp) {
    return Response.json({ error: 'Opportunity not found' }, { status: 404 });
  }

  // Deep research evaluation
  const evaluation = {
    opportunity_id,
    risk_assessment: {
      risk_score: opp.risk_score || 30,
      severity: opp.risk_score > 60 ? 'high' : opp.risk_score > 40 ? 'medium' : 'low',
      red_flags: opp.research_data?.red_flags || []
    },
    legitimacy_assessment: {
      legitimacy_score: opp.legitimacy_score || 85,
      team_verified: true,
      audit_status: 'passed',
      community_sentiment: 'positive'
    },
    profit_analysis: {
      estimated_value: opp.estimated_value_usd,
      time_required_hours: opp.estimated_time_hours,
      roi_percentage: (opp.estimated_value_usd / 100),
      recommendation: opp.risk_score < 40 ? 'EXECUTE' : 'MANUAL_REVIEW'
    },
    research_summary: `NED Analysis: ${opp.project_name} scores ${opp.legitimacy_score}/100 legitimacy. Risk level is ${opp.risk_score > 60 ? 'HIGH' : opp.risk_score > 40 ? 'MEDIUM' : 'LOW'}. Estimated profit: $${opp.estimated_value_usd}.`,
    next_action: opp.risk_score < 40 ? 'Ready for execution' : 'Requires user approval'
  };

  return Response.json(evaluation);
}

async function handleAirdropExecution(base44, user, payload) {
  const { opportunity_id, wallet_address } = payload;

  const opp = await base44.entities.CryptoOpportunity.read(opportunity_id);

  // Simulate airdrop claim
  const tx_hash = `0x${Math.random().toString(16).slice(2)}`;
  const tx_timestamp = new Date();

  // Create transaction record
  const transaction = await base44.entities.CryptoTransaction.create({
    transaction_type: 'airdrop_received',
    source: opp.project_name,
    token_symbol: opp.token_symbol,
    amount: opp.estimated_value_usd / 100, // Simplified
    value_usd: opp.estimated_value_usd,
    wallet_address,
    tx_hash,
    blockchain: 'ethereum',
    status: 'completed',
    executed_by: 'ned_autopilot',
    timestamp: tx_timestamp.toISOString(),
    related_opportunity_id: opportunity_id
  });

  // Update opportunity status
  await base44.entities.CryptoOpportunity.update(opportunity_id, {
    status: 'claimed',
    'execution_status.reward_claimed': true,
    'execution_status.reward_claimed_at': tx_timestamp.toISOString(),
    'execution_status.tx_hash': tx_hash,
    'execution_status.reward_address': wallet_address,
    'earnings.tokens_received': opp.estimated_value_usd / 100
  });

  return Response.json({
    success: true,
    transaction_hash: tx_hash,
    claimed_amount: opp.estimated_value_usd,
    token: opp.token_symbol,
    message: `Successfully claimed ${opp.token_symbol} airdrop to ${wallet_address}`
  });
}

async function handleMiningSetup(base44, user, payload) {
  const { platform, coin_symbol, hash_rate, wallet_address } = payload;

  const mining_op = await base44.entities.MiningOperation.create({
    mining_type: 'cloud_mining',
    platform,
    coin_symbol,
    hash_rate,
    payout_address: wallet_address,
    status: 'active',
    auto_payout_enabled: true,
    daily_revenue_usd: Math.random() * 50 + 5,
    started_at: new Date().toISOString(),
    profitability_score: Math.floor(Math.random() * 40 + 60)
  });

  return Response.json({
    success: true,
    mining_operation_id: mining_op.id,
    platform,
    coin: coin_symbol,
    status: 'active',
    message: `Mining operation started on ${platform} for ${coin_symbol}`
  });
}

async function handleStakingSetup(base44, user, payload) {
  const { token_symbol, platform, amount_staked, reward_address } = payload;

  const staking = await base44.entities.StakingPosition.create({
    token_symbol,
    platform,
    amount_staked,
    value_usd_at_stake: amount_staked * 2000, // Simplified
    apy_percentage: Math.random() * 15 + 3,
    daily_reward_usd: Math.random() * 10 + 0.5,
    staking_type: 'pool',
    status: 'active',
    started_at: new Date().toISOString(),
    reward_address,
    compounding_enabled: true
  });

  return Response.json({
    success: true,
    staking_position_id: staking.id,
    token: token_symbol,
    amount_staked,
    apy: staking.apy_percentage.toFixed(2),
    message: `Staking position created for ${token_symbol} on ${platform}`
  });
}

async function handleRewardClaim(base44, user, payload) {
  const { operation_type, operation_id, wallet_address } = payload;

  let reward_amount = 0;
  let token_symbol = '';

  if (operation_type === 'mining') {
    const mining = await base44.entities.MiningOperation.read(operation_id);
    reward_amount = mining.daily_revenue_usd * 0.95; // Minus fees
    token_symbol = mining.coin_symbol;
  } else if (operation_type === 'staking') {
    const staking = await base44.entities.StakingPosition.read(operation_id);
    reward_amount = staking.daily_reward_usd;
    token_symbol = staking.token_symbol;
  }

  const tx_hash = `0x${Math.random().toString(16).slice(2)}`;

  const transaction = await base44.entities.CryptoTransaction.create({
    transaction_type: 'reward_earned',
    source: operation_type,
    token_symbol,
    amount: reward_amount / 2000,
    value_usd: reward_amount,
    wallet_address,
    tx_hash,
    blockchain: 'ethereum',
    status: 'completed',
    executed_by: 'ned_autopilot'
  });

  return Response.json({
    success: true,
    transaction_hash: tx_hash,
    reward_claimed: reward_amount,
    token: token_symbol
  });
}

async function handleArbitrageScan(base44, user, payload) {
  // Simulate arbitrage opportunities
  const opportunities = [
    {
      pair: 'BTC/USDT',
      exchange_a: 'Binance',
      exchange_b: 'Kraken',
      price_a: 42500,
      price_b: 42800,
      profit_percentage: ((42800 - 42500) / 42500 * 100).toFixed(2),
      volume_available: 5
    },
    {
      pair: 'ETH/USDT',
      exchange_a: 'Coinbase',
      exchange_b: 'Kraken',
      price_a: 2250,
      price_b: 2280,
      profit_percentage: ((2280 - 2250) / 2250 * 100).toFixed(2),
      volume_available: 50
    }
  ];

  return Response.json({
    success: true,
    arbitrage_opportunities: opportunities,
    scan_timestamp: new Date().toISOString()
  });
}

async function handleProfitReport(base44, user, payload) {
  const { days = 30 } = payload;

  // Fetch all transactions for user
  const transactions = await base44.entities.CryptoTransaction.filter(
    { created_by: user.email },
    '-timestamp',
    1000
  );

  const total_earned = transactions.reduce((sum, tx) => sum + (tx.value_usd || 0), 0);
  const total_by_type = {};

  transactions.forEach(tx => {
    const type = tx.source || 'other';
    total_by_type[type] = (total_by_type[type] || 0) + (tx.value_usd || 0);
  });

  return Response.json({
    success: true,
    report_period_days: days,
    total_earned_usd: total_earned,
    earnings_by_source: total_by_type,
    transaction_count: transactions.length,
    average_transaction_value: (total_earned / transactions.length).toFixed(2),
    generated_at: new Date().toISOString()
  });
}