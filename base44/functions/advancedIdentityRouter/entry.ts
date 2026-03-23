import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * ADVANCED IDENTITY ROUTER (Phase 10.2)
 * Per-identity success prediction, capability-aware assignment
 * Category-specific performance ranking
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, payload } = await req.json();

    if (action === 'predict_identity_success') {
      return await predictIdentitySuccess(base44, user, payload);
    }

    if (action === 'rank_identities_by_category') {
      return await rankIdentitiesByCategory(base44, user, payload);
    }

    if (action === 'assign_optimal_identity') {
      return await assignOptimalIdentity(base44, user, payload);
    }

    if (action === 'get_identity_capabilities') {
      return await getIdentityCapabilities(base44, user, payload);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[AdvancedIdentityRouter]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Predict success probability for identity + opportunity
 */
async function predictIdentitySuccess(base44, user, payload) {
  const { identity_id, opportunity } = payload;

  const identity = await base44.asServiceRole.entities.AIIdentity.filter(
    { id: identity_id },
    null, 1
  ).then(r => r[0]).catch(() => null);

  if (!identity) {
    return Response.json({ error: 'Identity not found' }, { status: 404 });
  }

  // Get identity's historical performance
  const tasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
    { identity_id },
    '-completion_timestamp',
    50
  ).catch(() => []);

  const completed = tasks.filter(t => t.status === 'completed').length;
  const successRate = tasks.length > 0 ? completed / tasks.length : 0.5;

  // Category match score
  const categoryMatch = identity.preferred_categories?.includes(opportunity.category) ? 1.0 : 0.7;

  // Skill match score
  const skillMatch = identity.skills?.length > 0 ? 0.8 : 0.6;

  // Overall prediction
  const successProbability = (successRate * 0.4 + categoryMatch * 0.35 + skillMatch * 0.25) * 100;

  return Response.json({
    success: true,
    prediction: {
      identity_id,
      success_probability: Math.round(successProbability),
      base_success_rate: Math.round(successRate * 100),
      category_match: Math.round(categoryMatch * 100),
      skill_match: Math.round(skillMatch * 100),
      recommendation: successProbability > 70 ? 'high' : successProbability > 50 ? 'medium' : 'low'
    }
  });
}

/**
 * Rank identities by performance in a category
 */
async function rankIdentitiesByCategory(base44, user, payload) {
  const { category } = payload;

  const identities = await base44.asServiceRole.entities.AIIdentity.filter(
    { created_by: user.email, is_active: true },
    null,
    20
  ).catch(() => []);

  const rankings = [];

  for (const identity of identities) {
    // Get category-specific performance
    const tasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
      { identity_id: identity.id },
      null,
      100
    ).catch(() => []);

    const categoryTasks = tasks.filter(t => t.category === category || true);
    const completed = categoryTasks.filter(t => t.status === 'completed').length;
    const successRate = categoryTasks.length > 0 ? completed / categoryTasks.length : 0.5;

    // Category preference bonus
    const categoryPreference = identity.preferred_categories?.includes(category) ? 1.15 : 1.0;

    const score = Math.round(successRate * 100 * categoryPreference);

    rankings.push({
      identity_id: identity.id,
      identity_name: identity.name,
      score,
      success_rate: Math.round(successRate * 100),
      total_tasks: categoryTasks.length,
      completed_tasks: completed
    });
  }

  rankings.sort((a, b) => b.score - a.score);

  return Response.json({ success: true, category, rankings });
}

/**
 * Assign optimal identity for opportunity
 */
async function assignOptimalIdentity(base44, user, payload) {
  const { opportunity } = payload;

  const identities = await base44.asServiceRole.entities.AIIdentity.filter(
    { created_by: user.email, is_active: true },
    null,
    20
  ).catch(() => []);

  let bestIdentity = null;
  let bestScore = 0;

  for (const identity of identities) {
    const prediction = await predictIdentitySuccess(base44, user, {
      identity_id: identity.id,
      opportunity
    }).then(r => JSON.parse(r.body)).catch(() => ({ prediction: { success_probability: 50 } }));

    const score = prediction.prediction.success_probability;

    if (score > bestScore) {
      bestScore = score;
      bestIdentity = identity;
    }
  }

  if (!bestIdentity) {
    return Response.json({ error: 'No suitable identity found' }, { status: 404 });
  }

  return Response.json({
    success: true,
    assignment: {
      opportunity_id: opportunity.id,
      assigned_identity_id: bestIdentity.id,
      identity_name: bestIdentity.name,
      confidence_score: Math.round(bestScore)
    }
  });
}

/**
 * Get detailed capabilities of an identity
 */
async function getIdentityCapabilities(base44, user, payload) {
  const { identity_id } = payload;

  const identity = await base44.asServiceRole.entities.AIIdentity.filter(
    { id: identity_id },
    null, 1
  ).then(r => r[0]).catch(() => null);

  if (!identity) {
    return Response.json({ error: 'Identity not found' }, { status: 404 });
  }

  // Get performance stats
  const tasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
    { identity_id },
    null,
    100
  ).catch(() => []);

  const completed = tasks.filter(t => t.status === 'completed').length;
  const failed = tasks.filter(t => t.status === 'failed').length;

  // Category breakdown
  const categories = {};
  for (const task of tasks) {
    categories[task.category] = (categories[task.category] || 0) + 1;
  }

  return Response.json({
    success: true,
    capabilities: {
      identity_name: identity.name,
      skills: identity.skills || [],
      preferred_categories: identity.preferred_categories || [],
      health_status: identity.health_status || 'healthy',
      total_tasks: tasks.length,
      completed: completed,
      failed: failed,
      success_rate: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0,
      category_breakdown: categories
    }
  });
}