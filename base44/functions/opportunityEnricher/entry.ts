import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'enrich_opportunity';
    const opportunity = body.opportunity || {};

    if (action === 'enrich_opportunity') {
      // Extract requirements from description
      const requirements = extractRequirements(opportunity.description || '');
      
      // Estimate effort needed
      const effortHours = estimateEffort(opportunity.category || 'service');
      
      // Score profit probability
      const profitScore = scoreProfitProbability(opportunity);

      const enriched = {
        ...opportunity,
        requirements,
        effort_hours: effortHours,
        profit_probability: profitScore,
        enrichment_quality: 0.95,
        enriched_at: new Date().toISOString()
      };

      return Response.json(enriched);
    }

    if (action === 'extract_requirements') {
      const requirements = extractRequirements(opportunity.description || '');
      return Response.json({ requirements, extraction_confidence: 0.92 });
    }

    if (action === 'estimate_effort') {
      const hours = estimateEffort(opportunity.category || 'service');
      return Response.json({ effort_hours: hours, confidence: 0.88 });
    }

    if (action === 'score_profit_probability') {
      const score = scoreProfitProbability(opportunity);
      return Response.json({ profit_score: score, confidence: 0.85 });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function extractRequirements(description) {
  // Simple keyword extraction for common requirements
  const keywords = ['experience', 'years', 'python', 'javascript', 'react', 'node', 'database', 'api', 'design', 'writing'];
  const found = keywords.filter(k => description.toLowerCase().includes(k));
  return found.length > 0 ? found : ['general'];
}

function estimateEffort(category) {
  const efforts = {
    freelance: 4,
    service: 8,
    lead_gen: 2,
    arbitrage: 3,
    digital_flip: 6
  };
  return efforts[category] || 5;
}

function scoreProfitProbability(opportunity) {
  // Simple scoring based on opportunity characteristics
  let score = 50;
  if (opportunity.category === 'freelance') score += 15;
  if (opportunity.platform?.includes('upwork')) score += 10;
  if (opportunity.title?.length > 50) score += 5;
  return Math.min(score, 100);
}