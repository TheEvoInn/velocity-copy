/**
 * FIVERR REAL API INTEGRATION
 * Fetches real gig opportunities from Fiverr marketplace
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

async function getFiverrCredentials(base44, userEmail) {
  try {
    const vaults = await base44.asServiceRole.entities.CredentialVault.filter({
      platform: 'fiverr',
      is_active: true
    }, null, 1);

    if (!vaults.length) {
      return { success: false, error: 'No Fiverr credentials found.' };
    }

    return { success: true, credential_id: vaults[0].id };
  } catch (e) {
    return { success: false, error: `Credential lookup failed: ${e.message}` };
  }
}

async function fetchFiverrGigs(filters = {}) {
  /**
   * Real Fiverr Gigs API
   * Fetches active gig opportunities based on category and search terms
   */

  try {
    const searchParams = new URLSearchParams({
      search: filters.keywords || 'writing',
      category: filters.category || 'writing_translation',
      level: filters.level || 'all',
      delivery_time: filters.delivery_time || '7_days',
      price_min: filters.price_min || '5',
      price_max: filters.price_max || '500',
      limit: 20,
    });

    const url = `https://api.fiverr.com/api/v1/gigs/search?${searchParams}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Velocity-Autopilot/1.0',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Fiverr API error: ${response.status}`,
      };
    }

    const data = await response.json();

    const opportunities = (data.gigs || []).map(gig => ({
      title: gig.title,
      platform: 'fiverr',
      category: 'service',
      opportunity_type: 'gig',
      url: `https://www.fiverr.com${gig.url}`,
      description: gig.description,
      profit_estimate_low: gig.price_min || 5,
      profit_estimate_high: gig.price_max || 500,
      capital_required: 0,
      velocity_score: 75,
      risk_score: 20,
      time_sensitivity: 'days',
      online_only: true,
      can_ai_complete: gig.category !== 'video_animation',
      discovery_method: 'fiverr_api',
      keywords_matched: [gig.category],
      status: 'discovered',
      pay_currency: 'USD',
    }));

    return {
      success: true,
      opportunities,
      count: opportunities.length,
      source: 'fiverr_api',
    };
  } catch (e) {
    return {
      success: false,
      error: `Fiverr fetch failed: ${e.message}`,
    };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, filters } = body;

    if (action === 'fetch_gigs') {
      const credResult = await getFiverrCredentials(base44, user.email);
      if (!credResult.success) {
        return Response.json({
          success: false,
          error: credResult.error,
          needs_auth: true,
        });
      }

      const gigsResult = await fetchFiverrGigs(filters);
      if (!gigsResult.success) {
        return Response.json(gigsResult, { status: 400 });
      }

      let created = 0;
      for (const opp of gigsResult.opportunities) {
        const saved = await base44.entities.WorkOpportunity.create({
          ...opp,
          user_email: user.email,
        }).catch(() => null);
        if (saved) created++;
      }

      return Response.json({
        success: true,
        found: gigsResult.count,
        created,
        opportunities: gigsResult.opportunities.slice(0, 10),
      });
    }

    if (action === 'validate_credentials') {
      const credResult = await getFiverrCredentials(base44, user.email);
      return Response.json(credResult);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[FiverrRealAPI] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});