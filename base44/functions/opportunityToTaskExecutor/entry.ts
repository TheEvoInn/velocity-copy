import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Opportunity to Task Executor
 * Automatically converts selected opportunities to executable tasks
 * Assigns AI identities and queues for Autopilot execution
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { event, data, old_data } = await req.json();
    
    if (!event || event.type !== 'update') {
      return Response.json({ error: 'Invalid event' }, { status: 400 });
    }

    const opportunity = data;
    
    // Only trigger if opportunity status changed to 'executing' or 'queued'
    const previousStatus = old_data?.status;
    const newStatus = opportunity?.status;
    
    if (!['executing', 'queued'].includes(newStatus)) {
      return Response.json({ success: false, reason: 'Status not executable' });
    }

    const execution = {
      timestamp: new Date().toISOString(),
      opportunity_id: opportunity.id,
      task_created: false,
      identity_assigned: false,
      errors: []
    };

    try {
      // Step 1: Get available AI identities
      const identities = await base44.entities.AIIdentity.filter(
        { created_by: user.email, is_active: true },
        '-tasks_executed',
        5
      ).catch(() => []);
      
      const identitiesArray = Array.isArray(identities) ? identities : [];
      
      if (identitiesArray.length === 0) {
        execution.errors.push('No active AI identities available');
        return Response.json({ success: false, execution });
      }

      // Select identity with least tasks assigned (load balance)
      const selectedIdentity = identitiesArray.sort((a, b) => 
        (a.tasks_executed || 0) - (b.tasks_executed || 0)
      )[0];

      // Step 2: Create TaskExecutionQueue entry
      const taskData = {
        opportunity_id: opportunity.id,
        url: opportunity.url || 'pending',
        opportunity_type: opportunity.opportunity_type || 'job',
        platform: opportunity.platform || 'unknown',
        identity_id: selectedIdentity.id,
        identity_name: selectedIdentity.name,
        status: 'queued',
        priority: Math.round((opportunity.overall_score || 50) * 100) / 100, // velocity-based priority
        estimated_value: opportunity.profit_estimate_high || 0,
        deadline: opportunity.deadline,
        queue_timestamp: new Date().toISOString()
      };

      const createdTask = await base44.entities.TaskExecutionQueue.create(taskData).catch(e => {
        execution.errors.push(`Task creation failed: ${e.message}`);
        return null;
      });

      if (!createdTask) {
        return Response.json({ success: false, execution });
      }

      execution.task_created = true;
      execution.task_id = createdTask.id;
      execution.identity_assigned = true;

      // Step 3: Update opportunity status to 'executing'
      await base44.entities.Opportunity.update(opportunity.id, {
        status: 'executing',
        task_execution_id: createdTask.id,
        identity_id: selectedIdentity.id,
        identity_name: selectedIdentity.name
      }).catch(e => {
        execution.errors.push(`Status update failed: ${e.message}`);
      });

      // Step 4: Log the execution
      await base44.entities.ActivityLog.create({
        action_type: 'execution',
        message: `🚀 Opportunity "${opportunity.title}" queued for execution with identity ${selectedIdentity.name}`,
        severity: 'success',
        metadata: {
          opportunity_id: opportunity.id,
          task_id: createdTask.id,
          identity_id: selectedIdentity.id,
          platform: opportunity.platform,
          estimated_value: opportunity.profit_estimate_high
        }
      }).catch(() => {});

      return Response.json({
        success: true,
        execution: {
          ...execution,
          task_id: createdTask.id,
          identity_id: selectedIdentity.id,
          identity_name: selectedIdentity.name
        }
      });

    } catch (e) {
      execution.errors.push(`Execution error: ${e.message}`);
      return Response.json({ success: false, execution }, { status: 500 });
    }

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});