import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * PROFIT OPTIMIZER (Phase 10.4)
 * ROI scoring, time-to-value estimation, batch execution planning
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, payload } = await req.json();

    if (action === 'score_opportunity_roi') {
      return await scoreOpportunityROI(base44, user, payload);
    }

    if (action === 'estimate_time_to_value') {
      return await estimateTimeToValue(base44, user, payload);
    }

    if (action === 'optimize_batch_plan') {
      return await optimizeBatchPlan(base44, user, payload);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[ProfitOptimizer]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Score opportunity ROI (profit per unit effort)
 */
async function scoreOpportunityROI(base44, user, payload) {
  const { opportunity } = payload;

  // Base ROI calculation
  const avgProfit = ((opportunity.profit_estimate_low || 0) + (opportunity.profit_estimate_high || 0)) / 2;
  const capital = opportunity.capital_required || 0;
  const baseROI = capital > 0 ? (avgProfit / capital) * 100 : 100;

  // Effort estimation (category-based)
  const effortEstimate = estimateEffort(opportunity.category);

  // Time-to-value bonus/penalty
  const payout = timeToPayoutDays[opportunity.time_sensitivity] || 7;
  const payoutBonus = payout <= 3 ? 1.3 : payout <= 7 ? 1.0 : 0.7;

  // Success probability adjustment
  const successProb = opportunitySuccessRates[opportunity.category] || 0.5;

  // Final ROI score: profit / effort * success_rate * time_bonus
  const roiScore = Math.round((baseROI / Math.max(effortEstimate, 1)) * successProb * payoutBonus);

  return Response.json({
    success: true,
    roi_analysis: {
      opportunity_id: opportunity.id,
      base_roi: Math.round(baseROI),
      effort_estimate: effortEstimate,
      success_probability: Math.round(successProb * 100),
      time_to_payout_days: payout,
      final_roi_score: Math.max(0, roiScore),
      recommendation: roiScore > 80 ? 'high_priority' : roiScore > 50 ? 'medium' : 'low_priority'
    }
  });
}

/**
 * Estimate time to value
 */
async function estimateTimeToValue(base44, user, payload) {
  const { opportunity } = payload;

  const payoutDays = timeToPayoutDays[opportunity.time_sensitivity] || 7;
  const effortEstimate = estimateEffort(opportunity.category);

  const executionTime = effortEstimate * 60; // minutes to complete
  const totalTime = executionTime + (payoutDays * 24 * 60); // total in minutes

  const timeToValue = {
    category: opportunity.category,
    execution_time_minutes: Math.round(executionTime),
    payout_days: payoutDays,
    total_time_minutes: Math.round(totalTime),
    time_to_first_dollar: `${payoutDays} days`
  };

  return Response.json({ success: true, time_to_value: timeToValue });
}

/**
 * Optimize batch execution plan
 */
async function optimizeBatchPlan(base44, user, payload) {
  const { opportunities = [] } = payload;

  // Score each opportunity
  const scored = [];
  for (const opp of opportunities) {
    const roi = await scoreOpportunityROI(base44, user, { opportunity: opp })
      .then(r => JSON.parse(r.body))
      .catch(() => ({ roi_analysis: { final_roi_score: 0 } }));

    scored.push({
      opportunity_id: opp.id,
      roi_score: roi.roi_analysis.final_roi_score,
      profit: ((opp.profit_estimate_low || 0) + (opp.profit_estimate_high || 0)) / 2,
      category: opp.category
    });
  }

  // Sort by ROI score (highest first)
  scored.sort((a, b) => b.roi_score - a.roi_score);

  // Group by category for identity assignment
  const plan = {
    batch_id: `batch_${Date.now()}`,
    total_opportunities: opportunities.length,
    total_estimated_profit: scored.reduce((sum, s) => sum + s.profit, 0),
    execution_order: scored.slice(0, 20), // Top 20
    by_category: groupByCategory(scored),
    estimated_total_time_minutes: calculateTotalTime(scored)
  };

  return Response.json({ success: true, batch_plan: plan });
}

/**
 * Estimate effort for category
 */
function estimateEffort(category) {
  const effortMap = {
    arbitrage: 15,
    service: 120,
    lead_gen: 30,
    digital_flip: 60,
    auction: 20,
    freelance: 180,
    resale: 45,
    grant: 240,
    contest: 90,
    giveaway: 10,
    default: 60
  };
  return effortMap[category] || effortMap.default;
}

const timeToPayoutDays = {
  immediate: 1,
  hours: 0.5,
  days: 3,
  weeks: 14,
  ongoing: 30
};

const opportunitySuccessRates = {
  arbitrage: 0.72,
  service: 0.65,
  lead_gen: 0.58,
  digital_flip: 0.75,
  auction: 0.63,
  freelance: 0.68,
  resale: 0.62,
  grant: 0.45,
  contest: 0.35,
  giveaway: 0.40
};

/**
 * Group opportunities by category
 */
function groupByCategory(scored) {
  const grouped = {};
  for (const item of scored) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }
  return grouped;
}

/**
 * Calculate total execution time
 */
function calculateTotalTime(scored) {
  let total = 0;
  for (const item of scored.slice(0, 20)) {
    total += estimateEffort(item.category);
  }
  return Math.round(total);
}