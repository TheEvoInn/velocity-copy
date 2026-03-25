import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * AUTONOMOUS OPERATIONS OPTIMIZER
 * Real-time optimization of agentic workflows:
 * - Intelligent task batching
 * - Smart credential routing
 * - Adaptive retry strategies
 * - Dynamic priority rebalancing
 * - End-to-end execution optimization
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.role === 'admin') return jsonResponse({ error: 'Admin only' }, 403);

    const { action } = await req.json().catch(() => ({}));

    if (action === 'optimize_task_queue') {
      return await optimizeTaskQueue(base44);
    }

    if (action === 'intelligent_batching') {
      return await intelligentBatching(base44);
    }

    if (action === 'credential_health_check') {
      return await credentialHealthCheck(base44);
    }

    if (action === 'fix_stalled_workflow') {
      return await fixStalledWorkflow(base44);
    }

    return jsonResponse({ error: 'Unknown action' }, 400);

  } catch (error) {
    console.error('[AutonomousOperationsOptimizer]', error.message);
    return jsonResponse({ error: error.message }, 500);
  }
});

async function optimizeTaskQueue(base44) {
  const optimization = {
    timestamp: new Date().toISOString(),
    actions: []
  };

  try {
    // Get all queued tasks
    const queued = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
      { status: 'queued' },
      '-priority',
      1000
    ).catch(() => []);

    if (queued.length === 0) {
      return jsonResponse({ optimized: false, reason: 'No queued tasks' });
    }

    // Identify and fix stalled queued tasks (>2 hours)
    const stalled = queued.filter(t => 
      Date.now() - new Date(t.queue_timestamp).getTime() > 7200000
    );

    for (const task of stalled) {
      if (task.retry_count < task.max_retries) {
        await base44.asServiceRole.entities.TaskExecutionQueue.update(task.id, {
          retry_count: (task.retry_count || 0) + 1,
          status: 'processing',
          start_timestamp: new Date().toISOString()
        }).catch(e => console.error(`Retry failed for ${task.id}:`, e.message));
        
        optimization.actions.push(`Force-retry stalled task ${task.id}`);
      }
    }

    // Rebalance priority for high-value tasks
    const highValue = queued.filter(t => t.estimated_value > 1000);
    for (const task of highValue) {
      if (task.priority < 80) {
        await base44.asServiceRole.entities.TaskExecutionQueue.update(task.id, {
          priority: 85
        }).catch(() => null);
        optimization.actions.push(`Boosted priority for high-value task ${task.id}`);
      }
    }

    optimization.stalled_recovered = stalled.length;
    optimization.priority_rebalanced = highValue.length;
    optimization.status = 'optimized';

  } catch (e) {
    optimization.error = e.message;
  }

  return jsonResponse(optimization);
}

async function intelligentBatching(base44) {
  const batching = {
    timestamp: new Date().toISOString(),
    batches: []
  };

  try {
    const queued = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
      { status: 'queued' },
      '-priority',
      100
    ).catch(() => []);

    if (queued.length < 2) {
      return jsonResponse({ batches: [], reason: 'Insufficient tasks for batching' });
    }

    // Group by platform for parallel execution
    const byPlatform = {};
    for (const task of queued.slice(0, 20)) {
      if (!byPlatform[task.platform]) byPlatform[task.platform] = [];
      byPlatform[task.platform].push(task);
    }

    // Create batches: same platform + same identity
    for (const [platform, tasks] of Object.entries(byPlatform)) {
      const byIdentity = {};
      for (const task of tasks) {
        if (!byIdentity[task.identity_id]) byIdentity[task.identity_id] = [];
        byIdentity[task.identity_id].push(task);
      }

      for (const [identityId, batchTasks] of Object.entries(byIdentity)) {
        if (batchTasks.length > 1) {
          batching.batches.push({
            platform,
            identity_id: identityId,
            task_ids: batchTasks.map(t => t.id),
            count: batchTasks.length,
            total_value: batchTasks.reduce((s, t) => s + (t.estimated_value || 0), 0)
          });

          // Update all tasks in batch with shared execution context
          for (const task of batchTasks) {
            await base44.asServiceRole.entities.TaskExecutionQueue.update(task.id, {
              batch_id: `batch_${platform}_${identityId}_${Date.now()}`
            }).catch(() => null);
          }
        }
      }
    }

    batching.total_batches = batching.batches.length;
    batching.tasks_batched = batching.batches.reduce((s, b) => s + b.count, 0);

  } catch (e) {
    batching.error = e.message;
  }

  return jsonResponse(batching);
}

