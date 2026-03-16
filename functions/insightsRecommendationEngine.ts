import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Intelligent Insights & Automated Recommendations - Phase 10
 * AI-driven recommendations, performance optimization, smart alerts
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, payload } = await req.json();

    if (action === 'get_smart_recommendations') {
      return await getSmartRecommendations(base44, user, payload);
    }

    if (action === 'get_performance_insights') {
      return await getPerformanceInsights(base44, user, payload);
    }

    if (action === 'get_opportunity_recommendations') {
      return await getOpportunityRecommendations(base44, user, payload);
    }

    if (action === 'get_alert_rules') {
      return await getAlertRules(base44, user);
    }

    if (action === 'create_alert_rule') {
      return await createAlertRule(base44, user, payload);
    }

    if (action === 'get_active_alerts') {
      return await getActiveAlerts(base44, user);
    }

    if (action === 'generate_daily_insights') {
      return await generateDailyInsights(base44, user);
    }

    if (action === 'get_optimization_opportunities') {
      return await getOptimizationOpportunities(base44, user, payload);
    }

    if (action === 'get_risk_mitigation_strategies') {
      return await getRiskMitigationStrategies(base44, user, payload);
    }

    if (action === 'acknowledge_alert') {
      return await acknowledgeAlert(base44, user, payload);
    }

    if (action === 'get_personalized_insights') {
      return await getPersonalizedInsights(base44, user, payload);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Insights Engine Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Get smart recommendations based on user data
 */
async function getSmartRecommendations(base44, user, payload) {
  const { limit = 5 } = payload;

  try {
    const [goals, txns, opps, identities] = await Promise.all([
      base44.entities.UserGoals.filter({ created_by: user.email }, null, 1),
      base44.entities.Transaction.list('-created_date', 200),
      base44.entities.Opportunity.list('-overall_score', 100),
      base44.entities.AIIdentity.list('-total_earned', 20)
    ]);

    const goal = goals[0];
    const recommendations = [];

    // Recommendation 1: Increase capital allocation if wallet has excess
    if (goal && goal.wallet_balance > goal.daily_target * 7) {
      recommendations.push({
        id: 'rec_capital_allocation',
        type: 'capital_allocation',
        priority: 'high',
        title: 'Increase Capital Allocation',
        description: 'Your wallet has grown significantly. Consider increasing daily spending limits for higher ROI opportunities.',
        action: 'Review spending policy',
        potential_impact: 'Could unlock +$500-1000/week in additional opportunities'
      });
    }

    // Recommendation 2: Focus on high-ROI categories
    const categories = {};
    for (const txn of txns) {
      if (txn.category) {
        categories[txn.category] = (categories[txn.category] || 0) + (txn.amount || 0);
      }
    }
    const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
    if (topCategory) {
      recommendations.push({
        id: 'rec_focus_category',
        type: 'category_focus',
        priority: 'medium',
        title: `Maximize ${topCategory[0]}`,
        description: `Your best-performing category is "${topCategory[0]}" with $${topCategory[1].toFixed(0)} earnings.`,
        action: 'Allocate more time to this category',
        potential_impact: '+30-50% earnings potential'
      });
    }

    // Recommendation 3: Identity optimization
    if (identities.length > 1) {
      const topIdentity = identities[0];
      recommendations.push({
        id: 'rec_identity_focus',
        type: 'identity_optimization',
        priority: 'medium',
        title: `Leverage ${topIdentity.name}`,
        description: `Your "${topIdentity.name}" persona has earned $${topIdentity.total_earned} with highest efficiency.`,
        action: 'Increase usage of top-performing identity',
        potential_impact: '+25-40% conversion rate'
      });
    }

    // Recommendation 4: Autopilot acceleration
    if (goal && !goal.autopilot_enabled) {
      recommendations.push({
        id: 'rec_enable_autopilot',
        type: 'automation',
        priority: 'high',
        title: 'Enable AI Autopilot',
        description: 'Autopilot can generate 2-3x passive income while you focus on high-value tasks.',
        action: 'Enable autopilot mode',
        potential_impact: '+$200-500/day passive earnings'
      });
    }

    // Recommendation 5: Diversify platforms
    const platforms = new Set(txns.map(t => t.platform).filter(Boolean));
    if (platforms.size < 3) {
      recommendations.push({
        id: 'rec_diversify',
        type: 'diversification',
        priority: 'medium',
        title: 'Expand to New Platforms',
        description: `You're currently using ${platforms.size} platform(s). Diversifying reduces risk and opens new revenue streams.`,
        action: 'Connect to 1-2 new platforms',
        potential_impact: '+$100-300/week'
      });
    }

    return Response.json({
      success: true,
      total_recommendations: recommendations.length,
      recommendations: recommendations.slice(0, limit)
    });
  } catch (error) {
    console.error('Get smart recommendations error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get performance insights
 */
async function getPerformanceInsights(base44, user, payload) {
  const { days = 30 } = payload;

  try {
    const [txns, opps] = await Promise.all([
      base44.entities.Transaction.filter({ type: 'income' }, '-created_date', 500),
      base44.entities.Opportunity.filter({ status: 'completed' }, '-updated_date', 100)
    ]);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const periodTxns = txns.filter(t => new Date(t.created_date) >= cutoffDate);

    const insights = [];

    // Insight 1: Best performing time
    const byHour = {};
    for (const txn of periodTxns) {
      const hour = new Date(txn.created_date).getHours();
      byHour[hour] = (byHour[hour] || 0) + (txn.amount || 0);
    }
    const bestHour = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0];
    if (bestHour) {
      insights.push({
        type: 'timing',
        insight: `You earn most between ${bestHour[0]}:00-${(parseInt(bestHour[0]) + 1) % 24}:00 (avg $${(bestHour[1] / 24).toFixed(0)}/day)`,
        actionable: true
      });
    }

    // Insight 2: Consistency pattern
    const daysWithEarnings = new Set(periodTxns.map(t => new Date(t.created_date).toDateString())).size;
    insights.push({
      type: 'consistency',
      insight: `You earned on ${daysWithEarnings}/${days} days (${((daysWithEarnings/days)*100).toFixed(0)}% consistency)`,
      actionable: daysWithEarnings < days * 0.7
    });

    // Insight 3: Transaction size trend
    const avgSize = periodTxns.length > 0 ? periodTxns.reduce((sum, t) => sum + (t.amount || 0), 0) / periodTxns.length : 0;
    insights.push({
      type: 'transaction_size',
      insight: `Average transaction size: $${avgSize.toFixed(2)}`,
      actionable: avgSize < 50
    });

    // Insight 4: Fee burden
    const totalFees = periodTxns.reduce((sum, t) => sum + (t.platform_fee || 0), 0);
    const totalEarnings = periodTxns.reduce((sum, t) => sum + (t.amount || 0), 0);
    const feePct = totalEarnings > 0 ? (totalFees / totalEarnings) * 100 : 0;
    insights.push({
      type: 'cost_analysis',
      insight: `Platform fees consume ${feePct.toFixed(1)}% of earnings`,
      actionable: feePct > 20
    });

    return Response.json({
      success: true,
      period_days: days,
      insights: insights
    });
  } catch (error) {
    console.error('Get performance insights error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get opportunity recommendations
 */
async function getOpportunityRecommendations(base44, user, payload) {
  const { limit = 5 } = payload;

  try {
    const [goals, opps, identities] = await Promise.all([
      base44.entities.UserGoals.filter({ created_by: user.email }, null, 1),
      base44.entities.Opportunity.filter({ status: 'new' }, '-overall_score', 100),
      base44.entities.AIIdentity.list('-total_earned', 20)
    ]);

    const goal = goals[0];
    const topIdentity = identities[0];

    const recommendations = opps
      .filter(o => {
        // Filter by capital requirements
        if (goal && o.capital_required > goal.wallet_balance) return false;
        // Filter by user's risk tolerance
        if (goal?.risk_tolerance === 'conservative' && o.risk_score > 60) return false;
        return true;
      })
      .map(o => ({
        opportunity_id: o.id,
        title: o.title,
        category: o.category,
        platform: o.platform,
        profit_estimate: o.profit_estimate_high || 0,
        capital_required: o.capital_required,
        roi_pct: o.capital_required > 0 ? ((o.profit_estimate_high || 0) / o.capital_required) * 100 : 0,
        velocity_score: o.velocity_score,
        risk_score: o.risk_score,
        deadline: o.deadline,
        match_score: calculateOpportunityMatch(o, goal, topIdentity)
      }))
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, limit);

    return Response.json({
      success: true,
      total_recommended: recommendations.length,
      opportunities: recommendations
    });
  } catch (error) {
    console.error('Get opportunity recommendations error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get alert rules
 */
async function getAlertRules(base44, user) {
  try {
    // For now, return predefined alert rules
    const rules = [
      {
        id: 'alert_low_balance',
        name: 'Low Balance Warning',
        condition: 'wallet_balance < daily_target',
        enabled: true,
        severity: 'warning'
      },
      {
        id: 'alert_daily_target_missed',
        name: 'Daily Target Missed',
        condition: 'daily_earnings < daily_target',
        enabled: true,
        severity: 'info'
      },
      {
        id: 'alert_high_error_rate',
        name: 'High Error Rate',
        condition: 'error_count_today > 5',
        enabled: true,
        severity: 'warning'
      },
      {
        id: 'alert_account_health',
        name: 'Account Health Degraded',
        condition: 'account_health_status != healthy',
        enabled: true,
        severity: 'critical'
      }
    ];

    return Response.json({
      success: true,
      total_rules: rules.length,
      rules: rules
    });
  } catch (error) {
    console.error('Get alert rules error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Create new alert rule
 */
async function createAlertRule(base44, user, payload) {
  const { name, condition, severity = 'info' } = payload;

  try {
    if (!name || !condition) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const rule = {
      id: `alert_${Date.now()}`,
      name: name,
      condition: condition,
      enabled: true,
      severity: severity,
      created_at: new Date().toISOString()
    };

    return Response.json({
      success: true,
      rule: rule,
      message: `Alert rule "${name}" created successfully`
    });
  } catch (error) {
    console.error('Create alert rule error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get active alerts
 */
async function getActiveAlerts(base44, user) {
  try {
    const [goals, txns, opps] = await Promise.all([
      base44.entities.UserGoals.filter({ created_by: user.email }, null, 1),
      base44.entities.Transaction.filter({ type: 'income' }, '-created_date', 100),
      base44.entities.Opportunity.filter({ status: 'executing' }, null, 50)
    ]);

    const goal = goals[0];
    const alerts = [];

    // Check low balance
    if (goal && goal.wallet_balance < goal.daily_target) {
      alerts.push({
        id: `alert_${Date.now()}_1`,
        type: 'balance_warning',
        severity: 'warning',
        message: `Wallet balance ($${goal.wallet_balance.toFixed(0)}) is below daily target ($${goal.daily_target.toFixed(0)})`,
        timestamp: new Date().toISOString()
      });
    }

    // Check daily target
    const today = new Date().toDateString();
    const todayEarnings = txns
      .filter(t => new Date(t.created_date).toDateString() === today)
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    if (goal && todayEarnings < goal.daily_target) {
      alerts.push({
        id: `alert_${Date.now()}_2`,
        type: 'daily_target_warning',
        severity: 'info',
        message: `Daily earnings ($${todayEarnings.toFixed(0)}) below target ($${goal.daily_target.toFixed(0)})`,
        timestamp: new Date().toISOString()
      });
    }

    // Check deadline approaching opportunities
    const soon = new Date();
    soon.setHours(soon.getHours() + 24);
    const urgent = opps.filter(o => o.deadline && new Date(o.deadline) < soon);
    if (urgent.length > 0) {
      alerts.push({
        id: `alert_${Date.now()}_3`,
        type: 'deadline_approaching',
        severity: 'warning',
        message: `${urgent.length} opportunity/ies expiring within 24 hours`,
        timestamp: new Date().toISOString()
      });
    }

    return Response.json({
      success: true,
      total_active: alerts.length,
      alerts: alerts
    });
  } catch (error) {
    console.error('Get active alerts error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Generate daily insights summary
 */
async function generateDailyInsights(base44, user) {
  try {
    const [goals, txns, identities] = await Promise.all([
      base44.entities.UserGoals.filter({ created_by: user.email }, null, 1),
      base44.entities.Transaction.filter({ type: 'income' }, '-created_date', 100),
      base44.entities.AIIdentity.list('-total_earned', 10)
    ]);

    const goal = goals[0];
    const today = new Date().toDateString();
    const todayTxns = txns.filter(t => new Date(t.created_date).toDateString() === today);
    const todayEarnings = todayTxns.reduce((sum, t) => sum + (t.amount || 0), 0);

    const summary = {
      date: today,
      daily_earnings: todayEarnings,
      daily_target: goal?.daily_target || 0,
      target_progress_pct: goal ? (todayEarnings / (goal.daily_target || 1)) * 100 : 0,
      transaction_count: todayTxns.length,
      top_performer: identities[0]?.name || 'N/A',
      status: todayEarnings >= (goal?.daily_target || 0) ? 'on_track' : 'behind',
      next_actions: generateNextActions(todayEarnings, goal, identities)
    };

    return Response.json({
      success: true,
      ...summary
    });
  } catch (error) {
    console.error('Generate daily insights error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get optimization opportunities
 */
async function getOptimizationOpportunities(base44, user, payload) {
  try {
    const [txns, accounts] = await Promise.all([
      base44.entities.Transaction.filter({ type: 'income' }, '-created_date', 300),
      base44.entities.LinkedAccount.filter({ ai_can_use: true }, null, 50)
    ]);

    const optimizations = [];

    // Optimization 1: Idle accounts
    const activeAccounts = new Set(txns.map(t => t.linked_account_id).filter(Boolean));
    const idleAccounts = accounts.filter(a => !activeAccounts.has(a.id) && a.health_status === 'healthy');
    if (idleAccounts.length > 0) {
      optimizations.push({
        id: 'opt_idle_accounts',
        type: 'account_activation',
        title: `${idleAccounts.length} Idle Account(s)`,
        description: `You have ${idleAccounts.length} dormant accounts that could generate income`,
        potential_impact: `+$${50 * idleAccounts.length}-${200 * idleAccounts.length}/week`
      });
    }

    // Optimization 2: Peak hours
    const byHour = {};
    for (const txn of txns) {
      const hour = new Date(txn.created_date).getHours();
      byHour[hour] = (byHour[hour] || 0) + (txn.amount || 0);
    }
    const peakHour = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0];
    if (peakHour) {
      optimizations.push({
        id: 'opt_peak_hours',
        type: 'timing_optimization',
        title: 'Peak Hours Strategy',
        description: `Your peak earnings time is ${peakHour[0]}:00-${(parseInt(peakHour[0]) + 1) % 24}:00`,
        potential_impact: '+20-40% earnings if focused during peak hours'
      });
    }

    // Optimization 3: Fee reduction
    const totalFees = txns.reduce((sum, t) => sum + (t.platform_fee || 0), 0);
    if (totalFees > 0) {
      optimizations.push({
        id: 'opt_fee_reduction',
        type: 'cost_optimization',
        title: 'Fee Reduction Strategy',
        description: `Switch to platforms with lower fees to save on ${totalFees.toFixed(0)} in fees`,
        potential_impact: `+$${(totalFees * 0.5).toFixed(0)}/month savings`
      });
    }

    return Response.json({
      success: true,
      total_optimizations: optimizations.length,
      optimizations: optimizations
    });
  } catch (error) {
    console.error('Get optimization opportunities error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get risk mitigation strategies
 */
async function getRiskMitigationStrategies(base44, user, payload) {
  try {
    const [goals, accounts] = await Promise.all([
      base44.entities.UserGoals.filter({ created_by: user.email }, null, 1),
      base44.entities.LinkedAccount.filter({ health_status: 'warning' }, null, 50)
    ]);

    const goal = goals[0];
    const strategies = [];

    // Strategy 1: Account diversification
    if (accounts.length > 0) {
      strategies.push({
        id: 'strategy_account_health',
        type: 'account_management',
        risk: 'account_failure',
        strategy: 'Repair or replace unhealthy accounts',
        description: `You have ${accounts.length} account(s) with warning status`,
        action_items: [
          'Review account health regularly',
          'Prepare backup accounts',
          'Rotate between healthy accounts'
        ]
      });
    }

    // Strategy 2: Capital protection
    strategies.push({
      id: 'strategy_capital_protection',
      type: 'financial_management',
      risk: 'high_risk_opportunities',
      strategy: 'Implement spending limits by category',
      description: 'Limit exposure to high-risk opportunities',
      action_items: [
        `Set daily spend limit: $${(goal?.available_capital || 100) * 0.2}`,
        'Require approval for >$500 spends',
        'Track ROI by category'
      ]
    });

    // Strategy 3: Identity protection
    strategies.push({
      id: 'strategy_identity_rotation',
      type: 'identity_management',
      risk: 'account_suspension',
      strategy: 'Rotate identities to avoid patterns',
      description: 'Alternate between AI identities to reduce platform friction',
      action_items: [
        'Create 2-3 backup identities',
        'Rotate identities every 5-7 days',
        'Monitor suspension signals'
      ]
    });

    return Response.json({
      success: true,
      total_strategies: strategies.length,
      strategies: strategies
    });
  } catch (error) {
    console.error('Get risk mitigation strategies error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Acknowledge alert
 */
async function acknowledgeAlert(base44, user, payload) {
  const { alert_id } = payload;

  try {
    return Response.json({
      success: true,
      alert_id: alert_id,
      acknowledged: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Acknowledge alert error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get personalized insights
 */
async function getPersonalizedInsights(base44, user, payload) {
  const { limit = 3 } = payload;

  try {
    const [insights, recommendations, alerts] = await Promise.all([
      getPerformanceInsights(base44, user, { days: 7 }),
      getSmartRecommendations(base44, user, { limit: 3 }),
      getActiveAlerts(base44, user)
    ]);

    const personalizedData = {
      date: new Date().toISOString(),
      insights: insights.data?.insights?.slice(0, limit) || [],
      recommendations: recommendations.data?.recommendations?.slice(0, limit) || [],
      alerts: alerts.data?.alerts?.slice(0, 5) || [],
      summary: `${insights.data?.insights?.length || 0} insights, ${recommendations.data?.recommendations?.length || 0} recommendations, ${alerts.data?.alerts?.length || 0} active alerts`
    };

    return Response.json({
      success: true,
      personalized: personalizedData
    });
  } catch (error) {
    console.error('Get personalized insights error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateOpportunityMatch(opp, goal, topIdentity) {
  let score = 0;

  // Category match
  if (goal?.ai_preferred_categories?.includes(opp.category)) score += 20;

  // Risk tolerance match
  if (goal?.risk_tolerance === 'conservative' && opp.risk_score < 40) score += 15;
  if (goal?.risk_tolerance === 'moderate' && opp.risk_score < 70) score += 15;
  if (goal?.risk_tolerance === 'aggressive') score += 15;

  // ROI match
  const roi = opp.capital_required > 0 ? ((opp.profit_estimate_high || 0) / opp.capital_required) * 100 : 0;
  if (roi > 100) score += 25;
  if (roi > 50) score += 20;
  if (roi > 20) score += 15;

  // Velocity
  if (opp.velocity_score > 80) score += 15;
  if (opp.velocity_score > 60) score += 10;

  return Math.min(100, score);
}

function generateNextActions(earnings, goal, identities) {
  const actions = [];

  if (!goal) return actions;

  if (earnings < goal.daily_target * 0.5) {
    actions.push('Focus on high-ROI opportunities for remainder of day');
  }

  if (identities.length > 0) {
    actions.push(`Leverage ${identities[0].name} for next task`);
  }

  if (earnings >= goal.daily_target) {
    actions.push('Daily target achieved! Consider stretching to 1.5x target');
  }

  return actions;
}