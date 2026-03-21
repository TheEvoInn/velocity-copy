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
   try {
     const queue = await base44.entities.TaskExecutionQueue.list('-priority', 100);
     const safeTasks = Array.isArray(queue) ? queue : [];
     const byPlatform = {};
     const byStatus = {};

     safeTasks.forEach(task => {
       if (!task || !task.id) return;
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
    const executing = (Array.isArray(tasks) ? tasks : []).filter(t => t?.status === 'processing' || t?.status === 'navigating');
    if (executing.length > 1) {
      conflicts.push({
        platform,
        count: executing.length,
        tasks: executing.map(t => ({ id: t.id, opportunity_id: t.opportunity_id }))
      });
    }
  });

  return Response.json({
    total_queued: safeTasks.filter(t => t?.status === 'queued').length,
    total_processing: safeTasks.filter(t => t && ['processing', 'navigating', 'understanding', 'filling', 'submitting'].includes(t.status)).length,
    total_completed: safeTasks.filter(t => t?.status === 'completed').length,
    total_failed: safeTasks.filter(t => t?.status === 'failed').length,
    by_platform: Object.keys(byPlatform).map(p => ({
      platform: p,
      queued: (Array.isArray(byPlatform[p]) ? byPlatform[p] : []).filter(t => t?.status === 'queued').length,
      processing: (Array.isArray(byPlatform[p]) ? byPlatform[p] : []).filter(t => t && ['processing', 'navigating', 'understanding', 'filling', 'submitting'].includes(t.status)).length
    })),
    platform_conflicts: conflicts,
    queue: safeTasks.slice(0, 20)
  });
  } catch (err) {
  console.error('Error getting queue status:', err);
  return Response.json({ error: err.message }, { status: 500 });
  }
}

async function checkPlatformConflicts(base44, payload) {
   const { platform } = payload;
   if (!platform) return Response.json({ error: 'platform required' }, { status: 400 });
   try {
     const queue = await base44.entities.TaskExecutionQueue.filter({
       platform: platform,
       status: { $in: ['processing', 'navigating', 'understanding', 'filling', 'submitting'] }
     });

     const safeTasks = Array.isArray(queue) ? queue : [];
     return Response.json({
       platform,
       is_conflict: safeTasks.length > 1,
       executing_count: safeTasks.length,
       executing_tasks: safeTasks.map(t => ({
         id: t?.id,
         opportunity_id: t?.opportunity_id,
         status: t?.status,
         started_at: t?.start_timestamp
       }))
     });
   } catch (err) {
     console.error('Error checking platform conflicts:', err);
     return Response.json({ error: err.message }, { status: 500 });
   }
 }

async function recalculatePriorities(base44, payload) {
    const { force_recalc } = payload || {};
    try {
      // Fetch all queued tasks
      const queue = (await base44.entities.TaskExecutionQueue.filter({
        status: 'queued'
      }, '', 100).catch(() => [])) || [];

      const opportunities = (await base44.entities.Opportunity.list('', 100).catch(() => [])) || [];
      const safeTasks = Array.isArray(queue) ? queue : [];
      const safeOpps = Array.isArray(opportunities) ? opportunities : [];
      const oppMap = {};
      safeOpps.forEach(o => { if (o && o.id) oppMap[o.id] = o; });

      let updated = 0;
      for (const task of safeTasks) {
        if (!task || !task.id) continue;
        try {
          const opp = oppMap[task.opportunity_id];
          if (!opp || !opp.deadline) continue;

          // Recalculate based on deadline urgency, value, success rate
          const now = new Date();
          let deadline;
          try { deadline = new Date(opp.deadline); } catch { continue; }
          if (isNaN(deadline.getTime())) continue;

          const hoursUntilDeadline = (deadline - now) / (1000 * 60 * 60);

          let newPriority = typeof opp.overall_score === 'number' ? opp.overall_score : 50;

          // Boost urgency if deadline approaching
          if (typeof hoursUntilDeadline === 'number' && hoursUntilDeadline < 24 && hoursUntilDeadline > 0) {
            newPriority = Math.min(100, newPriority + 25);
          } else if (typeof hoursUntilDeadline === 'number' && hoursUntilDeadline < 6) {
            newPriority = 100; // Critical
          }

          // Boost if high value
          if (typeof opp.profit_estimate_high === 'number' && opp.profit_estimate_high > 1000) {
            newPriority = Math.min(100, newPriority + 10);
          }

          // Apply historical success rate
          const successRate = typeof task.success_rate_for_platform === 'number' ? task.success_rate_for_platform : 0.5;
          newPriority = Math.round(newPriority * (0.5 + successRate * 0.5));

          if (typeof newPriority === 'number' && newPriority !== task.priority) {
            await base44.entities.TaskExecutionQueue.update(task.id, {
              priority: newPriority
            }).catch(e => console.error(`Failed to update task ${task.id}:`, e.message));
            updated++;
          }
        } catch (e) {
          console.error(`Error recalculating priority for task ${task?.id}:`, e.message);
        }
      }

    return Response.json({
    success: true,
    tasks_updated: updated,
    total_queued: safeTasks.length
    });
    } catch (err) {
    console.error('Error recalculating priorities:', err);
    return Response.json({ error: err.message }, { status: 500 });
    }
    }

