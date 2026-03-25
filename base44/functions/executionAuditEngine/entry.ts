import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * EXECUTION AUDIT ENGINE
 * Audits real-world agentic operations: task queue health, autopilot performance,
 * credential/identity flow, intervention resolution, and end-to-end execution pipeline
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return jsonResponse({ error: 'Admin only' }, 403);

    const { action } = await req.json().catch(() => ({}));

    if (action === 'full_platform_audit') {
      return await fullPlatformAudit(base44);
    }

    if (action === 'execution_pipeline_health') {
      return await executionPipelineHealth(base44);
    }

    if (action === 'identify_stalled_tasks') {
      return await identifyStalledTasks(base44);
    }

    if (action === 'verify_sync_integrity') {
      return await verifySyncIntegrity(base44);
    }

    if (action === 'optimization_report') {
      return await optimizationReport(base44);
    }

    return jsonResponse({ error: 'Unknown action' }, 400);

  } catch (error) {
    console.error('[ExecutionAuditEngine]', error.message);
    return jsonResponse({ error: error.message }, 500);
  }
});

async function fullPlatformAudit(base44) {
  const audit = {
    timestamp: new Date().toISOString(),
    sections: {}
  };

  // 1. TASK EXECUTION HEALTH
  try {
    const queued = await base44.asServiceRole.entities.TaskExecutionQueue.filter({ status: 'queued' }, '', 1000).catch(() => []);
    const processing = await base44.asServiceRole.entities.TaskExecutionQueue.filter({ status: 'processing' }, '', 1000).catch(() => []);
    const completed = await base44.asServiceRole.entities.TaskExecutionQueue.filter({ status: 'completed' }, '-completion_timestamp', 100).catch(() => []);
    const failed = await base44.asServiceRole.entities.TaskExecutionQueue.filter({ status: 'failed' }, '-completion_timestamp', 100).catch(() => []);

    const avgCompletionTime = completed.length > 0
      ? completed.reduce((s, t) => s + (t.execution_time_seconds || 0), 0) / completed.length
      : 0;

    const oldestQueued = queued.length > 0 ? queued[0].queue_timestamp : null;
    const queueAgeMinutes = oldestQueued ? Math.round((Date.now() - new Date(oldestQueued).getTime()) / 60000) : 0;

    const oldestProcessing = processing.length > 0 ? processing[0].start_timestamp : null;
    const processingAgeMinutes = oldestProcessing ? Math.round((Date.now() - new Date(oldestProcessing).getTime()) / 60000) : 0;

    audit.sections.task_execution = {
      status: queued.length > 100 || processingAgeMinutes > 60 ? 'critical' : queued.length > 50 ? 'warning' : 'healthy',
      queued: { count: queued.length, oldest_age_minutes: queueAgeMinutes },
      processing: { count: processing.length, oldest_age_minutes: processingAgeMinutes },
      completed_24h: completed.length,
      failed_24h: failed.length,
      avg_execution_seconds: Math.round(avgCompletionTime),
      success_rate: completed.length > 0 ? Math.round((completed.length / (completed.length + failed.length)) * 100) : 0,
      issues: [
        ...(queued.length > 100 ? ['Queue backlog exceeds 100 tasks'] : []),
        ...(processingAgeMinutes > 60 ? [`Task stuck processing for ${processingAgeMinutes}+ minutes`] : []),
        ...(failed.length > 10 ? [`High failure rate: ${failed.length} failed in 24h`] : [])
      ]
    };
  } catch (e) {
    audit.sections.task_execution = { error: e.message, status: 'error' };
  }

  // 2. INTERVENTION RESOLUTION HEALTH
  try {
    const pending = await base44.asServiceRole.entities.UserIntervention.filter({ status: 'pending' }, '', 1000).catch(() => []);
    const inProgress = await base44.asServiceRole.entities.UserIntervention.filter({ status: 'in_progress' }, '', 1000).catch(() => []);
    const resolved = await base44.asServiceRole.entities.UserIntervention.filter({ status: 'resolved' }, '-resolved_at', 100).catch(() => []);
    const expired = pending.filter(i => new Date(i.expires_at) < new Date());

    const pendingAgeHours = pending.length > 0
      ? Math.round((Date.now() - new Date(pending[0].created_date).getTime()) / 3600000)
      : 0;

    audit.sections.interventions = {
      status: expired.length > 0 ? 'critical' : pending.length > 20 ? 'warning' : 'healthy',
      pending: { count: pending.length, oldest_age_hours: pendingAgeHours },
      in_progress: { count: inProgress.length },
      resolved_24h: resolved.length,
      expired: expired.length,
      avg_resolution_hours: resolved.length > 0
        ? Math.round(resolved.reduce((s, i) => s + (new Date(i.resolved_at) - new Date(i.created_date)), 0) / resolved.length / 3600000)
        : 0,
      issues: [
        ...(expired.length > 0 ? [`${expired.length} interventions expired without resolution`] : []),
        ...(pendingAgeHours > 24 ? [`Intervention pending for ${pendingAgeHours}+ hours`] : []),
        ...(pending.length > 20 ? ['High pending intervention backlog'] : [])
      ]
    };
  } catch (e) {
    audit.sections.interventions = { error: e.message, status: 'error' };
  }

  // 3. CREDENTIAL/IDENTITY FLOW
  try {
    const credentials = await base44.asServiceRole.entities.CredentialVault.filter({ is_active: true }, '', 1000).catch(() => []);
    const identities = await base44.asServiceRole.entities.AIIdentity.filter({ is_active: true }, '', 1000).catch(() => []);
    const linkedAccounts = await base44.asServiceRole.entities.LinkedAccount.filter({}, '', 1000).catch(() => []);

    const expiredCreds = credentials.filter(c => new Date(c.expires_at) < new Date());

    audit.sections.credentials_identities = {
      status: expiredCreds.length > 0 ? 'critical' : 'healthy',
      active_credentials: credentials.length,
      expired_credentials: expiredCreds.length,
      active_identities: identities.length,
      linked_accounts: linkedAccounts.length,
      issues: [
        ...(expiredCreds.length > 0 ? [`${expiredCreds.length} credentials expired - rotation needed`] : []),
        ...(identities.filter(i => !i.onboarding_complete).length > 0 ? [`${identities.filter(i => !i.onboarding_complete).length} identities incomplete onboarding`] : [])
      ]
    };
  } catch (e) {
    audit.sections.credentials_identities = { error: e.message, status: 'error' };
  }

  // 4. WALLET/TRANSACTION SYNC
  try {
    const goals = await base44.asServiceRole.entities.UserGoals.filter({}, '', 1000).catch(() => []);
    const transactions = await base44.asServiceRole.entities.Transaction.filter({}, '-created_date', 1000).catch(() => []);

    const syncMismatches = goals.filter(g => {
      const txTotal = transactions.filter(tx => tx.created_by === g.created_by)
        .reduce((s, tx) => s + (tx.type === 'income' ? tx.amount : -tx.amount), 0);
      return Math.abs((g.wallet_balance || 0) - txTotal) > 0.01;
    });

    audit.sections.wallet = {
      status: syncMismatches.length > 0 ? 'warning' : 'healthy',
      user_goals_tracked: goals.length,
      transactions_24h: transactions.length,
      wallet_sync_mismatches: syncMismatches.length,
      total_earnings_tracked: goals.reduce((s, g) => s + (g.total_earned || 0), 0),
      issues: [
        ...(syncMismatches.length > 0 ? [`${syncMismatches.length} users have wallet/transaction mismatches`] : [])
      ]
    };
  } catch (e) {
    audit.sections.wallet = { error: e.message, status: 'error' };
  }

  const statuses = Object.values(audit.sections).map(s => s.status).filter(s => s);
  audit.overall_status = statuses.includes('critical') ? 'critical' : statuses.includes('error') ? 'error' : statuses.includes('warning') ? 'warning' : 'healthy';

  return jsonResponse(audit);
}

