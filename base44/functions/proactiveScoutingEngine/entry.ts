import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Proactive Scouting Engine
 * Parses external signals, trend APIs, and market data to identify
 * emerging gaps BEFORE they appear on standard job boards.
 * Creates 'Pre-Opportunity' strategy drafts for user approval.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let body = {};
    try { body = await req.json(); } catch (_) {}
    const { action } = body;

    // Scheduled trigger: run full scout cycle
    if (!action || body.automation) {
      return await runScoutCycle(base44);
    }

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (action === 'run_scout') {
      return await runScoutCycle(base44, user);
    }

    if (action === 'approve_pre_opportunity') {
      return await approvePreOpportunity(base44, body.opportunity_id, user);
    }

    if (action === 'reject_pre_opportunity') {
      return await rejectPreOpportunity(base44, body.opportunity_id, user);
    }

    if (action === 'get_pre_opportunities') {
      return await getPreOpportunities(base44, user);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function runScoutCycle(base44, user) {
  const results = { scanned: 0, created: 0, errors: [] };

  try {
    // 1. Gather user context for personalized scouting
    let goals = {};
    let identities = [];
    try {
      const allGoals = await base44.asServiceRole.entities.UserGoals.list();
      goals = allGoals[0] || {};
      identities = await base44.asServiceRole.entities.AIIdentity.filter({ is_active: true });
    } catch (_) {}

    const skills = [
      ...(goals.skills || []),
      ...identities.flatMap(i => i.skills || []),
    ];
    const preferredCategories = goals.preferred_categories || ['freelance', 'service', 'arbitrage'];
    const riskTolerance = goals.risk_tolerance || 'moderate';
    const dailyTarget = goals.daily_target || 500;

    // 2. Fetch real-time market signals via web search
    let marketSignals = '';
    try {
      const trendRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Search the web for these and return a JSON summary of current market signals:
1. Trending skills in demand on Upwork and Fiverr right now (2026)
2. Emerging categories where supply is low but demand is high
3. Industries with sudden spikes in outsourcing budgets
4. New government grant programs or funding rounds open now
5. Recent news about companies hiring freelancers at scale
6. Underserved niches in digital products and SaaS tools
7. High-ROI arbitrage gaps (price discrepancies between platforms)

Return JSON: { signals: [{ type, title, detail, urgency, estimated_opportunity_size_usd, platform }] }`,
        add_context_from_internet: true,
        model: 'gemini_3_flash',
        response_json_schema: {
          type: 'object',
          properties: { signals: { type: 'array' } }
        }
      });
      marketSignals = JSON.stringify(trendRes.signals || []);
      results.scanned = (trendRes.signals || []).length;
    } catch (e) {
      results.errors.push(`Signal fetch: ${e.message}`);
    }

    // 3. Generate pre-opportunity strategies from signals
    const strategyPrompt = `You are a profit strategy analyst for an autonomous income platform.

USER PROFILE:
- Skills: ${skills.join(', ') || 'General'}
- Preferred categories: ${preferredCategories.join(', ')}
- Risk tolerance: ${riskTolerance}
- Daily profit target: $${dailyTarget}

LIVE MARKET SIGNALS:
${marketSignals}

Based on these signals, generate exactly 5 high-conviction "Pre-Opportunity" strategies — forward-looking profit plays that haven't saturated yet. These should be actionable within 24-72 hours.

Return JSON:
{
  "pre_opportunities": [
    {
      "title": "concise opportunity title",
      "description": "2-3 sentence explanation of the gap and why now",
      "market_signal": "what trend/signal triggered this",
      "category": "freelance|arbitrage|lead_gen|grant|service|digital_flip|resale",
      "platform": "upwork|fiverr|ebay|freelancer|linkedin|multi|amazon|etsy",
      "urgency": "24h|72h|1week|ongoing",
      "profit_estimate_low": number,
      "profit_estimate_high": number,
      "risk_score": number_0_to_100,
      "velocity_score": number_0_to_100,
      "execution_steps": [{"step": 1, "action": "string", "completed": false}],
      "required_skills": ["skill1"],
      "auto_execute": false,
      "tags": ["tag1", "tag2"]
    }
  ]
}`;

    let preOpps = [];
    try {
      const genRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: strategyPrompt,
        response_json_schema: {
          type: 'object',
          properties: { pre_opportunities: { type: 'array' } }
        }
      });
      preOpps = genRes.pre_opportunities || [];
    } catch (e) {
      results.errors.push(`Strategy generation: ${e.message}`);
    }

    // 4. Save as Opportunity records with 'reviewing' status + pre_opportunity tag
    for (const opp of preOpps) {
      try {
        // Check for duplicate (same title in last 24h)
        const existing = await base44.asServiceRole.entities.Opportunity.filter({ title: opp.title });
        const recentDupe = existing.find(e => {
          const age = Date.now() - new Date(e.created_date).getTime();
          return age < 24 * 60 * 60 * 1000;
        });
        if (recentDupe) continue;

        await base44.asServiceRole.entities.Opportunity.create({
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
          overall_score: Math.round(((opp.velocity_score || 50) + (100 - (opp.risk_score || 50))) / 2),
          auto_execute: false,
          time_sensitivity: opp.urgency === '24h' ? 'immediate' : opp.urgency === '72h' ? 'hours' : 'days',
          execution_steps: opp.execution_steps || [],
          tags: [...(opp.tags || []), 'pre_opportunity', 'scouted'],
          notes: `Market signal: ${opp.market_signal || 'Proactive scout'}`,
          source: 'proactive_scout',
        });
        results.created++;
      } catch (e) {
        results.errors.push(`Save opp: ${e.message}`);
      }
    }

    // 5. Notify user
    if (results.created > 0) {
      try {
        const users = user ? [user] : await base44.asServiceRole.entities.User.list();
        for (const u of (user ? [user] : users.slice(0, 10))) {
          await base44.asServiceRole.entities.Notification.create({
            user_email: u.email,
            type: 'opportunity_alert',
            severity: 'urgent',
            title: `🔭 ${results.created} Pre-Opportunities Scouted`,
            message: `Proactive scouting found ${results.created} emerging market gaps awaiting your approval.`,
            action_type: 'review_required',
            related_entity_type: 'Opportunity',
          });
        }
      } catch (_) {}
    }

    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'scan',
      message: `🔭 Proactive scout: ${results.scanned} signals → ${results.created} pre-opportunities created`,
      severity: results.created > 0 ? 'success' : 'info',
      metadata: results,
    });

    return Response.json({ success: true, ...results });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function approvePreOpportunity(base44, opportunityId, user) {
  const opps = await base44.asServiceRole.entities.Opportunity.filter({ id: opportunityId });
  if (!opps.length) return Response.json({ error: 'Not found' }, { status: 404 });

  await base44.asServiceRole.entities.Opportunity.update(opportunityId, {
    status: 'queued',
    auto_execute: true,
    tags: opps[0].tags?.filter(t => t !== 'pre_opportunity') || [],
  });

  // Immediately queue for execution
  await base44.asServiceRole.functions.invoke('unifiedAutopilot', {
    action: 'opportunity_to_agent_task',
    opportunity_id: opportunityId,
  });

  await base44.asServiceRole.entities.ActivityLog.create({
    action_type: 'user_action',
    message: `✅ Pre-opportunity approved for execution: ${opps[0].title}`,
    severity: 'success',
    metadata: { opportunity_id: opportunityId },
  });

  return Response.json({ success: true, status: 'queued' });
}

async function rejectPreOpportunity(base44, opportunityId, user) {
  await base44.asServiceRole.entities.Opportunity.update(opportunityId, { status: 'dismissed' });
  return Response.json({ success: true, status: 'dismissed' });
}

async function getPreOpportunities(base44, user) {
  const opps = await base44.entities.Opportunity.filter(
    { status: 'reviewing', source: 'proactive_scout' },
    '-created_date',
    50
  );
  return Response.json({ success: true, pre_opportunities: opps });
}