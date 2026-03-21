import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Intelligent Identity Router
 * 
 * Analyzes opportunities and automatically selects the most appropriate identity
 * based on:
 * - Opportunity category & platform
 * - KYC/legal identity requirements
 * - Identity performance history & ratings
 * - Skill matching
 * - Account health & availability
 * - Custom routing policies
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, opportunity, identity_id } = await req.json();

    switch (action) {
      case 'recommend_identity':
        return await recommendIdentity(base44, user, opportunity);

      case 'get_routing_policies':
        return await getRoutingPolicies(base44, user);

      case 'create_routing_policy':
        return await createRoutingPolicy(base44, user, opportunity);

      case 'evaluate_identity_fit':
        return await evaluateIdentityFit(base44, user, opportunity, identity_id);

      case 'switch_and_queue':
        return await switchAndQueue(base44, user, opportunity, identity_id);

      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function recommendIdentity(base44, user, opportunity) {
  // Get user's identities with performance data
  const identities = await base44.entities.AIIdentity.filter({});
  const policies = await base44.entities.IdentityRoutingPolicy.filter({});
  const routingLogs = await base44.entities.IdentityRoutingLog.filter({});

  if (!identities.length) {
    return Response.json({ 
      error: 'No identities configured',
      recommendation: null
    });
  }

  const recommendations = identities.map(identity => {
    const score = calculateIdentityScore(
      identity,
      opportunity,
      policies,
      routingLogs
    );
    return { identity, score };
  }).sort((a, b) => b.score - a.score);

  const topIdentity = recommendations[0];
  const routingReason = getRoutingReason(
    topIdentity.identity,
    opportunity,
    policies
  );

  return Response.json({
    recommended_identity_id: topIdentity.identity.id,
    recommended_identity: topIdentity.identity,
    fit_score: Math.round(topIdentity.score),
    routing_reason: routingReason,
    alternatives: recommendations.slice(1, 3).map(r => ({
      identity_id: r.identity.id,
      fit_score: Math.round(r.score)
    })),
    requires_kyc: routingReason.requires_kyc,
    kyc_identity_needed: routingReason.requires_legal_identity
  });
}

async function evaluateIdentityFit(base44, user, opportunity, identity_id) {
  const identity = await base44.entities.AIIdentity.filter({ id: identity_id }).then(r => r[0]);
  if (!identity) {
    return Response.json({ error: 'Identity not found' }, { status: 404 });
  }

  const policies = await base44.entities.IdentityRoutingPolicy.filter({});
  const routingLogs = await base44.entities.IdentityRoutingLog.filter({
    identity_used: identity.id
  });

  const metrics = {
    skill_match: calculateSkillMatch(identity, opportunity),
    platform_experience: calculatePlatformExperience(identity, opportunity, routingLogs),
    performance_score: calculatePerformanceScore(identity, routingLogs),
    account_health: identity.linked_account_ids?.length > 0 ? 85 : 50,
    kyc_clearance: identity.kyc_verified_data?.kyc_tier !== 'none' ? 100 : 0
  };

  const overall_fit = Math.round(
    (metrics.skill_match * 0.25 +
     metrics.platform_experience * 0.30 +
     metrics.performance_score * 0.25 +
     metrics.account_health * 0.15 +
     metrics.kyc_clearance * 0.05)
  );

  return Response.json({
    identity_id,
    overall_fit,
    metrics,
    recommendation: overall_fit > 70 ? 'RECOMMENDED' : overall_fit > 50 ? 'ACCEPTABLE' : 'NOT_RECOMMENDED'
  });
}

async function getRoutingPolicies(base44, user) {
  const policies = await base44.entities.IdentityRoutingPolicy.filter({
    created_by: user.email
  });

  return Response.json({
    policies,
    policy_count: policies.length,
    enabled_count: policies.filter(p => p.enabled).length
  });
}

async function createRoutingPolicy(base44, user, policyData) {
  const policy = await base44.entities.IdentityRoutingPolicy.create({
    ...policyData,
    created_by: user.email,
    enabled: true
  });

  return Response.json({
    success: true,
    policy_id: policy.id,
    policy
  });
}

async function switchAndQueue(base44, user, opportunity, identity_id) {
  // Get the identity
  const identity = await base44.entities.AIIdentity.filter({ id: identity_id }).then(r => r[0]);
  if (!identity) {
    return Response.json({ error: 'Identity not found' }, { status: 404 });
  }

  // Log the routing decision
  const routingLog = await base44.entities.IdentityRoutingLog.create({
    opportunity_id: opportunity.id,
    identity_used: identity.is_active ? 'persona' : 'legal',
    identity_name: identity.name,
    routing_reason: `Auto-routed by intelligent router based on skill/platform fit`,
    required_kyc: opportunity.requires_kyc_identity || false,
    kyc_verified: identity.kyc_verified_data?.kyc_tier !== 'none',
    auto_detected: true,
    platform: opportunity.platform,
    opportunity_category: opportunity.category,
    status: 'pending'
  });

  // Create task execution queue entry
  const task = await base44.entities.TaskExecutionQueue.create({
    opportunity_id: opportunity.id,
    url: opportunity.url,
    opportunity_type: opportunity.opportunity_type || 'application',
    platform: opportunity.platform,
    identity_id: identity.id,
    identity_name: identity.name,
    status: 'queued',
    priority: calculatePriority(opportunity),
    estimated_value: opportunity.profit_estimate_high || opportunity.profit_estimate_low || 0,
    deadline: opportunity.deadline
  });

  // Update opportunity status
  await base44.entities.Opportunity.update(opportunity.id, {
    status: 'queued',
    identity_id: identity.id,
    task_execution_id: task.id
  });

  return Response.json({
    success: true,
    task_id: task.id,
    identity_id,
    routing_log_id: routingLog.id,
    message: `Task queued with identity: ${identity.name}`
  });
}

// Helper functions

function calculateIdentityScore(identity, opportunity, policies, logs) {
  let score = 50; // base score

  // Skill match (0-20 points)
  const skillMatch = calculateSkillMatch(identity, opportunity);
  score += (skillMatch / 100) * 20;

  // Platform experience (0-25 points)
  const platformXp = calculatePlatformExperience(identity, opportunity, logs);
  score += (platformXp / 100) * 25;

  // Performance history (0-20 points)
  const perf = calculatePerformanceScore(identity, logs);
  score += (perf / 100) * 20;

  // Account health (0-15 points)
  const health = identity.linked_account_ids?.length > 0 ? 100 : 40;
  score += (health / 100) * 15;

  // KYC requirement check (0-20 points, can lose if needed but not available)
  if (opportunity.requires_kyc_identity) {
    const hasKyc = identity.kyc_verified_data?.kyc_tier === 'standard' || identity.kyc_verified_data?.kyc_tier === 'enhanced';
    score += hasKyc ? 20 : -20;
  }

  return Math.max(0, Math.min(100, score));
}

function calculateSkillMatch(identity, opportunity) {
  if (!identity.skills || !opportunity.category) return 50;

  const opportunityKeywords = [
    opportunity.category,
    opportunity.platform,
    ...(opportunity.required_documents || [])
  ].map(k => k?.toLowerCase() || '');

  const matchCount = identity.skills.filter(skill =>
    opportunityKeywords.some(kw => kw.includes(skill.toLowerCase()) || skill.toLowerCase().includes(kw))
  ).length;

  return identity.skills.length > 0 ? Math.min(100, (matchCount / identity.skills.length) * 100) : 50;
}

function calculatePlatformExperience(identity, opportunity, logs) {
  const platformLogs = logs.filter(l => l.platform === opportunity.platform && l.identity_used === identity.id);
  const successCount = platformLogs.filter(l => l.status === 'executed' || l.status === 'completed').length;

  if (platformLogs.length === 0) return 30; // new to platform
  return Math.min(100, (successCount / platformLogs.length) * 100);
}

function calculatePerformanceScore(identity, logs) {
  if (logs.length === 0) return 50;

  const completedCount = logs.filter(l => l.status === 'completed' || l.status === 'executed').length;
  return (completedCount / logs.length) * 100;
}

function getRoutingReason(identity, opportunity, policies) {
  const matchingPolicy = policies.find(p =>
    p.enabled &&
    (p.category === opportunity.category || !p.category) &&
    (!p.platform || p.platform === opportunity.platform)
  );

  return {
    requires_kyc: matchingPolicy?.requires_kyc || false,
    kyc_reason: matchingPolicy?.kyc_reason || null,
    requires_legal_identity: matchingPolicy?.identity_type === 'legal',
    policy_applied: matchingPolicy?.rule_name || 'Auto-detected'
  };
}

function calculatePriority(opportunity) {
  let priority = 50;

  if (opportunity.profit_estimate_high > 500) priority += 20;
  if (opportunity.profit_estimate_high > 1000) priority += 15;

  if (opportunity.time_sensitivity === 'immediate') priority += 25;
  if (opportunity.time_sensitivity === 'hours') priority += 15;

  return Math.min(100, priority);
}