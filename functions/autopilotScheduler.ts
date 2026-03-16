import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Continuous autopilot execution scheduler - runs autonomous cycles
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action } = await req.json();

    // ── run_continuous_cycle ───────────────────────────────────────────────────
    if (action === 'run_continuous_cycle') {
      const cycleId = `cycle_${Date.now()}`;
      const cycleStart = new Date();

      const cycle = {
        cycle_id: cycleId,
        start_time: cycleStart.toISOString(),
        stages: []
      };

      try {
        // Stage 1: Pre-flight checks
        cycle.stages.push({ stage: 'preflight', status: 'running', timestamp: new Date().toISOString() });
        const preflightRes = await base44.asServiceRole.functions.invoke('autopilotOrchestrator', {
          action: 'pre_flight_check'
        });
        cycle.stages[0].status = preflightRes.data?.checks?.ready_to_autopilot ? 'success' : 'warning';
        cycle.stages[0].data = preflightRes.data?.checks;

        // Stage 2: Ensure active identity
        if (!cycle.stages[0].data?.active_identity) {
          cycle.stages.push({ stage: 'identity_setup', status: 'running', timestamp: new Date().toISOString() });
          const identityRes = await base44.asServiceRole.functions.invoke('autopilotOrchestrator', {
            action: 'ensure_identity'
          });
          cycle.stages[1].status = identityRes.data?.identity ? 'success' : 'failed';
          cycle.stages[1].data = identityRes.data;
        }

        // Stage 3: Opportunity discovery & queueing
        cycle.stages.push({ stage: 'opportunity_queueing', status: 'running', timestamp: new Date().toISOString() });
        const batchRes = await base44.asServiceRole.functions.invoke('unifiedAutopilot', {
          action: 'batch_execute_opportunities',
          filter_criteria: { status: 'new', auto_execute: true },
          max_count: 10
        });
        cycle.stages[cycle.stages.length - 1].status = 'success';
        cycle.stages[cycle.stages.length - 1].data = {
          opportunities_queued: batchRes.data?.queued || 0,
          total_opportunities: batchRes.data?.total || 0
        };

        // Stage 4: Execute queued tasks (agent worker)
        cycle.stages.push({ stage: 'agent_execution', status: 'running', timestamp: new Date().toISOString() });
        let tasksExecuted = 0;
        for (let i = 0; i < 5; i++) {
          const taskRes = await base44.asServiceRole.functions.invoke('agentWorker', {
            action: 'execute_next_task'
          });
          if (taskRes.data?.task?.status === 'completed' || taskRes.data?.task?.status === 'needs_review') {
            tasksExecuted++;
          }
        }
        cycle.stages[cycle.stages.length - 1].status = 'success';
        cycle.stages[cycle.stages.length - 1].data = { tasks_executed: tasksExecuted };

        // Stage 5: Account health check
        cycle.stages.push({ stage: 'account_health', status: 'running', timestamp: new Date().toISOString() });
        try {
          await base44.asServiceRole.functions.invoke('accountHealthMonitor', {
            action: 'check_all_account_health'
          });
          cycle.stages[cycle.stages.length - 1].status = 'success';
        } catch (e) {
          cycle.stages[cycle.stages.length - 1].status = 'warning';
        }

        // Stage 6: Get execution stats
        cycle.stages.push({ stage: 'stats_collection', status: 'running', timestamp: new Date().toISOString() });
        const statsRes = await base44.asServiceRole.functions.invoke('agentWorker', {
          action: 'get_execution_stats'
        });
        cycle.stages[cycle.stages.length - 1].status = 'success';
        cycle.stages[cycle.stages.length - 1].data = {
          success_rate: statsRes.data?.stats?.success_rate || 0,
          total_value_completed: statsRes.data?.stats?.total_value_completed || 0,
          avg_execution_time: statsRes.data?.stats?.avg_execution_time || 0
        };

      } catch (error) {
        cycle.stages[cycle.stages.length - 1].status = 'failed';
        cycle.stages[cycle.stages.length - 1].error = error.message;
      }

      cycle.end_time = new Date().toISOString();
      cycle.duration_seconds = Math.round((new Date(cycle.end_time) - cycleStart) / 1000);

      // Log cycle
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `🤖 Autopilot cycle complete: ${cycle.stages.filter(s => s.status === 'success').length}/${cycle.stages.length} stages successful`,
        severity: cycle.stages.some(s => s.status === 'failed') ? 'warning' : 'success',
        metadata: cycle
      });

      return Response.json({
        success: true,
        cycle
      });
    }

    // ── get_cycle_history ──────────────────────────────────────────────────────
    if (action === 'get_cycle_history') {
      const { limit = 20 } = await req.json();
      const logs = await base44.asServiceRole.entities.ActivityLog.filter({
        action_type: 'system',
        message: { $regex: 'Autopilot cycle' }
      });

      return Response.json({
        success: true,
        cycles: logs.slice(0, limit)
      });
    }

    // ── get_autopilot_status ───────────────────────────────────────────────────
    if (action === 'get_autopilot_status') {
      // Get current stats
      const statsRes = await base44.asServiceRole.functions.invoke('agentWorker', {
        action: 'get_execution_stats'
      });

      // Get queued opportunities
      const opportunities = await base44.asServiceRole.entities.Opportunity.filter({
        status: 'new'
      });

      // Get active tasks
      const tasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter({
        status: { $in: ['queued', 'processing', 'navigating', 'filling'] }
      });

      // Get active identity
      const identities = await base44.asServiceRole.entities.AIIdentity.filter({
        is_active: true
      });

      return Response.json({
        success: true,
        status: {
          active: true,
          current_identity: identities[0] || null,
          queued_opportunities: opportunities.length,
          active_tasks: tasks.length,
          execution_stats: statsRes.data?.stats,
          ready_to_execute: !!identities[0]
        }
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});