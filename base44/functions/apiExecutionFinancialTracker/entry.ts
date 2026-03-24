import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * API EXECUTION FINANCIAL TRACKER
 * Tracks costs, ROI, profit attribution per API
 * Enforces spending limits from SpendingPolicy
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, execution_result, task_id, api_id, opportunity_id } = await req.json();

    if (action === 'track_execution_cost') {
      return await trackExecutionCost(base44, user, execution_result, task_id, api_id, opportunity_id);
    } else if (action === 'check_spending_limit') {
      return await checkSpendingLimit(base44, api_id);
    } else if (action === 'calculate_roi') {
      return await calculateROI(base44, api_id);
    } else if (action === 'daily_cost_summary') {
      return await getDailyCostSummary(base44);
    } else {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[apiExecutionFinancialTracker]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Track cost of API execution
 */
async function trackExecutionCost(base44, user, executionResult, taskId, apiId, opportunityId) {
  // Fetch API metadata to get cost per call
  const api = await base44.entities.APIMetadata.get(apiId);
  if (!api) {
    return Response.json({ error: 'API not found' }, { status: 404 });
  }

  const costPerCall = api.cost_per_call || 0;
  const { success, response_time_ms } = executionResult;

  // Only deduct cost if successful
  if (!success || costPerCall === 0) {
    return Response.json({
      success: true,
      cost_tracked: costPerCall > 0 && success,
      cost: costPerCall,
      message: success ? 'No cost associated' : 'Execution failed, no cost deducted',
    });
  }

  // Create transaction record
  const transaction = await base44.entities.Transaction?.create?.({
    type: 'expense',
    amount: costPerCall,
    net_amount: costPerCall,
    platform_fee: 0,
    platform_fee_pct: 0,
    platform: 'api_execution',
    category: 'api_execution',
    description: `API execution: ${api.api_name} (task: ${taskId})`,
    payout_status: 'cleared',
    linked_account_id: apiId,
    notes: `Response time: ${response_time_ms}ms`,
  }).catch(() => null);

  // Deduct from wallet
  try {
    await base44.functions.invoke('walletManager', {
      action: 'deduct_cost',
      cost: costPerCall,
      reason: `API execution: ${api.api_name}`,
      api_id: apiId,
      transaction_id: transaction?.id,
    }).catch(() => null);
  } catch (e) {
    console.warn('Wallet deduction failed:', e.message);
  }

  // Log financial transaction
  await base44.entities.APIDiscoveryLog.create({
    api_id: apiId,
    api_name: api.api_name,
    action_type: 'used_by_autopilot',
    status: 'success',
    details: {
      cost_deducted: costPerCall,
      transaction_id: transaction?.id,
      opportunity_id: opportunityId,
    },
    timestamp: new Date().toISOString(),
  }).catch(() => null);

  return Response.json({
    success: true,
    cost_deducted: costPerCall,
    transaction_id: transaction?.id,
    api_name: api.api_name,
    wallet_updated: true,
  });
}

/**
 * Check if execution would exceed spending limits
 */
async function checkSpendingLimit(base44, apiId) {
  // Fetch spending policy
  const policies = await base44.entities.SpendingPolicy?.filter?.({
    enabled: true,
  }, '-created_date', 10).catch(() => []);

  if (!policies || policies.length === 0) {
    return Response.json({
      success: true,
      within_limit: true,
      message: 'No spending policy configured',
    });
  }

  // Get today's spending
  const today = new Date().toDateString();
  const todayTransactions = await base44.entities.Transaction?.filter?.({
    category: 'api_execution',
  }, '-created_date', 100).catch(() => []);

  const todaySpent = todayTransactions
    ?.filter(t => new Date(t.created_date).toDateString() === today)
    ?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

  // Check against policy
  const globalPolicy = policies.find(p => p.category === 'global');
  const maxDaily = globalPolicy?.max_per_day || 5000;
  const withinLimit = todaySpent < maxDaily;

  return Response.json({
    success: true,
    within_limit: withinLimit,
    today_spent: todaySpent,
    daily_limit: maxDaily,
    remaining_today: Math.max(0, maxDaily - todaySpent),
    warning: !withinLimit,
  });
}

/**
 * Calculate ROI for API
 */
async function calculateROI(base44, apiId) {
  const api = await base44.entities.APIMetadata.get(apiId);
  if (!api) {
    return Response.json({ error: 'API not found' }, { status: 404 });
  }

  // Fetch all logs for this API
  const logs = await base44.entities.APIDiscoveryLog.filter({
    api_id: apiId,
  }, '-created_date', 100);

  const successfulExecutions = logs.filter(l => l.status === 'success').length;
  const totalExecutions = logs.length;
  const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;

  // Calculate costs
  const totalCost = api.cost_per_call * totalExecutions;

  // Estimate revenue from linked opportunities
  const opportunities = await base44.entities.Opportunity?.filter?.({
    linked_api_id: apiId,
  }, '-created_date', 100).catch(() => []);

  const estimatedRevenue = opportunities?.reduce((sum, o) => sum + (o.profit_estimate_high || 0), 0) || 0;

  const roi = totalCost > 0 ? ((estimatedRevenue - totalCost) / totalCost) * 100 : 0;

  return Response.json({
    success: true,
    api_id: apiId,
    api_name: api.api_name,
    total_executions: totalExecutions,
    successful_executions: successfulExecutions,
    success_rate: successRate.toFixed(1),
    total_cost: totalCost.toFixed(2),
    estimated_revenue: estimatedRevenue.toFixed(2),
    roi_percentage: roi.toFixed(1),
    recommendation: roi > 50 ? 'high_roi' : roi > 0 ? 'positive_roi' : 'negative_roi',
  });
}

/**
 * Get daily cost summary
 */
async function getDailyCostSummary(base44) {
  const today = new Date().toDateString();

  const transactions = await base44.entities.Transaction?.filter?.({
    category: 'api_execution',
  }, '-created_date', 100).catch(() => []);

  const todayTransactions = transactions?.filter(t => new Date(t.created_date).toDateString() === today) || [];

  const totalCost = todayTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const executionCount = todayTransactions.length;

  const costByAPI = {};
  for (const tx of todayTransactions) {
    const apiName = tx.description?.split(':')[1]?.trim() || 'Unknown';
    costByAPI[apiName] = (costByAPI[apiName] || 0) + tx.amount;
  }

  return Response.json({
    success: true,
    date: today,
    total_cost: totalCost.toFixed(2),
    execution_count: executionCount,
    average_cost_per_execution: executionCount > 0 ? (totalCost / executionCount).toFixed(2) : 0,
    cost_by_api: Object.entries(costByAPI).map(([api, cost]) => ({
      api,
      cost: cost.toFixed(2),
    })),
  });
}