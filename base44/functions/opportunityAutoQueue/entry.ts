import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, opportunity_id, opportunities } = await req.json();

    if (action === 'queue_opportunity') {
      // Queue a single opportunity
      if (!opportunity_id) {
        return Response.json({ error: 'opportunity_id required' }, { status: 400 });
      }

      const opp = await base44.entities.Opportunity.filter({ id: opportunity_id }, '-created_date', 1);
      if (opp.length === 0) {
        return Response.json({ error: 'Opportunity not found' }, { status: 404 });
      }

      const opportunity = opp[0];

      // Get active identity
      const platformStates = await base44.entities.PlatformState.list();
      const platformState = platformStates[0];
      const identityId = platformState?.active_identity_id;

      if (!identityId) {
        return Response.json({ error: 'No active identity assigned' }, { status: 400 });
      }

      const identity = await base44.entities.AIIdentity.filter({ id: identityId }, '-created_date', 1);
      if (identity.length === 0) {
        return Response.json({ error: 'Identity not found' }, { status: 404 });
      }

      // Create task execution queue entry
      const queueEntry = await base44.entities.TaskExecutionQueue.create({
        opportunity_id: opportunity.id,
        url: opportunity.url,
        opportunity_type: opportunity.opportunity_type,
        platform: opportunity.platform,
        identity_id: identityId,
        identity_name: identity[0].name,
        status: 'queued',
        priority: Math.round(opportunity.overall_score || 50),
        estimated_value: opportunity.profit_estimate_high,
        deadline: opportunity.deadline,
        queue_timestamp: new Date().toISOString(),
        notes: `Auto-queued from discovery engine`
      });

      // Update opportunity status
      await base44.entities.Opportunity.update(opportunity.id, {
        status: 'queued',
        task_execution_id: queueEntry.id
      });

      return Response.json({
        success: true,
        queued_id: queueEntry.id,
        opportunity_id: opportunity.id,
        message: 'Opportunity queued for execution'
      });
    }

    if (action === 'queue_batch') {
      // Queue multiple opportunities
      if (!opportunities || !Array.isArray(opportunities)) {
        return Response.json({ error: 'opportunities array required' }, { status: 400 });
      }

      const platformStates = await base44.entities.PlatformState.list();
      const platformState = platformStates[0];
      const identityId = platformState?.active_identity_id;

      if (!identityId) {
        return Response.json({ error: 'No active identity assigned' }, { status: 400 });
      }

      const identity = await base44.entities.AIIdentity.filter({ id: identityId }, '-created_date', 1);
      if (identity.length === 0) {
        return Response.json({ error: 'Identity not found' }, { status: 404 });
      }

      const queued = [];
      const failed = [];

      for (const oppId of opportunities) {
        try {
          const opp = await base44.entities.Opportunity.filter({ id: oppId }, '-created_date', 1);
          if (opp.length === 0) {
            failed.push({ opportunity_id: oppId, reason: 'Not found' });
            continue;
          }

          const opportunity = opp[0];

          // Skip if already queued
          if (opportunity.status === 'queued' || opportunity.status === 'executing') {
            continue;
          }

          const queueEntry = await base44.entities.TaskExecutionQueue.create({
            opportunity_id: opportunity.id,
            url: opportunity.url,
            opportunity_type: opportunity.opportunity_type,
            platform: opportunity.platform,
            identity_id: identityId,
            identity_name: identity[0].name,
            status: 'queued',
            priority: Math.round(opportunity.overall_score || 50),
            estimated_value: opportunity.profit_estimate_high,
            deadline: opportunity.deadline,
            queue_timestamp: new Date().toISOString(),
            notes: `Auto-queued from discovery engine (batch)`
          });

          await base44.entities.Opportunity.update(opportunity.id, {
            status: 'queued',
            task_execution_id: queueEntry.id
          });

          queued.push(queueEntry.id);
        } catch (err) {
          failed.push({ opportunity_id: oppId, reason: err.message });
        }
      }

      return Response.json({
        success: true,
        queued_count: queued.length,
        failed_count: failed.length,
        queued_ids: queued,
        failed: failed,
        message: `Queued ${queued.length} opportunity(ies)`
      });
    }

    if (action === 'get_queue_status') {
      // Get current queue statistics
      const queuedTasks = await base44.entities.TaskExecutionQueue.filter({
        status: { $in: ['queued', 'processing'] }
      }, '-priority', 100);

      const completedToday = await base44.entities.TaskExecutionQueue.filter({
        status: 'completed',
        completion_timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
      }, '-completed_timestamp', 100);

      const highPriorityCount = queuedTasks.filter(t => t.priority >= 75).length;
      const totalValue = queuedTasks.reduce((sum, t) => sum + (t.estimated_value || 0), 0);

      return Response.json({
        success: true,
        queue_status: {
          total_queued: queuedTasks.length,
          high_priority: highPriorityCount,
          total_estimated_value: totalValue,
          completed_today: completedToday.length,
          next_execution: queuedTasks[0] ? queuedTasks[0].deadline : null
        }
      });
    }

    if (action === 'auto_queue_new_opportunities') {
      // Automatically queue all new opportunities that match criteria
      const newOpps = await base44.entities.Opportunity.filter({
        status: 'new',
        auto_execute: true
      }, '-overall_score', 100);

      if (newOpps.length === 0) {
        return Response.json({
          success: true,
          queued_count: 0,
          message: 'No new opportunities to queue'
        });
      }

      const platformStates = await base44.entities.PlatformState.list();
      const platformState = platformStates[0];
      const identityId = platformState?.active_identity_id;

      if (!identityId) {
        return Response.json({ error: 'No active identity assigned' }, { status: 400 });
      }

      const identity = await base44.entities.AIIdentity.filter({ id: identityId }, '-created_date', 1);
      if (identity.length === 0) {
        return Response.json({ error: 'Identity not found' }, { status: 404 });
      }

      let queuedCount = 0;

      for (const opportunity of newOpps) {
        try {
          const queueEntry = await base44.entities.TaskExecutionQueue.create({
            opportunity_id: opportunity.id,
            url: opportunity.url,
            opportunity_type: opportunity.opportunity_type,
            platform: opportunity.platform,
            identity_id: identityId,
            identity_name: identity[0].name,
            status: 'queued',
            priority: Math.round(opportunity.overall_score || 50),
            estimated_value: opportunity.profit_estimate_high,
            deadline: opportunity.deadline,
            queue_timestamp: new Date().toISOString(),
            notes: `Auto-queued from discovery`
          });

          await base44.entities.Opportunity.update(opportunity.id, {
            status: 'queued',
            task_execution_id: queueEntry.id
          });

          queuedCount++;
        } catch (err) {
          console.error(`Failed to queue ${opportunity.id}:`, err.message);
        }
      }

      return Response.json({
        success: true,
        queued_count: queuedCount,
        total_new_opportunities: newOpps.length,
        message: `Auto-queued ${queuedCount} opportunities`
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});