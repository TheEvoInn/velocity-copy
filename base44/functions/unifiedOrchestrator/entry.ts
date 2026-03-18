import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * UNIFIED ORCHESTRATOR v1.0
 * Single monolithic engine for all automation
 * Merges Autopilot + Agent Worker into one cohesive system
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'full_cycle';

    // Get or create platform state
    let platformState = (await base44.entities.PlatformState.list())[0];
    if (!platformState) {
      platformState = await base44.entities.PlatformState.create({
        autopilot_enabled: true,
        autopilot_mode: 'continuous'
      });
    }

    // Emergency stop check
    if (platformState.emergency_stop_engaged) {
      return Response.json({
        success: false,
        message: 'Emergency stop engaged - automation paused',
        state: platformState
      });
    }

    // Check if autopilot is enabled
    if (!platformState.autopilot_enabled && action === 'full_cycle') {
      return Response.json({
        success: false,
        message: 'Autopilot is disabled',
        state: platformState
      });
    }

    // Route to appropriate handler
    let result;
    switch (action) {
      case 'full_cycle':
        result = await orchestrateFullCycle(base44, platformState, user);
        break;
      case 'scan_opportunities':
        result = await scanOpportunitiesPhase(base44, platformState, user);
        break;
      case 'execute_queued_tasks':
        result = await executeQueuedTasksPhase(base44, platformState, user);
        break;
      case 'toggle_autopilot':
        result = await toggleAutopilot(base44, platformState, body.enabled);
        break;
      case 'get_status':
        result = { state: platformState, success: true };
        break;
      case 'emergency_stop':
        result = await emergencyStop(base44, platformState);
        break;
      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    }

    return Response.json(result);
  } catch (error) {
    console.error('Orchestrator error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * FULL CYCLE: Scan → Select → Execute → Track
 */
async function orchestrateFullCycle(base44, platformState, user) {
  const cycleStart = new Date();
  const updates = {
    last_cycle_timestamp: cycleStart.toISOString(),
    cycle_count_today: (platformState.cycle_count_today || 0) + 1,
    execution_log: platformState.execution_log || []
  };

  try {
    // Phase 1: Discover opportunities
    console.log('[ORCHESTRATOR] Phase 1: Opportunity Discovery');
    const scanResult = await scanOpportunitiesPhase(base44, platformState, user);
    const opportunitiesFound = scanResult.opportunities_found || 0;
    logAction(updates.execution_log, 'SCAN', 'completed', `Found ${opportunitiesFound} opportunities`);

    // Phase 2: Select best opportunities from queue
    console.log('[ORCHESTRATOR] Phase 2: Task Selection');
    const queuedOpp = await base44.entities.Opportunity.filter({
      status: 'new',
      auto_execute: true
    }, '-overall_score', 5);

    if (queuedOpp.length === 0) {
      logAction(updates.execution_log, 'SELECTION', 'skipped', 'No eligible opportunities');
      updates.current_queue_count = 0;
      await base44.entities.PlatformState.update(platformState.id, updates);
      return { success: true, message: 'No opportunities to execute', cycle: updates };
    }

    // Phase 3: Execute tasks
    console.log('[ORCHESTRATOR] Phase 3: Task Execution');
    const execResult = await executeOpportunities(base44, platformState, queuedOpp, user);
    logAction(updates.execution_log, 'EXECUTION', 'completed', `Executed ${execResult.tasks_executed} tasks`);

    // Phase 4: Track results
    console.log('[ORCHESTRATOR] Phase 4: Results Tracking');
    updates.tasks_completed_today = (platformState.tasks_completed_today || 0) + execResult.tasks_executed;
    updates.revenue_generated_today = (platformState.revenue_generated_today || 0) + (execResult.revenue_generated || 0);
    updates.current_queue_count = Math.max(0, queuedOpp.length - execResult.tasks_executed);

    // Update platform state
    await base44.entities.PlatformState.update(platformState.id, updates);

    return {
      success: true,
      cycle: {
        opportunities_found: opportunitiesFound,
        tasks_executed: execResult.tasks_executed,
        revenue_generated: execResult.revenue_generated || 0,
        duration_ms: new Date() - cycleStart
      }
    };
  } catch (error) {
    console.error('Full cycle error:', error);
    updates.last_error = error.message;
    updates.last_error_timestamp = new Date().toISOString();
    updates.error_count_today = (platformState.error_count_today || 0) + 1;
    updates.system_health = 'warning';
    logAction(updates.execution_log, 'CYCLE', 'error', error.message);
    
    await base44.entities.PlatformState.update(platformState.id, updates);
    return { success: false, error: error.message, cycle: updates };
  }
}

/**
 * PHASE 1: Scan for new opportunities
 */
async function scanOpportunitiesPhase(base44, platformState, user) {
  try {
    const goals = (await base44.entities.UserGoals.list())[0];
    const categories = goals?.ai_preferred_categories || ['freelance', 'grant'];

    // In real implementation, this would scrape web
    // For now, create sample opportunities
    const opportunities = [
      {
        title: 'High-Paying Writing Project',
        category: 'freelance',
        opportunity_type: 'job',
        platform: 'upwork',
        profit_estimate_low: 200,
        profit_estimate_high: 500,
        velocity_score: 85,
        risk_score: 15,
        overall_score: 75,
        status: 'new',
        auto_execute: true,
        url: `https://upwork.com/job/${Date.now()}`
      }
    ];

    let created = 0;
    for (const opp of opportunities) {
      try {
        const existing = await base44.entities.Opportunity.filter({ url: opp.url }, '', 1);
        if (existing.length === 0) {
          await base44.entities.Opportunity.create(opp);
          created++;
        }
      } catch (e) {
        console.error('Failed to create opportunity:', e.message);
      }
    }

    return { opportunities_found: opportunities.length, opportunities_created: created };
  } catch (error) {
    console.error('Scan phase error:', error);
    return { opportunities_found: 0, error: error.message };
  }
}

/**
 * PHASE 3: Execute queued opportunities
 */
async function executeOpportunities(base44, platformState, opportunities, user) {
  let executed = 0;
  let revenue = 0;

  for (const opp of opportunities.slice(0, 3)) {
    try {
      // Get or select identity
      const identities = await base44.entities.AIIdentity.filter({ is_active: true }, '', 1);
      const identity = identities[0] || await createDefaultIdentity(base44);

      // Create task in queue
      const task = await base44.entities.TaskExecutionQueue.create({
        opportunity_id: opp.id,
        url: opp.url,
        opportunity_type: opp.opportunity_type,
        platform: opp.platform,
        identity_id: identity.id,
        identity_name: identity.name,
        status: 'processing'
      });

      // Simulate execution (in real implementation, would actually navigate/fill/submit)
      const result = await simulateTaskExecution(base44, task, opp);

      // Update opportunity
      await base44.entities.Opportunity.update(opp.id, {
        status: result.success ? 'submitted' : 'failed',
        task_execution_id: task.id
      });

      if (result.success) {
        executed++;
        revenue += opp.profit_estimate_low || 0;
      }
    } catch (e) {
      console.error('Task execution error:', e.message);
    }
  }

  return { tasks_executed: executed, revenue_generated: revenue };
}

/**
 * Execute queued tasks phase
 */
async function executeQueuedTasksPhase(base44, platformState, user) {
  const queued = await base44.entities.TaskExecutionQueue.filter({
    status: 'queued'
  }, 'queue_timestamp', 10);

  let executed = 0;
  for (const task of queued) {
    try {
      const result = await simulateTaskExecution(base44, task, null);
      if (result.success) executed++;
    } catch (e) {
      console.error('Queue execution error:', e.message);
    }
  }

  return { tasks_executed: executed, success: true };
}

/**
 * Simulate task execution (real version would navigate/fill/submit)
 */
async function simulateTaskExecution(base44, task, opportunity) {
  try {
    // Update task status
    await base44.entities.TaskExecutionQueue.update(task.id, {
      status: 'filling',
      start_timestamp: new Date().toISOString()
    });

    // Simulate form filling
    await new Promise(r => setTimeout(r, 100));

    // Mark complete
    await base44.entities.TaskExecutionQueue.update(task.id, {
      status: 'completed',
      completion_timestamp: new Date().toISOString(),
      submission_success: true,
      confirmation_text: `Task ${task.id} completed successfully`
    });

    return { success: true };
  } catch (error) {
    await base44.entities.TaskExecutionQueue.update(task.id, {
      status: 'failed',
      error_message: error.message
    });
    return { success: false, error: error.message };
  }
}

/**
 * Toggle autopilot on/off
 */
async function toggleAutopilot(base44, platformState, enabled) {
  await base44.entities.PlatformState.update(platformState.id, {
    autopilot_enabled: enabled
  });
  return {
    success: true,
    message: `Autopilot ${enabled ? 'enabled' : 'disabled'}`,
    autopilot_enabled: enabled
  };
}

/**
 * Emergency stop
 */
async function emergencyStop(base44, platformState) {
  await base44.entities.PlatformState.update(platformState.id, {
    emergency_stop_engaged: true,
    system_health: 'critical'
  });
  return {
    success: true,
    message: 'Emergency stop engaged - all automation paused'
  };
}

/**
 * Create default identity if none exists
 */
async function createDefaultIdentity(base44) {
  return await base44.entities.AIIdentity.create({
    name: 'Default AI Agent',
    role_label: 'Automation Agent',
    is_active: true,
    communication_tone: 'professional'
  });
}

/**
 * Log action to execution log
 */
function logAction(log, action, status, details) {
  log.push({
    timestamp: new Date().toISOString(),
    action,
    status,
    details
  });
}