async function credentialHealthCheck(base44) {
  const health = {
    timestamp: new Date().toISOString(),
    checks: {}
  };

  try {
    // Check 1: Expired credentials
    const allCreds = await base44.asServiceRole.entities.CredentialVault.filter({}, '', 10000).catch(() => []);
    const expired = allCreds.filter(c => new Date(c.expires_at) < new Date());
    const expiring = allCreds.filter(c => 
      new Date(c.expires_at) > new Date() && 
      new Date(c.expires_at) < new Date(Date.now() + 604800000)
    );

    health.checks.expired_credentials = expired.length;
    health.checks.expiring_in_7days = expiring.length;

    // Disable expired credentials
    for (const cred of expired) {
      await base44.asServiceRole.entities.CredentialVault.update(cred.id, {
        is_active: false
      }).catch(() => null);
    }
    health.actions_taken = `Disabled ${expired.length} expired credentials`;

    // Check 2: Access failures
    const accessLog = await base44.asServiceRole.entities.SecretAuditLog.filter(
      { event_type: 'secret_failed_auth' },
      '-created_date',
      1000
    ).catch(() => []);

    const failuresByPlatform = {};
    for (const log of accessLog) {
      failuresByPlatform[log.platform] = (failuresByPlatform[log.platform] || 0) + 1;
    }
    health.checks.auth_failures_by_platform = failuresByPlatform;

    // Check 3: Credential usage balance
    const linkedAccounts = await base44.asServiceRole.entities.LinkedAccount.filter({}, '', 10000).catch(() => []);
    const underutilized = linkedAccounts.filter(acc => {
      const daysSinceUsed = acc.last_used 
        ? (Date.now() - new Date(acc.last_used).getTime()) / 86400000
        : 999;
      return daysSinceUsed > 7 && acc.health_status === 'healthy';
    });

    health.checks.underutilized_accounts = underutilized.length;
    health.recommendation = underutilized.length > 0 
      ? `Consider deprioritizing ${underutilized.length} unused accounts`
      : 'All accounts actively in use';

    health.status = expired.length > 5 ? 'critical' : expiring.length > 0 ? 'warning' : 'healthy';

  } catch (e) {
    health.error = e.message;
  }

  return jsonResponse(health);
}

async function fixStalledWorkflow(base44) {
  const fix = {
    timestamp: new Date().toISOString(),
    fixes_applied: []
  };

  try {
    // 1. Reset stalled processing tasks
    const processing = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
      { status: 'processing' },
      'start_timestamp',
      1000
    ).catch(() => []);

    const stalled = processing.filter(t => 
      Date.now() - new Date(t.start_timestamp).getTime() > 3600000
    );

    for (const task of stalled) {
      if ((task.retry_count || 0) < (task.max_retries || 2)) {
        await base44.asServiceRole.entities.TaskExecutionQueue.update(task.id, {
          status: 'queued',
          retry_count: (task.retry_count || 0) + 1,
          last_retry_at: new Date().toISOString()
        }).catch(() => null);
        fix.fixes_applied.push(`Reset stalled task ${task.id} to queue (retry ${task.retry_count || 1})`);
      } else {
        await base44.asServiceRole.entities.TaskExecutionQueue.update(task.id, {
          status: 'failed',
          error_message: 'Max retries exceeded - stalled during processing'
        }).catch(() => null);
        fix.fixes_applied.push(`Failed task ${task.id} - max retries exceeded`);
      }
    }

    // 2. Resume interrupted interventions
    const expiredInterventions = await base44.asServiceRole.entities.UserIntervention.filter({
      status: 'pending',
      expires_at: { $lt: new Date().toISOString() }
    }, '', 1000).catch(() => []);

    for (const intervention of expiredInterventions) {
      await base44.asServiceRole.entities.UserIntervention.update(intervention.id, {
        status: 'expired'
      }).catch(() => null);

      // Auto-fail associated task
      if (intervention.task_id) {
        await base44.asServiceRole.entities.TaskExecutionQueue.update(intervention.task_id, {
          status: 'failed',
          error_message: 'User intervention expired'
        }).catch(() => null);
      }

      fix.fixes_applied.push(`Expired intervention ${intervention.id}`);
    }

    // 3. Sync wallet mismatches
    const goals = await base44.asServiceRole.entities.UserGoals.filter({}, '', 1000).catch(() => []);
    for (const goal of goals) {
      const txs = await base44.asServiceRole.entities.Transaction.filter({ created_by: goal.created_by }, '', 10000).catch(() => []);
      const txTotal = txs.reduce((s, tx) => s + (tx.type === 'income' ? tx.amount : -tx.amount), 0);
      
      if (Math.abs((goal.wallet_balance || 0) - txTotal) > 0.01) {
        await base44.asServiceRole.entities.UserGoals.update(goal.id, {
          wallet_balance: txTotal
        }).catch(() => null);
        fix.fixes_applied.push(`Synced wallet for ${goal.created_by}`);
      }
    }

    fix.status = 'workflow_restored';

  } catch (e) {
    fix.error = e.message;
  }

  return jsonResponse(fix);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}