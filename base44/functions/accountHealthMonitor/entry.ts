import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * ACCOUNT HEALTH MONITOR
 * Real-time detection of suspensions, rate-limits, cooldowns
 * Tracks account status and adjusts task routing accordingly
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const { action, identity_id, linked_account_id } = body;

    if (action === 'check_account_health') {
      return await checkAccountHealth(base44, user, linked_account_id);
    }

    if (action === 'monitor_all_accounts') {
      return await monitorAllAccounts(base44, user, identity_id);
    }

    if (action === 'report_account_issue') {
      return await reportAccountIssue(base44, user, linked_account_id, body.issue_type);
    }

    return jsonResponse({ error: 'Unknown action' }, 400);

  } catch (error) {
    console.error('[AccountHealthMonitor]', error.message);
    return jsonResponse({ error: error.message }, 500);
  }
});

/**
 * Check health of single account
 */
async function checkAccountHealth(base44, user, linkedAccountId) {
  if (!linkedAccountId) {
    return jsonResponse({ error: 'linked_account_id required' }, 400);
  }

  try {
    const account = await base44.entities.LinkedAccount?.get?.(linkedAccountId).catch(() => null);

    if (!account) {
      return jsonResponse({ error: 'Account not found' }, 404);
    }

    // Analyze account health indicators
    const healthScore = calculateHealthScore(account);
    const status = determineHealthStatus(healthScore, account.health_status);
    const issues = detectIssues(account);

    return jsonResponse({
      account_id: linkedAccountId,
      platform: account.platform,
      username: account.username,
      health_score: healthScore,
      health_status: status,
      issues_detected: issues.length,
      issues: issues,
      can_execute_tasks: status === 'healthy' || status === 'warning',
      last_checked: new Date().toISOString(),
      recommendation: getRecommendation(status, issues),
      metrics: {
        rating: account.rating || 0,
        success_rate: account.success_rate || 0,
        jobs_completed: account.jobs_completed || 0,
        applications_today: account.applications_today || 0,
        daily_application_limit: account.daily_application_limit || 10
      }
    });

  } catch (error) {
    return jsonResponse({ error: 'Health check failed', details: error.message }, 500);
  }
}

/**
 * Monitor all accounts for an identity
 */
async function monitorAllAccounts(base44, user, identityId) {
  if (!identityId) {
    return jsonResponse({ error: 'identity_id required' }, 400);
  }

  try {
    const identity = await base44.entities.AIIdentity?.get?.(identityId).catch(() => null);

    if (!identity) {
      return jsonResponse({ error: 'Identity not found' }, 404);
    }

    // Get all linked accounts
    const accounts = await base44.entities.LinkedAccount?.filter?.({
      id: { $in: identity.linked_account_ids || [] }
    }, 'health_status', 50).catch(() => []);

    const healthReport = {
      identity_id: identityId,
      identity_name: identity.name,
      accounts_monitored: accounts.length,
      timestamp: new Date().toISOString(),
      account_statuses: [],
      summary: {
        healthy: 0,
        warning: 0,
        cooldown: 0,
        suspended: 0,
        limited: 0
      }
    };

    for (const account of accounts) {
      const healthScore = calculateHealthScore(account);
      const status = determineHealthStatus(healthScore, account.health_status);
      const issues = detectIssues(account);

      healthReport.account_statuses.push({
        account_id: account.id,
        platform: account.platform,
        username: account.username,
        health_score: healthScore,
        status,
        issues: issues.length,
        can_execute: status === 'healthy' || status === 'warning'
      });

      healthReport.summary[status] = (healthReport.summary[status] || 0) + 1;
    }

    // Log monitoring report
    await base44.asServiceRole.entities.AuditLog?.create?.({
      entity_type: 'AccountHealthMonitoring',
      entity_id: identityId,
      action_type: 'account_health_monitored',
      user_email: user.email,
      details: healthReport.summary,
      severity: 'info',
      timestamp: new Date().toISOString()
    }).catch(() => {});

    return jsonResponse(healthReport);

  } catch (error) {
    return jsonResponse({ error: 'Monitoring failed', details: error.message }, 500);
  }
}

/**
 * Report account issue and trigger investigation
 */
