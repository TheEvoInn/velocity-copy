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
      const results = await Promise.allSettled([
        base44.functions.invoke('githubOpportunitiesDiscovery', {}),
        base44.functions.invoke('webSearchOpportunitiesDiscovery', {})
      ]);

      const githubResult = results[0].status === 'fulfilled' ? results[0].value : null;
      const webResult = results[1].status === 'fulfilled' ? results[1].value : null;

      const totalDiscovered = (githubResult?.data?.discovered || 0) + (webResult?.data?.discovered || 0);

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
          github: githubResult?.data?.discovered || 0,
          web_search: webResult?.data?.discovered || 0
        },
        errors: {
          github: results[0].status === 'rejected' ? results[0].reason?.message : null,
          web: results[1].status === 'rejected' ? results[1].reason?.message : null
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

  // Get or create a default identity for queuing
  const identities = await base44.asServiceRole.entities.AIIdentity.filter({ is_active: true }, '-created_date', 1);
  const identityId = identities[0]?.id;
  
  if (!identityId) {
    throw new Error('No active AI identity found. Create one first.');
  }

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
      identity_id: identityId,
      status: 'queued',
      priority: Math.min(100, totalScore),
      estimated_value: opp.profit_estimate_high,
      deadline: opp.deadline
    });

    queued++;
  }

  return queued;
}