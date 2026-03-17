import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Unified orchestrator: discovers opportunities, queues agent tasks, generates proposals, executes autonomously
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action } = body;

    // --- Scheduled automation trigger: "Auto-Execute Batch - High Priority Queue" ---
    // Runs every 15 min; body may be empty {} or { automation: {...} }
    if (!action || body.automation) {
      return await batchExecuteHighPriority(base44);
    }

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // ── opportunity_to_agent_task ──────────────────────────────────────────────
    if (action === 'opportunity_to_agent_task') {
      const { opportunity_id, force_identity_id } = body;

      // Fetch opportunity
      const opps = await base44.asServiceRole.entities.Opportunity.filter({ id: opportunity_id });
      if (!opps.length) return Response.json({ error: 'Opportunity not found' }, { status: 404 });

      const opp = opps[0];

      // If no URL, cannot execute
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
        // Use active identity
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

      // Queue task in Agent Worker
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

      // Update opportunity with task ID and status
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

    // ── generate_proposal_for_opportunity ──────────────────────────────────────
    if (action === 'generate_proposal_for_opportunity') {
      const { opportunity_id, identity_id } = body;

      // Fetch opportunity
      const opps = await base44.asServiceRole.entities.Opportunity.filter({ id: opportunity_id });
      if (!opps.length) return Response.json({ error: 'Opportunity not found' }, { status: 404 });

      const opp = opps[0];

      // Generate proposal via proposal engine
      const proposalRes = await base44.asServiceRole.functions.invoke('proposalEngine', {
        action: 'generate',
        opportunity_id,
        identity_id: identity_id || opp.identity_id
      });

      if (!proposalRes.data?.proposal) {
        return Response.json({
          success: false,
          error: 'Proposal generation failed',
          opportunity_id
        });
      }

      const proposal = proposalRes.data.proposal;

      // Log proposal
      const workLog = await base44.asServiceRole.entities.AIWorkLog.create({
        log_type: 'proposal_submitted',
        opportunity_id,
        platform: opp.platform || opp.source,
        subject: proposal.subject_line,
        content_preview: proposal.proposal_body?.slice(0, 500),
        full_content: proposal.proposal_body,
        status: 'drafted',
        metadata: {
          opportunity_id,
          identity_id: proposalRes.data?.identity_used?.id,
          bid_amount: proposal.estimated_bid,
          confidence: proposal.confidence_score,
          platform_tips: proposal.platform_tips
        }
      });

      // Update opportunity
      await base44.asServiceRole.entities.Opportunity.update(opportunity_id, {
        proposal_id: workLog.id
      });

      return Response.json({
        success: true,
        proposal,
        proposal_id: workLog.id,
        identity_used: proposalRes.data?.identity_used
      });
    }

    // ── execute_opportunity_end_to_end ──────────────────────────────────────────
    if (action === 'execute_opportunity_end_to_end') {
      const { opportunity_id, force_identity_id } = body;

      // Step 1: Queue agent task
      const taskRes = await base44.asServiceRole.functions.invoke('unifiedAutopilot', {
        action: 'opportunity_to_agent_task',
        opportunity_id,
        force_identity_id
      });

      if (!taskRes.data?.success) {
        return Response.json({
          success: false,
          error: taskRes.data?.error,
          opportunity_id
        });
      }

      // Step 2: Generate proposal if freelance opportunity
      const opp = (await base44.asServiceRole.entities.Opportunity.filter({ id: opportunity_id }))[0];
      if (['freelance', 'service'].includes(opp.category)) {
        try {
          const proposalRes = await base44.asServiceRole.functions.invoke('unifiedAutopilot', {
            action: 'generate_proposal_for_opportunity',
            opportunity_id,
            identity_id: force_identity_id || opp.identity_id
          });

          await base44.asServiceRole.entities.ActivityLog.create({
            action_type: 'system',
            message: `📝 Proposal generated for: ${opp.title} (Confidence: ${proposalRes.data?.proposal?.confidence_score || 0}%)`,
            severity: 'success',
            metadata: { opportunity_id, proposal_id: proposalRes.data?.proposal_id }
          });
        } catch (e) {
          // Proposal generation non-critical, continue
        }
      }

      return Response.json({
        success: true,
        opportunity_id,
        task_id: taskRes.data?.task_id,
        identity: taskRes.data?.identity,
        message: 'Opportunity queued for full autonomous execution'
      });
    }

    // ── batch_execute_opportunities ────────────────────────────────────────────
    if (action === 'batch_execute_opportunities') {
      const { filter_criteria, max_count } = body;

      // Fetch opportunities matching criteria
      const opps = await base44.asServiceRole.entities.Opportunity.filter(
        filter_criteria || { status: 'new', auto_execute: true }
      );

      const toExecute = opps
        .sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0))
        .slice(0, max_count || 10);

      const results = [];
      for (const opp of toExecute) {
        try {
          const res = await base44.asServiceRole.functions.invoke('unifiedAutopilot', {
            action: 'execute_opportunity_end_to_end',
            opportunity_id: opp.id
          });

          if (res.data?.success) {
            results.push({
              opportunity_id: opp.id,
              title: opp.title,
              status: 'queued',
              task_id: res.data?.task_id
            });
          } else {
            results.push({
              opportunity_id: opp.id,
              title: opp.title,
              status: 'failed',
              error: res.data?.error
            });
          }
        } catch (e) {
          results.push({
            opportunity_id: opp.id,
            title: opp.title,
            status: 'error',
            error: e.message
          });
        }
      }

      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `🚀 Batch execution: ${results.filter(r => r.status === 'queued').length}/${results.length} opportunities queued`,
        severity: results.filter(r => r.status === 'failed').length > 0 ? 'warning' : 'success',
        metadata: { results_count: results.length, queued: results.filter(r => r.status === 'queued').length }
      });

      return Response.json({
        success: true,
        total: results.length,
        queued: results.filter(r => r.status === 'queued').length,
        results
      });
    }

    // ── autopilot_full_cycle ────────────────────────────────────────────────────
    if (action === 'autopilot_full_cycle') {
      const cycleResults = {
        timestamp: new Date().toISOString(),
        opportunities_queued: 0,
        tasks_executed: 0,
        proposals_generated: 0,
        errors: []
      };

      try {
        // 1. Batch execute opportunities
        const batchRes = await base44.asServiceRole.functions.invoke('unifiedAutopilot', {
          action: 'batch_execute_opportunities',
          filter_criteria: { status: 'new', auto_execute: true },
          max_count: 15
        });

        cycleResults.opportunities_queued = batchRes.data?.queued || 0;

        // 2. Execute pending agent tasks
        for (let i = 0; i < 3; i++) {
          const taskRes = await base44.asServiceRole.functions.invoke('agentWorker', {
            action: 'execute_next_task'
          });

          if (taskRes.data?.task?.status === 'completed') {
            cycleResults.tasks_executed++;
          }
        }

        // 3. Get stats
        const statsRes = await base44.asServiceRole.functions.invoke('agentWorker', {
          action: 'get_execution_stats'
        });

        cycleResults.success_rate = statsRes.data?.stats?.success_rate || 0;
        cycleResults.total_value_completed = statsRes.data?.stats?.total_value_completed || 0;

      } catch (error) {
        cycleResults.errors.push(error.message);
      }

      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `🤖 Autopilot cycle: ${cycleResults.opportunities_queued} opportunities queued, ${cycleResults.tasks_executed} executed, ${cycleResults.success_rate}% success`,
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

function calculatePriority(opportunity) {
  let score = 50;

  // Time sensitivity boost
  if (opportunity.time_sensitivity === 'immediate') score += 30;
  else if (opportunity.time_sensitivity === 'hours') score += 20;
  else if (opportunity.time_sensitivity === 'days') score += 10;

  // Value boost
  const estValue = opportunity.profit_estimate_high || opportunity.profit_estimate_low || 0;
  if (estValue > 1000) score += 25;
  else if (estValue > 500) score += 15;
  else if (estValue > 100) score += 5;

  // Velocity & risk adjustment
  if (opportunity.velocity_score > 75 && opportunity.risk_score < 50) score += 10;

  // Overall score if available
  if (opportunity.overall_score) score = opportunity.overall_score;

  return Math.min(100, Math.max(0, score));
}