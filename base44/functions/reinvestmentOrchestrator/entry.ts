import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * REINVESTMENT ORCHESTRATOR — TIER 4
 * Intelligently distributes available capital to high-value opportunities
 * Respects spending policies, ROI thresholds, and risk tolerance
 * Coordinates with discovery engine to identify & execute opportunities
 * Supports autonomous profit reinvestment cycle
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // ── Allocate capital to opportunities based on spending policies ─────────
    if (action === 'allocate_capital') {
      return await allocateCapital(base44, user, body);
    }

    // ── Filter opportunities by spending policy constraints ──────────────────
    if (action === 'filter_by_policy') {
      return await filterByPolicy(base44, user, body);
    }

    // ── Execute autonomous reinvestment cycle ───────────────────────────────
    if (action === 'execute_reinvestment_cycle') {
      return await executeReinvestmentCycle(base44, user, body);
    }

    // ── Get reinvestment recommendations ────────────────────────────────────
    if (action === 'get_recommendations') {
      return await getReinvestmentRecommendations(base44, user, body);
    }

    // ── Monitor reinvestment health & ROI ────────────────────────────────────
    if (action === 'monitor_roi') {
      return await monitorROI(base44, user);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[ReinvestmentOrchestrator]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Allocate available capital to highest-ROI opportunities
 */
async function allocateCapital(base44, user, payload) {
  const { amount, categories = [], max_allocation_per_opp = 50 } = payload;

  try {
    // Fetch user's spending policies
    const policies = await base44.asServiceRole.entities.SpendingPolicy.filter(
      { created_by: user.email },
      null,
      20
    ).catch(() => []);

    if (!policies.length) {
      return Response.json({ error: 'No spending policies configured' }, { status: 400 });
    }

    // Fetch user's capital
    const goals = await base44.asServiceRole.entities.UserGoals.filter(
      { created_by: user.email },
      null,
      1
    ).catch(() => []);

    const goal = goals[0];
    if (!goal) {
      return Response.json({ error: 'User profile not found' }, { status: 404 });
    }

    const availableCapital = amount || goal.wallet_balance;

    // Fetch opportunities that match criteria
    const opportunities = await base44.asServiceRole.entities.Opportunity.filter(
      {
        status: 'new',
        auto_execute: true,
        overall_score: { $gte: 60 },
        ...(categories.length && { category: { $in: categories } })
      },
      '-overall_score',
      100
    ).catch(() => []);

    if (!opportunities.length) {
      return Response.json({
        success: true,
        allocated: 0,
        message: 'No suitable opportunities found',
        available_capital: availableCapital
      });
    }

    // Score and filter opportunities by policy
    const scored = await Promise.all(
      opportunities.map(async (opp) => {
        const score = await scoreReinvestmentOpportunity(opp, policies, goal);
        return { opportunity: opp, ...score };
      })
    );

    // Sort by ROI and viability
    const viable = scored
      .filter(s => s.eligible && s.roi_score > 0)
      .sort((a, b) => b.roi_score - a.roi_score);

    if (!viable.length) {
      return Response.json({
        success: true,
        allocated: 0,
        message: 'No opportunities meet policy requirements',
        reasons: scored.map(s => ({ title: s.opportunity.title, reason: s.reason }))
      });
    }

    // Allocate capital
    const allocations = [];
    let remainingCapital = availableCapital;

    for (const scored_opp of viable) {
      if (remainingCapital <= 0) break;

      const allocationAmount = Math.min(
        max_allocation_per_opp,
        remainingCapital,
        scored_opp.opportunity.capital_required || 50
      );

      allocations.push({
        opportunity_id: scored_opp.opportunity.id,
        title: scored_opp.opportunity.title,
        category: scored_opp.opportunity.category,
        allocated_amount: allocationAmount,
        expected_roi_pct: scored_opp.roi_score,
        estimated_return: allocationAmount * (scored_opp.roi_score / 100),
        policy_match_score: scored_opp.policy_match_score,
        reason: scored_opp.reason
      });

      remainingCapital -= allocationAmount;
    }

    // Log allocation
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `💹 Allocated $${availableCapital - remainingCapital} across ${allocations.length} opportunities`,
      severity: 'success',
      metadata: {
        total_allocated: availableCapital - remainingCapital,
        count: allocations.length,
        remaining_capital: remainingCapital,
        allocations: allocations.map(a => ({ title: a.title, amount: a.allocated_amount }))
      }
    }).catch(() => null);

    return Response.json({
      success: true,
      allocated: availableCapital - remainingCapital,
      count: allocations.length,
      allocations,
      remaining_capital: remainingCapital,
      total_expected_return: allocations.reduce((sum, a) => sum + a.estimated_return, 0)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Filter opportunities by spending policy constraints
 */
async function filterByPolicy(base44, user, payload) {
  const { opportunities, category = 'global' } = payload;

  try {
    // Fetch applicable policy
    const policies = await base44.asServiceRole.entities.SpendingPolicy.filter(
      { created_by: user.email, category: { $in: [category, 'global'] } },
      null,
      10
    ).catch(() => []);

    if (!policies.length) {
      return Response.json({ error: 'No spending policy found', status: 400 });
    }

    const policy = policies.find(p => p.category === category) || policies[0];

    // Get daily spending
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const spentToday = await base44.asServiceRole.entities.Transaction.filter(
      {
        type: 'expense',
        category: category,
        created_date: { $gte: startOfDay }
      },
      null,
      1000
    ).catch(() => []);

    const totalSpentToday = spentToday.reduce((sum, t) => sum + (t.amount || 0), 0);

    // Filter by policy
    const filtered = opportunities.filter(opp => {
      const oppAmount = opp.capital_required || opp.profit_estimate_low || 0;
      const remainingDailyBudget = policy.max_per_day - totalSpentToday;

      // Check 1: Per-task limit
      if (oppAmount > policy.max_per_task) return false;

      // Check 2: Daily limit
      if (oppAmount > remainingDailyBudget) return false;

      // Check 3: ROI threshold
      const oppROI = opp.overall_score || 50;
      if (oppROI < policy.min_roi_pct) return false;

      // Check 4: Auto-approve if under threshold
      if (oppAmount <= policy.auto_approve_threshold) return true;

      // Check 5: Conditional approval (high ROI)
      if (oppROI >= policy.conditional_approval_roi_threshold) return true;

      return false;
    });

    return Response.json({
      success: true,
      total: opportunities.length,
      passed_policy: filtered.length,
      filtered: filtered.map(o => ({
        id: o.id,
        title: o.title,
        capital_required: o.capital_required,
        roi_score: o.overall_score,
        category: o.category
      })),
      policy_constraints: {
        max_per_task: policy.max_per_task,
        max_per_day: policy.max_per_day,
        spent_today: totalSpentToday,
        remaining_budget: policy.max_per_day - totalSpentToday
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Execute full reinvestment cycle: discover → filter → allocate → execute
 */
async function executeReinvestmentCycle(base44, user, payload) {
  const { auto_discover = true, max_opportunities = 5 } = payload;

  try {
    const cycleLog = [];

    // Step 1: Discover new opportunities (optional)
    let opportunities = [];
    if (auto_discover) {
      cycleLog.push({ step: 'discovery', status: 'running', message: 'Discovering opportunities...' });
      const discoveryResult = await base44.asServiceRole.functions.invoke(
        'globalOpportunityDiscovery',
        { action: 'discover' }
      ).catch(e => ({ error: e.message }));

      if (!discoveryResult.error && discoveryResult.data?.opportunities) {
        // Create opportunities from discovery
        for (const disc_opp of discoveryResult.data.opportunities.slice(0, 10)) {
          const created = await base44.asServiceRole.entities.Opportunity.create({
            title: disc_opp.title,
            url: disc_opp.url,
            category: disc_opp.category || 'other',
            profit_estimate_low: disc_opp.estimated_value ? Math.floor(disc_opp.estimated_value * 0.8) : 0,
            profit_estimate_high: disc_opp.estimated_value || 100,
            description: disc_opp.description || '',
            overall_score: 70,
            auto_execute: true,
            status: 'new'
          }).catch(() => null);

          if (created) opportunities.push(created);
        }
        cycleLog.push({ step: 'discovery', status: 'success', message: `Discovered ${opportunities.length} opportunities` });
      }
    }

    // Step 2: Fetch high-scoring opportunities
    const candidates = await base44.asServiceRole.entities.Opportunity.filter(
      {
        status: 'new',
        auto_execute: true,
        overall_score: { $gte: 60 }
      },
      '-overall_score',
      max_opportunities
    ).catch(() => []);

    cycleLog.push({ step: 'fetch', status: 'success', message: `Fetched ${candidates.length} candidates` });

    // Step 3: Filter by spending policy
    const goals = await base44.asServiceRole.entities.UserGoals.filter(
      { created_by: user.email },
      null,
      1
    ).catch(() => []);

    const goal = goals[0];
    if (!goal || goal.wallet_balance < 50) {
      cycleLog.push({ step: 'validation', status: 'failed', message: 'Insufficient capital' });
      return Response.json({ success: false, cycle_log: cycleLog });
    }

    const policies = await base44.asServiceRole.entities.SpendingPolicy.filter(
      { created_by: user.email },
      null,
      10
    ).catch(() => []);

    const filtered = candidates.filter(opp => {
      const policy = policies.find(p => p.category === opp.category || p.category === 'global');
      if (!policy) return false;
      const required = opp.capital_required || 50;
      if (required > policy.max_per_task) return false;
      if ((opp.overall_score || 50) < policy.min_roi_pct) return false;
      return true;
    });

    cycleLog.push({ step: 'filter', status: 'success', message: `${filtered.length} opportunities passed policy filter` });

    // Step 4: Execute filtered opportunities
    const executed = [];
    let spentAmount = 0;

    for (const opp of filtered) {
      if (spentAmount > goal.wallet_balance * 0.5) break; // Don't spend more than 50% of wallet

      // Queue for autopilot execution
      const task = await base44.asServiceRole.entities.TaskExecutionQueue.create({
        opportunity_id: opp.id,
        url: opp.url,
        opportunity_type: opp.opportunity_type || 'other',
        platform: opp.platform || 'direct',
        identity_id: (await base44.asServiceRole.entities.AIIdentity.filter({ is_active: true }, null, 1).catch(() => []))?.[0]?.id,
        status: 'queued',
        priority: Math.min(99, (opp.overall_score || 50) + 10),
        estimated_value: opp.profit_estimate_high,
        queue_timestamp: new Date().toISOString()
      }).catch(() => null);

      if (task) {
        executed.push({ opportunity_id: opp.id, task_id: task.id, title: opp.title });
        spentAmount += opp.capital_required || 50;
      }
    }

    cycleLog.push({ step: 'execution', status: 'success', message: `Executed ${executed.length} opportunities` });

    // Log cycle
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `🔄 Reinvestment cycle complete: discovered ${opportunities.length}, executed ${executed.length}`,
      severity: 'success',
      metadata: { cycle_log: cycleLog, executed_count: executed.length, opportunities_count: opportunities.length }
    }).catch(() => null);

    return Response.json({
      success: executed.length > 0,
      cycle_log: cycleLog,
      executed: executed,
      total_executed: executed.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get reinvestment recommendations
 */
async function getReinvestmentRecommendations(base44, user, payload) {
  const { limit = 10 } = payload;

  try {
    const opportunities = await base44.asServiceRole.entities.Opportunity.filter(
      { status: 'new', auto_execute: true },
      '-overall_score',
      limit
    ).catch(() => []);

    const goals = await base44.asServiceRole.entities.UserGoals.filter(
      { created_by: user.email },
      null,
      1
    ).catch(() => []);

    const goal = goals[0];

    const recommendations = opportunities.map(opp => ({
      id: opp.id,
      title: opp.title,
      category: opp.category,
      roi_score: opp.overall_score || 50,
      capital_required: opp.capital_required || 50,
      estimated_return: (opp.profit_estimate_high || 100) - (opp.capital_required || 50),
      roi_pct: Math.round(((opp.profit_estimate_high || 100) / (opp.capital_required || 50) - 1) * 100),
      recommended: goal && (opp.capital_required || 50) <= goal.wallet_balance
    }));

    return Response.json({
      success: true,
      recommendations: recommendations.sort((a, b) => b.roi_pct - a.roi_pct),
      total_recommended_allocation: recommendations.filter(r => r.recommended).reduce((sum, r) => sum + r.capital_required, 0),
      available_capital: goal?.wallet_balance || 0
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Monitor ROI on reinvested capital
 */
async function monitorROI(base44, user) {
  try {
    // Get opportunities that were executed
    const executed = await base44.asServiceRole.entities.Opportunity.filter(
      { status: { $in: ['completed', 'submitted'] } },
      '-updated_date',
      100
    ).catch(() => []);

    const roi_metrics = {
      total_opportunities: executed.length,
      total_invested: executed.reduce((sum, o) => sum + (o.capital_required || 0), 0),
      total_returned: executed
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + (o.profit_estimate_high || 0), 0),
      success_rate: executed.filter(o => o.status === 'completed').length / (executed.length || 1),
      average_roi_pct: 0
    };

    const completed = executed.filter(o => o.status === 'completed');
    if (completed.length > 0) {
      const totalROI = completed.reduce((sum, o) => {
        const invested = o.capital_required || 0;
        const returned = o.profit_estimate_high || 0;
        return sum + ((returned / (invested || 1)) - 1) * 100;
      }, 0);
      roi_metrics.average_roi_pct = Math.round(totalROI / completed.length);
    }

    return Response.json({
      success: true,
      roi_metrics,
      opportunities: executed.slice(0, 10).map(o => ({
        title: o.title,
        status: o.status,
        invested: o.capital_required,
        returned: o.profit_estimate_high,
        roi_pct: o.capital_required ? Math.round(((o.profit_estimate_high || 0) / o.capital_required - 1) * 100) : 0
      }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Score opportunity for reinvestment eligibility
 */
async function scoreReinvestmentOpportunity(opportunity, policies, userGoal) {
  let score = opportunity.overall_score || 50;
  const reasons = [];

  // Find applicable policy
  const policy = policies.find(p => p.category === opportunity.category || p.category === 'global');
  if (!policy) {
    return { eligible: false, roi_score: 0, policy_match_score: 0, reason: 'No applicable policy' };
  }

  // Scoring factors
  const required = opportunity.capital_required || 50;
  const roi = ((opportunity.profit_estimate_high || 100) / (required || 1) - 1) * 100;

  // Factor 1: ROI threshold
  if (roi < policy.min_roi_pct) {
    reasons.push(`Low ROI: ${Math.round(roi)}% < ${policy.min_roi_pct}%`);
    score -= 30;
  } else {
    reasons.push(`Good ROI: ${Math.round(roi)}%`);
    score += 10;
  }

  // Factor 2: Capital requirement
  if (required > policy.max_per_task) {
    reasons.push(`Capital: $${required} > limit $${policy.max_per_task}`);
    return { eligible: false, roi_score: 0, policy_match_score: 0, reason: reasons.join('; ') };
  }

  // Factor 3: Auto-approval eligibility
  if (required <= policy.auto_approve_threshold) {
    reasons.push('Auto-approvable');
    score += 15;
  }

  // Factor 4: Risk alignment
  if (opportunity.risk_score && opportunity.risk_score > 70) {
    score -= 20;
    reasons.push('High risk');
  }

  return {
    eligible: score >= 40,
    roi_score: Math.max(0, Math.min(100, score)),
    policy_match_score: Math.round((score / 100) * 100),
    reason: reasons.join('; ')
  };
}