/**
 * AUTOPILOT TASK EXECUTOR v2.0
 * Real-world execution engine: queues → executes → reports
 * Uses actual browser automation + credential vault lookup
 * NO LLM content generation — real execution only
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    if (action === 'queue_bulk_tasks') {
      return await queueBulkTasks(base44, body);
    }

    if (action === 'execute_queued_tasks') {
      return await executeQueuedTasks(base44, body);
    }

    if (action === 'get_task_status') {
      return await getTaskStatus(base44, body.task_id);
    }

    if (action === 'get_queue_stats') {
      return await getQueueStats(base44);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[AutopilotTaskExecutor]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function queueBulkTasks(base44, body) {
  const { opportunities, identity_id } = body;
  const results = [];

  // Get active identity if none specified
  let identity = null;
  if (identity_id) {
    const ids = await base44.asServiceRole.entities.AIIdentity.filter({ id: identity_id }, null, 1).catch(() => []);
    identity = ids[0];
  } else {
    const ids = await base44.asServiceRole.entities.AIIdentity.filter({ is_active: true }, null, 1).catch(() => []);
    identity = ids[0];
  }

  if (!identity) {
    return Response.json({ success: false, error: 'No active identity found', queued: 0 });
  }

  // Queue each opportunity
  for (const opp of (opportunities || []).slice(0, 20)) {
    try {
      if (!opp.url) {
        results.push({ opportunity_id: opp.id, skipped: true, reason: 'No URL' });
        continue;
      }

      const task = await base44.asServiceRole.entities.TaskExecutionQueue.create({
        opportunity_id: opp.id,
        url: opp.url,
        opportunity_type: opp.opportunity_type || 'other',
        platform: opp.platform,
        identity_id: identity.id,
        status: 'queued',
        priority: opp.overall_score || 50,
        estimated_value: opp.profit_estimate_high || 0,
        queue_timestamp: new Date().toISOString()
      });

      // Update opportunity
      await base44.asServiceRole.entities.Opportunity.update(opp.id, {
        status: 'queued',
        task_execution_id: task.id,
        identity_id: identity.id,
        identity_name: identity.name
      }).catch(() => null);

      results.push({ opportunity_id: opp.id, task_id: task.id, queued: true });
    } catch (e) {
      results.push({ opportunity_id: opp.id, error: e.message });
    }
  }

  const queued = results.filter(r => r.queued).length;
  await base44.asServiceRole.entities.ActivityLog.create({
    action_type: 'system',
    message: `🎯 Queued ${queued} tasks for execution (${identity.name})`,
    severity: 'info',
    metadata: { queued, total: opportunities?.length || 0, identity: identity.name }
  }).catch(() => null);

  return Response.json({
    success: true,
    queued,
    total: opportunities?.length || 0,
    identity: identity.name,
    results
  });
}

async function executeQueuedTasks(base44, body) {
  const { max_concurrent = 5 } = body;
  const results = [];
  let executed = 0;

  // Get top N queued tasks by priority
  const tasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
    { status: 'queued' },
    '-priority',
    max_concurrent
  ).catch(() => []);

  if (tasks.length === 0) {
    return Response.json({ success: true, executed: 0, message: 'No queued tasks' });
  }

  // Execute each task
  for (const task of tasks) {
    try {
      const res = await base44.asServiceRole.functions.invoke('agentWorker', {
        action: 'execute_next_task'
      }).catch(e => ({ data: { success: false, error: e.message } }));

      if (res.data?.success) {
        executed++;
        results.push({
          task_id: task.id,
          status: 'executed',
          opportunity_id: task.opportunity_id
        });
      } else {
        results.push({
          task_id: task.id,
          status: 'failed',
          error: res.data?.error
        });
      }
    } catch (e) {
      results.push({
        task_id: task.id,
        status: 'error',
        error: e.message
      });
    }
  }

  await base44.asServiceRole.entities.ActivityLog.create({
    action_type: 'system',
    message: `🚀 Executed ${executed}/${tasks.length} tasks`,
    severity: 'info',
    metadata: { executed, total: tasks.length }
  }).catch(() => null);

  return Response.json({
    success: true,
    executed,
    total: tasks.length,
    results
  });
}

async function getTaskStatus(base44, task_id) {
  const tasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
    { id: task_id },
    null,
    1
  ).catch(() => []);

  if (!tasks.length) {
    return Response.json({ success: false, error: 'Task not found' }, { status: 404 });
  }

  const task = tasks[0];
  return Response.json({
    success: true,
    task: {
      id: task.id,
      status: task.status,
      opportunity_id: task.opportunity_id,
      platform: task.platform,
      priority: task.priority,
      estimated_value: task.estimated_value,
      queue_timestamp: task.queue_timestamp,
      start_timestamp: task.start_timestamp,
      completion_timestamp: task.completion_timestamp,
      error_message: task.error_message
    }
  });
}

async function getQueueStats(base44) {
  const tasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter({}, null, 1000).catch(() => []);

  const stats = {
    total: tasks.length,
    by_status: {},
    total_value: 0,
    success_rate: 0
  };

  let completed = 0;
  for (const t of tasks) {
    stats.by_status[t.status] = (stats.by_status[t.status] || 0) + 1;
    stats.total_value += t.estimated_value || 0;
    if (t.status === 'completed') completed++;
  }

  stats.success_rate = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

  return Response.json({
    success: true,
    stats
  });
}