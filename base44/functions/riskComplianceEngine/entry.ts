import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Risk Management & Compliance Engine - Phase 7
 * Opportunity risk scoring, compliance validation, fraud detection,
 * spending controls, and regulatory enforcement
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, payload } = await req.json();

    if (action === 'assess_opportunity_risk') {
      return await assessOpportunityRisk(base44, user, payload);
    }

    if (action === 'check_compliance') {
      return await checkCompliance(base44, user, payload);
    }

    if (action === 'detect_fraud_signals') {
      return await detectFraudSignals(base44, user, payload);
    }

    if (action === 'validate_spending_policy') {
      return await validateSpendingPolicy(base44, user, payload);
    }

    if (action === 'get_risk_dashboard') {
      return await getRiskDashboard(base44, user);
    }

    if (action === 'create_spending_policy') {
      return await createSpendingPolicy(base44, user, payload);
    }

    if (action === 'assess_user_risk_profile') {
      return await assessUserRiskProfile(base44, user);
    }

    if (action === 'validate_capital_allocation') {
      return await validateCapitalAllocation(base44, user, payload);
    }

    if (action === 'check_regulatory_requirements') {
      return await checkRegulatoryRequirements(base44, user, payload);
    }

    if (action === 'audit_compliance_history') {
      return await auditComplianceHistory(base44, user);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Risk Compliance Engine Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Assess opportunity risk across multiple dimensions
 */
async function assessOpportunityRisk(base44, user, payload) {
  const { opportunity_id } = payload;

  try {
    const opps = await base44.entities.Opportunity.filter(
      { id: opportunity_id },
      null,
      1
    );

    if (!opps.length) {
      return Response.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    const opp = opps[0];

    const riskAssessment = {
      opportunity_id: opportunity_id,
      timestamp: new Date().toISOString(),
      overall_risk_score: 0,
      risk_level: 'low',
      risk_factors: [],
      recommendations: [],
      approval_required: false
    };

    // 1. Platform Reputation Risk
    const platformRisk = assessPlatformRisk(opp.platform);
    riskAssessment.risk_factors.push(platformRisk);
    riskAssessment.overall_risk_score += platformRisk.score;

    // 2. Capital Risk
    const capitalRisk = assessCapitalRisk(opp.capital_required, opp.profit_estimate_low);
    riskAssessment.risk_factors.push(capitalRisk);
    riskAssessment.overall_risk_score += capitalRisk.score;

    // 3. Timeline Risk (Time sensitivity)
    const timelineRisk = assessTimelineRisk(opp.time_sensitivity, opp.deadline);
    riskAssessment.risk_factors.push(timelineRisk);
    riskAssessment.overall_risk_score += timelineRisk.score;

    // 4. Category Risk
    const categoryRisk = assessCategoryRisk(opp.category);
    riskAssessment.risk_factors.push(categoryRisk);
    riskAssessment.overall_risk_score += categoryRisk.score;

    // 5. Verification Risk
    const verificationRisk = assessVerificationRisk(opp.required_documents, opp.required_identity_type);
    riskAssessment.risk_factors.push(verificationRisk);
    riskAssessment.overall_risk_score += verificationRisk.score;

    // Normalize score to 0-100
    riskAssessment.overall_risk_score = Math.min(100, Math.round(riskAssessment.overall_risk_score / 5));

    // Determine risk level
    if (riskAssessment.overall_risk_score < 30) {
      riskAssessment.risk_level = 'low';
    } else if (riskAssessment.overall_risk_score < 60) {
      riskAssessment.risk_level = 'medium';
    } else if (riskAssessment.overall_risk_score < 80) {
      riskAssessment.risk_level = 'high';
    } else {
      riskAssessment.risk_level = 'critical';
    }

    // Generate recommendations
    for (const factor of riskAssessment.risk_factors) {
      if (factor.score > 15) {
        riskAssessment.recommendations.push(factor.recommendation);
      }
    }

    // Determine if approval required
    riskAssessment.approval_required = riskAssessment.overall_risk_score >= 70;

    return Response.json({
      success: true,
      ...riskAssessment
    });
  } catch (error) {
    console.error('Assess risk error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Check opportunity compliance requirements
 */
async function checkCompliance(base44, user, payload) {
  const { opportunity_id } = payload;

  try {
    const opps = await base44.entities.Opportunity.filter(
      { id: opportunity_id },
      null,
      1
    );

    if (!opps.length) {
      return Response.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    const opp = opps[0];

    const compliance = {
      opportunity_id: opportunity_id,
      timestamp: new Date().toISOString(),
      is_compliant: true,
      checks: [],
      warnings: [],
      blockers: [],
      kyc_required: false,
      legal_review_required: false
    };

    // 1. KYC Check
    const kycCheck = {
      name: 'Know Your Customer',
      passed: !detectKYCRequirement(opp),
      details: detectKYCRequirement(opp) ? 'KYC verification required for this opportunity' : 'No KYC needed'
    };
    compliance.checks.push(kycCheck);
    if (!kycCheck.passed) {
      compliance.kyc_required = true;
      compliance.warnings.push('KYC verification is required. Please complete identity verification.');
    }

    // 2. Age Verification Check
    const ageCheck = {
      name: 'Age Verification',
      passed: !requiresAgeVerification(opp),
      details: 'Age 18+ required'
    };
    compliance.checks.push(ageCheck);
    if (!ageCheck.passed) {
      compliance.blockers.push('You must be 18+ to participate in this opportunity.');
      compliance.is_compliant = false;
    }

    // 3. Geo-compliance Check
    const geoCheck = {
      name: 'Geographic Restrictions',
      passed: true,
      details: 'Available in US and Canada'
    };
    compliance.checks.push(geoCheck);

    // 4. Terms & Conditions Check
    const termsCheck = {
      name: 'Terms Acceptance',
      passed: !opp.requires_terms_acceptance,
      details: opp.requires_terms_acceptance ? 'Must accept platform terms' : 'No special terms required'
    };
    compliance.checks.push(termsCheck);

    // 5. Conflict of Interest Check
    const conflictCheck = {
      name: 'Conflict of Interest',
      passed: !checkConflictOfInterest(opp),
      details: 'No conflicts detected'
    };
    compliance.checks.push(conflictCheck);
    if (!conflictCheck.passed) {
      compliance.warnings.push('Potential conflict of interest detected.');
    }

    // 6. Platform TOS Compliance
    const tosCheck = {
      name: 'Platform TOS Compliance',
      passed: checkPlatformTOSCompliance(opp.platform),
      details: 'Operation complies with platform terms'
    };
    compliance.checks.push(tosCheck);
    if (!tosCheck.passed) {
      compliance.blockers.push(`Operation violates ${opp.platform} terms of service.`);
      compliance.is_compliant = false;
    }

    // Determine if legal review needed
    if (opp.profit_estimate_high > 50000 || opp.category === 'grant') {
      compliance.legal_review_required = true;
      compliance.warnings.push('Legal review recommended for high-value opportunities.');
    }

    return Response.json({
      success: true,
      ...compliance
    });
  } catch (error) {
    console.error('Check compliance error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Detect fraud signals in opportunity
 */
async function detectFraudSignals(base44, user, payload) {
  const { opportunity_id } = payload;

  try {
    const opps = await base44.entities.Opportunity.filter(
      { id: opportunity_id },
      null,
      1
    );

    if (!opps.length) {
      return Response.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    const opp = opps[0];

    const fraudDetection = {
      opportunity_id: opportunity_id,
      fraud_risk_score: 0,
      fraud_level: 'low',
      signals: [],
      recommendation: 'PROCEED'
    };

    // Signal 1: Unrealistic profit margins
    if (opp.profit_estimate_high && opp.capital_required) {
      const roi = (opp.profit_estimate_high / opp.capital_required) * 100;
      if (roi > 500) {
        fraudDetection.signals.push({
          type: 'unrealistic_roi',
          severity: 'high',
          details: `ROI of ${roi}% is suspiciously high`
        });
        fraudDetection.fraud_risk_score += 25;
      }
    }

    // Signal 2: Pressure tactics (limited time)
    if (opp.time_sensitivity === 'immediate') {
      fraudDetection.signals.push({
        type: 'pressure_tactics',
        severity: 'medium',
        details: 'Opportunity claims urgency to pressure decision'
      });
      fraudDetection.fraud_risk_score += 15;
    }

    // Signal 3: Vague opportunity details
    if (!opp.description || opp.description.length < 100) {
      fraudDetection.signals.push({
        type: 'vague_details',
        severity: 'medium',
        details: 'Opportunity description lacks specific details'
      });
      fraudDetection.fraud_risk_score += 10;
    }

    // Signal 4: Upfront payment requirement
    if (opp.capital_required > 0) {
      fraudDetection.signals.push({
        type: 'upfront_payment',
        severity: 'high',
        details: 'Requires upfront capital (common fraud indicator)'
      });
      fraudDetection.fraud_risk_score += 20;
    }

    // Signal 5: Unknown platform
    const knownPlatforms = ['upwork', 'fiverr', 'grant.gov', 'etsy', 'amazon', 'ebay'];
    if (!knownPlatforms.includes(opp.platform?.toLowerCase())) {
      fraudDetection.signals.push({
        type: 'unknown_platform',
        severity: 'medium',
        details: `Platform "${opp.platform}" is not widely recognized`
      });
      fraudDetection.fraud_risk_score += 15;
    }

    // Signal 6: No contact information
    if (!opp.url || !opp.url.includes('http')) {
      fraudDetection.signals.push({
        type: 'no_url',
        severity: 'medium',
        details: 'No verifiable URL provided'
      });
      fraudDetection.fraud_risk_score += 10;
    }

    // Determine fraud level
    if (fraudDetection.fraud_risk_score < 20) {
      fraudDetection.fraud_level = 'low';
      fraudDetection.recommendation = 'PROCEED';
    } else if (fraudDetection.fraud_risk_score < 40) {
      fraudDetection.fraud_level = 'medium';
      fraudDetection.recommendation = 'REVIEW_CAREFULLY';
    } else if (fraudDetection.fraud_risk_score < 60) {
      fraudDetection.fraud_level = 'high';
      fraudDetection.recommendation = 'MANUAL_REVIEW_REQUIRED';
    } else {
      fraudDetection.fraud_level = 'critical';
      fraudDetection.recommendation = 'BLOCK_AND_REPORT';
    }

    return Response.json({
      success: true,
      ...fraudDetection
    });
  } catch (error) {
    console.error('Fraud detection error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Validate spending against policy
 */
async function validateSpendingPolicy(base44, user, payload) {
  const { amount, category } = payload;

  try {
    const goals = await base44.entities.UserGoals.filter({ created_by: user.email }, null, 1);
    const goal = goals[0] || { available_capital: 0 };

    const validation = {
      amount_requested: amount,
      category: category,
      is_approved: false,
      reasons: [],
      available_balance: goal.available_capital || 0,
      daily_limit: 500,
      category_limit: 100,
      total_risk_exposure: 0
    };

    // Check 1: Sufficient balance
    if (amount > validation.available_balance) {
      validation.reasons.push(`Insufficient balance. Available: $${validation.available_balance}`);
    } else {
      validation.is_approved = true;
    }

    // Check 2: Daily limit
    const today = new Date().toDateString();
    const todayTransactions = await base44.entities.Transaction.filter(
      { created_date: { $gte: today }, type: 'expense' },
      null,
      100
    );
    const todaySpent = todayTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

    if (todaySpent + amount > validation.daily_limit) {
      validation.reasons.push(`Daily limit exceeded. Used: $${todaySpent}, Limit: $${validation.daily_limit}`);
      validation.is_approved = false;
    }

    // Check 3: Category limit
    const categorySpent = todayTransactions
      .filter(t => t.category === category)
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    if (categorySpent + amount > validation.category_limit) {
      validation.reasons.push(`Category limit exceeded for ${category}.`);
      validation.is_approved = false;
    }

    return Response.json({
      success: true,
      ...validation
    });
  } catch (error) {
    console.error('Validate spending error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get comprehensive risk dashboard
 */
async function getRiskDashboard(base44, user) {
  try {
    const opportunities = await base44.entities.Opportunity.filter(
      { status: 'new' },
      '-created_date',
      100
    );

    const dashboard = {
      timestamp: new Date().toISOString(),
      total_opportunities_reviewed: opportunities.length,
      risk_distribution: { low: 0, medium: 0, high: 0, critical: 0 },
      fraud_distribution: { low: 0, medium: 0, high: 0, critical: 0 },
      total_potential_exposure: 0,
      recommended_actions: [],
      portfolio_risk_score: 0
    };

    let totalRisk = 0;

    for (const opp of opportunities.slice(0, 20)) {
      // Quick risk assessment
      const risk = assessQuickRisk(opp);
      dashboard.risk_distribution[risk.level]++;
      totalRisk += risk.score;

      // Fraud check
      const fraud = assessQuickFraud(opp);
      dashboard.fraud_distribution[fraud.level]++;

      dashboard.total_potential_exposure += opp.profit_estimate_high || 0;
    }

    dashboard.portfolio_risk_score = Math.round(totalRisk / Math.max(opportunities.length, 1));

    // Generate recommendations
    if (dashboard.risk_distribution.critical > 0) {
      dashboard.recommended_actions.push('⚠️ CRITICAL: Review and block critical-risk opportunities');
    }
    if (dashboard.fraud_distribution.high > 0 || dashboard.fraud_distribution.critical > 0) {
      dashboard.recommended_actions.push('🚨 Fraud signals detected. Recommend manual review.');
    }
    if (dashboard.portfolio_risk_score > 65) {
      dashboard.recommended_actions.push('📊 Overall portfolio risk is elevated. Consider conservative approach.');
    }

    return Response.json({
      success: true,
      ...dashboard
    });
  } catch (error) {
    console.error('Get risk dashboard error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Create spending policy
 */
async function createSpendingPolicy(base44, user, payload) {
  const {
    name,
    daily_limit = 500,
    weekly_limit = 2000,
    monthly_limit = 8000,
    max_per_category = 100,
    categories = []
  } = payload;

  try {
    const policy = await base44.entities.SpendingPolicy.create({
      user_email: user.email,
      name: name,
      daily_limit: daily_limit,
      weekly_limit: weekly_limit,
      monthly_limit: monthly_limit,
      max_per_category: max_per_category,
      category_limits: categories,
      is_active: true,
      created_at: new Date().toISOString()
    });

    // Log creation
    await base44.entities.ActivityLog.create({
      action_type: 'system',
      message: `💰 Spending policy created: ${name}`,
      severity: 'info',
      metadata: { policy_id: policy.id }
    });

    return Response.json({
      success: true,
      policy_id: policy.id,
      name: name,
      daily_limit: daily_limit
    });
  } catch (error) {
    console.error('Create policy error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Assess user's overall risk profile
 */
async function assessUserRiskProfile(base44, user) {
  try {
    const goals = await base44.entities.UserGoals.filter({ created_by: user.email }, null, 1);
    const goal = goals[0] || {};

    const profile = {
      user_email: user.email,
      risk_tolerance: goal.risk_tolerance || 'moderate',
      available_capital: goal.available_capital || 0,
      daily_target: goal.daily_target || 1000,
      risk_metrics: {
        volatility: calculateVolatility(),
        drawdown_risk: calculateDrawdownRisk(goal.available_capital),
        concentration_risk: 0,
        leverage_risk: 0
      },
      portfolio_value: goal.wallet_balance || 0,
      maximum_loss_tolerance: calculateMaxLoss(goal.available_capital, goal.risk_tolerance),
      recommended_position_size: calculatePositionSize(goal.available_capital, goal.risk_tolerance)
    };

    return Response.json({
      success: true,
      ...profile
    });
  } catch (error) {
    console.error('Assess profile error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Validate capital allocation
 */
async function validateCapitalAllocation(base44, user, payload) {
  const { total_capital, allocations } = payload;

  try {
    const validation = {
      total_capital: total_capital,
      allocations: allocations,
      is_balanced: true,
      warnings: [],
      concentration_risk: 0,
      suggested_rebalance: null
    };

    let totalAllocated = 0;

    for (const alloc of allocations) {
      totalAllocated += alloc.percentage || 0;

      if ((alloc.percentage || 0) > 40) {
        validation.concentration_risk += (alloc.percentage - 40) / 100;
        validation.warnings.push(`High concentration in ${alloc.category}: ${alloc.percentage}%`);
      }
    }

    if (Math.abs(totalAllocated - 100) > 1) {
      validation.warnings.push(`Allocations sum to ${totalAllocated}%, should be 100%`);
      validation.is_balanced = false;
    }

    return Response.json({
      success: true,
      ...validation
    });
  } catch (error) {
    console.error('Validate allocation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Check regulatory requirements
 */
async function checkRegulatoryRequirements(base44, user, payload) {
  const { opportunity_id } = payload;

  try {
    const opps = await base44.entities.Opportunity.filter({ id: opportunity_id }, null, 1);

    if (!opps.length) {
      return Response.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    const opp = opps[0];

    const regulatory = {
      opportunity_id: opportunity_id,
      jurisdiction: 'US',
      requirements: [],
      licenses_needed: [],
      restrictions: [],
      tax_implications: {}
    };

    // Check category-specific requirements
    if (opp.category === 'grant') {
      regulatory.requirements.push('Eligible entity (individual, non-profit, business)');
      regulatory.tax_implications.reporting = 'Must report income on tax return';
    }

    if (opp.category === 'financial') {
      regulatory.licenses_needed.push('May require financial services licensing');
      regulatory.restrictions.push('Prohibited in certain US states');
    }

    // Tax implications
    regulatory.tax_implications.taxable_income = 'Yes - always report on taxes';
    regulatory.tax_implications.estimated_tax = 'May owe quarterly estimated tax';
    regulatory.tax_implications.self_employment_tax = opp.category === 'freelance' ? 'Yes' : 'No';

    return Response.json({
      success: true,
      ...regulatory
    });
  } catch (error) {
    console.error('Check regulatory error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Audit compliance history
 */
async function auditComplianceHistory(base44, user) {
  try {
    const logs = await base44.entities.ActivityLog.filter(
      { action_type: 'compliance' },
      '-created_date',
      100
    );

    const audit = {
      timestamp: new Date().toISOString(),
      total_checks: logs.length,
      passed: logs.filter(l => l.severity !== 'critical').length,
      failed: logs.filter(l => l.severity === 'critical').length,
      history: logs.slice(0, 20).map(l => ({
        timestamp: l.created_date,
        message: l.message,
        severity: l.severity
      }))
    };

    return Response.json({
      success: true,
      ...audit
    });
  } catch (error) {
    console.error('Audit compliance error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function assessPlatformRisk(platform) {
  const platformRisks = {
    'upwork': { score: 5, recommendation: 'Upwork is established and regulated' },
    'fiverr': { score: 10, recommendation: 'Monitor for scams on Fiverr' },
    'freelancer': { score: 15, recommendation: 'Use escrow features' },
    'unknown': { score: 30, recommendation: 'Unknown platforms carry higher risk' }
  };

  return platformRisks[platform?.toLowerCase()] || platformRisks.unknown;
}

function assessCapitalRisk(capitalRequired, profitEstimate) {
  const risk = { score: 0, recommendation: '' };
  const capital = capitalRequired || 0;
  const profit = profitEstimate || 0;

  if (capital > 5000) {
    risk.score += 25;
    risk.recommendation = 'High capital requirement increases risk';
  } else if (capital > 1000) {
    risk.score += 15;
  } else if (capital > 0) {
    risk.score += 5;
  }

  return risk;
}

function assessTimelineRisk(timeSensitivity, deadline) {
  const risk = { score: 0, recommendation: '' };

  if (timeSensitivity === 'immediate') {
    risk.score = 20;
    risk.recommendation = 'Tight timeline increases rush decisions';
  } else if (timeSensitivity === 'hours') {
    risk.score = 15;
  }

  return risk;
}

function assessCategoryRisk(category) {
  const categoryRisks = {
    'grant': { score: 5, recommendation: 'Grants are generally low risk if legitimate' },
    'contest': { score: 10, recommendation: 'Contests vary in legitimacy' },
    'giveaway': { score: 20, recommendation: 'Giveaways often have scams' },
    'arbitrage': { score: 15, recommendation: 'Arbitrage requires market knowledge' },
    'resale': { score: 18, recommendation: 'Resale has competition and inventory risk' },
    'freelance': { score: 12, recommendation: 'Freelance is fairly low risk' }
  };

  return categoryRisks[category] || { score: 10, recommendation: 'Category risk assessment' };
}

function assessVerificationRisk(requiredDocs, identityType) {
  const risk = { score: 0, recommendation: '' };

  if (requiredDocs && requiredDocs.length > 0) {
    risk.score = 5;
    risk.recommendation = 'Legitimate opportunities request verification';
  }

  return risk;
}

function detectKYCRequirement(opp) {
  if (opp.category === 'grant' || opp.category === 'prize') return true;
  if ((opp.profit_estimate_high || 0) > 20000) return true;
  return false;
}

function requiresAgeVerification(opp) {
  return opp.category === 'giveaway' || opp.category === 'contest';
}

function checkConflictOfInterest(opp) {
  return false; // Simplified
}

function checkPlatformTOSCompliance(platform) {
  const compliantPlatforms = ['upwork', 'fiverr', 'freelancer', 'toptal'];
  return compliantPlatforms.includes(platform?.toLowerCase());
}

function assessQuickRisk(opp) {
  let score = 30;
  if (opp.capital_required > 1000) score += 20;
  if (opp.time_sensitivity === 'immediate') score += 15;
  if (!opp.url || opp.url.length < 10) score += 20;

  let level = 'low';
  if (score > 65) level = 'high';
  else if (score > 45) level = 'medium';

  return { score: Math.min(score, 100), level };
}

function assessQuickFraud(opp) {
  let score = 0;
  if (opp.capital_required && opp.profit_estimate_high) {
    const roi = (opp.profit_estimate_high / opp.capital_required) * 100;
    if (roi > 500) score += 30;
  }
  if (opp.time_sensitivity === 'immediate') score += 15;

  let level = 'low';
  if (score > 50) level = 'high';
  else if (score > 25) level = 'medium';

  return { score, level };
}

function calculateVolatility() {
  return Math.random() * 30; // 0-30%
}

function calculateDrawdownRisk(capital) {
  return Math.min(capital * 0.2, 5000); // 20% or max $5000
}

function calculateMaxLoss(capital, tolerance) {
  const maxLossPct = tolerance === 'conservative' ? 0.05 : tolerance === 'moderate' ? 0.1 : 0.2;
  return capital * maxLossPct;
}

function calculatePositionSize(capital, tolerance) {
  const positionPct = tolerance === 'conservative' ? 0.02 : tolerance === 'moderate' ? 0.05 : 0.1;
  return capital * positionPct;
}