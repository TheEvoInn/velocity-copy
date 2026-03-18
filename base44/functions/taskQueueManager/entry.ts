import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Intelligent Task Queue Manager
 * - Prevents overlapping executions on same platform
 * - Recalculates priorities based on urgency
 * - Pauses low-priority tasks when high-urgency opportunities arise
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, payload } = await req.json();

    switch (action) {
      case 'get_queue_status':
        return await getQueueStatus(base44);
      
      case 'optimize_queue':
        return await optimizeQueue(base44, payload);
      
      case 'check_platform_conflicts':
        return await checkPlatformConflicts(base44, payload);
      
      case 'recalculate_priorities':
        return await recalculatePriorities(base44, payload);
      
      case 'pause_low_priority':
        return await pauseLowPriority(base44, payload);
      
      case 'resume_paused_tasks':
        return await resumePausedTasks(base44, payload);
      
      case 'get_next_executable':
        return await getNextExecutable(base44, payload);
      
      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Task queue manager error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function getQueueStatus(base44) {
  const queue = await base44.entities.TaskExecutionQueue.list('-priority', 100);
  const byPlatform = {};
  const byStatus = {};

  queue.forEach(task => {
    // Group by platform
    if (!byPlatform[task.platform]) {
      byPlatform[task.platform] = [];
    }
    byPlatform[task.platform].push(task);

    // Group by status
    if (!byStatus[task.status]) {
      byStatus[task.status] = [];
    }
    byStatus[task.status].push(task);
  });

  // Check for overlapping executions
  const conflicts = [];
  Object.entries(byPlatform).forEach(([platform, tasks]) => {
    const executing = tasks.filter(t => t.status === 'processing' || t.status === 'navigating');
    if (executing.length > 1) {
      conflicts.push({
        platform,
        count: executing.length,
        tasks: executing.map(t => ({ id: t.id, opportunity_id: t.opportunity_id }))
      });
    }
  });

  return Response.json({
    total_queued: queue.filter(t => t.status === 'queued').length,
    total_processing: queue.filter(t => ['processing', 'navigating', 'understanding', 'filling', 'submitting'].includes(t.status)).length,
    total_completed: queue.filter(t => t.status === 'completed').length,
    total_failed: queue.filter(t => t.status === 'failed').length,
    by_platform: Object.keys(byPlatform).map(p => ({
      platform: p,
      queued: byPlatform[p].filter(t => t.status === 'queued').length,
      processing: byPlatform[p].filter(t => ['processing', 'navigating', 'understanding', 'filling', 'submitting'].includes(t.status)).length
    })),
    platform_conflicts: conflicts,
    queue: queue.slice(0, 20)
  });
}

async function checkPlatformConflicts(base44, payload) {
  const { platform } = payload;
  const queue = await base44.entities.TaskExecutionQueue.filter({
    platform: platform,
    status: { $in: ['processing', 'navigating', 'understanding', 'filling', 'submitting'] }
  });

  return Response.json({
    platform,
    is_conflict: queue.length > 1,
    executing_count: queue.length,
    executing_tasks: queue.map(t => ({
      id: t.id,
      opportunity_id: t.opportunity_id,
      status: t.status,
      started_at: t.start_timestamp
    }))
  });
}

async function recalculatePriorities(base44, payload) {
  const { force_recalc } = payload || {};
  
  // Fetch all queued tasks
  const queue = await base44.entities.TaskExecutionQueue.filter({
    status: 'queued'
  }, '', 100);

  const opportunities = await base44.entities.Opportunity.list('', 100);
  const oppMap = {};
  opportunities.forEach(o => oppMap[o.id] = o);

  let updated = 0;
  for (const task of queue) {
    const opp = oppMap[task.opportunity_id];
    if (!opp) continue;

    // Recalculate based on:
    // 1. Deadline urgency (high if < 24 hours)
    // 2. Estimated value
    // 3. Historical success rate
    const now = new Date();
    const deadline = new Date(opp.deadline);
    const hoursUntilDeadline = (deadline - now) / (1000 * 60 * 60);

    let newPriority = opp.overall_score || 50;

    // Boost urgency if deadline approaching
    if (hoursUntilDeadline < 24 && hoursUntilDeadline > 0) {
      newPriority = Math.min(100, newPriority + 25);
    } else if (hoursUntilDeadline < 6) {
      newPriority = 100; // Critical
    }

    // Boost if high value
    if (opp.profit_estimate_high > 1000) {
      newPriority = Math.min(100, newPriority + 10);
    }

    // Apply historical success rate
    const successRate = task.success_rate_for_platform || 0.5;
    newPriority = Math.round(newPriority * (0.5 + successRate * 0.5));

    if (newPriority !== task.priority) {
      await base44.entities.TaskExecutionQueue.update(task.id, {
        priority: newPriority
      });
      updated++;
    }
  }

  return Response.json({
    success: true,
    tasks_updated: updated,
    total_queued: queue.length
  });
}

async function pauseLowPriority(base44, payload) {
  const { threshold, max_pause_count } = payload;
  const pauseThreshold = threshold || 40;
  const maxPause = max_pause_count || 3;

  const queue = await base44.entities.TaskExecutionQueue.filter({
    status: 'queued',
    priority: { $lt: pauseThreshold }
  }, '-priority', 100);

  let paused = 0;
  for (const task of queue.slice(0, maxPause)) {
    await base44.entities.TaskExecutionQueue.update(task.id, {
      status: 'needs_review',
      manual_review_reason: `Auto-paused: priority ${task.priority} below threshold ${pauseThreshold}`
    });
    paused++;
  }

  return Response.json({
    success: true,
    tasks_paused: paused,
    threshold: pauseThreshold
  });
}

async function resumePausedTasks(base44, payload) {
  const { priority_threshold } = payload;
  const minPriority = priority_threshold || 50;

  const paused = await base44.entities.TaskExecutionQueue.filter({
    status: 'needs_review',
    manual_review_reason: { $regex: 'Auto-paused' },
    priority: { $gte: minPriority }
  }, '-priority', 100);

  let resumed = 0;
  for (const task of paused) {
    await base44.entities.TaskExecutionQueue.update(task.id, {
      status: 'queued',
      manual_review_reason: null
    });
    resumed++;
  }

  return Response.json({
    success: true,
    tasks_resumed: resumed,
    priority_threshold: minPriority
  });
}

async function getNextExecutable(base44, payload) {
  const { platform } = payload;

  // Check if platform has executing tasks
  const executing = await base44.entities.TaskExecutionQueue.filter({
    platform: platform,
    status: { $in: ['processing', 'navigating', 'understanding', 'filling', 'submitting'] }
  });

  if (executing.length > 0) {
    return Response.json({
      can_execute: false,
      reason: `${executing.length} task(s) already executing on ${platform}`,
      platform_busy: true,
      executing_count: executing.length
    });
  }

  // Get highest priority queued task
  const candidates = await base44.entities.TaskExecutionQueue.filter({
    platform: platform,
    status: 'queued'
  }, '-priority', 1);

  if (candidates.length === 0) {
    return Response.json({
      can_execute: false,
      reason: 'No queued tasks for this platform',
      next_task: null
    });
  }

  return Response.json({
    can_execute: true,
    next_task: candidates[0],
    priority: candidates[0].priority
  });
}

async function optimizeQueue(base44, payload) {
  // 1. Recalculate priorities
  await recalculatePriorities(base44, {});

  // 2. Pause very low priority tasks if high-urgency exists
  const allQueue = await base44.entities.TaskExecutionQueue.filter({
    status: 'queued'
  }, '-priority', 100);

  const maxPriority = Math.max(...allQueue.map(t => t.priority), 50);
  
  if (maxPriority > 80) {
    // High-urgency task exists, pause low-priority tasks
    await pauseLowPriority(base44, { threshold: 35, max_pause_count: 5 });
  } else if (maxPriority < 50) {
    // No urgent tasks, resume paused tasks
    await resumePausedTasks(base44, { priority_threshold: 40 });
  }

  // 3. Get updated status
  return await getQueueStatus(base44);
}