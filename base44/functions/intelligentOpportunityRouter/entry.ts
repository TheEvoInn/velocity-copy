import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * INTELLIGENT OPPORTUNITY ROUTER
 * ML-based routing: matches opportunities to highest-performing identities
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'route_opportunity';

    if (action === 'route_opportunity') {
      return await routeOpportunity(base44, user, body);
    }

    if (action === 'get_identity_scores') {
      return await getIdentityScores(base44, user, body);
    }

    if (action === 'batch_route_opportunities') {
      return await batchRouteOpportunities(base44, user, body);
    }

    return jsonResponse({ error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('[IntelligentOpportunityRouter]', error.message);
    return jsonResponse({ error: error.message }, 500);
  }
});

/**
 * Route single opportunity to best identity
 */
async function routeOpportunity(base44, user, data) {
  const { opportunity_id } = data;

  if (!opportunity_id) {
    return jsonResponse({ error: 'opportunity_id required' }, 400);
  }

  try {
    // Fetch opportunity
    const opp = await base44.entities.Opportunity
      .filter({ id: opportunity_id }, null, 1)
      .then(r => r[0])
      .catch((err) => {
        console.error('[Opportunity Fetch]', err.message);
        return null;
      });

    if (!opp) {
      return jsonResponse({ error: 'Opportunity not found' }, 404);
    }

    // Get all active identities
    const identities = await base44.entities.AIIdentity
      .filter({ user_email: user.email, is_active: true }, null, 100)
      .catch((err) => {
        console.error('[AIIdentity List]', err.message);
        return [];
      });

    if (identities.length === 0) {
      return jsonResponse({ error: 'No active identities available' }, 400);
    }

    // Score each identity
    const scoredIdentities = await Promise.all(
      identities.map(identity => scoreIdentityForOpportunity(base44, user, identity, opp))
    );

    // Sort by score descending
    const ranked = scoredIdentities.sort((a, b) => b.score - a.score);
    const bestIdentity = ranked[0];

    // Assign opportunity to best identity
    await base44.entities.Opportunity
      .update(opportunity_id, { identity_id: bestIdentity.identity_id, status: 'queued' })
      .catch((err) => {
        console.error('[Opportunity Update]', err.message);
      });

    // Log routing decision
    await base44.entities.ComplianceAuditLog
      .create({
        user_email: user.email,
        action_type: 'opportunity_routed',
        entity_type: 'Opportunity',
        entity_id: opportunity_id,
        identity_id: bestIdentity.identity_id,
        details: {
          routed_to: bestIdentity.identity_name,
          score: bestIdentity.score,
          category: opp.category,
          all_scores: ranked.slice(0, 5)
        },
        risk_level: 'low',
        timestamp: new Date().toISOString()
      })
      .catch((err) => {
        console.error('[ComplianceAuditLog Create]', err.message);
      });

    return jsonResponse({
      message: 'Opportunity routed',
      opportunity_id,
      routed_to: bestIdentity.identity_id,
      identity_name: bestIdentity.identity_name,
      score: bestIdentity.score,
      runner_up_scores: ranked.slice(1, 3).map(r => ({ name: r.identity_name, score: r.score }))
    });
  } catch (error) {
    return jsonResponse({ error: 'Routing failed: ' + error.message }, 500);
  }
}

/**
 * Score identity for specific opportunity
 */
async function scoreIdentityForOpportunity(base44, user, identity, opportunity) {
  let score = 50; // Base score

  // Category match (30 points max)
  if (identity.specialization && opportunity.category) {
    const oppCategory = opportunity.category.toLowerCase();
    const specCategory = identity.specialization.toLowerCase();
    if (specCategory.includes(oppCategory) || oppCategory.includes(specCategory)) {
      score += 30;
    } else if (identity.categories && identity.categories.includes(opportunity.category)) {
      score += 20;
    }
  }

  // Performance score (40 points max)
  const linkedAccounts = await base44.entities.LinkedAccount
    .filter({ created_by: user.email, ai_can_use: true }, null, 50)
    .catch((err) => {
      console.error('[LinkedAccount Score]', err.message);
      return [];
    });

  const accountsUsed = linkedAccounts.filter(a => a.performance_score && a.performance_score > 60);
  if (accountsUsed.length > 0) {
    const avgScore = accountsUsed.reduce((sum, a) => sum + a.performance_score, 0) / accountsUsed.length;
    score += Math.min(40, (avgScore / 100) * 40);
  }

  // Success rate (20 points max)
  const successRate = identity.success_rate || 50;
  score += Math.min(20, (successRate / 100) * 20);

  // Availability penalty
  if (identity.cooldown_until && new Date(identity.cooldown_until) > new Date()) {
    score -= 25;
  }

  // Health status bonus/penalty
  if (identity.health_status === 'healthy') {
    score += 10;
  } else if (identity.health_status === 'warning') {
    score -= 15;
  } else if (identity.health_status === 'suspended') {
    score -= 50;
  }

  return {
    identity_id: identity.id,
    identity_name: identity.name,
    score: Math.max(0, Math.min(100, score))
  };
}

/**
 * Get scoring details for all identities
 */
async function getIdentityScores(base44, user, data) {
  try {
    const identities = await base44.entities.AIIdentity
      .filter({ user_email: user.email, is_active: true }, null, 100)
      .catch((err) => {
        console.error('[AIIdentity Scores]', err.message);
        return [];
      });

    const scores = identities.map(id => ({
      identity_id: id.id,
      name: id.name,
      specialization: id.specialization,
      performance_score: id.performance_score || 50,
      success_rate: id.success_rate || 50,
      health_status: id.health_status,
      is_available: !id.cooldown_until || new Date(id.cooldown_until) < new Date()
    }));

    return jsonResponse({
      total_identities: scores.length,
      scores: scores.sort((a, b) => b.performance_score - a.performance_score)
    });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

/**
 * Batch route multiple opportunities
 */
async function batchRouteOpportunities(base44, user, data) {
  const { opportunity_ids = [] } = data;

  if (opportunity_ids.length === 0) {
    return jsonResponse({ error: 'opportunity_ids array required' }, 400);
  }

  const results = [];

  for (const oppId of opportunity_ids.slice(0, 50)) {
    try {
      const opp = await base44.entities.Opportunity
        .filter({ id: oppId }, null, 1)
        .then(r => r[0])
        .catch(() => null);

      if (!opp) {
        results.push({ opportunity_id: oppId, status: 'not_found' });
        continue;
      }

      const identities = await base44.entities.AIIdentity
        .filter({ user_email: user.email, is_active: true }, null, 100)
        .catch(() => []);

      if (identities.length === 0) {
        results.push({ opportunity_id: oppId, status: 'no_identities' });
        continue;
      }

      const scoredIdentities = await Promise.all(
        identities.map(id => scoreIdentityForOpportunity(base44, user, id, opp))
      );

      const bestIdentity = scoredIdentities.sort((a, b) => b.score - a.score)[0];

      await base44.entities.Opportunity
        .update(oppId, { identity_id: bestIdentity.identity_id, status: 'queued' })
        .catch(() => {});

      results.push({
        opportunity_id: oppId,
        status: 'routed',
        routed_to: bestIdentity.identity_id,
        score: bestIdentity.score
      });
    } catch (err) {
      console.error('[Batch Route]', err.message);
      results.push({ opportunity_id: oppId, status: 'error', error: err.message });
    }
  }

  return jsonResponse({
    total_processed: results.length,
    successful: results.filter(r => r.status === 'routed').length,
    results
  });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}