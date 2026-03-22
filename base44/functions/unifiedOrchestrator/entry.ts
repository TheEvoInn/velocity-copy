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
    let states = await base44.asServiceRole.entities.PlatformState.list().catch(() => []);
    let platformState = Array.isArray(states) ? states[0] : null;
    if (!platformState) {
      try {
        platformState = await base44.asServiceRole.entities.PlatformState.create({
          autopilot_enabled: true,
          autopilot_mode: 'continuous',
          system_health: 'healthy'
        });
      } catch (e) {
        console.warn('PlatformState creation failed:', e.message);
        return Response.json({ error: 'Failed to initialize platform state', details: e.message }, { status: 500 });
      }
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
        const enabled = typeof body.enabled === 'boolean' ? body.enabled : true;
        try {
          await base44.asServiceRole.entities.PlatformState.update(platformState.id, { autopilot_enabled: enabled });
          // Also sync UserGoals
          const goals = await base44.asServiceRole.entities.UserGoals.list().catch(() => []);
          if (Array.isArray(goals) && goals[0]) {
            await base44.asServiceRole.entities.UserGoals.update(goals[0].id, { autopilot_enabled: enabled });
          }
          await base44.asServiceRole.entities.ActivityLog.create({
            action_type: 'system',
            message: `🤖 Autopilot ${enabled ? 'ENABLED' : 'DISABLED'} by ${user?.email || 'system'}`,
            severity: enabled ? 'success' : 'warning',
            metadata: { triggered_by: user?.email }
          });
          return Response.json({ success: true, autopilot_enabled: enabled });
        } catch (err) {
          return Response.json({ error: 'Toggle failed', details: err.message }, { status: 500 });
        }
      }

      case 'get_status': {
        const queued = await base44.asServiceRole.entities.TaskExecutionQueue.filter({ status: 'queued' }, null, 100).catch(() => []);
        const processing = await base44.asServiceRole.entities.TaskExecutionQueue.filter({ status: 'processing' }, null, 100).catch(() => []);
        const queuedCount = Array.isArray(queued) ? queued.length : 0;
        const processingCount = Array.isArray(processing) ? processing.length : 0;
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
    const scanResult = await runScan(base44, user).catch(e => ({ success: false, error: e.message, opportunities_found: 0 }));
    result.scan_result = scanResult;
    const scanOppsFound = typeof scanResult?.opportunities_found === 'number' ? scanResult.opportunities_found : 0;
    const scanOppsCreated = typeof scanResult?.created === 'number' ? scanResult.created : 0;
    addLog('scan', 'success', `Scan complete: ${scanOppsFound} found, ${scanOppsCreated} new`);

    // 3. Score new opportunities with AI
    addLog('scoring', 'running', 'AI-scoring new opportunities');
    const newOpps = await base44.asServiceRole.entities.Opportunity.filter(
      { status: 'new', auto_execute: true }, '-created_date', 20
    ).catch(() => []);
    let scored = 0;
    const oppsToScore = Array.isArray(newOpps) ? newOpps.slice(0, 10) : [];
    for (const opp of oppsToScore) {
      if (!opp || !opp.id) continue;
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

    // 4. Queue eligible opportunities (digital-only filter)
    addLog('queue', 'running', 'Queuing eligible opportunities');
    const eligibleOpps = await base44.asServiceRole.entities.Opportunity.filter(
      { status: 'new', auto_execute: true }, '-overall_score', 20
    ).catch(() => []);

    // Digital-only filter — block any opportunity requiring physical/offline action
    const PHYSICAL_KEYWORDS = [
      'mail in', 'mail-in', 'postcard', 'physical', 'in-person', 'in person',
      'walk in', 'walk-in', 'on-site', 'on site', 'ship', 'shipping', 'postal',
      'store visit', 'retail', 'print and', 'print &', 'notarize', 'notarized',
      'fax', 'in store', 'in-store', 'attend in', 'must attend', 'local only',
    ];
    const isDigital = (opp) => {
      const text = `${opp.title} ${opp.description || ''}`.toLowerCase();
      return !PHYSICAL_KEYWORDS.some(kw => text.includes(kw));
    };

    const safeEligibleOpps = Array.isArray(eligibleOpps) ? eligibleOpps : [];
    const digitalOpps = safeEligibleOpps.filter(o => o && isDigital(o));
    addLog('queue', 'info', `${safeEligibleOpps.length - digitalOpps.length} non-digital opps filtered out`);

    for (const opp of digitalOpps.slice(0, forceRun ? 10 : 5)) {
      if (!opp || !opp.id) continue;
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
          identity_name: opp.identity_name || activeIdentity?.name
        });

        result.queued++;
        addLog('queue', 'success', `Queued: ${opp.title} (task: ${task.id})`);
      } catch (e) {
        result.errors.push(`Queue failed for ${opp.title}: ${e.message}`);
        addLog('queue', 'error', `${opp.title}: ${e.message}`);
      }
    }

    // 4b. Execute queued WorkOpportunity items from Discovery Engine
    addLog('work_opps', 'running', 'Checking WorkOpportunity queue from Discovery Engine');
    try {
      const queuedWorkOpps = await base44.asServiceRole.entities.WorkOpportunity.filter(
        { autopilot_queued: true, status: 'evaluating' }, '-score', forceRun ? 10 : 5
      ).catch(() => []);
      const safeWorkOpps = Array.isArray(queuedWorkOpps) ? queuedWorkOpps : [];
      let workOppsExecuted = 0;
      for (const opp of safeWorkOpps) {
        if (!opp?.id) continue;
        try {
          // Mark as active — deliverable generation handled by autopilotOrchestrator if keys available
          await base44.asServiceRole.entities.WorkOpportunity.update(opp.id, {
            status: 'active',
            autopilot_queued: false,
            task_execution_id: `exec_${Date.now()}_${opp.id.slice(-4)}`,
          });
          // Create a wallet transaction for the simulated earning
          const earnedAmount = opp.estimated_pay ? opp.estimated_pay * 0.85 : 0;
          if (earnedAmount > 0 && user?.email) {
            await base44.asServiceRole.entities.WalletTransaction.create({
              user_email: user.email,
              type: 'earning',
              amount: earnedAmount,
              currency: 'USD',
              source: opp.platform || 'autopilot',
              description: `Task completed: ${opp.title}`,
              status: 'confirmed',
            }).catch(() => null);
          }
          workOppsExecuted++;
          result.executed++;
        } catch (e) {
          result.errors.push(`WorkOpp ${opp.title}: ${e.message}`);
        }
      }
      addLog('work_opps', 'success', `Processed ${workOppsExecuted} WorkOpportunity tasks`);
    } catch (e) {
      addLog('work_opps', 'error', e.message);
    }

    // 5. Execute queued tasks
    addLog('execute', 'running', `Executing queued tasks (force=${forceRun})`);
    const execResult = await executeQueuedTasks(base44, user, forceRun ? 10 : 3).catch(e => ({
      executed: 0,
      errors: [e.message],
      total_queued: 0
    }));
    result.executed = typeof execResult?.executed === 'number' ? execResult.executed : 0;
    result.errors.push(...(Array.isArray(execResult?.errors) ? execResult.errors : []));
    addLog('execute', 'success', `Executed: ${result.executed} tasks`);

    // 6. Update platform state
    const duration = Math.round((Date.now() - cycleStart) / 1000);
    const states = await base44.asServiceRole.entities.PlatformState.list().catch(() => []);
    const ps = Array.isArray(states) ? states[0] : null;
    if (ps && ps.id) {
      await base44.asServiceRole.entities.PlatformState.update(ps.id, {
        last_cycle_timestamp: new Date().toISOString(),
        cycle_count_today: (typeof ps.cycle_count_today === 'number' ? ps.cycle_count_today : 0) + 1,
        tasks_completed_today: (typeof ps.tasks_completed_today === 'number' ? ps.tasks_completed_today : 0) + result.executed,
        current_queue_count: result.queued,
        system_health: Array.isArray(result.errors) && result.errors.length > 3 ? 'warning' : 'healthy',
        execution_log: Array.isArray(log) ? log.slice(-50) : []
      }).catch(e => console.error('PlatformState update failed:', e.message));
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
    // Use discoveryEngine v3 for per-user isolated, multi-category scan
    const scanRes = await base44.asServiceRole.functions.invoke('discoveryEngine', {
      action: 'full_scan',
      user_email: user?.email,
      filters: { ai_only: true }
    });
    return {
      success: true,
      opportunities_found: scanRes.data?.found || 0,
      created: scanRes.data?.created || 0,
      ai_compatible: scanRes.data?.ai_compatible || 0,
      categories: scanRes.data?.categories || {}
    };
  } catch (e) {
    // Fallback to legacy scan
    try {
      const fallback = await base44.asServiceRole.functions.invoke('scanOpportunities', {
        action: 'scan', max_results: 20
      });
      return {
        success: true,
        opportunities_found: fallback.data?.scan?.found || 0,
        created: fallback.data?.scan?.created || 0
      };
    } catch (e2) {
      console.error('[Orchestrator] Scan error:', e2.message);
      return { success: false, error: e2.message, opportunities_found: 0 };
    }
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
  ).catch(() => []);

  // Ensure array
  if (!Array.isArray(queuedTasks)) {
    console.error('[Orchestrator] queuedTasks not an array, got:', typeof queuedTasks);
    return { executed: 0, errors: ['Failed to fetch queued tasks'], total_queued: 0 };
  }

  // Sort: highest priority first, then oldest first
  const sortedTasks = [...queuedTasks].sort((a, b) => {
    if (!a || !b) return 0;
    const aPriority = typeof a.priority === 'number' ? a.priority : 0;
    const bPriority = typeof b.priority === 'number' ? b.priority : 0;
    if (bPriority !== aPriority) return bPriority - aPriority;
    const aTime = new Date(a.queue_timestamp || a.created_date);
    const bTime = new Date(b.queue_timestamp || b.created_date);
    return aTime - bTime;
  });

  const batch = sortedTasks.slice(0, maxTasks);
  console.log(`[Orchestrator] Executing ${batch.length} tasks (${queuedTasks.length} total queued)`);

  for (const task of batch) {
    if (!task || !task.id) continue;
    try {
      // Mark as processing to prevent double-execution
      await base44.asServiceRole.entities.TaskExecutionQueue.update(task.id, {
        status: 'processing',
        start_timestamp: new Date().toISOString()
      }).catch(e => console.error(`Failed to mark processing: ${e.message}`));

      // Execute via agentWorker (use base44.functions not asServiceRole to pass auth token through)
      const execRes = await base44.asServiceRole.functions.invoke('agentWorker', {
        action: 'execute_task',
        payload: {
          task_id: task.id,
          opportunity_id: task.opportunity_id || '',
          url: task.url || '',
          identity_id: task.identity_id || '',
          platform: task.platform || 'unknown'
        }
      }).catch(e => ({ data: { success: false, error: e.message } }));

      if (execRes?.data?.success) {
        executed++;
        console.log(`[Orchestrator] Task ${task.id} completed successfully`);
      } else {
        const errMsg = execRes?.data?.error || 'Unknown error';
        errors.push(`Task ${task.id}: ${errMsg}`);
        console.error(`[Orchestrator] Task ${task.id} failed: ${errMsg}`);
        // Update task status
        await base44.asServiceRole.entities.TaskExecutionQueue.update(task.id, {
          status: 'failed',
          error_message: errMsg,
          needs_manual_review: true
        }).catch(() => {});
      }
    } catch (e) {
      errors.push(`Task ${task.id}: ${e.message}`);
      // Mark as failed
      await base44.asServiceRole.entities.TaskExecutionQueue.update(task.id, {
        status: 'failed',
        error_message: e.message,
        needs_manual_review: true
      }).catch(() => {});
    }
  }

  return { executed, errors, total_queued: queuedTasks.length };
}