async function pauseLowPriority(base44, payload) {
   const { threshold, max_pause_count } = payload || {};
   const pauseThreshold = typeof threshold === 'number' ? threshold : 40;
   const maxPause = typeof max_pause_count === 'number' ? max_pause_count : 3;

   try {
     const queue = await base44.entities.TaskExecutionQueue.filter({
       status: 'queued',
       priority: { $lt: pauseThreshold }
     }, '-priority', 100);

     const safeTasks = Array.isArray(queue) ? queue : [];
     let paused = 0;
     for (const task of safeTasks.slice(0, maxPause)) {
       if (!task || !task.id) continue;
       await base44.entities.TaskExecutionQueue.update(task.id, {
         status: 'needs_review',
         manual_review_reason: `Auto-paused: priority ${task.priority} below threshold ${pauseThreshold}`
       }).catch(() => {});
       paused++;
     }

     return Response.json({
       success: true,
       tasks_paused: paused,
       threshold: pauseThreshold
     });
   } catch (err) {
     console.error('Error pausing low priority tasks:', err);
     return Response.json({ error: err.message }, { status: 500 });
   }
 }

async function resumePausedTasks(base44, payload) {
   const { priority_threshold } = payload || {};
   const minPriority = typeof priority_threshold === 'number' ? priority_threshold : 50;

   try {
     const paused = await base44.entities.TaskExecutionQueue.filter({
       status: 'needs_review',
       manual_review_reason: { $regex: 'Auto-paused' },
       priority: { $gte: minPriority }
     }, '-priority', 100);

     const safeTasks = Array.isArray(paused) ? paused : [];
     let resumed = 0;
     for (const task of safeTasks) {
       if (!task || !task.id) continue;
       await base44.entities.TaskExecutionQueue.update(task.id, {
         status: 'queued',
         manual_review_reason: null
       }).catch(() => {});
       resumed++;
     }

     return Response.json({
       success: true,
       tasks_resumed: resumed,
       priority_threshold: minPriority
     });
   } catch (err) {
     console.error('Error resuming paused tasks:', err);
     return Response.json({ error: err.message }, { status: 500 });
   }
 }

async function getNextExecutable(base44, payload) {
   const { platform } = payload;
   if (!platform) return Response.json({ error: 'platform required' }, { status: 400 });

   try {
     // Check if platform has executing tasks
     const executing = await base44.entities.TaskExecutionQueue.filter({
       platform: platform,
       status: { $in: ['processing', 'navigating', 'understanding', 'filling', 'submitting'] }
     });

     const safeExecuting = Array.isArray(executing) ? executing : [];
     if (safeExecuting.length > 0) {
       return Response.json({
         can_execute: false,
         reason: `${safeExecuting.length} task(s) already executing on ${platform}`,
         platform_busy: true,
         executing_count: safeExecuting.length
       });
     }

     // Get highest priority queued task
     const candidates = await base44.entities.TaskExecutionQueue.filter({
       platform: platform,
       status: 'queued'
     }, '-priority', 1);

     const safeCandidates = Array.isArray(candidates) ? candidates : [];
     if (safeCandidates.length === 0) {
       return Response.json({
         can_execute: false,
         reason: 'No queued tasks for this platform',
         next_task: null
       });
     }

     return Response.json({
       can_execute: true,
       next_task: safeCandidates[0],
       priority: safeCandidates[0]?.priority || 0
     });
   } catch (err) {
     console.error('Error getting next executable:', err);
     return Response.json({ error: err.message }, { status: 500 });
   }
 }

async function optimizeQueue(base44, payload) {
   try {
     // 1. Recalculate priorities
     await recalculatePriorities(base44, {});

     // 2. Pause very low priority tasks if high-urgency exists
     const allQueue = await base44.entities.TaskExecutionQueue.filter({
       status: 'queued'
     }, '-priority', 100);

     const safeTasks = Array.isArray(allQueue) ? allQueue : [];
     const maxPriority = safeTasks.length > 0 ? Math.max(...safeTasks.map(t => typeof t?.priority === 'number' ? t.priority : 50)) : 50;

     if (maxPriority > 80) {
       // High-urgency task exists, pause low-priority tasks
       await pauseLowPriority(base44, { threshold: 35, max_pause_count: 5 });
     } else if (maxPriority < 50) {
       // No urgent tasks, resume paused tasks
       await resumePausedTasks(base44, { priority_threshold: 40 });
     }

     // 3. Get updated status
     return await getQueueStatus(base44);
   } catch (err) {
     console.error('Error optimizing queue:', err);
     return Response.json({ error: err.message }, { status: 500 });
   }
}