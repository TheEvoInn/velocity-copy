import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Advanced Scanning Engine - Phase 3
 * Deep opportunity analysis with hidden opportunity detection,
 * automatic requirement detection, and intelligent alerting
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, payload } = await req.json();

    if (action === 'deep_scan_opportunity') {
      return await deepScanOpportunity(base44, user, payload);
    }

    if (action === 'detect_requirements') {
      return await detectRequirements(base44, user, payload);
    }

    if (action === 'analyze_all_opportunities') {
      return await analyzeAllOpportunities(base44, user);
    }

    if (action === 'generate_smart_alerts') {
      return await generateSmartAlerts(base44, user);
    }

    if (action === 'identify_hidden_payouts') {
      return await identifyHiddenPayouts(base44, user, payload);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Scanning Engine Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Deep scan a single opportunity for hidden features and requirements
 */
async function deepScanOpportunity(base44, user, payload) {
  const { opportunity_id } = payload;

  try {
    const opps = await base44.entities.Opportunity.filter(
      { id: opportunity_id },
      null,
      1
    );

    if (!opps || opps.length === 0) {
      return Response.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    const opp = opps[0];
    const analysis = {
      opportunity_id: opp.id,
      title: opp.title,
      platform: opp.platform,
      analysis: {
        hidden_features: [],
        bonus_opportunities: [],
        multi_step_processes: [],
        credential_requirements: []
      }
    };

    // Detect hidden features based on platform
    if (opp.platform === 'upwork') {
      analysis.analysis.hidden_features.push(
        'Connects bonus (higher earnings for accepted proposals)',
        'Upwork Plus membership benefits',
        'Talent specialized categories (premium visibility)',
        'Proposal boosts available'
      );
      analysis.analysis.bonus_opportunities.push(
        'Batch proposals for 10+ similar jobs (20% boost)',
        'Early bird proposals in first 24 hours',
        'Invite-only contracts for high-rated freelancers'
      );
      analysis.analysis.multi_step_processes.push(
        'Step 1: Build competitive proposal',
        'Step 2: Send custom proposal',
        'Step 3: Negotiate terms',
        'Step 4: Contract negotiation',
        'Step 5: Milestone setup'
      );
    }

    if (opp.platform === 'fiverr') {
      analysis.analysis.hidden_features.push(
        'Gig Ratings multiplier for badges',
        'Pro level benefits (higher visibility)',
        'Buyer Request feature (direct clients)',
        'Custom offers (higher conversion)'
      );
      analysis.analysis.bonus_opportunities.push(
        'New Year/seasonal gig boosts',
        'Category featured gig slots',
        'Affiliate promotion opportunities'
      );
      analysis.analysis.multi_step_processes.push(
        'Step 1: Create gig listing',
        'Step 2: Set pricing tiers',
        'Step 3: Portfolio showcase',
        'Step 4: Deliver exceptional service',
        'Step 5: Collect reviews for ranking'
      );
    }

    if (opp.category === 'grant') {
      analysis.analysis.hidden_features.push(
        'Matching funds available (multiplier effect)',
        'Technical assistance grants (separate funding)',
        'Rural or minority business bonuses',
        'Woman-owned business set-asides'
      );
      analysis.analysis.multi_step_processes.push(
        'Step 1: Pre-application eligibility check',
        'Step 2: Business plan preparation',
        'Step 3: Financial documentation',
        'Step 4: Grant application submission',
        'Step 5: Agency review (4-8 weeks)',
        'Step 6: Award notification and contracting'
      );
    }

    if (opp.category === 'contest') {
      analysis.analysis.hidden_features.push(
        'Runner-up prizes (cash for 2nd-5th places)',
        'Sponsor bonus incentives',
        'Volume discounts (multiple entries)',
        'Exclusive preview access for high-rated entrants'
      );
      analysis.analysis.bonus_opportunities.push(
        'Team collaboration boosts',
        'Early bird submission bonuses',
        'Featured entry placements'
      );
    }

    if (opp.category === 'microtask') {
      analysis.analysis.hidden_features.push(
        'Qualification bonuses (higher rates for qualified workers)',
        'Batch completion multipliers',
        'Speed bonuses (first 10% of workers)',
        'Quality tier bonuses (99%+ approval rate)'
      );
      analysis.analysis.bonus_opportunities.push(
        'Master qualifications (hidden batches)',
        'Requester preferences (repeat work)',
        'NDA batch access (premium tasks)'
      );
    }

    // Detect credential requirements
    const credentialsNeeded = await detectCredentialRequirements(opp);
    analysis.analysis.credential_requirements = credentialsNeeded;

    return Response.json({
      success: true,
      ...analysis
    });
  } catch (error) {
    console.error('Deep scan error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Detect all requirements for an opportunity
 */
async function detectRequirements(base44, user, payload) {
  const { opportunity_id } = payload;

  try {
    const opps = await base44.entities.Opportunity.filter(
      { id: opportunity_id },
      null,
      1
    );

    if (!opps || opps.length === 0) {
      return Response.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    const opp = opps[0];
    const requirements = {
      identity_type: detectIdentityType(opp),
      account_type: detectAccountType(opp),
      kyc_required: detectKYCRequirement(opp),
      skill_match_profile: detectSkillProfile(opp),
      documents_needed: detectDocumentNeeds(opp),
      time_commitment: estimateTimeCommitment(opp),
      experience_level: detectExperienceLevel(opp),
      geographic_restrictions: detectGeoRestrictions(opp),
      age_verification: detectAgeRequirement(opp),
      success_probability: calculateSuccessProbability(opp)
    };

    // Update opportunity with detected requirements
    await base44.entities.Opportunity.update(opportunity_id, {
      required_identity_type: requirements.identity_type,
      required_documents: requirements.documents_needed,
      notes: `Auto-detected: KYC=${requirements.kyc_required}, Success Rate=${requirements.success_probability}%`
    });

    return Response.json({
      success: true,
      opportunity_id,
      requirements
    });
  } catch (error) {
    console.error('Requirement detection error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Analyze all opportunities in database
 */
async function analyzeAllOpportunities(base44, user) {
  try {
    const allOpps = await base44.entities.Opportunity.filter(
      { status: { $in: ['new', 'reviewing'] } },
      '-overall_score',
      200
    );

    const analysisResults = {
      total_analyzed: 0,
      updated_count: 0,
      by_category: {},
      highest_priority: []
    };

    for (const opp of allOpps) {
      try {
        const requirements = {
          identity_type: detectIdentityType(opp),
          kyc_required: detectKYCRequirement(opp),
          success_probability: calculateSuccessProbability(opp),
          urgency_score: calculateUrgency(opp)
        };

        // Update with analysis
        await base44.entities.Opportunity.update(opp.id, {
          required_identity_type: requirements.identity_type,
          notes: `KYC=${requirements.kyc_required}, Success=${requirements.success_probability}%, Urgency=${requirements.urgency_score}`
        });

        analysisResults.updated_count++;

        // Track by category
        const cat = opp.category || 'unknown';
        if (!analysisResults.by_category[cat]) {
          analysisResults.by_category[cat] = { count: 0, avg_success: 0 };
        }
        analysisResults.by_category[cat].count++;
        analysisResults.by_category[cat].avg_success += requirements.success_probability;

        // Add to highest priority if score >= 75
        if ((opp.overall_score || 0) >= 75 && requirements.urgency_score >= 7) {
          analysisResults.highest_priority.push({
            id: opp.id,
            title: opp.title,
            score: opp.overall_score,
            urgency: requirements.urgency_score,
            deadline: opp.deadline
          });
        }
      } catch (e) {
        console.error(`Error analyzing opportunity ${opp.id}:`, e.message);
      }
    }

    analysisResults.total_analyzed = allOpps.length;

    // Calculate averages
    for (const cat in analysisResults.by_category) {
      analysisResults.by_category[cat].avg_success = Math.round(
        analysisResults.by_category[cat].avg_success / analysisResults.by_category[cat].count
      );
    }

    // Sort by urgency
    analysisResults.highest_priority.sort((a, b) => b.urgency - a.urgency);
    analysisResults.highest_priority = analysisResults.highest_priority.slice(0, 10);

    // Log activity
    await base44.entities.ActivityLog.create({
      action_type: 'scan',
      message: `🔎 Deep scanning: ${analysisResults.updated_count} opportunities analyzed, ${analysisResults.highest_priority.length} high priority identified`,
      severity: 'info',
      metadata: analysisResults
    });

    return Response.json({
      success: true,
      ...analysisResults
    });
  } catch (error) {
    console.error('Bulk analysis error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Generate smart alerts for time-sensitive opportunities
 */
async function generateSmartAlerts(base44, user) {
  try {
    const alerts = {
      timestamp: new Date().toISOString(),
      high_value_alerts: [],
      expiring_soon: [],
      immediate_action: [],
      total_alerts: 0
    };

    const allOpps = await base44.entities.Opportunity.list('-overall_score', 200);

    for (const opp of allOpps) {
      if (opp.status !== 'new' && opp.status !== 'reviewing') continue;

      const now = new Date();
      const isExpiring = opp.deadline && (new Date(opp.deadline) - now) < (3 * 24 * 60 * 60 * 1000); // 3 days
      const isExpiringSoon = opp.deadline && (new Date(opp.deadline) - now) < (24 * 60 * 60 * 1000); // 1 day
      const isImminent = opp.deadline && (new Date(opp.deadline) - now) < (6 * 60 * 60 * 1000); // 6 hours

      // High-value opportunity alert
      if ((opp.profit_estimate_high || 0) >= 5000 && (opp.overall_score || 0) >= 70) {
        alerts.high_value_alerts.push({
          id: opp.id,
          title: opp.title,
          profit_high: opp.profit_estimate_high,
          score: opp.overall_score,
          platform: opp.platform,
          priority: 'critical'
        });
      }

      // Expiring soon alerts
      if (isExpiringSoon && !isImminent) {
        alerts.expiring_soon.push({
          id: opp.id,
          title: opp.title,
          deadline: opp.deadline,
          hours_remaining: Math.round((new Date(opp.deadline) - now) / (60 * 60 * 1000)),
          profit_estimate: opp.profit_estimate_high,
          priority: 'high'
        });
      }

      // Immediate action alerts
      if (isImminent) {
        alerts.immediate_action.push({
          id: opp.id,
          title: opp.title,
          deadline: opp.deadline,
          minutes_remaining: Math.round((new Date(opp.deadline) - now) / (60 * 1000)),
          profit_estimate: opp.profit_estimate_high,
          priority: 'critical'
        });
      }
    }

    alerts.total_alerts = alerts.high_value_alerts.length + alerts.expiring_soon.length + alerts.immediate_action.length;

    // Create alert notifications
    for (const alert of alerts.immediate_action) {
      await base44.entities.ActivityLog.create({
        action_type: 'alert',
        message: `🚨 URGENT: ${alert.title} expires in ${alert.minutes_remaining} minutes!`,
        severity: 'critical',
        metadata: alert
      });
    }

    for (const alert of alerts.expiring_soon) {
      await base44.entities.ActivityLog.create({
        action_type: 'alert',
        message: `⏰ Expiring Soon: ${alert.title} (${alert.hours_remaining}h remaining)`,
        severity: 'warning',
        metadata: alert
      });
    }

    for (const alert of alerts.high_value_alerts) {
      await base44.entities.ActivityLog.create({
        action_type: 'opportunity_found',
        message: `💰 High-Value Alert: ${alert.title} - $${alert.profit_high} potential`,
        severity: 'info',
        metadata: alert
      });
    }

    return Response.json({
      success: true,
      ...alerts
    });
  } catch (error) {
    console.error('Alert generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Identify hidden payout structures
 */
async function identifyHiddenPayouts(base44, user, payload) {
  const { opportunity_id } = payload;

  try {
    const opps = await base44.entities.Opportunity.filter(
      { id: opportunity_id },
      null,
      1
    );

    if (!opps || opps.length === 0) {
      return Response.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    const opp = opps[0];
    const hiddenPayouts = {
      opportunity_id: opp.id,
      platform: opp.platform,
      direct_payment: opp.profit_estimate_high || 0,
      hidden_earnings: []
    };

    // Platform-specific hidden payout detection
    if (opp.platform === 'upwork') {
      hiddenPayouts.hidden_earnings.push(
        { source: 'Connects bonus', potential: Math.round((opp.profit_estimate_high || 0) * 0.05) },
        { source: 'Hourly bonus (first 10 hours)', potential: Math.round((opp.profit_estimate_high || 0) * 0.10) },
        { source: 'Agency referral (if applicable)', potential: Math.round((opp.profit_estimate_high || 0) * 0.15) }
      );
    }

    if (opp.platform === 'fiverr') {
      hiddenPayouts.hidden_earnings.push(
        { source: 'Level bonus (new orders when leveling)', potential: Math.round((opp.profit_estimate_high || 0) * 0.08) },
        { source: 'Affiliate earnings (selling gigs)', potential: Math.round((opp.profit_estimate_high || 0) * 0.20) },
        { source: 'Clearance boost (category feature)', potential: Math.round((opp.profit_estimate_high || 0) * 0.12) }
      );
    }

    if (opp.category === 'microtask') {
      hiddenPayouts.hidden_earnings.push(
        { source: 'Qualification bonus', potential: Math.round((opp.profit_estimate_high || 0) * 0.15) },
        { source: 'Speed bonus (first 10% complete)', potential: Math.round((opp.profit_estimate_high || 0) * 0.25) },
        { source: 'Quality bonus (99%+ approval)', potential: Math.round((opp.profit_estimate_high || 0) * 0.20) }
      );
    }

    if (opp.category === 'affiliate') {
      hiddenPayouts.hidden_earnings.push(
        { source: 'Recurring commission (monthly)', potential: Math.round((opp.profit_estimate_high || 0) * 0.50) },
        { source: 'Volume bonus (10+ referrals)', potential: Math.round((opp.profit_estimate_high || 0) * 0.15) },
        { source: 'Lifetime commission (select programs)', potential: Math.round((opp.profit_estimate_high || 0) * 1.00) }
      );
    }

    // Calculate total potential
    const totalHidden = hiddenPayouts.hidden_earnings.reduce((sum, e) => sum + e.potential, 0);
    hiddenPayouts.total_potential = hiddenPayouts.direct_payment + totalHidden;
    hiddenPayouts.multiplier = (hiddenPayouts.total_potential / (hiddenPayouts.direct_payment || 1)).toFixed(2);

    return Response.json({
      success: true,
      ...hiddenPayouts
    });
  } catch (error) {
    console.error('Hidden payout analysis error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function detectIdentityType(opp) {
  if (opp.required_identity_type) return opp.required_identity_type;

  const title = (opp.title || '').toLowerCase();
  const desc = (opp.description || '').toLowerCase();
  const combined = title + ' ' + desc;

  if (combined.includes('freelancer') || combined.includes('developer') || combined.includes('designer')) return 'freelancer';
  if (combined.includes('grant') || combined.includes('business') || combined.includes('startup')) return 'business_owner';
  if (combined.includes('contest') || combined.includes('competition')) return 'creator';
  if (combined.includes('survey') || combined.includes('microtask') || combined.includes('data')) return 'worker';
  if (combined.includes('beta') || combined.includes('test')) return 'tester';
  if (combined.includes('affiliate') || combined.includes('marketer') || combined.includes('promote')) return 'marketer';

  return 'general';
}

function detectAccountType(opp) {
  if (opp.platform === 'upwork') return 'freelancer_profile_required';
  if (opp.platform === 'fiverr') return 'seller_gig_account';
  if (opp.platform === 'mturk') return 'worker_account_required';
  if (opp.platform === 'grants.gov') return 'business_registration_required';
  if (opp.platform === 'kaggle') return 'data_scientist_profile';

  return 'standard_account';
}

function detectKYCRequirement(opp) {
  const category = (opp.category || '').toLowerCase();
  const profit = opp.profit_estimate_high || 0;

  if (category === 'grant' || category === 'prize') return true;
  if (profit > 20000) return true;
  if ((opp.description || '').toLowerCase().includes('kyc') || (opp.description || '').toLowerCase().includes('identity')) return true;
  if (category === 'financial' || category === 'payment') return true;

  return false;
}

function detectSkillProfile(opp) {
  const desc = (opp.description || '').toLowerCase();
  const skills = [];

  const skillMap = {
    'react|nodejs|javascript|frontend|backend|fullstack': 'web_development',
    'python|machine learning|data|ai|ml': 'data_science',
    'design|ui|ux|figma|adobe|photoshop': 'design',
    'writing|content|blog|seo|copywriting': 'writing',
    'marketing|seo|social|ads|campaign': 'marketing',
    'video|editing|motion|animation': 'video_production',
    'accounting|finance|bookkeeping|tax': 'finance',
    'devops|cloud|aws|kubernetes|docker': 'devops'
  };

  for (const [pattern, skill] of Object.entries(skillMap)) {
    if (new RegExp(pattern, 'i').test(desc)) {
      skills.push(skill);
    }
  }

  return skills.length > 0 ? skills : ['general'];
}

function detectDocumentNeeds(opp) {
  const category = (opp.category || '').toLowerCase();
  const desc = (opp.description || '').toLowerCase();
  const docs = [];

  if (category === 'grant' || desc.includes('grant')) {
    docs.push('business_plan', 'financial_statements', 'tax_returns');
  }
  if (category === 'microtask' || desc.includes('qualification')) {
    docs.push('id_verification', 'payment_method');
  }
  if ((opp.profit_estimate_high || 0) > 10000) {
    docs.push('id_verification', 'bank_account_verification');
  }
  if (desc.includes('portfolio')) {
    docs.push('portfolio_samples', 'work_examples');
  }

  return docs.length > 0 ? docs : [];
}

function estimateTimeCommitment(opp) {
  const profit = opp.profit_estimate_high || 0;
  const desc = (opp.description || '').toLowerCase();

  if (desc.includes('5 min') || desc.includes('quick')) return '5-15 minutes';
  if (desc.includes('hour') || profit < 100) return '1-4 hours';
  if (profit < 1000) return '1-3 days';
  if (profit < 5000) return '1-2 weeks';

  return '2+ weeks';
}

function detectExperienceLevel(opp) {
  const desc = (opp.description || '').toLowerCase();

  if (desc.includes('expert') || desc.includes('senior') || (opp.risk_score || 0) > 60) return 'expert';
  if (desc.includes('intermediate') || desc.includes('experienced')) return 'intermediate';

  return 'beginner_friendly';
}

function detectGeoRestrictions(opp) {
  const desc = (opp.description || '').toLowerCase();

  if (desc.includes('us only') || desc.includes('united states')) return ['us'];
  if (desc.includes('us, uk, ca')) return ['us', 'uk', 'ca'];
  if (desc.includes('worldwide') || desc.includes('global')) return 'unrestricted';

  return 'verify_during_execution';
}

function detectAgeRequirement(opp) {
  const category = (opp.category || '').toLowerCase();

  if (category === 'prize' || category === 'contest') return '18+';
  if (category === 'survey' || category === 'microtask') return '18+';

  return 'not_specified';
}

function calculateSuccessProbability(opp) {
  let score = 50;

  // Velocity bonus
  if ((opp.velocity_score || 0) > 80) score += 15;
  else if ((opp.velocity_score || 0) > 60) score += 8;

  // Risk penalty
  if ((opp.risk_score || 0) > 70) score -= 20;
  else if ((opp.risk_score || 0) > 50) score -= 10;

  // Category bonuses
  const category = (opp.category || '').toLowerCase();
  if (category === 'microtask') score += 10;
  if (category === 'freelance') score += 5;
  if (category === 'grant') score -= 15;

  return Math.min(Math.max(score, 10), 95);
}

function calculateUrgency(opp) {
  let urgency = 5;

  if (!opp.deadline) return urgency;

  const now = new Date();
  const deadline = new Date(opp.deadline);
  const hoursUntil = (deadline - now) / (60 * 60 * 1000);

  if (hoursUntil < 6) urgency = 10;
  else if (hoursUntil < 24) urgency = 9;
  else if (hoursUntil < 72) urgency = 7;
  else if (hoursUntil < 168) urgency = 5;

  if ((opp.profit_estimate_high || 0) > 5000) urgency += 1;

  return Math.min(urgency, 10);
}

function detectCredentialRequirements(opp) {
  const creds = [];

  if (opp.platform === 'upwork') {
    creds.push('Upwork account (Top Rated preferred)', 'Portfolio with 3+ samples', 'Profile completion >90%');
  }
  if (opp.platform === 'fiverr') {
    creds.push('Fiverr seller account', 'Gig listing (active)', 'Professional profile photo');
  }
  if (opp.category === 'grant') {
    creds.push('Business registration', 'EIN or SSN', 'Bank account verification');
  }
  if (opp.category === 'contest') {
    creds.push('Portfolio or previous work', 'Terms of service acceptance');
  }

  return creds.length > 0 ? creds : ['Standard profile setup'];
}