async function reportAccountIssue(base44, user, linkedAccountId, issueType) {
  if (!linkedAccountId || !issueType) {
    return jsonResponse({ error: 'linked_account_id, issue_type required' }, 400);
  }

  try {
    const account = await base44.entities.LinkedAccount?.get?.(linkedAccountId).catch(() => null);

    if (!account) {
      return jsonResponse({ error: 'Account not found' }, 404);
    }

    // Determine action based on issue type
    let newStatus = account.health_status;
    let action = 'monitor';

    const issueMap = {
      'rate_limit_hit': { status: 'warning', action: 'cooldown_24h' },
      'suspension_notice': { status: 'suspended', action: 'escalate_admin' },
      'login_failed': { status: 'warning', action: 'verify_credentials' },
      'account_locked': { status: 'limited', action: 'request_unlock' },
      'unusual_activity': { status: 'cooldown', action: 'escalate_admin' }
    };

    if (issueMap[issueType]) {
      newStatus = issueMap[issueType].status;
      action = issueMap[issueType].action;
    }

    // Update account status
    await base44.asServiceRole.entities.LinkedAccount?.update?.(linkedAccountId, {
      health_status: newStatus,
      last_used: new Date().toISOString()
    }).catch(() => {});

    // Log issue report
    await base44.asServiceRole.entities.AuditLog?.create?.({
      entity_type: 'AccountIssueReport',
      entity_id: linkedAccountId,
      action_type: 'account_issue_reported',
      user_email: user.email,
      details: {
        issue_type: issueType,
        previous_status: account.health_status,
        new_status: newStatus,
        action_taken: action
      },
      severity: newStatus === 'suspended' ? 'critical' : 'warning',
      timestamp: new Date().toISOString()
    }).catch(() => {});

    return jsonResponse({
      account_id: linkedAccountId,
      issue_reported: true,
      issue_type: issueType,
      previous_status: account.health_status,
      new_status: newStatus,
      action_taken: action,
      message: `Account status updated to ${newStatus}. ${action} initiated.`
    });

  } catch (error) {
    return jsonResponse({ error: 'Issue reporting failed', details: error.message }, 500);
  }
}

/**
 * Calculate health score 0-100
 */
function calculateHealthScore(account) {
  let score = 100;

  // Deduct based on metrics
  if (account.health_status === 'suspended') score -= 100;
  else if (account.health_status === 'limited') score -= 60;
  else if (account.health_status === 'cooldown') score -= 40;
  else if (account.health_status === 'warning') score -= 20;

  // Deduct for low success rate
  if (account.success_rate !== undefined) {
    score -= Math.max(0, 30 - (account.success_rate / 100) * 30);
  }

  // Deduct for near daily limit
  if (account.applications_today !== undefined && account.daily_application_limit) {
    const usage = account.applications_today / account.daily_application_limit;
    if (usage > 0.8) score -= Math.min(20, usage * 20);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Determine status based on score and indicators
 */
function determineHealthStatus(score, currentStatus) {
  if (currentStatus === 'suspended') return 'suspended';
  if (score >= 80) return 'healthy';
  if (score >= 60) return 'warning';
  if (score >= 40) return currentStatus === 'cooldown' ? 'cooldown' : 'warning';
  return 'limited';
}

/**
 * Detect specific issues
 */
function detectIssues(account) {
  const issues = [];

  if (account.health_status === 'suspended') {
    issues.push({ type: 'suspended', severity: 'critical', message: 'Account is suspended' });
  }
  if (account.health_status === 'cooldown' && account.cooldown_until) {
    const now = new Date();
    const cooldownEnd = new Date(account.cooldown_until);
    if (now < cooldownEnd) {
      issues.push({ 
        type: 'cooldown', 
        severity: 'warning', 
        message: `Cooldown active until ${cooldownEnd.toISOString()}` 
      });
    }
  }
  if (account.success_rate !== undefined && account.success_rate < 50) {
    issues.push({ type: 'low_success_rate', severity: 'warning', message: `Success rate: ${account.success_rate}%` });
  }
  if (account.applications_today >= (account.daily_application_limit || 10)) {
    issues.push({ type: 'daily_limit_exceeded', severity: 'warning', message: 'Daily application limit reached' });
  }

  return issues;
}

/**
 * Get recommendation
 */
function getRecommendation(status, issues) {
  if (status === 'healthy') return 'Account is healthy. Safe to execute tasks.';
  if (status === 'warning') return 'Account has minor issues. Monitor and proceed with caution.';
  if (status === 'cooldown') return 'Account is in cooldown. Wait before attempting new tasks.';
  if (status === 'limited') return 'Account has restrictions. Consider rotating to alternative account.';
  return 'Account is suspended. Use alternative account.';
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}