import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Advanced Earnings Analytics & Performance Intelligence - Phase 9
 * Real-time analytics, trend forecasting, ROI calculation, performance attribution
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, payload } = await req.json();

    if (action === 'get_earnings_summary') {
      return await getEarningsSummary(base44, user, payload);
    }

    if (action === 'get_platform_analytics') {
      return await getPlatformAnalytics(base44, user, payload);
    }

    if (action === 'get_category_analytics') {
      return await getCategoryAnalytics(base44, user, payload);
    }

    if (action === 'get_identity_performance') {
      return await getIdentityPerformance(base44, user, payload);
    }

    if (action === 'get_trend_analysis') {
      return await getTrendAnalysis(base44, user, payload);
    }

    if (action === 'get_roi_metrics') {
      return await getROIMetrics(base44, user, payload);
    }

    if (action === 'get_earnings_forecast') {
      return await getEarningsForecast(base44, user, payload);
    }

    if (action === 'get_performance_attribution') {
      return await getPerformanceAttribution(base44, user, payload);
    }

    if (action === 'detect_anomalies') {
      return await detectAnomalies(base44, user, payload);
    }

    if (action === 'get_comparative_analysis') {
      return await getComparativeAnalysis(base44, user, payload);
    }

    if (action === 'get_top_performers') {
      return await getTopPerformers(base44, user, payload);
    }

    if (action === 'get_velocity_metrics') {
      return await getVelocityMetrics(base44, user, payload);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Analytics Intelligence Engine Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Get comprehensive earnings summary
 */
async function getEarningsSummary(base44, user, payload) {
  const { days = 30 } = payload;

  try {
    const txns = await base44.entities.Transaction.filter(
      { type: 'income' },
      '-created_date',
      500
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const periodTxns = txns.filter(t => new Date(t.created_date) >= cutoffDate);

    const summary = {
      period_days: days,
      total_earnings: periodTxns.reduce((sum, t) => sum + (t.amount || 0), 0),
      total_fees: periodTxns.reduce((sum, t) => sum + (t.platform_fee || 0), 0),
      total_tax_withheld: periodTxns.reduce((sum, t) => sum + (t.tax_withheld || 0), 0),
      net_earnings: periodTxns.reduce((sum, t) => sum + (t.net_amount || 0), 0),
      transaction_count: periodTxns.length,
      average_transaction: periodTxns.length > 0 ? periodTxns.reduce((sum, t) => sum + (t.amount || 0), 0) / periodTxns.length : 0,
      median_transaction: calculateMedian(periodTxns.map(t => t.amount || 0)),
      daily_average: periodTxns.length > 0 ? periodTxns.reduce((sum, t) => sum + (t.amount || 0), 0) / days : 0,
      best_day: calculateBestDay(periodTxns),
      worst_day: calculateWorstDay(periodTxns),
      consistency_score: calculateConsistencyScore(periodTxns, days)
    };

    return Response.json({
      success: true,
      ...summary
    });
  } catch (error) {
    console.error('Get earnings summary error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get platform-specific analytics
 */
async function getPlatformAnalytics(base44, user, payload) {
  const { days = 30, limit = 10 } = payload;

  try {
    const txns = await base44.entities.Transaction.filter(
      { type: 'income' },
      '-created_date',
      500
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const periodTxns = txns.filter(t => new Date(t.created_date) >= cutoffDate);

    const byPlatform = {};

    for (const txn of periodTxns) {
      const platform = txn.platform || 'unknown';
      if (!byPlatform[platform]) {
        byPlatform[platform] = {
          platform: platform,
          total_earnings: 0,
          transaction_count: 0,
          avg_transaction: 0,
          total_fees: 0,
          total_tax: 0,
          net_earnings: 0,
          growth_rate: 0
        };
      }
      byPlatform[platform].total_earnings += txn.amount || 0;
      byPlatform[platform].transaction_count += 1;
      byPlatform[platform].total_fees += txn.platform_fee || 0;
      byPlatform[platform].total_tax += txn.tax_withheld || 0;
      byPlatform[platform].net_earnings += txn.net_amount || 0;
    }

    // Calculate averages
    for (const platform in byPlatform) {
      const data = byPlatform[platform];
      data.avg_transaction = data.transaction_count > 0 ? data.total_earnings / data.transaction_count : 0;
    }

    const sorted = Object.values(byPlatform)
      .sort((a, b) => b.total_earnings - a.total_earnings)
      .slice(0, limit);

    return Response.json({
      success: true,
      total_platforms: Object.keys(byPlatform).length,
      platforms: sorted
    });
  } catch (error) {
    console.error('Get platform analytics error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get category-specific analytics
 */
async function getCategoryAnalytics(base44, user, payload) {
  const { days = 30, limit = 10 } = payload;

  try {
    const txns = await base44.entities.Transaction.filter(
      { type: 'income' },
      '-created_date',
      500
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const periodTxns = txns.filter(t => new Date(t.created_date) >= cutoffDate);

    const byCategory = {};

    for (const txn of periodTxns) {
      const category = txn.category || 'uncategorized';
      if (!byCategory[category]) {
        byCategory[category] = {
          category: category,
          total_earnings: 0,
          transaction_count: 0,
          roi_score: 0,
          avg_roi: 0,
          growth_trend: 'stable'
        };
      }
      byCategory[category].total_earnings += txn.amount || 0;
      byCategory[category].transaction_count += 1;
    }

    const sorted = Object.values(byCategory)
      .sort((a, b) => b.total_earnings - a.total_earnings)
      .slice(0, limit);

    return Response.json({
      success: true,
      total_categories: Object.keys(byCategory).length,
      categories: sorted
    });
  } catch (error) {
    console.error('Get category analytics error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get identity performance metrics
 */
async function getIdentityPerformance(base44, user, payload) {
  const { days = 30, limit = 10 } = payload;

  try {
    const identities = await base44.entities.AIIdentity.list('-total_earned', 100);
    const txns = await base44.entities.Transaction.filter(
      { type: 'income' },
      '-created_date',
      500
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const performance = identities.map(identity => {
      const identityTxns = txns.filter(
        t => new Date(t.created_date) >= cutoffDate && 
        t.description?.includes(identity.name)
      );

      return {
        identity_id: identity.id,
        identity_name: identity.name,
        role: identity.role_label,
        total_earned: identity.total_earned || 0,
        period_earnings: identityTxns.reduce((sum, t) => sum + (t.amount || 0), 0),
        tasks_executed: identity.tasks_executed || 0,
        efficiency_score: calculateEfficiencyScore(identity),
        active: identity.is_active,
        last_used: identity.last_used_at
      };
    }).filter(p => p.total_earned > 0).slice(0, limit);

    return Response.json({
      success: true,
      total_identities: identities.filter(i => i.total_earned > 0).length,
      identities: performance
    });
  } catch (error) {
    console.error('Get identity performance error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get trend analysis
 */
async function getTrendAnalysis(base44, user, payload) {
  const { days = 30 } = payload;

  try {
    const txns = await base44.entities.Transaction.filter(
      { type: 'income' },
      '-created_date',
      500
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const periodTxns = txns.filter(t => new Date(t.created_date) >= cutoffDate);

    // Build daily trend
    const dailyTrend = {};
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toDateString();
      dailyTrend[dateStr] = {
        date: dateStr,
        earnings: 0,
        transactions: 0,
        average: 0
      };
    }

    for (const txn of periodTxns) {
      const dateStr = new Date(txn.created_date).toDateString();
      if (dailyTrend[dateStr]) {
        dailyTrend[dateStr].earnings += txn.amount || 0;
        dailyTrend[dateStr].transactions += 1;
      }
    }

    for (const day in dailyTrend) {
      if (dailyTrend[day].transactions > 0) {
        dailyTrend[day].average = dailyTrend[day].earnings / dailyTrend[day].transactions;
      }
    }

    const trends = Object.values(dailyTrend).reverse();

    // Calculate trend direction
    const firstHalf = trends.slice(0, Math.floor(trends.length / 2));
    const secondHalf = trends.slice(Math.floor(trends.length / 2));

    const firstHalfAvg = firstHalf.reduce((sum, t) => sum + t.earnings, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, t) => sum + t.earnings, 0) / secondHalf.length;

    const trendDirection = secondHalfAvg > firstHalfAvg ? 'upward' : 'downward';
    const trendMagnitude = Math.abs((secondHalfAvg - firstHalfAvg) / firstHalfAvg * 100);

    return Response.json({
      success: true,
      period_days: days,
      trend_direction: trendDirection,
      trend_magnitude_pct: trendMagnitude,
      daily_trends: trends
    });
  } catch (error) {
    console.error('Get trend analysis error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get ROI metrics for opportunities
 */
async function getROIMetrics(base44, user, payload) {
  const { days = 30, limit = 20 } = payload;

  try {
    const opps = await base44.entities.Opportunity.filter(
      { status: 'completed' },
      '-updated_date',
      200
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const roiData = opps
      .filter(o => new Date(o.updated_date) >= cutoffDate)
      .map(o => {
        const capital = o.capital_required || 0;
        const profit = o.profit_estimate_high || o.profit_estimate_low || 0;
        const roi = capital > 0 ? (profit / capital) * 100 : 0;

        return {
          opportunity_id: o.id,
          title: o.title,
          category: o.category,
          capital_required: capital,
          estimated_profit: profit,
          roi_pct: roi,
          completed_at: o.updated_date
        };
      })
      .sort((a, b) => b.roi_pct - a.roi_pct)
      .slice(0, limit);

    const avgROI = roiData.length > 0 
      ? roiData.reduce((sum, o) => sum + o.roi_pct, 0) / roiData.length 
      : 0;

    const bestROI = roiData.length > 0 ? roiData[0] : null;
    const worstROI = roiData.length > 0 ? roiData[roiData.length - 1] : null;

    return Response.json({
      success: true,
      total_opportunities_analyzed: roiData.length,
      average_roi_pct: avgROI,
      best_roi: bestROI,
      worst_roi: worstROI,
      opportunities: roiData
    });
  } catch (error) {
    console.error('Get ROI metrics error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Forecast earnings based on trends
 */
async function getEarningsForecast(base44, user, payload) {
  const { forecast_days = 7 } = payload;

  try {
    const txns = await base44.entities.Transaction.filter(
      { type: 'income' },
      '-created_date',
      200
    );

    // Calculate last 30 days average
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const last30 = txns.filter(t => new Date(t.created_date) >= thirtyDaysAgo);

    const avgDaily = last30.length > 0 
      ? last30.reduce((sum, t) => sum + (t.amount || 0), 0) / 30 
      : 0;

    // Simple linear forecast
    const forecast = [];
    for (let i = 1; i <= forecast_days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      
      // Add some variance (±15%)
      const variance = avgDaily * (Math.random() * 0.3 - 0.15);
      
      forecast.push({
        date: date.toDateString(),
        forecasted_earnings: Math.max(0, avgDaily + variance),
        confidence: 0.75
      });
    }

    const totalForecast = forecast.reduce((sum, f) => sum + f.forecasted_earnings, 0);

    return Response.json({
      success: true,
      forecast_days: forecast_days,
      historical_daily_average: avgDaily,
      total_forecasted_earnings: totalForecast,
      forecast: forecast
    });
  } catch (error) {
    console.error('Get earnings forecast error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get performance attribution
 */
async function getPerformanceAttribution(base44, user, payload) {
  const { days = 30 } = payload;

  try {
    const goals = await base44.entities.UserGoals.filter({ created_by: user.email }, null, 1);
    const goal = goals[0];

    const txns = await base44.entities.Transaction.filter(
      { type: 'income' },
      '-created_date',
      500
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const periodTxns = txns.filter(t => new Date(t.created_date) >= cutoffDate);

    // Attribution by source
    const aiEarned = periodTxns
      .filter(t => t.description?.includes('[AI Autopilot]'))
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const userEarned = periodTxns
      .filter(t => !t.description?.includes('[AI Autopilot]'))
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalEarned = aiEarned + userEarned;

    return Response.json({
      success: true,
      period_days: days,
      total_earnings: totalEarned,
      ai_earnings: aiEarned,
      user_earnings: userEarned,
      ai_contribution_pct: totalEarned > 0 ? (aiEarned / totalEarned) * 100 : 0,
      user_contribution_pct: totalEarned > 0 ? (userEarned / totalEarned) * 100 : 0,
      ai_vs_user_ratio: userEarned > 0 ? aiEarned / userEarned : 0
    });
  } catch (error) {
    console.error('Get performance attribution error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Detect anomalies in earnings patterns
 */
async function detectAnomalies(base44, user, payload) {
  const { days = 30, sensitivity = 'medium' } = payload;

  try {
    const txns = await base44.entities.Transaction.filter(
      { type: 'income' },
      '-created_date',
      500
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const periodTxns = txns.filter(t => new Date(t.created_date) >= cutoffDate);

    // Calculate daily amounts
    const dailyAmounts = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toDateString();
      const dayTotal = periodTxns
        .filter(t => new Date(t.created_date).toDateString() === dateStr)
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      if (dayTotal > 0) {
        dailyAmounts.push(dayTotal);
      }
    }

    // Calculate statistics
    const mean = dailyAmounts.length > 0 ? dailyAmounts.reduce((a, b) => a + b) / dailyAmounts.length : 0;
    const variance = dailyAmounts.length > 0
      ? dailyAmounts.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / dailyAmounts.length
      : 0;
    const stdDev = Math.sqrt(variance);

    // Determine threshold based on sensitivity
    const thresholdMultiplier = sensitivity === 'high' ? 1.5 : sensitivity === 'low' ? 3 : 2;
    const threshold = mean + stdDev * thresholdMultiplier;

    // Find anomalies
    const anomalies = periodTxns
      .filter(t => (t.amount || 0) > threshold)
      .map(t => ({
        transaction_id: t.id,
        amount: t.amount,
        date: t.created_date,
        severity: ((t.amount || 0) - mean) / stdDev,
        platform: t.platform,
        category: t.category
      }))
      .sort((a, b) => b.severity - a.severity);

    return Response.json({
      success: true,
      anomalies_detected: anomalies.length,
      threshold_amount: threshold,
      mean_amount: mean,
      std_deviation: stdDev,
      anomalies: anomalies.slice(0, 20)
    });
  } catch (error) {
    console.error('Detect anomalies error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Comparative analysis (AI vs User performance)
 */
async function getComparativeAnalysis(base44, user, payload) {
  const { days = 30 } = payload;

  try {
    const txns = await base44.entities.Transaction.filter(
      { type: 'income' },
      '-created_date',
      500
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const periodTxns = txns.filter(t => new Date(t.created_date) >= cutoffDate);

    const aiTxns = periodTxns.filter(t => t.description?.includes('[AI Autopilot]'));
    const userTxns = periodTxns.filter(t => !t.description?.includes('[AI Autopilot]'));

    const analysis = {
      ai_metrics: {
        total_earnings: aiTxns.reduce((sum, t) => sum + (t.amount || 0), 0),
        transaction_count: aiTxns.length,
        average_transaction: aiTxns.length > 0 ? aiTxns.reduce((sum, t) => sum + (t.amount || 0), 0) / aiTxns.length : 0,
        efficiency: calculateTransactionEfficiency(aiTxns)
      },
      user_metrics: {
        total_earnings: userTxns.reduce((sum, t) => sum + (t.amount || 0), 0),
        transaction_count: userTxns.length,
        average_transaction: userTxns.length > 0 ? userTxns.reduce((sum, t) => sum + (t.amount || 0), 0) / userTxns.length : 0,
        efficiency: calculateTransactionEfficiency(userTxns)
      },
      winner: aiTxns.reduce((sum, t) => sum + (t.amount || 0), 0) > userTxns.reduce((sum, t) => sum + (t.amount || 0), 0) ? 'ai' : 'user'
    };

    return Response.json({
      success: true,
      ...analysis
    });
  } catch (error) {
    console.error('Get comparative analysis error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get top performers
 */
async function getTopPerformers(base44, user, payload) {
  const { metric = 'earnings', limit = 10 } = payload;

  try {
    let data = [];

    if (metric === 'earnings') {
      const txns = await base44.entities.Transaction.filter(
        { type: 'income' },
        '-amount',
        limit
      );
      data = txns.map(t => ({
        id: t.id,
        name: t.platform || 'unknown',
        value: t.amount,
        category: t.category,
        date: t.created_date
      }));
    } else if (metric === 'platforms') {
      const platforms = {};
      const txns = await base44.entities.Transaction.filter(
        { type: 'income' },
        '-created_date',
        500
      );

      for (const txn of txns) {
        const platform = txn.platform || 'unknown';
        platforms[platform] = (platforms[platform] || 0) + (txn.amount || 0);
      }

      data = Object.entries(platforms)
        .map(([name, value]) => ({ name, value, type: 'platform' }))
        .sort((a, b) => b.value - a.value)
        .slice(0, limit);
    }

    return Response.json({
      success: true,
      metric: metric,
      top_performers: data
    });
  } catch (error) {
    console.error('Get top performers error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get velocity metrics
 */
async function getVelocityMetrics(base44, user, payload) {
  const { window_days = 7 } = payload;

  try {
    const txns = await base44.entities.Transaction.filter(
      { type: 'income' },
      '-created_date',
      500
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - window_days);
    const windowTxns = txns.filter(t => new Date(t.created_date) >= cutoffDate);

    // Calculate transactions per day
    const txnPerDay = windowTxns.length > 0 ? windowTxns.length / window_days : 0;
    const earningsPerDay = windowTxns.length > 0 ? windowTxns.reduce((sum, t) => sum + (t.amount || 0), 0) / window_days : 0;

    // Velocity score (0-100)
    const velocityScore = Math.min(100, txnPerDay * 10);

    return Response.json({
      success: true,
      window_days: window_days,
      transactions_per_day: txnPerDay,
      earnings_per_day: earningsPerDay,
      velocity_score: velocityScore,
      total_window_transactions: windowTxns.length,
      total_window_earnings: windowTxns.reduce((sum, t) => sum + (t.amount || 0), 0)
    });
  } catch (error) {
    console.error('Get velocity metrics error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateMedian(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function calculateBestDay(txns) {
  const byDay = {};
  for (const txn of txns) {
    const date = new Date(txn.created_date).toDateString();
    byDay[date] = (byDay[date] || 0) + (txn.amount || 0);
  }
  const best = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
  return best ? { date: best[0], earnings: best[1] } : null;
}

function calculateWorstDay(txns) {
  const byDay = {};
  for (const txn of txns) {
    const date = new Date(txn.created_date).toDateString();
    byDay[date] = (byDay[date] || 0) + (txn.amount || 0);
  }
  const worst = Object.entries(byDay).sort((a, b) => a[1] - b[1])[0];
  return worst ? { date: worst[0], earnings: worst[1] } : null;
}

function calculateConsistencyScore(txns, days) {
  if (txns.length === 0) return 0;
  const daysWithIncome = new Set(txns.map(t => new Date(t.created_date).toDateString())).size;
  return (daysWithIncome / days) * 100;
}

function calculateEfficiencyScore(identity) {
  if ((identity.tasks_executed || 0) === 0) return 0;
  return Math.min(100, (identity.total_earned || 0) / (identity.tasks_executed || 1));
}

function calculateTransactionEfficiency(txns) {
  if (txns.length === 0) return 0;
  const avgSize = txns.reduce((sum, t) => sum + (t.amount || 0), 0) / txns.length;
  return Math.min(100, avgSize);
}