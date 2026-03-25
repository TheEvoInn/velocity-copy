import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Unified orchestrator: discovers opportunities, queues agent tasks, executes autonomously
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const { action } = body;

    // Scheduled automation trigger: execute high-priority queue
    if ((!action || body.automation) && action !== 'autopilot_full_cycle' && action !== 'full_cycle') {
      return await batchExecuteHighPriority(base44);
    }

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // ── opportunity_to_agent_task ──────────────────────────────────────────────
    if (action === 'opportunity_to_agent_task') {
      const { opportunity_id, force_identity_id } = body;

      const opps = await base44.asServiceRole.entities.Opportunity.filter({ id: opportunity_id });
      if (!opps.length) return Response.json({ error: 'Opportunity not found' }, { status: 404 });

      const opp = opps[0];
      if (!opp.url) {
        return Response.json({
          success: false,
          error: 'Opportunity has no URL for agent execution',
          opportunity_id
        });
      }

      // Determine identity
      let identity = null;
      if (force_identity_id) {
        const ids = await base44.asServiceRole.entities.AIIdentity.filter({ id: force_identity_id });
        identity = ids[0];
      } else if (opp.identity_id) {
        const ids = await base44.asServiceRole.entities.AIIdentity.filter({ id: opp.identity_id });
        identity = ids[0];
      } else {
        const ids = await base44.asServiceRole.entities.AIIdentity.filter({ is_active: true });
        identity = ids[0];
      }

      if (!identity) {
        return Response.json({
          success: false,
          error: 'No identity available for execution',
          opportunity_id
        });
      }

      // Queue task
      const taskRes = await base44.asServiceRole.functions.invoke('agentWorker', {
        action: 'queue_task',
        url: opp.url,
        opportunity_id: opp.id,
        opportunity_type: opp.opportunity_type || 'other',
        platform: opp.platform || opp.source || 'unknown',
        identity_id: identity.id,
        priority: calculatePriority(opp),
        estimated_value: opp.profit_estimate_high || opp.profit_estimate_low || 0,
        deadline: opp.deadline
      });

      // Update opportunity
      await base44.asServiceRole.entities.Opportunity.update(opportunity_id, {
        status: 'queued',
        task_execution_id: taskRes.data?.task?.id,
        identity_id: identity.id,
        identity_name: identity.name
      });

      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'opportunity_found',
        message: `📋 Opportunity queued for execution: ${opp.title} (${identity.name})`,
        severity: 'info',
        metadata: { opportunity_id, task_id: taskRes.data?.task?.id, identity: identity.name }
      });

      return Response.json({
        success: true,
        task_id: taskRes.data?.task?.id,
        identity: identity.name,
        opportunity_id
      });
    }

    // ── batch_execute_opportunities ────────────────────────────────────────────
    if (action === 'batch_execute_opportunities') {
      const { filter_criteria, max_count } = body;

      const opps = await base44.asServiceRole.entities.Opportunity.filter(
        filter_criteria || { status: 'new', auto_execute: true }
      );

      const toExecute = opps
        .sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0))
        .slice(0, max_count || 10);

      // Use bulk queue executor
      const queueRes = await base44.asServiceRole.functions.invoke('autopilotTaskExecutor', {
        action: 'queue_bulk_tasks',
        opportunities: toExecute.map(o => ({
          id: o.id,
          url: o.url,
          title: o.title,
          opportunity_type: o.opportunity_type,
          platform: o.platform,
          overall_score: o.overall_score,
          profit_estimate_high: o.profit_estimate_high
        }))
      }).catch(e => ({ data: { success: false, error: e.message, queued: 0 } }));

      const queued = queueRes.data?.queued || 0;

      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `🎯 Batch queued: ${queued}/${toExecute.length} opportunities`,
        severity: 'info',
        metadata: { queued, total: toExecute.length }
      });

      return Response.json({
        success: true,
        total: toExecute.length,
        queued,
        results: queueRes.data?.results || []
      });
    }

    // ── autopilot_full_cycle ────────────────────────────────────────────────────
    if (action === 'autopilot_full_cycle' || action === 'full_cycle') {
      const cycleResults = {
        timestamp: new Date().toISOString(),
        opportunities_queued: 0,
        tasks_executed: 0,
        success_rate: 0,
        total_value_completed: 0,
        errors: []
      };

      try {
        // 1. Scan for new opportunities
        try {
          const scanRes = await base44.asServiceRole.functions.invoke('unifiedDiscoveryOrchestrator', {
            action: 'discover_all'
          }).catch(e => ({ data: { discovered: 0, error: e.message } }));
          cycleResults.opportunities_scanned = scanRes.data?.discovered || 0;
        } catch (e) {
          cycleResults.errors.push(`Scan: ${e.message}`);
        }

        // 2. Batch execute opportunities
        const batchRes = await base44.asServiceRole.functions.invoke('unifiedAutopilot', {
          action: 'batch_execute_opportunities',
          filter_criteria: { status: 'new', auto_execute: true },
          max_count: 15
        }).catch(e => ({ data: { queued: 0, error: e.message } }));

        cycleResults.opportunities_queued = batchRes.data?.queued || 0;

        // 3. Execute pending tasks via batch executor
        const execRes = await base44.asServiceRole.functions.invoke('autopilotTaskExecutor', {
          action: 'execute_queued_tasks',
          max_concurrent: 10
        }).catch(e => ({ data: { executed: 0 } }));

        cycleResults.tasks_executed = execRes.data?.executed || 0;

        // 4. Get stats
        const statsRes = await base44.asServiceRole.functions.invoke('autopilotTaskExecutor', {
          action: 'get_queue_stats'
        }).catch(e => ({ data: { stats: {} } }));

        cycleResults.success_rate = statsRes.data?.stats?.success_rate || 0;
        cycleResults.total_value_completed = statsRes.data?.stats?.total_value || 0;

      } catch (error) {
        cycleResults.errors.push(error.message);
      }

      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `🤖 Autopilot cycle: ${cycleResults.opportunities_queued} queued, ${cycleResults.tasks_executed} executed, ${cycleResults.success_rate}% success`,
        severity: cycleResults.errors.length > 0 ? 'warning' : 'success',
        metadata: cycleResults
      });

      return Response.json({
        success: true,
        cycle: cycleResults
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function batchExecuteHighPriority(base44) {
  const now = new Date();
  console.log(`[BatchExecute] Running at ${now.toISOString()}`);

  const queued = await base44.asServiceRole.entities.Opportunity.filter(
    { status: 'queued', auto_execute: true },
    '-overall_score',
    10
  ).catch(() => []);

  if (queued.length === 0) {
    const newOpps = await base44.asServiceRole.entities.Opportunity.filter(
      { status: 'new', auto_execute: true },
      '-overall_score',
      10
    ).catch(() => []);

    if (newOpps.length === 0) {
      console.log('[BatchExecute] No eligible opportunities');
      return Response.json({ success: true, processed: 0 });
    }

    // Queue new opportunities
    const queueRes = await base44.asServiceRole.functions.invoke('autopilotTaskExecutor', {
      action: 'queue_bulk_tasks',
      opportunities: newOpps
    }).catch(e => ({ data: { queued: 0 } }));

    const queued_count = queueRes.data?.queued || 0;
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `[Auto-Batch] Queued ${queued_count}/${newOpps.length} opportunities`,
      severity: 'info',
      metadata: { queued_count, total: newOpps.length }
    }).catch(() => null);

    return Response.json({ success: true, processed: queued_count });
  }

  // Execute queued tasks
  const execRes = await base44.asServiceRole.functions.invoke('autopilotTaskExecutor', {
    action: 'execute_queued_tasks',
    max_concurrent: 10
  }).catch(e => ({ data: { executed: 0 } }));

  const executed = execRes.data?.executed || 0;

  await base44.asServiceRole.entities.ActivityLog.create({
    action_type: 'system',
    message: `[Auto-Batch] Executed ${executed}/${queued.length} queued tasks`,
    severity: 'info',
    metadata: { executed, total_queued: queued.length }
  }).catch(() => null);

  return Response.json({ success: true, processed: executed, total_queued: queued.length });
}

function calculatePriority(opportunity) {
  let score = 50;

  if (opportunity.time_sensitivity === 'immediate') score += 30;
  else if (opportunity.time_sensitivity === 'hours') score += 20;
  else if (opportunity.time_sensitivity === 'days') score += 10;

  const estValue = opportunity.profit_estimate_high || opportunity.profit_estimate_low || 0;
  if (estValue > 1000) score += 25;
  else if (estValue > 500) score += 15;
  else if (estValue > 100) score += 5;

  if (opportunity.velocity_score > 75 && opportunity.risk_score < 50) score += 10;

  if (opportunity.overall_score) score = opportunity.overall_score;

  return Math.min(100, Math.max(0, score));
}