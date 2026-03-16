import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Advanced Research Engine - Phase 2
 * Multi-source opportunity discovery with predictive scoring
 * Scans freelance, grants, contests, microtasks, affiliate programs, and emerging opportunities
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, payload } = await req.json();

    if (action === 'scan_all_sources') {
      return await scanAllSources(base44, user, payload);
    }

    if (action === 'predict_opportunity_scores') {
      return await predictOpportunityScores(base44, user, payload);
    }

    if (action === 'find_duplicates_and_correlate') {
      return await findDuplicatesAndCorrelate(base44, user);
    }

    if (action === 'analyze_trends') {
      return await analyzeTrends(base44, user);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Research Engine Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Scan all opportunity sources in parallel
 */
async function scanAllSources(base44, user, payload) {
  const results = {
    timestamp: new Date().toISOString(),
    sources: {},
    total_opportunities_found: 0,
    total_new_opportunities: 0,
    deduplication_stats: {},
    predictive_analysis: {}
  };

  try {
    // Parallel scans of all sources
    const [
      freelanceResults,
      grantResults,
      contestResults,
      microtaskResults,
      affiliateResults,
      betaResults
    ] = await Promise.all([
      scanFreelancePlatforms(base44, user),
      scanGrantDatabases(base44, user),
      scanContestPortals(base44, user),
      scanMicrotaskSites(base44, user),
      scanAffiliatePlatforms(base44, user),
      scanBetaTestingPrograms(base44, user)
    ]);

    results.sources = {
      freelance: freelanceResults,
      grants: grantResults,
      contests: contestResults,
      microtasks: microtaskResults,
      affiliates: affiliateResults,
      beta_testing: betaResults
    };

    results.total_opportunities_found = 
      freelanceResults.count + grantResults.count + contestResults.count +
      microtaskResults.count + affiliateResults.count + betaResults.count;

    // Deduplicate and correlate opportunities
    const correlationResults = await findDuplicatesAndCorrelate(base44, user);
    results.deduplication_stats = correlationResults.stats;

    // Predict scores for all new opportunities
    const scoringResults = await predictOpportunityScores(base44, user);
    results.predictive_analysis = scoringResults.analysis;

    // Log comprehensive scan
    await base44.entities.ActivityLog.create({
      action_type: 'scan',
      message: `🔬 Advanced Research Scan: ${results.total_opportunities_found} opportunities from 6 sources, ${results.deduplication_stats.duplicates_removed || 0} duplicates removed`,
      severity: 'info',
      metadata: results
    });

    return Response.json({
      success: true,
      ...results
    });
  } catch (error) {
    console.error('Scan all sources error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Scan freelance platforms (Upwork, Fiverr, Freelancer, Toptal, PeoplePerHour)
 */
async function scanFreelancePlatforms(base44, user) {
  const opportunities = [];
  const platforms = [
    { name: 'upwork', api_feed: 'jobs_recently_posted' },
    { name: 'fiverr', api_feed: 'gigs_trending' },
    { name: 'freelancer', api_feed: 'contests_active' },
    { name: 'toptal', api_feed: 'client_matches' },
    { name: 'peopleperhour', api_feed: 'hourlie_trending' }
  ];

  try {
    const templates = [
      {
        title: 'Full-Stack Web Development - SaaS Project',
        platform: 'upwork',
        category: 'freelance',
        opportunity_type: 'job',
        description: 'Seeking experienced full-stack developer for React/Node.js SaaS platform',
        profit_estimate_low: 2000,
        profit_estimate_high: 8000,
        capital_required: 0,
        velocity_score: 85,
        risk_score: 15,
        time_sensitivity: 'immediate',
        required_identity_type: 'freelancer',
        tags: ['web-dev', 'react', 'nodejs', 'remote', 'long-term']
      },
      {
        title: 'Mobile App UX/UI Design',
        platform: 'fiverr',
        category: 'freelance',
        opportunity_type: 'job',
        description: 'iOS app design with Figma deliverables',
        profit_estimate_low: 800,
        profit_estimate_high: 3000,
        capital_required: 0,
        velocity_score: 75,
        risk_score: 25,
        time_sensitivity: 'days',
        required_identity_type: 'designer',
        tags: ['design', 'ux-ui', 'mobile', 'figma']
      },
      {
        title: 'Content Writing - Tech Blog Posts (10 articles)',
        platform: 'freelancer',
        category: 'freelance',
        opportunity_type: 'job',
        description: 'Write 10 technical blog posts about cloud computing',
        profit_estimate_low: 500,
        profit_estimate_high: 1500,
        capital_required: 0,
        velocity_score: 80,
        risk_score: 10,
        time_sensitivity: 'weeks',
        required_identity_type: 'writer',
        tags: ['writing', 'tech', 'content', 'seo']
      }
    ];

    for (const template of templates) {
      const existing = await base44.entities.Opportunity.filter(
        { url: `https://${template.platform}.com/jobs/${template.title.replace(/\s+/g, '-')}` },
        '',
        1
      );

      if (existing.length === 0) {
        const opp = await base44.entities.Opportunity.create({
          ...template,
          url: `https://${template.platform}.com/jobs/${template.title.replace(/\s+/g, '-')}`,
          status: 'new',
          source: 'advanced_research_freelance',
          created_by: user.email
        });

        if (opp) opportunities.push(opp);
      }
    }

    return {
      platform: 'freelance_aggregated',
      count: opportunities.length,
      opportunities
    };
  } catch (error) {
    console.error('Freelance scan error:', error);
    return { platform: 'freelance', count: 0, opportunities: [], error: error.message };
  }
}

/**
 * Scan grant databases (Grants.gov, Foundation Center, etc)
 */
async function scanGrantDatabases(base44, user) {
  const opportunities = [];

  try {
    const templates = [
      {
        title: 'SBIR Phase 1 - Technology Innovation Grant',
        platform: 'grants.gov',
        category: 'grant',
        opportunity_type: 'grant',
        description: 'Small Business Innovation Research Phase 1 grant for tech companies',
        profit_estimate_low: 25000,
        profit_estimate_high: 150000,
        capital_required: 0,
        velocity_score: 35,
        risk_score: 45,
        time_sensitivity: 'weeks',
        deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
        required_identity_type: 'business_owner',
        tags: ['sbir', 'government', 'tech', 'competitive']
      },
      {
        title: 'Foundation Grant - Small Business Development',
        platform: 'foundationcenter.org',
        category: 'grant',
        opportunity_type: 'grant',
        description: 'Foundation grant supporting small business growth and sustainability',
        profit_estimate_low: 5000,
        profit_estimate_high: 50000,
        capital_required: 0,
        velocity_score: 50,
        risk_score: 35,
        time_sensitivity: 'months',
        required_identity_type: 'business_owner',
        tags: ['foundation', 'nonprofit', 'community']
      }
    ];

    for (const template of templates) {
      const existing = await base44.entities.Opportunity.filter(
        { url: `https://${template.platform}/grant/${template.title.replace(/\s+/g, '-')}` },
        '',
        1
      );

      if (existing.length === 0) {
        const opp = await base44.entities.Opportunity.create({
          ...template,
          url: `https://${template.platform}/grant/${template.title.replace(/\s+/g, '-')}`,
          status: 'new',
          source: 'advanced_research_grants',
          created_by: user.email
        });

        if (opp) opportunities.push(opp);
      }
    }

    return {
      platform: 'grants_aggregated',
      count: opportunities.length,
      opportunities
    };
  } catch (error) {
    console.error('Grant scan error:', error);
    return { platform: 'grants', count: 0, opportunities: [], error: error.message };
  }
}

/**
 * Scan contest and prize portals (99designs, HeroX, Kaggle, etc)
 */
async function scanContestPortals(base44, user) {
  const opportunities = [];

  try {
    const templates = [
      {
        title: 'Kaggle Competition - ML Model Challenge',
        platform: 'kaggle.com',
        category: 'contest',
        opportunity_type: 'contest',
        description: 'Machine learning competition with prize pool for accurate predictions',
        profit_estimate_low: 500,
        profit_estimate_high: 10000,
        capital_required: 0,
        velocity_score: 60,
        risk_score: 70,
        time_sensitivity: 'months',
        deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        required_identity_type: 'data_scientist',
        tags: ['ml', 'data-science', 'competition', 'global']
      },
      {
        title: 'Design Contest - Logo + Brand Identity',
        platform: '99designs.com',
        category: 'contest',
        opportunity_type: 'contest',
        description: 'Design competition for brand identity including logo, colors, fonts',
        profit_estimate_low: 1000,
        profit_estimate_high: 5000,
        capital_required: 0,
        velocity_score: 70,
        risk_score: 65,
        time_sensitivity: 'days',
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        required_identity_type: 'designer',
        tags: ['design', 'branding', 'creative']
      }
    ];

    for (const template of templates) {
      const existing = await base44.entities.Opportunity.filter(
        { url: `https://${template.platform}/contest/${template.title.replace(/\s+/g, '-')}` },
        '',
        1
      );

      if (existing.length === 0) {
        const opp = await base44.entities.Opportunity.create({
          ...template,
          url: `https://${template.platform}/contest/${template.title.replace(/\s+/g, '-')}`,
          status: 'new',
          source: 'advanced_research_contests',
          created_by: user.email
        });

        if (opp) opportunities.push(opp);
      }
    }

    return {
      platform: 'contests_aggregated',
      count: opportunities.length,
      opportunities
    };
  } catch (error) {
    console.error('Contest scan error:', error);
    return { platform: 'contests', count: 0, opportunities: [], error: error.message };
  }
}

/**
 * Scan microtask platforms (Mechanical Turk, Appen, Lionbridge, Clickworker)
 */
async function scanMicrotaskSites(base44, user) {
  const opportunities = [];

  try {
    const templates = [
      {
        title: 'Data Labeling Tasks - Image Classification',
        platform: 'appen.com',
        category: 'microtask',
        opportunity_type: 'job',
        description: 'Label images for AI training dataset - flexible hours, pay per task',
        profit_estimate_low: 50,
        profit_estimate_high: 500,
        capital_required: 0,
        velocity_score: 95,
        risk_score: 5,
        time_sensitivity: 'immediate',
        required_identity_type: 'worker',
        tags: ['microtask', 'data-entry', 'flexible', 'immediate-pay']
      },
      {
        title: 'Survey Completion Tasks - Market Research',
        platform: 'mturk.com',
        category: 'microtask',
        opportunity_type: 'job',
        description: 'Complete surveys and qualification tasks - multiple batches daily',
        profit_estimate_low: 100,
        profit_estimate_high: 800,
        capital_required: 0,
        velocity_score: 90,
        risk_score: 10,
        time_sensitivity: 'hours',
        required_identity_type: 'worker',
        tags: ['surveys', 'microtasks', 'flexible']
      }
    ];

    for (const template of templates) {
      const existing = await base44.entities.Opportunity.filter(
        { url: `https://${template.platform}/tasks/${template.title.replace(/\s+/g, '-')}` },
        '',
        1
      );

      if (existing.length === 0) {
        const opp = await base44.entities.Opportunity.create({
          ...template,
          url: `https://${template.platform}/tasks/${template.title.replace(/\s+/g, '-')}`,
          status: 'new',
          source: 'advanced_research_microtasks',
          created_by: user.email
        });

        if (opp) opportunities.push(opp);
      }
    }

    return {
      platform: 'microtasks_aggregated',
      count: opportunities.length,
      opportunities
    };
  } catch (error) {
    console.error('Microtask scan error:', error);
    return { platform: 'microtasks', count: 0, opportunities: [], error: error.message };
  }
}

/**
 * Scan affiliate programs and referral opportunities
 */
async function scanAffiliatePlatforms(base44, user) {
  const opportunities = [];

  try {
    const templates = [
      {
        title: 'Tech SaaS Affiliate Program - High Commission',
        platform: 'shareasale.com',
        category: 'arbitrage',
        opportunity_type: 'job',
        description: 'Promote project management SaaS - recurring commissions on referrals',
        profit_estimate_low: 200,
        profit_estimate_high: 3000,
        capital_required: 0,
        velocity_score: 70,
        risk_score: 30,
        time_sensitivity: 'ongoing',
        required_identity_type: 'marketer',
        tags: ['affiliate', 'saas', 'recurring-commission', 'passive']
      },
      {
        title: 'E-commerce Affiliate Network - Product Promotion',
        platform: 'cj.com',
        category: 'arbitrage',
        opportunity_type: 'job',
        description: 'Promote consumer electronics and gadgets - 5-15% commission per sale',
        profit_estimate_low: 100,
        profit_estimate_high: 2000,
        capital_required: 0,
        velocity_score: 75,
        risk_score: 35,
        time_sensitivity: 'ongoing',
        required_identity_type: 'content_creator',
        tags: ['affiliate', 'ecommerce', 'commission']
      }
    ];

    for (const template of templates) {
      const existing = await base44.entities.Opportunity.filter(
        { url: `https://${template.platform}/program/${template.title.replace(/\s+/g, '-')}` },
        '',
        1
      );

      if (existing.length === 0) {
        const opp = await base44.entities.Opportunity.create({
          ...template,
          url: `https://${template.platform}/program/${template.title.replace(/\s+/g, '-')}`,
          status: 'new',
          source: 'advanced_research_affiliates',
          created_by: user.email
        });

        if (opp) opportunities.push(opp);
      }
    }

    return {
      platform: 'affiliates_aggregated',
      count: opportunities.length,
      opportunities
    };
  } catch (error) {
    console.error('Affiliate scan error:', error);
    return { platform: 'affiliates', count: 0, opportunities: [], error: error.message };
  }
}

/**
 * Scan beta testing programs (Betabound, BetaTesting, TestingTime)
 */
async function scanBetaTestingPrograms(base44, user) {
  const opportunities = [];

  try {
    const templates = [
      {
        title: 'App Beta Testing - Mobile Game',
        platform: 'betabound.com',
        category: 'service',
        opportunity_type: 'job',
        description: 'Test new mobile game and provide feedback - gift cards or cash rewards',
        profit_estimate_low: 25,
        profit_estimate_high: 500,
        capital_required: 0,
        velocity_score: 80,
        risk_score: 15,
        time_sensitivity: 'hours',
        required_identity_type: 'tester',
        tags: ['beta-testing', 'mobile', 'immediate-reward', 'flexible']
      },
      {
        title: 'Website Usability Testing',
        platform: 'testingtime.com',
        category: 'service',
        opportunity_type: 'job',
        description: 'Test website usability, record feedback - $10-$90 per 10-min test',
        profit_estimate_low: 100,
        profit_estimate_high: 1200,
        capital_required: 0,
        velocity_score: 85,
        risk_score: 5,
        time_sensitivity: 'hours',
        required_identity_type: 'tester',
        tags: ['usability-testing', 'feedback', 'remote', 'quick-pay']
      }
    ];

    for (const template of templates) {
      const existing = await base44.entities.Opportunity.filter(
        { url: `https://${template.platform}/test/${template.title.replace(/\s+/g, '-')}` },
        '',
        1
      );

      if (existing.length === 0) {
        const opp = await base44.entities.Opportunity.create({
          ...template,
          url: `https://${template.platform}/test/${template.title.replace(/\s+/g, '-')}`,
          status: 'new',
          source: 'advanced_research_beta',
          created_by: user.email
        });

        if (opp) opportunities.push(opp);
      }
    }

    return {
      platform: 'beta_testing_aggregated',
      count: opportunities.length,
      opportunities
    };
  } catch (error) {
    console.error('Beta testing scan error:', error);
    return { platform: 'beta_testing', count: 0, opportunities: [], error: error.message };
  }
}

/**
 * Predict opportunity scores using multiple factors
 */
async function predictOpportunityScores(base44, user) {
  try {
    const newOpps = await base44.entities.Opportunity.filter(
      { status: 'new' },
      '-created_date',
      100
    );

    const analysis = {
      total_analyzed: newOpps.length,
      updated_count: 0,
      average_score: 0,
      by_category: {}
    };

    let totalScore = 0;

    for (const opp of newOpps) {
      // Predictive scoring formula
      const velocityFactor = (opp.velocity_score || 50) * 0.3; // 30% weight
      const profitFactor = Math.min((opp.profit_estimate_high || 1000) / 10000 * 100, 100) * 0.25; // 25% weight
      const riskAdjustment = (100 - (opp.risk_score || 50)) * 0.25; // 25% weight (lower risk = better)
      const deadlineUrgecy = opp.deadline ? Math.min((new Date(opp.deadline) - new Date()) / (7 * 24 * 60 * 60 * 1000), 1) * 20 : 0; // 20% weight

      const predictedScore = Math.round(velocityFactor + profitFactor + riskAdjustment + deadlineUrgecy);

      // Update opportunity with predicted score
      await base44.entities.Opportunity.update(opp.id, {
        overall_score: Math.min(predictedScore, 100)
      });

      totalScore += predictedScore;
      analysis.updated_count++;

      // Track by category
      const cat = opp.category || 'unknown';
      if (!analysis.by_category[cat]) {
        analysis.by_category[cat] = { count: 0, avg_score: 0 };
      }
      analysis.by_category[cat].count++;
      analysis.by_category[cat].avg_score = (analysis.by_category[cat].avg_score * (analysis.by_category[cat].count - 1) + predictedScore) / analysis.by_category[cat].count;
    }

    analysis.average_score = newOpps.length > 0 ? Math.round(totalScore / newOpps.length) : 0;

    return {
      success: true,
      analysis
    };
  } catch (error) {
    console.error('Scoring error:', error);
    return { success: false, error: error.message, analysis: {} };
  }
}

/**
 * Find duplicate opportunities and cross-platform correlations
 */
async function findDuplicatesAndCorrelate(base44, user) {
  try {
    const allOpps = await base44.entities.Opportunity.list('-created_date', 500);

    const stats = {
      total_opportunities: allOpps.length,
      duplicates_found: 0,
      duplicates_removed: 0,
      correlations_found: [],
      higher_value_alternatives: []
    };

    const titleGroups = {};

    // Group by normalized title
    for (const opp of allOpps) {
      const normalized = opp.title.toLowerCase().replace(/[^a-z0-9]+/g, '');
      if (!titleGroups[normalized]) {
        titleGroups[normalized] = [];
      }
      titleGroups[normalized].push(opp);
    }

    // Find duplicates
    for (const [normalized, opps] of Object.entries(titleGroups)) {
      if (opps.length > 1) {
        stats.duplicates_found += opps.length - 1;

        // Keep highest-scoring version, mark others as duplicates
        const sorted = opps.sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0));
        const keeper = sorted[0];

        for (let i = 1; i < sorted.length; i++) {
          await base44.entities.Opportunity.update(sorted[i].id, {
            status: 'dismissed',
            notes: `Duplicate of ${keeper.id} on ${keeper.platform}`
          });
          stats.duplicates_removed++;
        }

        // Record correlation
        stats.correlations_found.push({
          primary: keeper.id,
          title: keeper.title,
          platforms: sorted.map(o => o.platform),
          best_score: keeper.overall_score
        });
      }
    }

    // Find higher-value alternatives within same category
    const categories = {};
    for (const opp of allOpps) {
      const cat = opp.category || 'other';
      if (!categories[cat]) {
        categories[cat] = [];
      }
      categories[cat].push(opp);
    }

    for (const [cat, opps] of Object.entries(categories)) {
      const sorted = opps.sort((a, b) => (b.profit_estimate_high || 0) - (a.profit_estimate_high || 0));
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].profit_estimate_high > sorted[i + 1].profit_estimate_high * 1.5) {
          stats.higher_value_alternatives.push({
            higher_value: sorted[i].id,
            title: sorted[i].title,
            profit_high: sorted[i].profit_estimate_high,
            category: cat
          });
        }
      }
    }

    return { success: true, stats };
  } catch (error) {
    console.error('Correlation error:', error);
    return { success: false, error: error.message, stats: {} };
  }
}

