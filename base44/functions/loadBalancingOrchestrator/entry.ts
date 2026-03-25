import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * LOAD BALANCING ORCHESTRATOR
 * Distributes tasks across identities and accounts
 * Detects rate limits, prevents overloading
 * Cooldown management for over-used accounts
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, task_id, opportunities } = body;

    // ── Assign task to best available account ──────────────────────────────
    if (action === 'assign_task') {
      if (!task_id) return Response.json({ error: 'task_id required' }, { status: 400 });

      const task = await base44.entities.TaskExecutionQueue.get(task_id).catch(() => null);
      if (!task) return Response.json({ error: 'Task not found' }, { status: 404 });

      // Get all accounts for this identity with load scores
      const accounts = await base44.entities.LinkedAccount.filter(
        { id: { $in: task.identity_id ? [task.identity_id] : [] } },
        null,
        50
      ).catch(() => []);

      if (!accounts.length) {
        return Response.json({ error: 'No accounts available' }, { status: 400 });
      }

      // Score accounts for suitability
      const scoredAccounts = await Promise.all(
        accounts.map(async (account) => {
          const score = await scoreAccountLoad(base44, account);
          return { account, ...score };
        })
      );

      // Find best available account
      const viable = scoredAccounts.filter(s => s.available).sort((a, b) => b.score - a.score);
      
      if (!viable.length) {
        return Response.json({
          success: false,
          error: 'No available accounts (all rate-limited or on cooldown)',
          details: scoredAccounts.map(s => ({ account: s.account.username, reason: s.reason }))
        });
      }

      const best = viable[0];
      
      // Update task with assigned account
      await base44.asServiceRole.entities.TaskExecutionQueue.update(task_id, {
        linked_account_id: best.account.id,
        notes: `${task.notes || ''} [Assigned to account: ${best.account.username} - load score: ${best.load_score}/100]`
      });

      // Log assignment
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `⚖️ Task ${task_id} assigned to account "${best.account.username}" (load: ${best.load_score}/100)`,
        severity: 'info',
        metadata: {
          task_id,
          account_id: best.account.id,
          load_score: best.load_score,
          reason: best.reason
        }
      }).catch(() => null);

      return Response.json({
        success: true,
        account: best.account,
        load_score: best.load_score,
        reason: best.reason
      });
    }

    // ── Get load status for all accounts ────────────────────────────────────
    if (action === 'get_load_status') {
      const accounts = await base44.asServiceRole.entities.LinkedAccount.list('-last_used', 100).catch(() => []);
      
      const statusReport = await Promise.all(
        accounts.map(async (account) => {
          const score = await scoreAccountLoad(base44, account);
          return {
            account_id: account.id,
            username: account.username,
            platform: account.platform,
            health_status: account.health_status,
            load_score: score.load_score,
            available: score.available,
            reason: score.reason,
            daily_limit: account.daily_application_limit || 10,
            applications_today: account.applications_today || 0
          };
        })
      );

      const overloaded = statusReport.filter(s => s.load_score > 80);
      const healthy = statusReport.filter(s => s.load_score < 50 && s.available);

      return Response.json({
        success: true,
        total_accounts: statusReport.length,
        healthy_accounts: healthy.length,
        overloaded_accounts: overloaded.length,
        status_report: statusReport,
        recommendations: {
          pause_accounts: overloaded.map(s => s.username),
          available_for_use: healthy.map(s => s.username)
        }
      });
    }

    // ── Check and apply cooldowns ──────────────────────────────────────────
    if (action === 'enforce_cooldowns') {
      const accounts = await base44.asServiceRole.entities.LinkedAccount.list('-last_used', 100).catch(() => []);
      
      const results = { applied: 0, removed: 0 };
      const now = new Date();

      for (const account of accounts) {
        const tasksToday = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
          {
            linked_account_id: account.id,
            status: { $in: ['completed', 'failed'] },
            completion_timestamp: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString() }
          },
          null,
          1000
        ).catch(() => []);

        const tasksLast1h = tasksToday.filter(t => {
          const comp = new Date(t.completion_timestamp);
          return comp.getTime() > now.getTime() - 60 * 60 * 1000;
        });

        // Apply cooldown if too many tasks in 1 hour
        if (tasksLast1h.length > 5) {
          const cooldownEnd = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour cooldown
          await base44.asServiceRole.entities.LinkedAccount.update(account.id, {
            health_status: 'cooldown',
            cooldown_until: cooldownEnd.toISOString(),
            notes: `${account.notes || ''} [Cooldown applied: ${tasksLast1h.length} tasks in 1h]`
          });
          results.applied++;
        } else if (account.cooldown_until && new Date(account.cooldown_until) < now) {
          // Remove expired cooldown
          await base44.asServiceRole.entities.LinkedAccount.update(account.id, {
            health_status: 'healthy',
            cooldown_until: null
          });
          results.removed++;
        }
      }

      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `⏱️ Cooldown enforcement: Applied ${results.applied}, removed ${results.removed}`,
        severity: 'info',
        metadata: results
      }).catch(() => null);

      return Response.json({ success: true, ...results });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[LoadBalancingOrchestrator]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Score an account's current load and availability
 */
async function scoreAccountLoad(base44, account) {
  let score = 100; // Start perfect
  const reasons = [];

  try {
    // Factor 1: Health status
    if (account.health_status === 'suspended' || account.health_status === 'banned') {
      return { score: 0, available: false, load_score: 100, reason: 'Account suspended/banned' };
    }

    if (account.health_status === 'cooldown') {
      if (account.cooldown_until && new Date(account.cooldown_until) > new Date()) {
        return { score: 0, available: false, load_score: 100, reason: 'Account on cooldown' };
      }
    }

    // Factor 2: Daily application limit
    const tasksToday = account.applications_today || 0;
    const dailyLimit = account.daily_application_limit || 10;
    
    if (tasksToday >= dailyLimit) {
      score -= 50;
      reasons.push(`Hit daily limit (${tasksToday}/${dailyLimit})`);
    } else {
      const utilization = (tasksToday / dailyLimit) * 100;
      score -= utilization * 0.4; // Up to 40 point deduction
      reasons.push(`Daily utilization: ${Math.round(utilization)}%`);
    }

    // Factor 3: Last used (stale accounts are good, recently hammered are bad)
    if (account.last_used) {
      const hoursSinceUse = (Date.now() - new Date(account.last_used).getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceUse < 1) {
        score -= 30; // Just used, may be rate-limited
        reasons.push('Just used (<1h ago)');
      } else if (hoursSinceUse > 24) {
        // Account is cool, good to use
      }
    }

    // Factor 4: Account rating/reputation
    if (account.success_rate) {
      if (account.success_rate < 80) {
        score -= 20;
        reasons.push(`Low success rate: ${account.success_rate}%`);
      }
    }

    // Factor 5: Account age (newer accounts need careful use)
    if (account.created_date) {
      const ageInDays = (Date.now() - new Date(account.created_date).getTime()) / (1000 * 60 * 60 * 24);
      
      if (ageInDays < 7) {
        score -= 25;
        reasons.push('Account <7 days old (high risk)');
      } else if (ageInDays < 30) {
        score -= 10;
        reasons.push('Account <30 days old (moderate risk)');
      }
    }

    const finalScore = Math.max(0, Math.min(100, score));
    
    return {
      score: finalScore,
      load_score: 100 - finalScore, // Inverted (higher = more loaded)
      available: finalScore > 20,
      reason: reasons.join('; ') || 'Account is available'
    };
  } catch (e) {
    return { score: 0, load_score: 100, available: false, reason: `Error: ${e.message}` };
  }
}