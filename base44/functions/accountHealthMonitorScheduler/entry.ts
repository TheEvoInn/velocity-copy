import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * ACCOUNT HEALTH MONITOR SCHEDULER
 * Runs periodically (scheduled automation, every 4 hours)
 * Checks LinkedAccount health status across all identities
 * Detects suspended/banned accounts, alerts user, pauses Autopilot if critical
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Service-role operation: check all accounts across all users
    const allAccounts = await base44.asServiceRole.entities.LinkedAccount.list(
      '-last_used',
      1000
    ).catch(() => []);

    const healthResults = {
      checked: allAccounts.length,
      healthy: 0,
      warning: 0,
      critical: 0,
      actions: []
    };

    for (const account of allAccounts) {
      // Simulate health check (in real scenario, would ping platform APIs)
      // For now: consider account healthy unless marked otherwise
      
      let healthStatus = 'healthy';
      let issues = [];

      // Check 1: Last used too old (30+ days) = potential stale
      if (account.last_used) {
        const daysSinceUse = (Date.now() - new Date(account.last_used).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceUse > 30) {
          healthStatus = 'warning';
          issues.push(`Last used ${Math.floor(daysSinceUse)} days ago`);
        }
      }

      // Check 2: Cooldown active
      if (account.cooldown_until && new Date(account.cooldown_until) > new Date()) {
        healthStatus = 'cooldown';
        issues.push('Account on cooldown');
      }

      // Check 3: Explicit health_status = suspended/banned
      if (account.health_status === 'suspended' || account.health_status === 'banned') {
        healthStatus = 'critical';
        issues.push(`Account ${account.health_status} on platform`);
      }

      // Update account with health check timestamp
      if (healthStatus !== account.health_status) {
        await base44.asServiceRole.entities.LinkedAccount.update(account.id, {
          health_status: healthStatus,
          notes: `${account.notes || ''} [Health check: ${healthStatus}]`
        }).catch(() => null);
      }

      // Tally results
      if (healthStatus === 'healthy') healthResults.healthy++;
      else if (healthStatus === 'warning' || healthStatus === 'cooldown') healthResults.warning++;
      else if (healthStatus === 'critical') healthResults.critical++;

      // Action: Pause Autopilot if critical account
      if (healthStatus === 'critical') {
        const linkedIdentities = await base44.asServiceRole.entities.AIIdentity.filter(
          { id: { $in: [account.id] } },
          undefined,
          10
        ).catch(() => []);

        for (const identity of linkedIdentities) {
          if (identity.linked_account_ids?.includes(account.id)) {
            // Find all queued tasks for this identity using this account
            const affectedTasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
              { identity_id: identity.id, status: 'queued', linked_account_id: account.id },
              undefined,
              100
            ).catch(() => []);

            for (const task of affectedTasks) {
              await base44.asServiceRole.entities.TaskExecutionQueue.update(task.id, {
                status: 'needs_review',
                notes: `${task.notes || ''} [Account health critical - paused]`,
                manual_review_reason: `Linked account "${account.username}" marked as ${account.health_status}`
              }).catch(() => null);
            }

            healthResults.actions.push({
              action: 'paused_tasks',
              identity_id: identity.id,
              account_id: account.id,
              tasks_affected: affectedTasks.length,
              reason: issues.join(', ')
            });
          }
        }
      }
    }

    // Log summary
    const severity = healthResults.critical > 0 ? 'warning' : 'success';
    const message = `Health check complete: ${healthResults.healthy} healthy, ${healthResults.warning} warning, ${healthResults.critical} critical`;

    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `📊 ${message}`,
      severity,
      metadata: healthResults
    }).catch(() => null);

    // Alert admins if critical accounts found
    if (healthResults.critical > 0) {
      const adminUsers = await base44.asServiceRole.entities.User.filter(
        { role: 'admin' },
        undefined,
        100
      ).catch(() => []);

      for (const admin of adminUsers) {
        await base44.asServiceRole.entities.Notification.create({
          type: 'warning',
          severity: 'warning',
          title: '⚠️ Account Health Alert',
          message: `${healthResults.critical} critical account(s) detected. ${healthResults.actions.length} task(s) paused. Review in Admin Panel.`,
          user_email: admin.email,
          action_type: 'account_health_critical',
          is_read: false
        }).catch(() => null);
      }
    }

    return Response.json({
      success: true,
      message,
      health_results: healthResults
    });
  } catch (error) {
    console.error('[AccountHealthMonitorScheduler]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});