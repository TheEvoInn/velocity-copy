import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const OPPORTUNITY_QUERIES = [
  // Prize & Giveaways
  'free instant win contests no signup',
  'online giveaways no CAPTCHA free claim',
  'daily raffles instant prize claiming',
  'quick money giveaways zero requirements',
  
  // Digital Work (Minimal signup)
  'quick micro tasks no verification free',
  'instant payment gigs minimal signup',
  'fast digital work instant approval',
  
  // Grants & Bounties
  'free grant applications instant eligibility',
  'bug bounties zero verification instant',
  'content creation bounties fast approve',
  
  // Arbitrage & Resale
  'free item flips no listing fees',
  'instant liquidation no verification needed',
  'quick resale opportunities free platform',
  
  // Affiliate & Referral
  'instant referral bonuses no signup fees',
  'affiliate programs instant commission',
  'referral rewards instant payment',
  
  // Surveys & Research
  'paid surveys instant cashout no CAPTCHA',
  'quick research studies instant payment',
  'opinion rewards instant approval',
  
  // Gaming Rewards
  'play to earn instant withdraw',
  'gaming rewards instant cashout',
  'free gaming bounties instant claim',
  
  // Crypto & Digital Assets
  'free crypto airdrops instant claim',
  'NFT giveaways no verification',
  'digital asset rewards instant access',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, searchQuery, filters = {} } = body;

    if (action === 'discover') {
      const queries = Array.isArray(OPPORTUNITY_QUERIES) ? (searchQuery ? [searchQuery] : OPPORTUNITY_QUERIES.slice(0, 5)) : [];
      const opportunities = [];

      for (const query of queries) {
         const searchResults = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Search for legitimate ${query}. For each opportunity found, provide JSON with:
{
  "title": "opportunity name",
  "url": "direct link",
  "category": "giveaway|job|gig|survey|affiliate|gaming|crypto|grant|arbitrage",
  "estimated_value": number (USD),
  "signup_required": boolean,
  "has_captcha": boolean,
  "instant_claim": boolean,
  "difficulty": "easy|medium|hard",
  "description": "brief description"
}

IMPORTANT: Only include opportunities that are:
- Completely free to participate
- No CAPTCHA required
- Minimal or no signup (< 2 minutes)
- Instant claim or fast approval process
- Legitimate and safe

Return ONLY valid JSON array, no text before or after.`,
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
                    category: { type: 'string' },
                    estimated_value: { type: 'number' },
                    signup_required: { type: 'boolean' },
                    has_captcha: { type: 'boolean' },
                    instant_claim: { type: 'boolean' },
                    difficulty: { type: 'string' },
                    description: { type: 'string' },
                  },
                },
              },
            },
          },
        });

        const oppData = searchResults?.opportunities || searchResults?.data?.opportunities || [];
        if (Array.isArray(oppData)) {
          opportunities.push(...oppData.filter(o => o && o.title && o.url));
        }
        }

        // Filter based on user preferences
        const filtered = (Array.isArray(opportunities) ? opportunities : []).filter(opp => {
         if (!opp) return false;
         if (filters?.no_captcha && opp.has_captcha) return false;
         if (filters?.instant_only && !opp.instant_claim) return false;
         if (filters?.no_signup && opp.signup_required) return false;
         if (filters?.min_value && typeof opp.estimated_value === 'number' && opp.estimated_value < filters.min_value) return false;
         if (filters?.max_value && typeof opp.estimated_value === 'number' && opp.estimated_value > filters.max_value) return false;
         if (filters?.category && opp.category !== filters.category) return false;
         return true;
        });

        // Deduplicate and sort by estimated value
        const unique = Array.from(
         new Map(filtered.map(o => [typeof o.title === 'string' ? o.title.toLowerCase() : `opp_${Math.random()}`, o])).values()
        ).sort((a, b) => {
         const aVal = typeof a?.estimated_value === 'number' ? a.estimated_value : 0;
         const bVal = typeof b?.estimated_value === 'number' ? b.estimated_value : 0;
         return bVal - aVal;
        });

        return Response.json({
         success: true,
         count: unique.length,
         opportunities: unique.slice(0, 50),
         timestamp: new Date().toISOString(),
        });
        }

    if (action === 'create_from_discovery') {
      const { title, url, category, estimated_value, description } = body;
      if (!title || !url) return Response.json({ error: 'Missing title or url' }, { status: 400 });

      try {
        const oppData = {
          title,
          url,
          category: category || 'other',
          profit_estimate_low: typeof estimated_value === 'number' ? Math.floor(estimated_value * 0.8) : 0,
          profit_estimate_high: typeof estimated_value === 'number' ? estimated_value : 100,
          description: description || `Discovered opportunity: ${title}`,
          status: 'new',
          source: 'global_discovery',
          platform: 'direct',
        };

        const result = await base44.entities.Opportunity.create(oppData);
        // Log for cross-platform notifications
        await base44.asServiceRole.entities.ActivityLog.create({
          action_type: 'opportunity_added',
          message: `✨ New discovery added: "${title}" on ${category || 'general'} — Est. $${typeof estimated_value === 'number' ? estimated_value : 100}`,
          severity: 'info',
          metadata: { opportunity_id: result?.id, source: 'global_discovery' }
        }).catch(() => {});

        return Response.json({ success: true, opportunity_id: result?.id });
      } catch (err) {
        console.error('Failed to create opportunity:', err.message);
        return Response.json({ error: err.message }, { status: 500 });
      }
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Discovery error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});