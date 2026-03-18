import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Opportunity Ingestion V2 - Advanced Research Integration
 * Routes to advanced research engine for multi-source discovery
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, payload } = await req.json();

    if (action === 'advanced_scan_all_sources') {
      return await runAdvancedResearch(base44, user);
    }

    if (action === 'ingest_opportunities') {
      return await ingestOpportunities(base44, user, payload);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Opportunity Ingestion V2 Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Run full advanced research pipeline
 */
async function runAdvancedResearch(base44, user) {
  try {
    // Call advanced research engine
    const researchRes = await base44.functions.invoke('advancedResearchEngine', {
      action: 'scan_all_sources',
      payload: {}
    });

    if (researchRes.data?.success) {
      return Response.json({
        success: true,
        message: 'Advanced research scan completed',
        ...researchRes.data
      });
    } else {
      return Response.json({
        success: false,
        error: researchRes.data?.error || 'Research failed'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Advanced research error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Batch ingest opportunities with validation
 */
async function ingestOpportunities(base44, user, payload) {
  const { opportunities } = payload;

  if (!Array.isArray(opportunities)) {
    return Response.json({ error: 'Opportunities must be an array' }, { status: 400 });
  }

  const results = {
    total: opportunities.length,
    ingested: 0,
    duplicates: 0,
    errors: []
  };

  try {
    for (const opp of opportunities) {
      try {
        // Check if already exists
        const existing = await base44.entities.Opportunity.filter(
          { url: opp.url },
          '',
          1
        );

        if (existing.length > 0) {
          results.duplicates++;
          continue;
        }

        // Create opportunity
        const created = await base44.entities.Opportunity.create({
          ...opp,
          status: opp.status || 'new',
          source: opp.source || 'api_ingestion',
          created_by: user.email
        });

        if (created) {
          results.ingested++;
        }
      } catch (e) {
        results.errors.push({
          opportunity: opp.title,
          error: e.message
        });
      }
    }

    return Response.json({
      success: true,
      ...results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}