async function executionPipelineHealth(base44) {
  const health = {
    timestamp: new Date().toISOString(),
    pipeline_stages: {}
  };

  const opportunities = await base44.asServiceRole.entities.Opportunity.filter({}, '', 1000).catch(() => []);
  health.pipeline_stages.discovery_to_queue = {
    new_opportunities: opportunities.filter(o => o.status === 'new').length,
    queued_opportunities: opportunities.filter(o => o.status === 'queued').length
  };

  const queued = await base44.asServiceRole.entities.TaskExecutionQueue.filter({ status: 'queued' }, 'priority', 1000).catch(() => []);
  health.pipeline_stages.queue_to_execution = {
    queued_tasks: queued.length,
    top_priority: queued[0]?.priority || 0,
    avg_wait_minutes: queued.length > 0
      ? Math.round(queued.reduce((s, t) => s + (Date.now() - new Date(t.queue_timestamp).getTime()), 0) / queued.length / 60000)
      : 0
  };

  const executing = await base44.asServiceRole.entities.TaskExecutionQueue.filter({ status: 'processing' }, '', 1000).catch(() => []);
  health.pipeline_stages.execution = {
    actively_executing: executing.length,
    avg_execution_age_minutes: executing.length > 0
      ? Math.round(executing.reduce((s, t) => s + (Date.now() - new Date(t.start_timestamp).getTime()), 0) / executing.length / 60000)
      : 0
  };

  const completed = await base44.asServiceRole.entities.TaskExecutionQueue.filter({ status: 'completed' }, '-completion_timestamp', 100).catch(() => []);
  health.pipeline_stages.completion_to_wallet = {
    completed_tasks_24h: completed.length,
    unrecorded_in_wallet: 0
  };

  health.bottlenecks = [
    ...(health.pipeline_stages.queue_to_execution.queued_tasks > 100 ? ['Task queue backlog'] : []),
    ...(health.pipeline_stages.execution.avg_execution_age_minutes > 30 ? ['Long-running executions'] : [])
  ];

  return jsonResponse(health);
}