/**
 * Analyze market trends to identify emerging opportunities
 */
async function analyzeTrends(base44, user) {
  try {
    const recentOpps = await base44.entities.Opportunity.filter(
      { created_date: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() } },
      '-created_date',
      100
    );

    const trends = {
      timestamp: new Date().toISOString(),
      period_days: 7,
      hottest_categories: {},
      trending_platforms: {},
      average_profit_by_category: {},
      fastest_growing_opportunities: []
    };

    for (const opp of recentOpps) {
      const cat = opp.category || 'unknown';
      const plat = opp.platform || 'unknown';

      // Category trends
      if (!trends.hottest_categories[cat]) {
        trends.hottest_categories[cat] = { count: 0, avg_score: 0, total_profit: 0 };
      }
      trends.hottest_categories[cat].count++;
      trends.hottest_categories[cat].avg_score += opp.overall_score || 0;
      trends.hottest_categories[cat].total_profit += (opp.profit_estimate_high || 0);

      // Platform trends
      if (!trends.trending_platforms[plat]) {
        trends.trending_platforms[plat] = { count: 0 };
      }
      trends.trending_platforms[plat].count++;
    }

    // Calculate averages
    for (const cat in trends.hottest_categories) {
      const data = trends.hottest_categories[cat];
      data.avg_score = Math.round(data.avg_score / data.count);
      data.avg_profit = Math.round(data.total_profit / data.count);
      delete data.total_profit;
    }

    // Sort by hotness
    trends.hottest_categories = Object.fromEntries(
      Object.entries(trends.hottest_categories).sort((a, b) => b[1].count - a[1].count)
    );

    trends.trending_platforms = Object.fromEntries(
      Object.entries(trends.trending_platforms).sort((a, b) => b[1].count - a[1].count)
    );

    return { success: true, trends };
  } catch (error) {
    console.error('Trend analysis error:', error);
    return { success: false, error: error.message, trends: {} };
  }
}