import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * UNIFIED ORCHESTRATOR v3.0 — Full Lifecycle Autopilot Engine
 * Handles: full_cycle, scan_opportunities, execute_queued_tasks,
 *          force_run, toggle_autopilot, get_status, emergency_stop
 * Also handles scheduled automation calls (body may be empty)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Scheduled automation trigger — run full cycle
    if (body.automation && !body.action) {
      const user = await base44.auth.me().catch(() => null);
      return Response.json(await orchestrateFullCycle(base44, user, false));
    }

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const action = body.action || 'full_cycle';

    // Get or create platform state
    let states = await base44.entities.PlatformState.list();
    let platformState = states[0];
    if (!platformState) {
      platformState = await base44.entities.PlatformState.create({
        autopilot_enabled: true,
        autopilot_mode: 'continuous',
        system_health: 'healthy'
      });
    }

    // Emergency stop gate (bypassed by force_run)
    if (platformState.emergency_stop_engaged && action !== 'emergency_stop') {
      return Response.json({ success: false, message: 'Emergency stop engaged — automation paused', state: platformState });
    }

    switch (action) {
      case 'full_cycle':
        if (!platformState.autopilot_enabled) {
          return Response.json({ success: false, message: 'Autopilot is disabled', state: platformState });
        }
        return Response.json(await orchestrateFullCycle(base44, user, false));

      case 'force_run':
        // Force run ignores autopilot_enabled flag and scheduling
        return Response.json(await orchestrateFullCycle(base44, user, true));

      case 'scan_opportunities':
        return Response.json(await runScan(base44, user));

      case 'execute_queued_tasks':
        return Response.json(await executeQueuedTasks(base44, user, body.max_tasks || 5));

      case 'toggle_autopilot': {
        const enabled = body.enabled;
        await base44.entities.PlatformState.update(platformState.id, { autopilot_enabled: enabled });
        // Also sync UserGoals
        const goals = (await base44.entities.UserGoals.list())[0];
        if (goals) await base44.entities.UserGoals.update(goals.id, { autopilot_enabled: enabled });
        await base44.entities.ActivityLog.create({
          action_type: 'system',
          message: `🤖 Autopilot ${enabled ? 'ENABLED' : 'DISABLED'} by user`,
          severity: enabled ? 'success' : 'warning',
          metadata: { triggered_by: user.email }
        });
        return Response.json({ success: true, autopilot_enabled: enabled });
      }

      case 'get_status': {
        const queuedCount = (await base44.entities.TaskExecutionQueue.filter({ status: 'queued' }, null, 100)).length;
        const processingCount = (await base44.entities.TaskExecutionQueue.filter({ status: 'processing' }, null, 100)).length;
        return Response.json({ success: true, state: { ...platformState, queued_count: queuedCount, processing_count: processingCount } });
      }

      case 'emergency_stop':
        await base44.entities.PlatformState.update(platformState.id, {
          emergency_stop_engaged: true,
          autopilot_enabled: false,
          system_health: 'critical'
        });
        await base44.entities.ActivityLog.create({
          action_type: 'alert',
          message: '🚨 EMERGENCY STOP engaged — all automation halted',
          severity: 'critical',
          metadata: { triggered_by: user.email }
        });
        return Response.json({ success: true, message: 'Emergency stop engaged' });

      case 'resume':
        await base44.entities.PlatformState.update(platformState.id, {
          emergency_stop_engaged: false,
          system_health: 'healthy'
        });
        return Response.json({ success: true, message: 'System resumed' });

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[Orchestrator] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * FULL CYCLE: Scan → Identity Check → Queue → Execute → Report
 */
async function orchestrateFullCycle(base44, user, forceRun = false) {
  const cycleStart = Date.now();
  const log = [];
  const addLog = (step, status, details) => {
    log.push({ timestamp: new Date().toISOString(), step, status, details });
    console.log(`[Orchestrator] ${step}: ${details}`);
  };

  const result = {
    timestamp: new Date().toISOString(),
    force_run: forceRun,
    scan_result: null,
    identity_check: null,
    queued: 0,
    executed: 0,
    errors: [],
    execution_log: log
  };

  try {
    // 1. Ensure active identity (inline — avoids cross-function auth issues)
    addLog('identity_check', 'running', 'Ensuring active identity exists');
    const activeIds = await base44.asServiceRole.entities.AIIdentity.filter({ is_active: true }, null, 1);
    let activeIdentity = activeIds[0];
    if (!activeIdentity) {
      const allIds = await base44.asServiceRole.entities.AIIdentity.list('-created_date', 1);
      if (allIds.length) {
        activeIdentity = await base44.asServiceRole.entities.AIIdentity.update(allIds[0].id, { is_active: true });
      } else {
        activeIdentity = await base44.asServiceRole.entities.AIIdentity.create({
          name: 'Default Autopilot Agent',
          role_label: 'Freelancer',
          email: user?.email || '',
          is_active: true,
          skills: ['general', 'writing', 'research', 'communication'],
          bio: 'Autonomous agent optimized for profit generation',
          communication_tone: 'professional'
        });
        addLog('identity_check', 'info', 'Created default identity');
      }
    }
    result.identity_check = activeIdentity?.name || 'unknown';
    addLog('identity_check', 'success', `Identity ready: ${result.identity_check}`);

    // 2. Run opportunity scan
    addLog('scan', 'running', 'Scanning for new opportunities');
    const scanResult = await runScan(base44, user);
    result.scan_result = scanResult;
    addLog('scan', 'success', `Scan complete: ${scanResult.opportunities_found || 0} found, ${scanResult.created || 0} new`);

    // 3. Score new opportunities with AI
    addLog('scoring', 'running', 'AI-scoring new opportunities');
    const newOpps = await base44.asServiceRole.entities.Opportunity.filter(
      { status: 'new', auto_execute: true }, '-created_date', 20
    );
    let scored = 0;
    for (const opp of newOpps.slice(0, 10)) {
      if (!opp.overall_score) {
        try {
          const scoreRes = await base44.asServiceRole.functions.invoke('geminiAI', {
            action: 'score',
            title: opp.title,
            description: opp.description || '',
            category: opp.category,
            platform: opp.platform,
            capital_required: opp.capital_required || 0
          });
          if (scoreRes.data?.scores) {
            await base44.asServiceRole.entities.Opportunity.update(opp.id, {
              velocity_score: scoreRes.data.scores.velocity_score,
              risk_score: scoreRes.data.scores.risk_score,
              overall_score: scoreRes.data.scores.overall_score
            });
            scored++;
          }
        } catch (e) {
          // Non-fatal — proceed without score
        }
      }
    }
    addLog('scoring', 'success', `Scored ${scored} opportunities`);

    // 4. Queue eligible opportunities
    addLog('queue', 'running', 'Queuing eligible opportunities');
    const eligibleOpps = await base44.asServiceRole.entities.Opportunity.filter(
      { status: 'new', auto_execute: true }, '-overall_score', 15
    );

    const activeIdentities = await base44.asServiceRole.entities.AIIdentity.filter({ is_active: true }, null, 1);
    const activeIdentity = activeIdentities[0];

    for (const opp of eligibleOpps.slice(0, forceRun ? 10 : 5)) {
      try {
        // Skip if no URL
        if (!opp.url) {
          addLog('queue', 'skipped', `${opp.title}: No URL`);
          continue;
        }

        const identityId = opp.identity_id || activeIdentity?.id;
        if (!identityId) {
          addLog('queue', 'skipped', `${opp.title}: No identity`);
          continue;
        }

        // Create task in execution queue
        const task = await base44.asServiceRole.entities.TaskExecutionQueue.create({
          opportunity_id: opp.id,
          url: opp.url,
          opportunity_type: opp.opportunity_type || 'other',
          platform: opp.platform,
          identity_id: identityId,
          identity_name: opp.identity_name || activeIdentity?.name,
          status: 'queued',
          priority: opp.overall_score || 50,
          estimated_value: opp.profit_estimate_high || opp.profit_estimate_low || 0,
          deadline: opp.deadline,
          queue_timestamp: new Date().toISOString(),
          max_retries: 2
        });

        // Update opportunity status
        await base44.asServiceRole.entities.Opportunity.update(opp.id, {
          status: 'queued',
          task_execution_id: task.id,
          identity_id: identityId,
          identity_name: activeIdentity?.name
        });

        result.queued++;
        addLog('queue', 'success', `Queued: ${opp.title} (task: ${task.id})`);
      } catch (e) {
        result.errors.push(`Queue failed for ${opp.title}: ${e.message}`);
        addLog('queue', 'error', `${opp.title}: ${e.message}`);
      }
    }

    // 5. Execute queued tasks
    addLog('execute', 'running', `Executing queued tasks (force=${forceRun})`);
    const execResult = await executeQueuedTasks(base44, user, forceRun ? 10 : 3);
    result.executed = execResult.executed;
    result.errors.push(...(execResult.errors || []));
    addLog('execute', 'success', `Executed: ${execResult.executed} tasks`);

    // 6. Update platform state
    const duration = Math.round((Date.now() - cycleStart) / 1000);
    const states = await base44.asServiceRole.entities.PlatformState.list();
    const ps = states[0];
    if (ps) {
      await base44.asServiceRole.entities.PlatformState.update(ps.id, {
        last_cycle_timestamp: new Date().toISOString(),
        cycle_count_today: (ps.cycle_count_today || 0) + 1,
        tasks_completed_today: (ps.tasks_completed_today || 0) + result.executed,
        current_queue_count: result.queued,
        system_health: result.errors.length > 3 ? 'warning' : 'healthy',
        execution_log: log.slice(-50) // Keep last 50 entries
      });
    }

    // 7. Activity log
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `🤖 ${forceRun ? '⚡ FORCE RUN' : 'Autopilot cycle'}: ${result.queued} queued, ${result.executed} executed in ${duration}s`,
      severity: result.errors.length > 0 ? 'warning' : 'success',
      metadata: { queued: result.queued, executed: result.executed, duration_s: duration, errors: result.errors.length }
    });

    result.success = true;
    result.duration_seconds = duration;
    return result;

  } catch (error) {
    addLog('cycle', 'error', error.message);
    result.errors.push(error.message);
    result.success = false;

    // Update platform state with error
    const states = await base44.asServiceRole.entities.PlatformState.list().catch(() => []);
    const ps = states[0];
    if (ps) {
      await base44.asServiceRole.entities.PlatformState.update(ps.id, {
        last_error: error.message,
        last_error_timestamp: new Date().toISOString(),
        error_count_today: (ps.error_count_today || 0) + 1,
        system_health: 'warning'
      }).catch(() => {});
    }

    return result;
  }
}