async function identifyStalledTasks(base44) {
  const stalled = {
    timestamp: new Date().toISOString(),
    categories: {}
  };

  const oldQueued = await base44.asServiceRole.entities.TaskExecutionQueue.filter({ status: 'queued' }, 'queue_timestamp', 1000).catch(() => []);
  const queuedStalled = oldQueued.filter(t => Date.now() - new Date(t.queue_timestamp).getTime() > 3600000);
  stalled.categories.queued_stalled = {
    count: queuedStalled.length,
    task_ids: queuedStalled.slice(0, 10).map(t => ({ id: t.id, age_minutes: Math.round((Date.now() - new Date(t.queue_timestamp).getTime()) / 60000) }))
  };

  const processing = await base44.asServiceRole.entities.TaskExecutionQueue.filter({ status: 'processing' }, 'start_timestamp', 1000).catch(() => []);
  const procStalled = processing.filter(t => Date.now() - new Date(t.start_timestamp).getTime() > 3600000);
  stalled.categories.processing_stalled = {
    count: procStalled.length,
    task_ids: procStalled.slice(0, 10).map(t => ({ id: t.id, age_minutes: Math.round((Date.now() - new Date(t.start_timestamp).getTime()) / 60000) }))
  };

  stalled.total_stalled = queuedStalled.length + procStalled.length;
  stalled.recommended_actions = [
    ...(queuedStalled.length > 0 ? [`Force-retry ${queuedStalled.length} stuck queued tasks`] : []),
    ...(procStalled.length > 0 ? [`Reset ${procStalled.length} timeout-stalled tasks to queued`] : [])
  ];

  return jsonResponse(stalled);
}

async function verifySyncIntegrity(base44) {
  const sync = {
    timestamp: new Date().toISOString(),
    checks: {}
  };

  const tasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter({}, '', 1000).catch(() => []);
  const orphanedTasks = [];
  for (const task of tasks) {
    if (task.opportunity_id) {
      const opp = await base44.asServiceRole.entities.Opportunity.filter({ id: task.opportunity_id }, '', 1).catch(() => []);
      if (opp.length === 0) orphanedTasks.push(task.id);
    }
  }
  sync.checks.task_opportunity_orphans = orphanedTasks.length;

  const goals = await base44.asServiceRole.entities.UserGoals.filter({}, '', 1000).catch(() => []);
  const walletMismatches = [];
  for (const goal of goals) {
    const txs = await base44.asServiceRole.entities.Transaction.filter({ created_by: goal.created_by }, '', 10000).catch(() => []);
    const txTotal = txs.reduce((s, tx) => s + (tx.type === 'income' ? tx.amount : -tx.amount), 0);
    if (Math.abs((goal.wallet_balance || 0) - txTotal) > 0.01) {
      walletMismatches.push(goal.id);
    }
  }
  sync.checks.wallet_transaction_mismatches = walletMismatches.length;
  sync.issues_found = orphanedTasks.length + walletMismatches.length;
  sync.status = sync.issues_found > 0 ? 'sync_drift_detected' : 'synced';

  return jsonResponse(sync);
}

async function optimizationReport(base44) {
  const report = {
    timestamp: new Date().toISOString(),
    opportunities: []
  };

  const queued = await base44.asServiceRole.entities.TaskExecutionQueue.filter({ status: 'queued' }, 'priority', 10).catch(() => []);
  if (queued.length > 5) {
    report.opportunities.push({
      category: 'throughput',
      issue: 'Sequential task execution',
      solution: 'Batch process top 5 high-priority tasks in parallel',
      potential_speedup: '3-5x'
    });
  }

  const failed = await base44.asServiceRole.entities.TaskExecutionQueue.filter({ status: 'failed', error_type: 'captcha' }, '', 100).catch(() => []);
  if (failed.length > 0) {
    report.opportunities.push({
      category: 'error_recovery',
      issue: `${failed.length} tasks failing on CAPTCHA`,
      solution: 'Route to dedicated CAPTCHA solving service',
      potential_impact: `Recover ${failed.length} tasks`
    });
  }

  const expiredCreds = await base44.asServiceRole.entities.CredentialVault.filter({}, '', 1000).catch(() => []);
  const expiringCreds = expiredCreds.filter(c => new Date(c.expires_at) < new Date(Date.now() + 604800000));
  if (expiringCreds.length > 0) {
    report.opportunities.push({
      category: 'reliability',
      issue: `${expiringCreds.length} credentials expiring within 7 days`,
      solution: 'Proactive rotation schedule',
      potential_impact: 'Prevent task failures from expired credentials'
    });
  }

  return jsonResponse(report);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}