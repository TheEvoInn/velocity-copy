/**
 * Shared utilities for backend engines
 * Reduces code duplication across ML, integrity, compliance engines
 */

export const categorySuccessRates = {
  arbitrage: 0.72,
  service: 0.65,
  lead_gen: 0.58,
  digital_flip: 0.75,
  auction: 0.63,
  market_inefficiency: 0.70,
  trend_surge: 0.55,
  freelance: 0.68,
  resale: 0.62,
  grant: 0.45,
  contest: 0.35,
  giveaway: 0.40
};

export const riskToleranceLevels = {
  conservative: 30,
  moderate: 60,
  aggressive: 100
};

export const timeToPayoutDays = {
  immediate: 1,
  hours: 0.5,
  days: 3,
  weeks: 14,
  ongoing: 30
};

export const timeSensitivityBoost = {
  immediate: 0.15,
  hours: 0.12,
  days: 0.08,
  weeks: 0.03,
  ongoing: 0.05
};

/**
 * Calculate success probability based on opportunity factors
 */
export function calculateSuccessProbability(opportunity) {
  let score = 50; // base
  
  if (opportunity.velocity_score) {
    score += opportunity.velocity_score * 0.15;
  }
  
  if (opportunity.risk_score) {
    score -= opportunity.risk_score * 0.10;
  }
  
  const categoryRate = categorySuccessRates[opportunity.category] || 0.50;
  score += categoryRate * 20;
  
  score += (timeSensitivityBoost[opportunity.time_sensitivity] || 0) * 10;
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate ROI estimate
 */
export function calculateROI(opportunity) {
  if (!opportunity.profit_estimate_low || !opportunity.profit_estimate_high) {
    return 0;
  }
  const avgProfit = (opportunity.profit_estimate_low + opportunity.profit_estimate_high) / 2;
  const capital = opportunity.capital_required || 1;
  return (avgProfit / capital) * 100;
}

/**
 * Get time to first dollar estimate
 */
export function getTimeToFirstDollar(timeSensitivity) {
  return timeToPayoutDays[timeSensitivity] || 7;
}

/**
 * Classify recommendation priority
 */
export function getRecommendationPriority(score) {
  if (score > 70) return 'high_priority';
  if (score > 50) return 'medium_priority';
  return 'low_priority';
}

/**
 * Create audit log entry helper
 */
export async function createAuditLog(base44, userEmail, actionType, entityType, details) {
  return base44.asServiceRole.entities.AuditLog.create({
    entity_type: entityType,
    action_type: actionType,
    user_email: userEmail,
    details,
    status: details.status || 'completed',
    severity: details.severity || 'low',
    timestamp: new Date().toISOString()
  });
}

/**
 * Batch entity queries with error handling
 */
export async function batchGetEntities(base44, entityName, filters, limit = 100) {
  try {
    return await base44.asServiceRole.entities[entityName].filter(filters, '-created_date', limit);
  } catch (error) {
    console.error(`Error fetching ${entityName}:`, error);
    return [];
  }
}

/**
 * Calculate average and standard deviation
 */
export function getStatistics(values) {
  if (values.length === 0) return { avg: 0, stdDev: 0 };
  
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  return { avg, stdDev };
}

/**
 * Detect outliers (values > 3 sigma from mean)
 */
export function detectOutliers(values, threshold = 3) {
  const { avg, stdDev } = getStatistics(values);
  return values.filter(v => Math.abs(v - avg) > threshold * stdDev);
}

/**
 * Clamp value between min and max
 */
export function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Format currency
 */
export function formatCurrency(amount) {
  return `$${amount.toFixed(2)}`;
}

/**
 * Check time window (e.g., last 30 days)
 */
export function isInTimeWindow(date, days) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return new Date(date) > cutoff;
}

/**
 * Merge arrays without duplicates
 */
export function uniqueArray(arr) {
  return [...new Set(arr)];
}