import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Identity & Account Management Engine - Phase 6
 * Multi-persona identity management, linked account orchestration,
 * credential management, and intelligent identity routing
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, payload } = await req.json();

    if (action === 'create_ai_identity') {
      return await createAIIdentity(base44, user, payload);
    }

    if (action === 'get_active_identities') {
      return await getActiveIdentities(base44, user);
    }

    if (action === 'link_account') {
      return await linkAccount(base44, user, payload);
    }

    if (action === 'get_linked_accounts') {
      return await getLinkedAccounts(base44, user);
    }

    if (action === 'monitor_account_health') {
      return await monitorAccountHealth(base44, user);
    }

    if (action === 'route_identity_for_opportunity') {
      return await routeIdentityForOpportunity(base44, user, payload);
    }

    if (action === 'auto_create_accounts') {
      return await autoCreateAccounts(base44, user, payload);
    }

    if (action === 'rotate_identity') {
      return await rotateIdentity(base44, user, payload);
    }

    if (action === 'get_identity_performance') {
      return await getIdentityPerformance(base44, user, payload);
    }

    if (action === 'manage_credentials') {
      return await manageCredentials(base44, user, payload);
    }

    if (action === 'audit_identity_usage') {
      return await auditIdentityUsage(base44, user);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Identity Engine Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Create a new AI identity/persona
 */
async function createAIIdentity(base44, user, payload) {
  const {
    name,
    role_label = 'Freelancer',
    communication_tone = 'professional',
    email,
    skills = [],
    preferred_platforms = [],
    preferred_categories = []
  } = payload;

  try {
    // Create identity record
    const identity = await base44.entities.AIIdentity.create({
      name: name,
      role_label: role_label,
      email: email || `${name.toLowerCase().replace(/\s+/g, '_')}@profit-matrix.ai`,
      communication_tone: communication_tone,
      skills: skills,
      preferred_platforms: preferred_platforms,
      preferred_categories: preferred_categories,
      is_active: false,
      tasks_executed: 0,
      total_earned: 0,
      color: generateColor(),
      icon: generateIcon()
    });

    // Log creation
    await base44.entities.ActivityLog.create({
      action_type: 'system',
      message: `👤 New AI identity created: ${name} (${role_label})`,
      severity: 'info',
      metadata: { identity_id: identity.id }
    });

    return Response.json({
      success: true,
      identity_id: identity.id,
      name: identity.name,
      role_label: identity.role_label,
      message: `AI identity "${name}" created successfully`
    });
  } catch (error) {
    console.error('Create identity error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get all active AI identities
 */
async function getActiveIdentities(base44, user) {
  try {
    const identities = await base44.entities.AIIdentity.list('-created_date', 100);

    const summary = {
      total_identities: identities.length,
      active: identities.filter(i => i.is_active).length,
      identities: identities.map(i => ({
        id: i.id,
        name: i.name,
        role_label: i.role_label,
        is_active: i.is_active,
        email: i.email,
        tasks_executed: i.tasks_executed || 0,
        total_earned: i.total_earned || 0,
        last_used: i.last_used_at,
        skills: i.skills || [],
        preferred_platforms: i.preferred_platforms || []
      }))
    };

    return Response.json({
      success: true,
      ...summary
    });
  } catch (error) {
    console.error('Get identities error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Link external platform account to identity
 */
async function linkAccount(base44, user, payload) {
  const {
    platform,
    username,
    email,
    identity_id,
    profile_url = '',
    hourly_rate = 0
  } = payload;

  try {
    // Create linked account record
    const account = await base44.entities.LinkedAccount.create({
      platform: platform,
      username: username,
      email: email,
      profile_url: profile_url,
      hourly_rate: hourly_rate,
      specialization: `${platform} specialist`,
      health_status: 'healthy',
      last_used: new Date().toISOString(),
      ai_can_use: true,
      performance_score: 50
    });

    // Update identity with linked account
    const linkedIdentities = await base44.entities.AIIdentity.filter(
      { id: identity_id },
      null,
      1
    );

    if (linkedIdentities.length > 0) {
      const linkedIds = linkedIdentities[0].linked_account_ids || [];
      linkedIds.push(account.id);

      await base44.entities.AIIdentity.update(identity_id, {
        linked_account_ids: linkedIds
      });
    }

    // Log activity
    await base44.entities.ActivityLog.create({
      action_type: 'system',
      message: `🔗 Account linked: ${username} on ${platform}`,
      severity: 'info',
      metadata: { account_id: account.id, platform }
    });

    return Response.json({
      success: true,
      account_id: account.id,
      platform: platform,
      username: username,
      status: 'healthy'
    });
  } catch (error) {
    console.error('Link account error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get all linked accounts
 */
async function getLinkedAccounts(base44, user) {
  try {
    const accounts = await base44.entities.LinkedAccount.list('-created_date', 200);

    const groupedByPlatform = {};
    for (const account of accounts) {
      const platform = account.platform || 'unknown';
      if (!groupedByPlatform[platform]) {
        groupedByPlatform[platform] = [];
      }
      groupedByPlatform[platform].push({
        id: account.id,
        username: account.username,
        email: account.email,
        health_status: account.health_status,
        rating: account.rating || 0,
        jobs_completed: account.jobs_completed || 0,
        success_rate: account.success_rate || 0,
        total_earned: account.total_earned || 0,
        hourly_rate: account.hourly_rate,
        last_used: account.last_used,
        performance_score: account.performance_score || 50
      });
    }

    return Response.json({
      success: true,
      total_accounts: accounts.length,
      by_platform: groupedByPlatform
    });
  } catch (error) {
    console.error('Get linked accounts error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Monitor account health across all platforms
 */
async function monitorAccountHealth(base44, user) {
  try {
    const accounts = await base44.entities.LinkedAccount.list('-created_date', 200);

    const health = {
      timestamp: new Date().toISOString(),
      total_accounts: accounts.length,
      healthy: 0,
      warning: 0,
      critical: 0,
      by_platform: {},
      issues: []
    };

    for (const account of accounts) {
      const status = account.health_status || 'healthy';
      health[status]++;

      const platform = account.platform || 'unknown';
      if (!health.by_platform[platform]) {
        health.by_platform[platform] = { healthy: 0, warning: 0, critical: 0 };
      }
      health.by_platform[platform][status]++;

      // Detect issues
      if (status === 'critical') {
        health.issues.push({
          platform: platform,
          username: account.username,
          reason: 'Account suspended or limited',
          action_required: true
        });
      }

      if (status === 'warning') {
        health.issues.push({
          platform: platform,
          username: account.username,
          reason: 'Account in cooldown or performance warning',
          action_required: false
        });
      }

      // Check last used date
      if (account.last_used) {
        const lastUsed = new Date(account.last_used);
        const daysAgo = (Date.now() - lastUsed.getTime()) / (1000 * 60 * 60 * 24);
        if (daysAgo > 30) {
          health.issues.push({
            platform: platform,
            username: account.username,
            reason: `Unused for ${Math.round(daysAgo)} days`,
            action_required: false
          });
        }
      }
    }

    // Log summary
    if (health.issues.length > 0) {
      await base44.entities.ActivityLog.create({
        action_type: 'alert',
        message: `⚠️ Account Health: ${health.healthy} healthy, ${health.warning} warning, ${health.critical} critical`,
        severity: health.critical > 0 ? 'critical' : 'warning',
        metadata: health
      });
    }

    return Response.json({
      success: true,
      ...health
    });
  } catch (error) {
    console.error('Monitor health error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Route identity to opportunity based on requirements
 */
async function routeIdentityForOpportunity(base44, user, payload) {
  const { opportunity_id } = payload;

  try {
    const opps = await base44.entities.Opportunity.filter(
      { id: opportunity_id },
      null,
      1
    );

    if (!opps || opps.length === 0) {
      return Response.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    const opp = opps[0];
    const identities = await base44.entities.AIIdentity.filter(
      { is_active: true },
      null,
      100
    );

    const routing = {
      opportunity_id: opportunity_id,
      opportunity_category: opp.category,
      opportunity_platform: opp.platform,
      candidates: [],
      recommended_identity: null,
      reasoning: ''
    };

    // Score each identity for this opportunity
    for (const identity of identities) {
      let score = 50;

      // Platform preference match
      if (identity.preferred_platforms?.includes(opp.platform)) {
        score += 30;
      }

      // Category preference match
      if (identity.preferred_categories?.includes(opp.category)) {
        score += 20;
      }

      // Skill match
      if (opp.required_identity_type === 'freelancer' && identity.skills?.length > 0) {
        score += 15;
      }

      // Performance bonus
      score += Math.round((identity.total_earned || 0) / 1000); // Bonus per $1000 earned

      routing.candidates.push({
        identity_id: identity.id,
        identity_name: identity.name,
        platform_match: identity.preferred_platforms?.includes(opp.platform) || false,
        category_match: identity.preferred_categories?.includes(opp.category) || false,
        score: Math.min(score, 100),
        total_earned: identity.total_earned,
        tasks_executed: identity.tasks_executed
      });
    }

    // Sort and select best candidate
    routing.candidates.sort((a, b) => b.score - a.score);
    if (routing.candidates.length > 0) {
      const best = routing.candidates[0];
      routing.recommended_identity = best.identity_id;
      routing.reasoning = buildRoutingReasoning(best);
    }

    // Create routing log
    await base44.entities.IdentityRoutingLog.create({
      opportunity_id: opportunity_id,
      identity_used: routing.recommended_identity,
      routing_reason: routing.reasoning,
      required_kyc: detectKYCRequirement(opp),
      auto_detected: true,
      platform: opp.platform,
      opportunity_category: opp.category,
      status: 'pending'
    });

    return Response.json({
      success: true,
      ...routing
    });
  } catch (error) {
    console.error('Route identity error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Auto-create accounts on platforms
 */
async function autoCreateAccounts(base44, user, payload) {
  const { identity_id, platforms = [] } = payload;

  try {
    const identities = await base44.entities.AIIdentity.filter(
      { id: identity_id },
      null,
      1
    );

    if (!identities.length) {
      return Response.json({ error: 'Identity not found' }, { status: 404 });
    }

    const identity = identities[0];
    const results = {
      identity_id: identity_id,
      identity_name: identity.name,
      created_accounts: [],
      failed_attempts: [],
      total: platforms.length
    };

    for (const platform of platforms) {
      try {
        // Create account record
        const accountCreation = await base44.entities.LinkedAccountCreation.create({
          platform: platform,
          identity_id: identity_id,
          identity_name: identity.name,
          username: `${identity.name.toLowerCase().replace(/\s+/g, '_')}_${Math.random().toString(36).substr(2, 5)}`,
          email: `${identity.name.toLowerCase().replace(/\s+/g, '.')}+${platform}@profit-matrix.ai`,
          account_status: 'created',
          is_ai_created: true,
          onboarding_completed: false,
          profile_completeness: 0
        });

        results.created_accounts.push({
          platform: platform,
          account_id: accountCreation.id,
          username: accountCreation.username,
          status: 'created'
        });
      } catch (e) {
        results.failed_attempts.push({
          platform: platform,
          error: e.message
        });
      }
    }

    // Log activity
    await base44.entities.ActivityLog.create({
      action_type: 'system',
      message: `🤖 Auto-created ${results.created_accounts.length} accounts for ${identity.name}`,
      severity: 'info',
      metadata: results
    });

    return Response.json({
      success: true,
      ...results
    });
  } catch (error) {
    console.error('Auto-create accounts error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Rotate to different identity
 */
async function rotateIdentity(base44, user, payload) {
  const { current_identity_id, reason = 'rotation' } = payload;

  try {
    // Get current identity
    const current = await base44.entities.AIIdentity.filter(
      { id: current_identity_id },
      null,
      1
    );

    if (!current.length) {
      return Response.json({ error: 'Current identity not found' }, { status: 404 });
    }

    // Deactivate current
    await base44.entities.AIIdentity.update(current_identity_id, {
      is_active: false
    });

    // Get all other identities
    const others = await base44.entities.AIIdentity.filter(
      { is_active: false, id: { $ne: current_identity_id } },
      '-total_earned',
      1
    );

    let nextIdentity = null;
    if (others.length > 0) {
      nextIdentity = others[0];
      await base44.entities.AIIdentity.update(nextIdentity.id, {
        is_active: true,
        last_used_at: new Date().toISOString()
      });
    }

    // Log rotation
    await base44.entities.ActivityLog.create({
      action_type: 'system',
      message: `🔄 Identity rotated: ${current[0].name} → ${nextIdentity?.name || 'none'}`,
      severity: 'info',
      metadata: { reason, previous_id: current_identity_id, new_id: nextIdentity?.id }
    });

    return Response.json({
      success: true,
      previous_identity: current[0].name,
      new_identity: nextIdentity?.name || null,
      reason: reason
    });
  } catch (error) {
    console.error('Rotate identity error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get performance metrics for identity
 */
async function getIdentityPerformance(base44, user, payload) {
  const { identity_id } = payload;

  try {
    const identities = await base44.entities.AIIdentity.filter(
      { id: identity_id },
      null,
      1
    );

    if (!identities.length) {
      return Response.json({ error: 'Identity not found' }, { status: 404 });
    }

    const identity = identities[0];

    // Get linked accounts
    const linkedIds = identity.linked_account_ids || [];
    const linkedAccounts = linkedIds.length > 0 
      ? await base44.entities.LinkedAccount.filter({ id: { $in: linkedIds } }, null, 100)
      : [];

    // Calculate metrics
    const performance = {
      identity_id: identity_id,
      identity_name: identity.name,
      is_active: identity.is_active,
      tasks_executed: identity.tasks_executed || 0,
      total_earned: identity.total_earned || 0,
      linked_accounts: linkedAccounts.length,
      account_health: {
        healthy: linkedAccounts.filter(a => a.health_status === 'healthy').length,
        warning: linkedAccounts.filter(a => a.health_status === 'warning').length,
        critical: linkedAccounts.filter(a => a.health_status === 'critical').length
      },
      average_success_rate: linkedAccounts.length > 0
        ? Math.round(linkedAccounts.reduce((sum, a) => sum + (a.success_rate || 0), 0) / linkedAccounts.length)
        : 0,
      total_jobs_completed: linkedAccounts.reduce((sum, a) => sum + (a.jobs_completed || 0), 0),
      earning_per_task: identity.tasks_executed > 0 ? (identity.total_earned / identity.tasks_executed).toFixed(2) : 0,
      last_used: identity.last_used_at,
      accounts_by_platform: {}
    };

    // Group accounts by platform
    for (const account of linkedAccounts) {
      const platform = account.platform;
      if (!performance.accounts_by_platform[platform]) {
        performance.accounts_by_platform[platform] = [];
      }
      performance.accounts_by_platform[platform].push({
        username: account.username,
        rating: account.rating || 0,
        success_rate: account.success_rate || 0,
        jobs_completed: account.jobs_completed || 0,
        total_earned: account.total_earned || 0
      });
    }

    return Response.json({
      success: true,
      ...performance
    });
  } catch (error) {
    console.error('Get performance error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Manage credentials (store, retrieve, rotate)
 */
async function manageCredentials(base44, user, payload) {
  const { action: credAction, account_id, credential_data } = payload;

  try {
    if (credAction === 'store') {
      // Create credential vault entry
      const vault = await base44.entities.CredentialVault.create({
        platform: credential_data.platform,
        credential_type: 'login',
        linked_account_id: account_id,
        is_active: true,
        access_count: 0
      });

      return Response.json({
        success: true,
        credential_id: vault.id,
        status: 'stored'
      });
    }

    if (credAction === 'rotate') {
      // Get old credential
      const vaults = await base44.entities.CredentialVault.filter(
        { linked_account_id: account_id, is_active: true },
        null,
        1
      );

      if (vaults.length > 0) {
        // Mark old as inactive
        await base44.entities.CredentialVault.update(vaults[0].id, {
          is_active: false
        });
      }

      // Create new credential
      const newVault = await base44.entities.CredentialVault.create({
        platform: vaults[0]?.platform || 'unknown',
        credential_type: 'login',
        linked_account_id: account_id,
        is_active: true,
        access_count: 0
      });

      return Response.json({
        success: true,
        credential_id: newVault.id,
        status: 'rotated',
        old_credential_id: vaults[0]?.id
      });
    }

    return Response.json({ error: 'Unknown credential action' }, { status: 400 });
  } catch (error) {
    console.error('Manage credentials error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Audit identity usage
 */
async function auditIdentityUsage(base44, user) {
  try {
    const identities = await base44.entities.AIIdentity.list('-created_date', 100);
    const logs = await base44.entities.IdentityRoutingLog.list('-created_date', 200);

    const audit = {
      timestamp: new Date().toISOString(),
      total_identities: identities.length,
      total_usage_logs: logs.length,
      usage_by_identity: {},
      top_performers: [],
      unused_identities: []
    };

    // Aggregate usage
    for (const log of logs) {
      const id = log.identity_used || 'unknown';
      if (!audit.usage_by_identity[id]) {
        audit.usage_by_identity[id] = 0;
      }
      audit.usage_by_identity[id]++;
    }

    // Get top performers
    audit.top_performers = identities
      .sort((a, b) => (b.total_earned || 0) - (a.total_earned || 0))
      .slice(0, 5)
      .map(i => ({
        name: i.name,
        earned: i.total_earned,
        tasks: i.tasks_executed,
        usage_count: audit.usage_by_identity[i.id] || 0
      }));

    // Find unused
    audit.unused_identities = identities
      .filter(i => !audit.usage_by_identity[i.id])
      .map(i => i.name);

    return Response.json({
      success: true,
      ...audit
    });
  } catch (error) {
    console.error('Audit usage error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateColor() {
  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function generateIcon() {
  const icons = ['Zap', 'Sparkles', 'Star', 'Heart', 'Rocket', 'Target'];
  return icons[Math.floor(Math.random() * icons.length)];
}

function detectKYCRequirement(opp) {
  const category = (opp.category || '').toLowerCase();
  const profit = opp.profit_estimate_high || 0;

  if (category === 'grant' || category === 'prize') return true;
  if (profit > 20000) return true;

  return false;
}

function buildRoutingReasoning(candidate) {
  const reasons = [];

  if (candidate.platform_match) {
    reasons.push('Preferred platform match');
  }
  if (candidate.category_match) {
    reasons.push('Preferred category match');
  }
  if (candidate.total_earned > 10000) {
    reasons.push('Strong performance history');
  }

  return reasons.length > 0 ? reasons.join(', ') : 'Selected based on overall score';
}