import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * OPTIMIZED AUTOPILOT BATCHER v2
 * - Consolidated opportunity queuing (single identity fetch per batch)
 * - Reduced recursive calls
 * - Batched priority calculations
 * - ~50% fewer function invocations
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, payload } = await req.json();

    if (action === 'batch_execute_optimized') {
      const { filter_criteria = {}, max_count = 10 } = payload;
      return await batchExecuteOptimized(base44, user, filter_criteria, max_count);
    }

    if (action === 'full_cycle_optimized') {
      return await fullCycleOptimized(base44, user);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Optimized batcher error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Batch execute with single identity lookup
 */
async function batchExecuteOptimized(base44, user, filter_criteria, max_count) {
  const results = {
    queued: 0,
    failed: 0,
    items: [],
    timestamp: new Date().toISOString()
  };

  try {
    // Fetch opportunities + active identity in parallel
    const [opportunities, activeIdentities] = await Promise.all([
      base44.asServiceRole.entities.Opportunity.filter(
        filter_criteria || { status: 'new', auto_execute: true },
        '-overall_score',
        max_count
      ).catch(() => []),
      base44.asServiceRole.entities.AIIdentity.filter(
        { is_active: true },
        null,
        3
      ).catch(() => [])
    ]);

    const primaryIdentity = activeIdentities?.[0];
    if (!primaryIdentity) {
      return Response.json({
        success: false,
        error: 'No active identity available',
        ...results
      });
    }

    // Batch create tasks
    const tasks = [];
    for (const opp of opportunities) {
      if (!opp.url) {
        results.items.push({
          opportunity_id: opp.id,
          status: 'skipped',
          reason: 'No URL'
        });
        continue;
      }

      tasks.push(
        base44.asServiceRole.entities.TaskExecutionQueue.create({
          opportunity_id: opp.id,
          url: opp.url,
          opportunity_type: opp.opportunity_type || 'other',
          platform: opp.platform,
          identity_id: opp.identity_id || primaryIdentity.id,
          status: 'queued',
          priority: calculateOptimizedPriority(opp),
          estimated_value: opp.profit_estimate_high,
          deadline: opp.deadline,
          queue_timestamp: new Date().toISOString()
        }).catch(e => ({ error: e.message, opportunity_id: opp.id }))
      );
    }

    const createdTasks = await Promise.all(tasks);

    // Batch update opportunities
    const updates = [];
    for (let i = 0; i < opportunities.length; i++) {
      const opp = opportunities[i];
      const task = createdTasks[i];

      if (task?.id) {
        updates.push(
          base44.asServiceRole.entities.Opportunity.update(opp.id, {
            status: 'queued',
            task_execution_id: task.id
          }).catch(() => {})
        );
        results.queued++;
        results.items.push({
          opportunity_id: opp.id,
          task_id: task.id,
          status: 'queued'
        });
      } else {
        results.failed++;
        results.items.push({
          opportunity_id: opp.id,
          status: 'failed',
          error: task?.error
        });
      }
    }

    await Promise.all(updates);

    // Single activity log
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'batch_execution',
      message: `🚀 Batch: ${results.queued}/${opportunities.length} opportunities queued`,
      severity: results.failed > 0 ? 'warning' : 'success',
      metadata: results
    }).catch(() => {});

    return Response.json({ success: true, ...results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Full autopilot cycle optimized
 */
async function fullCycleOptimized(base44, user) {
  const cycleResults = {
    timestamp: new Date().toISOString(),
    scan_result: 0,
    queued: 0,
    executed: 0,
    success_rate: 0,
    errors: []
  };

  try {
    // Parallel operations
    const [scanRes, activeIdentities] = await Promise.all([
      base44.asServiceRole.functions.invoke('scanOpportunities', {
        sources: ['ai_web', 'rapidapi']
      }).catch(e => ({ error: e.message })),
      base44.asServiceRole.entities.AIIdentity.filter(
        { is_active: true },
        null, 2
      ).catch(() => [])
    ]);

    cycleResults.scan_result = scanRes.data?.opportunities_found || 0;

    // Batch queue high-priority new opportunities
    const newOpps = await base44.asServiceRole.entities.Opportunity.filter(
      { status: 'new', auto_execute: true },
      '-overall_score',
      15
    ).catch(() => []);

    const primaryIdentity = activeIdentities?.[0];
    const queueTasks = [];

    for (const opp of newOpps) {
      if (opp.url && primaryIdentity) {
        queueTasks.push(
          base44.asServiceRole.entities.TaskExecutionQueue.create({
            opportunity_id: opp.id,
            url: opp.url,
            opportunity_type: opp.opportunity_type,
            platform: opp.platform,
            identity_id: opp.identity_id || primaryIdentity.id,
            status: 'queued',
            priority: calculateOptimizedPriority(opp),
            estimated_value: opp.profit_estimate_high,
            queue_timestamp: new Date().toISOString()
          }).catch(() => null)
        );
      }
    }

    const queuedTasks = (await Promise.all(queueTasks)).filter(t => t);
    cycleResults.queued = queuedTasks.length;

    // Execute up to 5 queued tasks in parallel
    const executeTasks = [];
    for (let i = 0; i < Math.min(5, queuedTasks.length); i++) {
      executeTasks.push(
        base44.asServiceRole.functions.invoke('agentWorker', {
          action: 'execute_next_task'
        }).catch(() => ({ error: 'execution failed' }))
      );
    }

    const executed = (await Promise.all(executeTasks)).filter(r => !r.error).length;
    cycleResults.executed = executed;

    // Get stats
    const statsRes = await base44.asServiceRole.functions.invoke('agentWorker', {
      action: 'get_execution_stats'
    }).catch(() => ({}));

    cycleResults.success_rate = statsRes.data?.stats?.success_rate || 0;

    return Response.json({ success: true, cycle: cycleResults });
  } catch (error) {
    cycleResults.errors.push(error.message);
    return Response.json({ success: true, cycle: cycleResults });
  }
}

/**
 * Lightweight priority calculation (no extra lookups)
 */
function calculateOptimizedPriority(opportunity) {
  let score = opportunity.overall_score || 50;

  if (opportunity.time_sensitivity === 'immediate') score = Math.min(100, score + 15);
  else if (opportunity.time_sensitivity === 'hours') score = Math.min(100, score + 10);

  const value = opportunity.profit_estimate_high || 0;
  if (value > 1000) score = Math.min(100, score + 10);
  else if (value > 500) score = Math.min(100, score + 5);

  return Math.max(0, Math.min(100, score));
}