import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * API OPPORTUNITY MATCHER
 * Links discovered APIs to opportunity types
 * Uses LLM to intelligently match API capabilities to profit opportunities
 * Updates APIMetadata with opportunity references
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, api_id, api_metadata, opportunities } = await req.json();

    if (action === 'match_opportunities') {
      return await matchOpportunities(base44, api_id, api_metadata, opportunities);
    } else if (action === 'batch_match_all_apis') {
      return await batchMatchAllAPIs(base44);
    } else if (action === 'get_api_opportunities') {
      return await getAPIOpportunities(base44, api_id);
    } else {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[apiOpportunityMatcher]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Match an API to relevant opportunities
 */
async function matchOpportunities(base44, api_id, api_metadata, opportunities) {
  if (!api_id && !api_metadata) {
    return Response.json({ error: 'Missing api_id or api_metadata' }, { status: 400 });
  }

  // Use provided metadata or fetch API
  const api = api_metadata || (api_id ? (await base44.entities.APIMetadata.get(api_id)) : null);
  if (!api) {
    return Response.json({ error: 'API not found' }, { status: 404 });
  }

  // Fetch all opportunities if not provided
  const opps = opportunities || (await base44.entities.Opportunity.list('-created_date', 100));

  // Use LLM to match API to opportunities
  const matches = await matchAPIToOpportunities(base44, api, opps);

  // Filter matches with score > 40
  const qualifiedMatches = matches.filter(m => m.match_score >= 40);

  // Update API metadata with linked opportunities
  const linkedOppIds = qualifiedMatches.map(m => m.opportunity_id);
  if (linkedOppIds.length > 0) {
    await base44.entities.APIMetadata.update(api.id, {
      linked_opportunities: linkedOppIds,
    });
  }

  // Log the matching event
  await base44.entities.APIDiscoveryLog.create({
    api_id: api.id,
    api_name: api.api_name,
    action_type: 'integrated',
    status: 'success',
    details: {
      matched_count: qualifiedMatches.length,
      matches: qualifiedMatches,
    },
    timestamp: new Date().toISOString(),
  });

  return Response.json({
    success: true,
    api_id: api.id,
    api_name: api.api_name,
    total_opportunities: opps.length,
    matched_count: qualifiedMatches.length,
    matches: qualifiedMatches,
  });
}

/**
 * Use LLM to match API capabilities to opportunities
 */
async function matchAPIToOpportunities(base44, api, opportunities) {
  if (opportunities.length === 0) {
    return [];
  }

  const oppDescriptions = opportunities
    .map(o => `[${o.id}] ${o.title} (${o.category}) - ${o.description}`)
    .join('\n');

  const prompt = `You are an API-to-opportunity matcher. Given an API and a list of opportunities, determine which opportunities can use this API.

API:
- Name: ${api.api_name}
- Base URL: ${api.api_url}
- Type: ${api.api_type}
- Capabilities: ${(api.capabilities || []).join(', ')}
- Endpoints: ${api.endpoints?.length || 0}
- Description: ${api.endpoints?.map(e => e.description).join('; ') || 'N/A'}

Opportunities:
${oppDescriptions}

For EACH opportunity, respond with:
{
  "opportunity_id": "...",
  "opportunity_title": "...",
  "match_score": <1-100>,
  "reason": "...",
  "can_automate": <true/false>
}

Return a JSON array. Score 0-40 = no match, 41-70 = partial match, 71-100 = strong match.
Focus on opportunities where this API directly enables execution.`;

  try {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          matches: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                opportunity_id: { type: 'string' },
                opportunity_title: { type: 'string' },
                match_score: { type: 'number' },
                reason: { type: 'string' },
                can_automate: { type: 'boolean' },
              },
            },
          },
        },
      },
    });

    return result?.matches || [];
  } catch (error) {
    console.warn('LLM matching failed:', error.message);
    return [];
  }
}

/**
 * Batch match all verified APIs to all opportunities
 */
async function batchMatchAllAPIs(base44) {
  const apis = await base44.entities.APIMetadata.filter({
    verification_status: 'verified',
  }, '-execution_readiness_score', 100);

  const opportunities = await base44.entities.Opportunity.list('-created_date', 100);

  const results = {
    apis_processed: 0,
    total_matches: 0,
    matches_by_api: [],
    timestamp: new Date().toISOString(),
  };

  for (const api of apis) {
    try {
      const matches = await matchAPIToOpportunities(base44, api, opportunities);
      const qualifiedMatches = matches.filter(m => m.match_score >= 40);

      if (qualifiedMatches.length > 0) {
        const linkedOppIds = qualifiedMatches.map(m => m.opportunity_id);
        await base44.entities.APIMetadata.update(api.id, {
          linked_opportunities: linkedOppIds,
        });

        results.matches_by_api.push({
          api_id: api.id,
          api_name: api.api_name,
          match_count: qualifiedMatches.length,
          top_matches: qualifiedMatches.slice(0, 3),
        });

        results.total_matches += qualifiedMatches.length;
      }

      results.apis_processed++;
    } catch (error) {
      console.warn(`Batch match failed for ${api.api_name}:`, error.message);
    }
  }

  return Response.json(results);
}

/**
 * Get all opportunities linked to an API
 */
async function getAPIOpportunities(base44, api_id) {
  const api = await base44.entities.APIMetadata.get(api_id);
  if (!api) {
    return Response.json({ error: 'API not found' }, { status: 404 });
  }

  const linkedOppIds = api.linked_opportunities || [];
  if (linkedOppIds.length === 0) {
    return Response.json({
      api_id: api.id,
      api_name: api.api_name,
      opportunities: [],
    });
  }

  const opportunities = [];
  for (const oppId of linkedOppIds) {
    try {
      const opp = await base44.entities.Opportunity.get(oppId);
      if (opp) opportunities.push(opp);
    } catch (e) {
      console.warn(`Failed to fetch opportunity ${oppId}:`, e.message);
    }
  }

  return Response.json({
    api_id: api.id,
    api_name: api.api_name,
    linked_opportunity_count: opportunities.length,
    opportunities,
  });
}