/**
 * SCAN: Delegates to scanOpportunities function
 */
async function runScan(base44, user) {
  try {
    const scanRes = await base44.asServiceRole.functions.invoke('scanOpportunities', {
      action: 'scan',
      sources: ['ai_web', 'rapidapi'],
      max_results: 20
    });
    return {
      success: true,
      opportunities_found: scanRes.data?.opportunities?.length || scanRes.data?.total || 0,
      created: scanRes.data?.created || 0
    };
  } catch (e) {
    console.error('[Orchestrator] Scan error:', e.message);
    return { success: false, error: e.message, opportunities_found: 0 };
  }
}

/**
 * EXECUTE: Pull queued tasks and run them through agentWorker
 */
async function executeQueuedTasks(base44, user, maxTasks = 3) {
  const errors = [];
  let executed = 0;

  const queuedTasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
    { status: 'queued' }, '-priority', maxTasks * 2
  );

  // Sort: highest priority first, then oldest first
  queuedTasks.sort((a, b) => {
    if (b.priority !== a.priority) return (b.priority || 0) - (a.priority || 0);
    return new Date(a.queue_timestamp || a.created_date) - new Date(b.queue_timestamp || b.created_date);
  });

  const batch = queuedTasks.slice(0, maxTasks);
  console.log(`[Orchestrator] Executing ${batch.length} tasks (${queuedTasks.length} total queued)`);

  for (const task of batch) {
    try {
      // Mark as processing to prevent double-execution
      await base44.asServiceRole.entities.TaskExecutionQueue.update(task.id, {
        status: 'processing',
        start_timestamp: new Date().toISOString()
      });

      // Execute via agentWorker
      const execRes = await base44.asServiceRole.functions.invoke('agentWorker', {
        action: 'execute_task',
        payload: {
          task_id: task.id,
          opportunity_id: task.opportunity_id,
          url: task.url,
          identity_id: task.identity_id,
          platform: task.platform
        }
      });

      if (execRes.data?.success) {
        executed++;
        console.log(`[Orchestrator] Task ${task.id} completed successfully`);
      } else {
        const errMsg = execRes.data?.error || 'Unknown error';
        errors.push(`Task ${task.id}: ${errMsg}`);
        console.error(`[Orchestrator] Task ${task.id} failed: ${errMsg}`);
      }
    } catch (e) {
      errors.push(`Task ${task.id}: ${e.message}`);
      // Revert to queued on exception so retry can pick it up
      await base44.asServiceRole.entities.TaskExecutionQueue.update(task.id, {
        status: 'failed',
        error_message: e.message,
        needs_manual_review: true
      }).catch(() => {});
    }
  }

  return { executed, errors, total_queued: queuedTasks.length };
}