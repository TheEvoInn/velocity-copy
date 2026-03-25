import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * MULTI-IDENTITY COORDINATOR — TIER 5
 * Intelligently routes tasks across identities based on capacity, health, specialization
 * Prevents single-identity burnout, optimizes success rates
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    if (action === 'select_best_identity') return await selectBestIdentity(base44, user, body);
    if (action === 'balance_load_across_identities') return await balanceLoadAcrossIdentities(base44, user);
    if (action === 'rotate_identity_if_needed') return await rotateIdentityIfNeeded(base44, user, body);
    if (action === 'get_identity_portfolio') return await getIdentityPortfolio(base44, user);

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[MultiIdentityCoordinator]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Select best identity for a given opportunity
 */
async function selectBestIdentity(base44, user, payload) {
  const { opportunity, category } = payload;

  try {
    const identities = await base44.asServiceRole.entities.AIIdentity.filter(
      { created_by: user.email, is_active: true, onboarding_complete: true },
      null,
      100
    ).catch(() => []);

    if (!identities.length) {
      return Response.json({ error: 'No active identities available' }, { status: 400 });
    }

    const scored = await Promise.all(
      identities.map(async (identity) => {
        let score = 50;
        const reasons = [];

        // Check 1: Specialization match
        if (identity.preferred_categories?.includes(category)) {
          score += 25;
          reasons.push('Category match');
        }

        // Check 2: Skills match (if opportunity has required skills)
        if (opportunity?.required_documents) {
          const matched_skills = (identity.skills || []).filter(s =>
            opportunity.required_documents?.some(d => d.toLowerCase().includes(s.toLowerCase()))
          ).length;
          if (matched_skills > 0) {
            score += 15;
            reasons.push(`${matched_skills} skills match`);
          }
        }

        // Check 3: Account health check
        const linkedAccounts = await base44.asServiceRole.entities.LinkedAccount.filter(
          { id: { $in: identity.linked_account_ids || [] } },
          null,
          100
        ).catch(() => []);

        const healthy_accounts = linkedAccounts.filter(a => a.health_status === 'healthy').length;
        if (healthy_accounts > 0) {
          score += 20;
          reasons.push(`${healthy_accounts} healthy accounts`);
        } else {
          score -= 30;
          reasons.push('No healthy accounts');
        }

        // Check 4: KYC tier
        const kyc_tier = identity.kyc_verified_data?.kyc_tier || 'none';
        const tier_scores = { 'enhanced': 25, 'standard': 15, 'basic': 5, 'none': -20 };
        score += tier_scores[kyc_tier] || 0;

        // Check 5: Recent activity (fresh > stale)
        if (identity.last_used_at) {
          const hours_since_use = (Date.now() - new Date(identity.last_used_at).getTime()) / (60 * 60 * 1000);
          if (hours_since_use < 24) score += 10;
          else if (hours_since_use > 7 * 24) score -= 10;
        }

        return {
          identity_id: identity.id,
          name: identity.name,
          score: Math.max(0, Math.min(100, score)),
          reasons,
          kyc_tier,
          healthy_accounts
        };
      })
    );

    const best = scored.sort((a, b) => b.score - a.score)[0];

    return Response.json({
      success: true,
      selected_identity: best,
      alternatives: scored.slice(1, 3),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Balance execution load across identities
 */
async function balanceLoadAcrossIdentities(base44, user) {
  try {
    const identities = await base44.asServiceRole.entities.AIIdentity.filter(
      { created_by: user.email, is_active: true },
      null,
      100
    ).catch(() => []);

    const portfolio = [];

    for (const identity of identities) {
      // Count recent tasks (last 24h)
      const recentTasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
        { identity_id: identity.id, created_date: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() } },
        null,
        1000
      ).catch(() => []);

      const completed = recentTasks.filter(t => t.status === 'completed').length;
      const failed = recentTasks.filter(t => t.status === 'failed').length;
      const queued = recentTasks.filter(t => t.status === 'queued').length;

      portfolio.push({
        identity_id: identity.id,
        name: identity.name,
        load: {
          queued,
          completed,
          failed,
          total_recent: recentTasks.length
        },
        capacity_available: queued < 5, // Simple heuristic
        success_rate: recentTasks.length > 0 ? Math.round((completed / recentTasks.length) * 100) : 0
      });
    }

    // Identify overloaded identities
    const overloaded = portfolio.filter(p => p.load.queued >= 5);
    const underutilized = portfolio.filter(p => p.load.queued <= 2);

    if (overloaded.length > 0 && underutilized.length > 0) {
      const message = `⚖️ Load Imbalance Detected: ${overloaded.length} overloaded, ${underutilized.length} underutilized. Recommending task redistribution.`;

      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'alert',
        message,
        severity: 'warning',
        metadata: { overloaded, underutilized }
      }).catch(() => null);
    }

    return Response.json({
      success: true,
      portfolio,
      balance_status: overloaded.length === 0 ? 'balanced' : 'imbalanced',
      overloaded: overloaded.map(p => ({ name: p.name, queued: p.load.queued })),
      underutilized: underutilized.map(p => ({ name: p.name, queued: p.load.queued }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Rotate to different identity if current one shows health warnings
 */
async function rotateIdentityIfNeeded(base44, user, payload) {
  const { current_identity_id, task_id } = payload;

  try {
    const current = await base44.asServiceRole.entities.AIIdentity.filter(
      { id: current_identity_id },
      null,
      1
    ).catch(() => []);

    if (!current.length) {
      return Response.json({ error: 'Current identity not found' }, { status: 404 });
    }

    // Check current identity health
    const accounts = await base44.asServiceRole.entities.LinkedAccount.filter(
      { id: { $in: current[0].linked_account_ids || [] } },
      null,
      100
    ).catch(() => []);

    const unhealthy = accounts.filter(a => a.health_status !== 'healthy').length;

    // If >50% unhealthy, find replacement
    if (unhealthy > accounts.length * 0.5) {
      const alternatives = await selectBestIdentity(base44, user, {
        category: current[0].preferred_categories?.[0]
      });

      if (alternatives.data?.selected_identity) {
        // Update task to new identity
        await base44.asServiceRole.entities.TaskExecutionQueue.update(task_id, {
          identity_id: alternatives.data.selected_identity.identity_id,
          identity_name: alternatives.data.selected_identity.name
        }).catch(() => null);

        await base44.asServiceRole.entities.ActivityLog.create({
          action_type: 'system',
          message: `🔄 Identity Rotation: ${current[0].name} → ${alternatives.data.selected_identity.name} (health concerns)`,
          severity: 'warning',
          metadata: { task_id, from: current[0].name, to: alternatives.data.selected_identity.name }
        }).catch(() => null);

        return Response.json({
          success: true,
          rotated: true,
          from_identity: current[0].name,
          to_identity: alternatives.data.selected_identity.name,
          reason: `${unhealthy}/${accounts.length} accounts unhealthy`
        });
      }
    }

    return Response.json({
      success: true,
      rotated: false,
      reason: 'Current identity health acceptable'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get full identity portfolio status
 */
async function getIdentityPortfolio(base44, user) {
  try {
    const identities = await base44.asServiceRole.entities.AIIdentity.filter(
      { created_by: user.email },
      null,
      100
    ).catch(() => []);

    const portfolio = await Promise.all(
      identities.map(async (id) => {
        const recentTasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
          { identity_id: id.id, created_date: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() } },
          null,
          1000
        ).catch(() => []);

        const earned = recentTasks
          .filter(t => t.status === 'completed')
          .reduce((sum, t) => sum + (t.estimated_value || 0), 0);

        return {
          id: id.id,
          name: id.name,
          status: id.is_active ? 'active' : 'inactive',
          onboarding_complete: id.onboarding_complete,
          kyc_tier: id.kyc_verified_data?.kyc_tier || 'none',
          tasks_7d: recentTasks.length,
          earned_7d: earned,
          success_rate: recentTasks.length > 0 ? Math.round((recentTasks.filter(t => t.status === 'completed').length / recentTasks.length) * 100) : 0
        };
      })
    );

    const active_count = portfolio.filter(p => p.status === 'active').length;
    const total_earned = portfolio.reduce((sum, p) => sum + p.earned_7d, 0);

    return Response.json({
      success: true,
      portfolio,
      summary: {
        total_identities: identities.length,
        active: active_count,
        onboarded: portfolio.filter(p => p.onboarding_complete).length,
        total_earned_7d: total_earned
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}