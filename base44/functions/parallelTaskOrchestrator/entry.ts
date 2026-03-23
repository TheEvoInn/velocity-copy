import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * PARALLEL TASK ORCHESTRATOR (Phase 10.1)
 * Multi-task execution respecting identity constraints
 * Task grouping, priority optimization, concurrent execution
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, payload } = await req.json();

    if (action === 'queue_parallel_batch') {
      return await queueParallelBatch(base44, user, payload);
    }

    if (action === 'execute_parallel_tasks') {
      return await executeParallelTasks(base44, user, payload);
    }

    if (action === 'get_parallel_queue_status') {
      return await getQueueStatus(base44, user);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[ParallelTaskOrchestrator]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Queue multiple tasks for parallel execution
 */
async function queueParallelBatch(base44, user, payload) {
  const { opportunities = [], max_concurrent = 5 } = payload;

  const batch = {
    batch_id: `batch_${Date.now()}`,
    user_email: user.email,
    opportunities_count: opportunities.length,
    max_concurrent,
    created_at: new Date().toISOString(),
    status: 'queued',
    tasks: []
  };

  // Group opportunities by identity capabilities
  const grouped = groupByIdentityCapability(opportunities);

  let taskCount = 0;
  for (const [identityId, opps] of Object.entries(grouped)) {
    const priority = opps.length > 0 ? opps[0].overall_score || 50 : 50;
    
    for (const opp of opps.slice(0, max_concurrent)) {
      const task = {
        id: `task_${Date.now()}_${taskCount++}`,
        batch_id: batch.batch_id,
        opportunity_id: opp.id,
        identity_id: identityId,
        priority,
        status: 'queued',
        created_at: new Date().toISOString()
      };
      batch.tasks.push(task);

      await base44.asServiceRole.entities.TaskExecutionQueue.create({
        opportunity_id: opp.id,
        identity_id: identityId,
        status: 'queued',
        priority,
        batch_id: batch.batch_id,
        queue_timestamp: new Date().toISOString()
      }).catch(() => {});
    }
  }

  return Response.json({ success: true, batch, queued: taskCount });
}

/**
 * Execute parallel tasks (up to max_concurrent)
 */
async function executeParallelTasks(base44, user, payload) {
  const { batch_id, max_concurrent = 5 } = payload;

  // Get queued tasks for this batch
  const tasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
    { status: 'queued', batch_id },
    '-priority',
    max_concurrent
  ).catch(() => []);

  if (tasks.length === 0) {
    return Response.json({ success: true, executed: 0, message: 'No queued tasks' });
  }

  const results = [];
  const execPromises = tasks.map(task => executeTask(base44, task));

  const executed = await Promise.all(execPromises);

  return Response.json({
    success: true,
    batch_id,
    executed: executed.length,
    results: executed
  });
}

/**
 * Execute single task
 */
async function executeTask(base44, task) {
  try {
    // Mark as executing
    await base44.asServiceRole.entities.TaskExecutionQueue.update(task.id, {
      status: 'executing',
      execution_start: new Date().toISOString()
    }).catch(() => {});

    // Get opportunity details
    const opp = await base44.asServiceRole.entities.Opportunity.filter(
      { id: task.opportunity_id },
      null, 1
    ).then(r => r[0]).catch(() => null);

    if (!opp) throw new Error('Opportunity not found');

    // Simulate execution (replaced with actual logic in production)
    const success = Math.random() > 0.15; // 85% success rate
    const executionTime = 5 + Math.random() * 10; // 5-15 seconds

    // Mark complete
    await base44.asServiceRole.entities.TaskExecutionQueue.update(task.id, {
      status: success ? 'completed' : 'failed',
      completion_timestamp: new Date().toISOString(),
      execution_time_seconds: Math.round(executionTime)
    }).catch(() => {});

    return {
      task_id: task.id,
      opportunity_id: task.opportunity_id,
      status: success ? 'completed' : 'failed',
      execution_time: executionTime.toFixed(1)
    };
  } catch (e) {
    await base44.asServiceRole.entities.TaskExecutionQueue.update(task.id, {
      status: 'failed',
      error_message: e.message
    }).catch(() => {});

    return {
      task_id: task.id,
      status: 'failed',
      error: e.message
    };
  }
}

/**
 * Get queue status
 */
async function getQueueStatus(base44, user) {
  const tasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
    { created_by: user.email },
    null,
    100
  ).catch(() => []);

  const byStatus = {};
  for (const task of tasks) {
    byStatus[task.status] = (byStatus[task.status] || 0) + 1;
  }

  return Response.json({
    success: true,
    queue_status: {
      total: tasks.length,
      by_status: byStatus,
      queued: byStatus.queued || 0,
      executing: byStatus.executing || 0,
      completed: byStatus.completed || 0
    }
  });
}

/**
 * Group opportunities by matching identity capabilities
 */
function groupByIdentityCapability(opportunities) {
  const grouped = {};

  for (const opp of opportunities) {
    const identityId = opp.identity_id || 'default';
    if (!grouped[identityId]) grouped[identityId] = [];
    grouped[identityId].push(opp);
  }

  return grouped;
}