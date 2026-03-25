/**
 * PROACTIVE SCOUTING ENGINE v3 — VELO AI
 * - Deep multi-source market signal collection
 * - Identity-aware opportunity matching
 * - Trend prediction + emerging opportunity detection
 * - 20+ signal sources, cross-referenced with user identity
 * - Feeds directly into Autopilot with auto-execution path
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let body = {};
    try { body = await req.json(); } catch (_) {}
    const { action } = body;

    if (!action || body.automation) {
      return await runScoutCycle(base44);
    }

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (action === 'run_scout') return await runScoutCycle(base44, user);
    if (action === 'deep_scout') return await runDeepScout(base44, user, body);
    if (action === 'approve_pre_opportunity') return await approvePreOpportunity(base44, body.opportunity_id, user);
    if (action === 'reject_pre_opportunity') return await rejectPreOpportunity(base44, body.opportunity_id, user);
    if (action === 'get_pre_opportunities') return await getPreOpportunities(base44, user);
    if (action === 'get_trend_signals') return await getTrendSignals(base44, user);

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ─── SIGNAL SOURCE CATEGORIES ──────────────────────────────────────────────────
const SIGNAL_QUERIES = [
  // Freelance market trends
  'most in-demand freelance skills 2026 highest pay',
  'new freelance platforms launched 2025 2026 accepting workers',
  'upwork fiverr emerging categories 2026 high demand',
  'remote work opportunities spike 2026 companies hiring',
  // AI/Tech opportunities
  'AI jobs hiring 2026 no experience required',
  'new AI training platforms accepting evaluators 2026',
  'companies paying for AI data annotation 2026',
  'prompt engineer jobs 2026 entry level',
  // Grant/Funding
  'new government grants open applications 2026 small business',
  'foundation grants accepting proposals 2026',
  'tech startup grants no equity required 2026',
  'minority business grants open now 2026',
  // Market arbitrage
  'price arbitrage opportunities 2026 digital products',
  'high demand low supply digital services 2026',
  'underserved niches online marketplace 2026',
  'new crypto earn programs launching 2026',
  // Contest/Prize
  'new hackathon competitions 2026 cash prizes',
  'design contest open submissions 2026 prize',
  'writing contest cash prize open now 2026',
  // Emerging platforms
  'new gig platforms launching 2026 early workers bonus',
  'beta platform sign-up bonus 2026',
  'creator monetization new platforms 2026',
];

// ─── MAIN SCOUT CYCLE ──────────────────────────────────────────────────────────
async function runScoutCycle(base44, user) {
  const results = { scanned: 0, signals_found: 0, created: 0, auto_queued: 0, errors: [] };

  try {
    // 1. Load user context across all active identities
    let goals = {};
    let identities = [];
    let kycData = null;

    try {
      const allGoals = await base44.asServiceRole.entities.UserGoals.list('-created_date', 5);
      goals = allGoals[0] || {};
      identities = await base44.asServiceRole.entities.AIIdentity.filter({ is_active: true });
      const kycList = await base44.asServiceRole.entities.KYCVerification.list('-created_date', 5);
      kycData = kycList[0] || null;
    } catch (_) {}

    const skills = [
      ...(goals.skills || []),
      ...identities.flatMap(i => i.skills || []),
    ];
    const preferredCategories = goals.preferred_categories || ['freelance', 'service', 'arbitrage'];
    const riskTolerance = goals.risk_tolerance || 'moderate';
    const dailyTarget = goals.daily_target || 500;
    const kycTier = kycData?.verification_type || identities[0]?.kyc_verified_data?.kyc_tier || 'basic';
    const activeIdentityName = identities[0]?.name || 'VELO Agent';
    const autopilotEnabled = goals.autopilot_enabled !== false;

    // 2. Collect multi-source market signals via internet search
    const signalBatch = SIGNAL_QUERIES.slice(0, 12);
    let rawSignals = [];

    try {
      const signalPrompt = `You are SCOUT — an advanced market intelligence agent for an autonomous income platform.

Search the internet using Google Search and analyze these 12 queries simultaneously:
${signalBatch.map((q, i) => `${i + 1}. ${q}`).join('\n')}

USER CONTEXT:
- Skills: ${skills.slice(0, 8).join(', ') || 'General'}
- Preferred categories: ${preferredCategories.join(', ')}
- Risk tolerance: ${riskTolerance}
- Daily profit target: $${dailyTarget}
- KYC Tier: ${kycTier}
- Identity: ${activeIdentityName}
- Autopilot: ${autopilotEnabled ? 'ENABLED' : 'DISABLED'}

For each query, extract the most actionable market signal. Return JSON:
{
  "signals": [
    {
      "query": "original query",
      "signal_type": "new_platform|skill_demand|price_gap|grant|contest|trend|emerging",
      "title": "specific actionable opportunity title",
      "detail": "2-3 sentence explanation with specific data/platform names",
      "urgency": "immediate|24h|72h|1week|ongoing",
      "estimated_value_low": 100,
      "estimated_value_high": 2000,
      "platform": "specific platform or multi",
      "category": "ai_training|freelancing|grants|prizes_contests|crypto_earn|arbitrage|writing|coding|design|automation_tools|other",
      "identity_match": "high|medium|low",
      "kyc_required": false,
      "autopilot_compatible": true,
      "risk_level": "low|medium|high",
      "action_required": "specific first action to take",
      "source_url": "https://source.com"
    }
  ]
}`;

      const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: signalPrompt,
        add_context_from_internet: true,
        model: 'gemini_3_flash',
        response_json_schema: { type: 'object', properties: { signals: { type: 'array' } } }
      });
      rawSignals = res.signals || [];
      results.signals_found = rawSignals.length;
      results.scanned = signalBatch.length;
    } catch (e) {
      results.errors.push(`Signal fetch: ${e.message}`);
    }

    // 3. Generate high-conviction pre-opportunities from signals
    let preOpps = [];
    if (rawSignals.length > 0) {
      try {
        const strategyPrompt = `You are a profit strategy architect for VELO AI — an autonomous income generation platform.

LIVE MARKET SIGNALS (${rawSignals.length} signals just collected):
${JSON.stringify(rawSignals.slice(0, 15), null, 2)}

USER PROFILE:
- Skills: ${skills.join(', ') || 'General'}
- Daily target: $${dailyTarget}
- Risk tolerance: ${riskTolerance}
- Preferred: ${preferredCategories.join(', ')}
- KYC Tier: ${kycTier} (${kycTier === 'enhanced' ? 'can apply for grants, W9 tasks' : kycTier === 'standard' ? 'can apply for standard work' : 'basic online tasks only'})
- Autopilot AI: ${autopilotEnabled ? 'ACTIVE — can auto-execute tasks' : 'inactive'}

Generate exactly 8 high-conviction "Pre-Opportunities" — forward-looking, specific, actionable plays that an AI agent can begin executing immediately or within 24-72 hours.

Prioritize:
1. Opportunities matching user skills
2. Opportunities AI can fully automate
3. Hidden/emerging platforms with low competition
4. Multi-step opportunities with recurring income
5. Time-sensitive gaps before they close

Return JSON:
{
  "pre_opportunities": [
    {
      "title": "specific opportunity title",
      "description": "3-4 sentence detail: the gap, why now, how to act",
      "market_signal": "signal that triggered this",
      "category": "exact category key",
      "platform": "platform.com or multi",
      "urgency": "24h|72h|1week|ongoing",
      "profit_estimate_low": 100,
      "profit_estimate_high": 3000,
      "risk_score": 30,
      "velocity_score": 80,
      "autopilot_compatible": true,
      "identity_type_needed": "freelancer|creator|business|general",
      "kyc_required": false,
      "execution_steps": [
        {"step": 1, "action": "specific action", "completed": false},
        {"step": 2, "action": "specific action", "completed": false}
      ],
      "required_skills": ["skill1"],
      "auto_execute": true,
      "tags": ["tag1", "scouted", "2026"]
    }
  ]
}`;

        const genRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: strategyPrompt,
          response_json_schema: { type: 'object', properties: { pre_opportunities: { type: 'array' } } }
        });
        preOpps = genRes.pre_opportunities || [];
      } catch (e) {
        results.errors.push(`Strategy generation: ${e.message}`);
      }
    }

    // 4. Persist pre-opportunities, avoiding dupes
    for (const opp of preOpps) {
      try {
        const existing = await base44.asServiceRole.entities.Opportunity.filter({ title: opp.title });
        const recentDupe = existing.find(e => Date.now() - new Date(e.created_date).getTime() < 24 * 60 * 60 * 1000);
        if (recentDupe) continue;

        const overall_score = Math.round(((opp.velocity_score || 50) + (100 - (opp.risk_score || 50))) / 2);
        const created = await base44.asServiceRole.entities.Opportunity.create({
          title: opp.title,
          description: opp.description,
          category: opp.category || 'service',
          platform: opp.platform || 'multi',
          opportunity_type: 'other',
          status: 'reviewing',
          profit_estimate_low: opp.profit_estimate_low || 0,
          profit_estimate_high: opp.profit_estimate_high || 0,
          risk_score: opp.risk_score || 50,
          velocity_score: opp.velocity_score || 50,
          overall_score,
          auto_execute: autopilotEnabled && (opp.auto_execute === true) && overall_score >= 65,
          time_sensitivity: opp.urgency === '24h' ? 'immediate' : opp.urgency === '72h' ? 'hours' : 'days',
          execution_steps: opp.execution_steps || [],
          required_identity_type: opp.identity_type_needed || 'general',
          tags: [...(opp.tags || []), 'pre_opportunity', 'scouted'],
          notes: `Signal: ${opp.market_signal || 'Proactive scout'} | KYC: ${opp.kyc_required ? 'required' : 'not required'} | Autopilot: ${opp.autopilot_compatible ? 'compatible' : 'manual'}`,
          source: 'proactive_scout',
        });

        results.created++;

        // Auto-queue high-score autopilot-compatible opps
        if (autopilotEnabled && opp.autopilot_compatible && overall_score >= 70) {
          await base44.asServiceRole.entities.Opportunity.update(created.id, { status: 'queued', auto_execute: true });
          results.auto_queued++;
        }
      } catch (e) {
        results.errors.push(`Save: ${e.message}`);
      }
    }

    // 5. Notify users
    if (results.created > 0) {
      try {
        const users = user ? [user] : (await base44.asServiceRole.entities.User.list().catch(() => [])).slice(0, 10);
        for (const u of users) {
          await base44.asServiceRole.entities.Notification.create({
            user_email: u.email,
            type: 'opportunity_alert',
            severity: results.auto_queued > 0 ? 'urgent' : 'info',
            title: `🔭 ${results.created} Pre-Opportunities Scouted${results.auto_queued > 0 ? ` · ${results.auto_queued} Auto-Queued` : ''}`,
            message: `SCOUT found ${results.created} emerging opportunities from ${results.signals_found} live market signals.${results.auto_queued > 0 ? ` ${results.auto_queued} queued for Autopilot execution.` : ''}`,
            action_type: 'review_required',
            related_entity_type: 'Opportunity',
          }).catch(() => {});
        }
      } catch (_) {}
    }

    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'scan',
      message: `🔭 SCOUT v3: ${results.scanned} queries → ${results.signals_found} signals → ${results.created} pre-opportunities (${results.auto_queued} auto-queued for Autopilot)`,
      severity: results.created > 0 ? 'success' : 'info',
      metadata: results,
    }).catch(() => {});

    return Response.json({ success: true, ...results });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// ─── DEEP SCOUT — TARGET-SPECIFIC DEEP SCAN ───────────────────────────────────
async function runDeepScout(base44, user, body) {
  const { target_category, target_platform, target_keyword } = body;

  const prompt = `You are SCOUT performing a DEEP SCAN on a specific target.

TARGET: ${target_category || target_platform || target_keyword || 'highest-value online opportunities'}

Search the internet with maximum depth. Find:
1. Hidden/unlisted opportunities on this platform
2. Niche sub-categories with less competition
3. Premium tiers or invite-only programs
4. Bonus structures not publicly listed
5. Seasonal or time-limited opportunities right now
6. New platforms entering this space
7. Cross-platform arbitrage opportunities

Return JSON with 10 highly specific, actionable findings:
{
  "deep_findings": [
    {
      "title": "specific opportunity",
      "type": "hidden|premium|seasonal|emerging|arbitrage|bonus",
      "platform": "platform.com",
      "url": "https://url.com",
      "detail": "exact details on how to access/apply",
      "estimated_value": 200,
      "difficulty": "beginner|intermediate|advanced",
      "urgency": "immediate|24h|ongoing",
      "why_hidden": "reason this is not widely known",
      "action": "exact first step"
    }
  ]
}`;

  const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    add_context_from_internet: true,
    model: 'gemini_3_flash',
    response_json_schema: { type: 'object', properties: { deep_findings: { type: 'array' } } }
  });

  const findings = res.deep_findings || [];

  // Convert findings to opportunities
  let created = 0;
  for (const f of findings) {
    await base44.asServiceRole.entities.Opportunity.create({
      title: f.title,
      description: `${f.detail} | Why hidden: ${f.why_hidden} | Action: ${f.action}`,
      category: target_category || 'service',
      platform: f.platform || 'multi',
      status: 'reviewing',
      profit_estimate_high: f.estimated_value || 100,
      overall_score: f.difficulty === 'beginner' ? 75 : f.difficulty === 'intermediate' ? 65 : 55,
      url: f.url,
      time_sensitivity: f.urgency === 'immediate' ? 'immediate' : f.urgency === '24h' ? 'hours' : 'ongoing',
      tags: ['deep_scouted', f.type || 'found', '2026'],
      source: 'deep_scout',
    }).catch(() => null);
    created++;
  }

  await base44.asServiceRole.entities.ActivityLog.create({
    action_type: 'scan',
    message: `🔬 Deep Scout: ${findings.length} hidden opportunities found on ${target_category || target_platform || 'target'}`,
    severity: 'success',
    metadata: { created, target: target_category || target_platform || target_keyword },
  }).catch(() => {});

  return Response.json({ success: true, found: findings.length, created, findings });
}

// ─── TREND SIGNALS ────────────────────────────────────────────────────────────
async function getTrendSignals(base44, user) {
  const prompt = `Search the internet and return current market intelligence for online income opportunities in 2026.

Find and analyze:
1. Top 5 trending skills on Upwork/Fiverr right now (with pay rates)
2. New platforms paying for work/data launched in last 90 days
3. AI tools creating new income opportunities (prompt selling, automation, etc.)
4. Grant programs with deadlines in the next 30 days
5. Emerging categories where AI can earn money that didn't exist 1 year ago
6. Platforms offering bonuses for early adopters right now
7. Price gaps between platforms (buy here, sell there)
8. Upcoming hackathons/contests with significant prize pools
9. Economic trends driving demand for specific online skills
10. New crypto/Web3 earning methods live right now

Return JSON:
{
  "trending_skills": [{"skill": "...", "avg_rate": "...", "demand_level": "very_high|high|medium"}],
  "new_platforms": [{"name": "...", "url": "...", "type": "...", "joining_bonus": "..."}],
  "ai_opportunities": [{"title": "...", "detail": "...", "estimated_earn": "..."}],
  "open_grants": [{"name": "...", "amount": "...", "deadline": "...", "url": "..."}],
  "emerging_categories": [{"category": "...", "why_now": "...", "potential": "..."}],
  "early_adopter_bonuses": [{"platform": "...", "bonus": "...", "expires": "..."}],
  "price_gaps": [{"gap": "...", "buy_platform": "...", "sell_platform": "...", "margin": "..."}],
  "upcoming_contests": [{"name": "...", "prize_pool": "...", "deadline": "...", "url": "..."}],
  "market_trends": [{"trend": "...", "impact": "..."}],
  "crypto_earn": [{"method": "...", "platform": "...", "yield": "..."}]
}`;

  const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    add_context_from_internet: true,
    model: 'gemini_3_flash',
    response_json_schema: {
      type: 'object',
      properties: {
        trending_skills: { type: 'array' },
        new_platforms: { type: 'array' },
        ai_opportunities: { type: 'array' },
        open_grants: { type: 'array' },
        emerging_categories: { type: 'array' },
        early_adopter_bonuses: { type: 'array' },
        price_gaps: { type: 'array' },
        upcoming_contests: { type: 'array' },
        market_trends: { type: 'array' },
        crypto_earn: { type: 'array' },
      }
    }
  });

  await base44.asServiceRole.entities.ActivityLog.create({
    action_type: 'scan',
    message: `📊 SCOUT trend analysis complete — ${Object.keys(res || {}).length} signal categories collected`,
    severity: 'info',
    metadata: { categories_collected: Object.keys(res || {}).length },
  }).catch(() => {});

  return Response.json({ success: true, signals: res });
}

async function approvePreOpportunity(base44, opportunityId, user) {
  const opps = await base44.asServiceRole.entities.Opportunity.filter({ id: opportunityId });
  if (!opps.length) return Response.json({ error: 'Not found' }, { status: 404 });

  await base44.asServiceRole.entities.Opportunity.update(opportunityId, {
    status: 'queued',
    auto_execute: true,
    tags: opps[0].tags?.filter(t => t !== 'pre_opportunity') || [],
  });

  await base44.asServiceRole.functions.invoke('unifiedAutopilot', {
    action: 'opportunity_to_agent_task',
    opportunity_id: opportunityId,
  }).catch(() => {});

  await base44.asServiceRole.entities.ActivityLog.create({
    action_type: 'user_action',
    message: `✅ Pre-opportunity approved for Autopilot: ${opps[0].title}`,
    severity: 'success',
    metadata: { opportunity_id: opportunityId },
  }).catch(() => {});

  return Response.json({ success: true, status: 'queued' });
}

async function rejectPreOpportunity(base44, opportunityId) {
  await base44.asServiceRole.entities.Opportunity.update(opportunityId, { status: 'dismissed' });
  return Response.json({ success: true, status: 'dismissed' });
}

async function getPreOpportunities(base44, user) {
  const opps = await base44.entities.Opportunity.filter(
    { status: 'reviewing', source: 'proactive_scout' }, '-created_date', 50
  );
  return Response.json({ success: true, pre_opportunities: opps });
}