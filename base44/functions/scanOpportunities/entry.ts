import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const now = new Date();
    console.log(`[ScanOpportunities] Starting market scan at ${now.toISOString()}`);

    // Scan in smaller batches per category to avoid LLM JSON truncation
    const categories = [
      { name: 'freelance', label: 'freelance jobs on Upwork, Fiverr, Freelancer' },
      { name: 'contest', label: 'writing contests, design contests, hackathons with cash prizes' },
      { name: 'grant', label: 'small business grants, creative grants, startup grants' },
      { name: 'giveaway', label: 'legitimate sweepstakes and giveaways with cash or high-value prizes' },
    ];

    let totalCreated = 0;
    const allResults = [];

    for (const cat of categories) {
      try {
        const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Search the internet right now for 3 real, current, legitimate ${cat.label} that are active TODAY (${now.toISOString().slice(0,10)}).

For each opportunity return ONLY a JSON array of exactly 3 objects. Each object must have these exact keys:
- title: string (short name)
- description: string (1-2 sentences, what it is and how to earn)
- url: string (direct link to apply/enter)
- platform: string (website name)
- profit_low: number (minimum USD you can earn)
- profit_high: number (maximum USD you can earn)
- time_sensitivity: string (one of: immediate, hours, days, weeks, ongoing)

Return ONLY the raw JSON array. No markdown, no explanation, no code fences.`,
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
                    description: { type: 'string' },
                    url: { type: 'string' },
                    platform: { type: 'string' },
                    profit_low: { type: 'number' },
                    profit_high: { type: 'number' },
                    time_sensitivity: { type: 'string' }
                  }
                }
              }
            }
          }
        });

        const opps = result?.opportunities || [];
        console.log(`[ScanOpportunities] ${cat.name}: found ${opps.length} opportunities`);

        for (const opp of opps) {
          if (!opp.title || !opp.url) continue;

          // Check for duplicates by URL
          const existing = await base44.asServiceRole.entities.Opportunity.filter({ url: opp.url });
          if (existing.length > 0) continue;

          await base44.asServiceRole.entities.Opportunity.create({
            title: opp.title,
            description: opp.description,
            url: opp.url,
            category: cat.name,
            opportunity_type: cat.name === 'freelance' ? 'job' : cat.name === 'contest' ? 'contest' : cat.name === 'grant' ? 'grant' : 'giveaway',
            platform: opp.platform,
            profit_estimate_low: opp.profit_low || 0,
            profit_estimate_high: opp.profit_high || 0,
            time_sensitivity: opp.time_sensitivity || 'days',
            status: 'new',
            auto_execute: true,
            source: 'market_scan',
            overall_score: Math.min(90, 50 + (opp.profit_high > 1000 ? 20 : opp.profit_high > 100 ? 10 : 0)),
          });
          totalCreated++;
        }

        allResults.push({ category: cat.name, found: opps.length });
      } catch (catError) {
        console.error(`[ScanOpportunities] Error scanning ${cat.name}:`, catError.message);
        allResults.push({ category: cat.name, error: catError.message });
      }
    }

    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'scan',
      message: `[Market Scan] Found and added ${totalCreated} new opportunities across ${categories.length} categories`,
      severity: totalCreated > 0 ? 'success' : 'info',
      metadata: { total_created: totalCreated, categories: allResults },
    });

    console.log(`[ScanOpportunities] Complete. Created ${totalCreated} new opportunities.`);
    return Response.json({ success: true, total_created: totalCreated, results: allResults });

  } catch (error) {
    console.error('[ScanOpportunities] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});