import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * TIER 4 AUTONOMOUS CYCLE ENGINE
 * Master orchestrator for complete autonomous profit cycle:
 * Payout (Tier 3) → Reinvestment (Tier 4) → Opportunity Execution (Tier 4)
 * Runs continuously to maximize autonomous profit generation
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // ── Run full autonomous profit cycle ────────────────────────────────────
    if (action === 'run_full_cycle' || !action) {
      return await runFullAutonomousCycle(base44, user);
    }

    // ── Get cycle health & metrics ─────────────────────────────────────────
    if (action === 'get_cycle_health') {
      return await getCycleHealth(base44, user);
    }

    // ── Optimize cycle timing ──────────────────────────────────────────────
    if (action === 'optimize_timing') {
      return await optimizeCycleTiming(base44, user);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[Tier4AutonomousCycleEngine]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Execute full autonomous profit cycle
 * Sequence: Payout → Reinvestment → Discovery → Filtering → Execution
 */
async function runFullAutonomousCycle(base44, user) {
  const cycleId = `cycle_${Date.now()}`;
  const steps = [];

  try {
    // Get user config
    const goals = await base44.asServiceRole.entities.UserGoals.filter(
      { created_by: user.email },
      null,
      1
    ).catch(() => []);

    const goal = goals[0];
    if (!goal) {
      return Response.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Check if autopilot is enabled
    if (!goal.autopilot_enabled) {
      return Response.json({
        success: false,
        reason: 'Autopilot disabled',
        message: 'Autonomous profit engine is disabled'
      });
    }

    const policies = await base44.asServiceRole.entities.WithdrawalPolicy.filter(
      { created_by: user.email },
      null,
      1
    ).catch(() => []);

    const policy = policies[0];
    if (!policy?.engine_enabled) {
      return Response.json({
        success: false,
        reason: 'Engine disabled',
        message: 'Autonomous engine is disabled in withdrawal policy'
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 1: PAYOUT ORCHESTRATION (Tier 3)
    // ──────────────────────────────────────────────────────────────────────────
    steps.push({ step: 1, name: 'Payout Orchestration', status: 'running' });

    const payoutResult = await base44.asServiceRole.functions.invoke(
      'payoutOrchestrationEngine',
      { action: 'trigger_auto_withdrawal' }
    ).catch(e => ({ error: e.message }));

    if (payoutResult.data?.success) {
      steps[steps.length - 1] = {
        ...steps[steps.length - 1],
        status: 'success',
        message: `Withdrawal triggered: $${payoutResult.data.amount}`,
        data: payoutResult.data
      };
    } else if (payoutResult.data?.reason === 'balance_below_threshold') {
      steps[steps.length - 1] = {
        ...steps[steps.length - 1],
        status: 'skipped',
        message: `Balance below threshold ($${payoutResult.data.current_balance} < $${payoutResult.data.threshold})`,
        data: payoutResult.data
      };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 2: OPPORTUNITY DISCOVERY
    // ──────────────────────────────────────────────────────────────────────────
    steps.push({ step: 2, name: 'Opportunity Discovery', status: 'running' });

    const discoveryResult = await base44.asServiceRole.functions.invoke(
      'globalOpportunityDiscovery',
      { action: 'discover' }
    ).catch(e => ({ error: e.message }));

    let discoveredCount = 0;
    if (discoveryResult.data?.opportunities) {
      // Create discovered opportunities
      for (const disc_opp of discoveryResult.data.opportunities.slice(0, 8)) {
        const created = await base44.asServiceRole.entities.Opportunity.create({
          title: disc_opp.title,
          url: disc_opp.url,
          category: disc_opp.category || 'other',
          opportunity_type: disc_opp.opportunity_type || 'other',
          profit_estimate_low: disc_opp.estimated_value ? Math.floor(disc_opp.estimated_value * 0.7) : 0,
          profit_estimate_high: disc_opp.estimated_value || 50,
          overall_score: 65,
          auto_execute: true,
          status: 'new',
          source: 'auto_discovery'
        }).catch(() => null);

        if (created) discoveredCount++;
      }
    }

    steps[steps.length - 1] = {
      ...steps[steps.length - 1],
      status: 'success',
      message: `Discovered and created ${discoveredCount} opportunities`
    };

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 3: REINVESTMENT ORCHESTRATION (Tier 4)
    // ──────────────────────────────────────────────────────────────────────────
    steps.push({ step: 3, name: 'Reinvestment Orchestration', status: 'running' });

    const reinvestResult = await base44.asServiceRole.functions.invoke(
      'reinvestmentOrchestrator',
      { action: 'execute_reinvestment_cycle', auto_discover: false, max_opportunities: 5 }
    ).catch(e => ({ error: e.message }));

    if (reinvestResult.data?.success) {
      steps[steps.length - 1] = {
        ...steps[steps.length - 1],
        status: 'success',
        message: `Executed ${reinvestResult.data.total_executed} opportunities`,
        data: reinvestResult.data
      };
    } else {
      steps[steps.length - 1] = {
        ...steps[steps.length - 1],
        status: 'partial',
        message: 'No opportunities executed (insufficient capital or no matches)',
        data: reinvestResult.data
      };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 4: HEALTH CHECK & MONITORING
    // ──────────────────────────────────────────────────────────────────────────
    steps.push({ step: 4, name: 'Health & Monitoring', status: 'running' });

    // Check account health
    const healthResult = await base44.asServiceRole.functions.invoke(
      'accountHealthMonitorScheduler',
      {}
    ).catch(e => ({ error: e.message }));

    // Monitor payout status
    const payoutStatusResult = await base44.asServiceRole.functions.invoke(
      'payoutOrchestrationEngine',
      { action: 'monitor_payout_status' }
    ).catch(e => ({ error: e.message }));

    steps[steps.length - 1] = {
      ...steps[steps.length - 1],
      status: 'success',
      message: `Health check complete. In-flight payouts: ${payoutStatusResult.data?.in_flight || 0}`,
      data: { health: healthResult.data, payouts: payoutStatusResult.data }
    };

    // ──────────────────────────────────────────────────────────────────────────
    // LOG CYCLE COMPLETION
    // ──────────────────────────────────────────────────────────────────────────
    const successSteps = steps.filter(s => s.status === 'success').length;
    const totalSteps = steps.length;

    await base44.asServiceRole.entities.EngineAuditLog.create({
      action_type: 'engine_cycle',
      amount: 0,
      status: successSteps > 2 ? 'success' : 'partial',
      ai_reasoning: `Tier 4 autonomous cycle: ${successSteps}/${totalSteps} steps successful`,
      metadata: { cycle_id: cycleId, steps }
    }).catch(() => null);

    // Activity log
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `🤖 Tier 4 Autonomous Cycle Complete: ${successSteps}/${totalSteps} steps successful`,
      severity: successSteps > 2 ? 'success' : 'warning',
      metadata: { cycle_id: cycleId, steps_summary: steps.map(s => ({ name: s.name, status: s.status })) }
    }).catch(() => null);

    return Response.json({
      success: successSteps > 2,
      cycle_id: cycleId,
      steps,
      summary: {
        total_steps: totalSteps,
        successful: successSteps,
        skipped_or_failed: totalSteps - successSteps,
        message: `Tier 4 autonomous cycle: ${successSteps}/${totalSteps} steps completed successfully`
      }
    });
  } catch (error) {
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `❌ Tier 4 Cycle Error: ${error.message}`,
      severity: 'critical',
      metadata: { cycle_id: cycleId, error: error.message, steps }
    }).catch(() => null);

    return Response.json({ error: error.message, cycle_id: cycleId, steps }, { status: 500 });
  }
}

/**
 * Get cycle health and performance metrics
 */
async function getCycleHealth(base44, user) {
  try {
    // Get recent cycle logs
    const logs = await base44.asServiceRole.entities.EngineAuditLog.filter(
      { action_type: 'engine_cycle', created_date: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() } },
      '-created_date',
      20
    ).catch(() => []);

    const successCount = logs.filter(l => l.status === 'success').length;
    const totalCount = logs.length;

    // Get execution queue status
    const queue = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
      { status: { $in: ['queued', 'processing'] } },
      null,
      1000
    ).catch(() => []);

    // Get pending interventions
    const interventions = await base44.asServiceRole.entities.UserIntervention.filter(
      { status: 'pending', user_email: user.email },
      null,
      100
    ).catch(() => []);

    return Response.json({
      success: true,
      health: {
        cycle_success_rate: totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0,
        recent_cycles: totalCount,
        successful_cycles: successCount,
        execution_queue_size: queue.length,
        pending_interventions: interventions.length,
        status: queue.length > 10 ? 'busy' : queue.length > 0 ? 'active' : 'idle'
      },
      recommendations: generateRecommendations(queue, interventions)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Optimize cycle timing based on performance
 */
async function optimizeCycleTiming(base44, user) {
  try {
    // Analyze success patterns by time of day
    const logs = await base44.asServiceRole.entities.EngineAuditLog.filter(
      { action_type: 'engine_cycle', created_date: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() } },
      '-created_date',
      100
    ).catch(() => []);

    const byHour = {};
    for (const log of logs) {
      const hour = new Date(log.created_date).getHours();
      if (!byHour[hour]) byHour[hour] = { success: 0, total: 0 };
      byHour[hour].total++;
      if (log.status === 'success') byHour[hour].success++;
    }

    // Find best hours
    const hourly = Object.entries(byHour).map(([hour, data]) => ({
      hour: parseInt(hour),
      success_rate: Math.round((data.success / data.total) * 100),
      sample_size: data.total
    }));

    const bestHours = hourly
      .filter(h => h.sample_size >= 2)
      .sort((a, b) => b.success_rate - a.success_rate)
      .slice(0, 3);

    return Response.json({
      success: true,
      optimization: {
        best_hours: bestHours,
        recommendation: bestHours.length > 0
          ? `Schedule cycles at hours: ${bestHours.map(h => `${h.hour}:00 (${h.success_rate}% success)`).join(', ')}`
          : 'Insufficient data for optimization',
        current_interval: '30 minutes',
        suggested_interval: '30-45 minutes (based on success rate)'
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Generate health recommendations
 */
function generateRecommendations(queue, interventions) {
  const recs = [];

  if (queue.length > 20) {
    recs.push({
      level: 'warning',
      message: `High queue backlog: ${queue.length} tasks waiting. Consider increasing execution frequency.`
    });
  }

  if (interventions.length > 5) {
    recs.push({
      level: 'critical',
      message: `${interventions.length} interventions pending. Engine may stall without user input.`
    });
  }

  if (recs.length === 0) {
    recs.push({
      level: 'info',
      message: 'System running normally. No interventions needed.'
    });
  }

  return recs;
}