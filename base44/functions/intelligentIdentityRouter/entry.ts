/**
 * INTELLIGENT IDENTITY ROUTER
 * Selects optimal AI identity for each task based on:
 * - Task category + required skills
 * - Identity performance history (completion rate, quality score)
 * - Account health (not suspended, not rate-limited)
 * - KYC tier for identity-dependent opportunities
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Score an identity for suitability to a specific task
 */
async function scoreIdentityForTask(base44, identity, opportunity) {
  let score = 50; // Base score
  const reasons = [];

  try {
    // Factor 1: Skill match (categories match preferred_categories)
    if (identity.preferred_categories?.includes(opportunity.category)) {
      score += 20;
      reasons.push('✓ Category matches preferred focus');
    } else {
      score -= 5;
      reasons.push('⚠️ Category outside preferred focus');
    }

    // Factor 2: Account health
    if (identity.health_status === 'healthy') {
      score += 15;
      reasons.push('✓ Account in healthy status');
    } else if (identity.health_status === 'warning') {
      score -= 10;
      reasons.push('⚠️ Account has warnings');
    } else if (identity.health_status === 'suspended') {
      return { score: 0, viable: false, reasons: ['❌ Account suspended'] };
    }

    // Factor 3: Historical success rate
    const successRate = identity.tasks_executed > 0
      ? ((identity.tasks_executed - (identity.failed_tasks || 0)) / identity.tasks_executed) * 100
      : 50;

    if (successRate > 90) {
      score += 20;
      reasons.push(`✓ High success rate (${Math.round(successRate)}%)`);
    } else if (successRate > 70) {
      score += 10;
      reasons.push(`✓ Good success rate (${Math.round(successRate)}%)`);
    } else if (successRate < 50) {
      score -= 15;
      reasons.push(`❌ Low success rate (${Math.round(successRate)}%)`);
    }

    // Factor 4: Earnings prove effectiveness
    if (identity.total_earned > 1000) {
      score += 12;
      reasons.push('✓ Proven track record with earnings');
    } else if (identity.total_earned > 100) {
      score += 5;
      reasons.push('ℹ️ Moderate earning history');
    }

    // Factor 5: KYC tier matches requirement
    if (opportunity.required_identity_type) {
      const kycTier = identity.kyc_verified_data?.kyc_tier || 'none';
      const tierRank = { none: 0, basic: 1, standard: 2, enhanced: 3 };
      const reqRank = tierRank[opportunity.required_identity_type] || 0;

      if (tierRank[kycTier] >= reqRank) {
        score += 15;
        reasons.push(`✓ KYC tier sufficient (${kycTier})`);
      } else {
        score -= 25;
        reasons.push(`❌ KYC tier insufficient (need ${opportunity.required_identity_type}, have ${kycTier})`);
      }
    }

    // Factor 6: Account cool-down status
    if (identity.cooldown_until) {
      const cooldownEnd = new Date(identity.cooldown_until);
      if (cooldownEnd > new Date()) {
        score -= 30;
        reasons.push('❌ Account in cool-down period');
      }
    }

    // Factor 7: Linked accounts availability
    const linkedAccounts = await base44.asServiceRole.entities.LinkedAccount.filter(
      { 'identity_id': identity.id }, null, 5
    ).catch(() => []);

    if (linkedAccounts.length > 0) {
      const healthyAccounts = linkedAccounts.filter(acc => acc.health_status !== 'suspended').length;
      if (healthyAccounts > 2) {
        score += 10;
        reasons.push(`✓ Multiple healthy accounts (${healthyAccounts})`);
      }
    } else {
      score -= 10;
      reasons.push('⚠️ No linked accounts found');
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      viable: score > 40,
      reasons,
      success_rate: Math.round(successRate),
    };
  } catch (e) {
    return {
      score: 0,
      viable: false,
      reasons: [`Error scoring identity: ${e.message}`],
    };
  }
}

/**
 * Select best identity for task
 */
async function selectBestIdentity(base44, userEmail, opportunity) {
  try {
    // Get all active identities for user
    const identities = await base44.asServiceRole.entities.AIIdentity.filter(
      { user_email: userEmail, is_active: true },
      '-tasks_executed',
      10
    ).catch(() => []);

    if (!identities.length) {
      return {
        success: false,
        error: 'No active identities found',
      };
    }

    // Score each identity
    const scoredIdentities = await Promise.all(
      identities.map(async (identity) => {
        const scoring = await scoreIdentityForTask(base44, identity, opportunity);
        return {
          identity,
          ...scoring,
        };
      })
    );

    // Filter viable identities
    const viable = scoredIdentities.filter(s => s.viable).sort((a, b) => b.score - a.score);

    if (!viable.length) {
      const reasons = scoredIdentities.map(s => `${s.identity.name}: ${s.reasons.join(', ')}`).join(' | ');
      return {
        success: false,
        error: 'No viable identities found',
        details: reasons,
      };
    }

    const best = viable[0];

    // Log selection
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `🎯 Identity selected: "${best.identity.name}" (score: ${best.score}/100) for "${opportunity.title}"`,
      severity: 'info',
      metadata: {
        selected_identity: best.identity.id,
        opportunity_id: opportunity.id,
        score: best.score,
        reasons: best.reasons,
      },
    }).catch(() => null);

    return {
      success: true,
      identity: best.identity,
      score: best.score,
      reasons: best.reasons,
    };
  } catch (e) {
    return {
      success: false,
      error: e.message,
    };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, identity, opportunity } = body;

    // ── Score identity for task ────────────────────────────────────────
    if (action === 'score_identity') {
      if (!identity || !opportunity) {
        return Response.json({ error: 'Identity and opportunity required' }, { status: 400 });
      }

      const scoring = await scoreIdentityForTask(base44, identity, opportunity);
      return Response.json({ success: true, scoring });
    }

    // ── Select best identity for task ──────────────────────────────────
    if (action === 'select_best_identity') {
      if (!opportunity) {
        return Response.json({ error: 'Opportunity required' }, { status: 400 });
      }

      const selection = await selectBestIdentity(base44, user.email, opportunity);
      return Response.json(selection);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[IntelligentIdentityRouter] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});