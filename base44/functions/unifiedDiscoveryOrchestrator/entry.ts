import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const action = body.action || 'discover_all';

    if (action === 'discover_all') {
      // Run both discovery sources in parallel
      const [githubResult, webResult] = await Promise.all([
        base44.functions.invoke('githubOpportunitiesDiscovery', {}),
        base44.functions.invoke('webSearchOpportunitiesDiscovery', {})
      ]);

      const totalDiscovered = (githubResult.data?.discovered || 0) + (webResult.data?.discovered || 0);

      // Fetch all new opportunities
      const opportunities = await base44.asServiceRole.entities.Opportunity.filter({
        status: 'new'
      });

      // Score and queue eligible opportunities
      const queuedCount = await scoreAndQueueOpportunities(base44, opportunities);

      return Response.json({
        success: true,
        discovered: totalDiscovered,
        queued: queuedCount,
        sources: {
          github: githubResult.data?.discovered || 0,
          web_search: webResult.data?.discovered || 0
        }
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function scoreAndQueueOpportunities(base44, opportunities) {
  let queued = 0;

  for (const opp of opportunities) {
    // Simple scoring: velocity + profit + feasibility
    const velocityScore = opp.time_sensitivity === 'immediate' ? 30 : opp.time_sensitivity === 'hours' ? 25 : 15;
    const profitScore = Math.min(40, Math.floor((opp.profit_estimate_high / 100) * 40));
    const feasibilityScore = opp.category === 'freelance' ? 15 : opp.category === 'contest' ? 10 : 20;

    const totalScore = velocityScore + profitScore + feasibilityScore;

    // Update opportunity with score
    await base44.asServiceRole.entities.Opportunity.update(opp.id, {
      overall_score: totalScore,
      status: 'queued'
    });

    // Create execution queue entry
    await base44.asServiceRole.entities.TaskExecutionQueue.create({
      opportunity_id: opp.id,
      url: opp.url,
      opportunity_type: opp.opportunity_type,
      platform: opp.platform,
      status: 'queued',
      priority: Math.min(100, totalScore),
      estimated_value: opp.profit_estimate_high,
      deadline: opp.deadline
    });

    queued++;
  }

  return queued;
}