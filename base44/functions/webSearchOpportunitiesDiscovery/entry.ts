import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use InvokeLLM with web search to find real opportunities
    const searchKeywords = [
      'online paid jobs work from home 2026',
      'freelance gigs earning opportunities',
      'contest sweepstakes prizes money',
      'grant applications funding available',
      'digital product arbitrage opportunities',
      'reselling flipping profitable items',
      'survey sites real money payout'
    ];

    const opportunities = [];

    for (const keyword of searchKeywords) {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Find and list 5 legitimate, real-world opportunities matching: "${keyword}". For each opportunity, provide:
        1. Exact name/title
        2. Direct URL if available
        3. Brief description
        4. Estimated earning potential
        5. Time requirement
        
        Only include REAL, VERIFIABLE opportunities. No simulated or fake data.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            opportunities: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  url: { type: 'string' },
                  description: { type: 'string' },
                  earning_potential: { type: 'string' },
                  time_needed: { type: 'string' },
                  category: { type: 'string' }
                }
              }
            }
          }
        }
      });

      if (result?.opportunities) {
        for (const opp of result.opportunities) {
          // Parse earning potential into numbers
          const earnMatch = opp.earning_potential?.match(/\$?(\d+)/);
          const profitLow = earnMatch ? parseInt(earnMatch[1]) : 10;

          const opportunity = {
            title: opp.title,
            description: opp.description,
            url: opp.url || '',
            platform: 'Web Discovery',
            category: categorizeByKeyword(keyword),
            opportunity_type: 'other',
            source: `Web Search - ${keyword}`,
            profit_estimate_low: profitLow,
            profit_estimate_high: profitLow * 3,
            time_sensitivity: 'days',
            status: 'new',
            auto_execute: true,
            tags: [keyword.split(' ')[0].toLowerCase()]
          };

          opportunities.push(opportunity);
        }
      }
    }

    // Create opportunities in database
    if (opportunities.length > 0) {
      await base44.asServiceRole.entities.Opportunity.bulkCreate(opportunities);
    }

    return Response.json({
      success: true,
      discovered: opportunities.length,
      opportunities: opportunities
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function categorizeByKeyword(keyword) {
  if (keyword.includes('job') || keyword.includes('freelance')) return 'freelance';
  if (keyword.includes('contest') || keyword.includes('sweepstakes')) return 'contest';
  if (keyword.includes('grant')) return 'grant';
  if (keyword.includes('resell') || keyword.includes('flip')) return 'resale';
  if (keyword.includes('survey') || keyword.includes('gig')) return 'service';
  return 'other';
}