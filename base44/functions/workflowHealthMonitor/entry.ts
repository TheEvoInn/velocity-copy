import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Workflow Health Monitor
 * Monitors task and workflow health, handles stalled/failed tasks
 * Triggers recovery mechanisms and escalations
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get all active workflows
    const workflows = await base44.asServiceRole.entities.Workflow.filter({
      status: 'active'
    });

    const health = {
      total_workflows: workflows.length,
      healthy: 0,
      stalled: 0,
      failed: 0,
      escalated: 0,
      timestamp: new Date().toISOString()
    };

    // Check each workflow
    for (const workflow of workflows) {
      const workflowHealth = await checkWorkflowHealth(base44, workflow);
      
      if (workflowHealth.status === 'healthy') {
        health.healthy++;
      } else if (workflowHealth.status === 'stalled') {
        health.stalled++;
        // Trigger recovery
        await handleStalledWorkflow(base44, workflow);
      } else if (workflowHealth.status === 'failed') {
        health.failed++;
        // Escalate
        await escalateFailedWorkflow(base44, workflow);
      }
    }

    // Check for stuck analysis tasks
    const stallThreshold = Date.now() - 15 * 60 * 1000; // 15 minutes
    const allAnalysisTasks = await base44.asServiceRole.entities.AITask.filter({
      status: 'analyzing'
    });

    for (const task of allAnalysisTasks) {
      const createdTime = new Date(task.created_at).getTime();
      if (createdTime < stallThreshold) {
        health.stalled++;
        // Recovery
        await base44.entities.AITask.update(task.id, {
          status: 'failed',
          error_message: 'Analysis task stalled (timeout)',
          updated_at: new Date().toISOString()
        });

        // Create recovery task
        await base44.entities.AITask.create({
          task_type: 'error_recovery_retry',
          status: 'queued',
          parent_task_id: task.id,
          original_error: 'stalled_analysis',
          retry_count: 1,
          priority: 80
        });
      }
    }

    // Log health report
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: 'Workflow health check completed',
      metadata: health,
      severity: 'info'
    });

    return Response.json(health);
  } catch (error) {
    console.error('Health monitor error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Check health of a single workflow
 */
async function checkWorkflowHealth(base44, workflow) {
  const updatedTime = new Date(workflow.updated_at || workflow.created_at).getTime();
  const now = Date.now();
  const ageMinutes = (now - updatedTime) / (1000 * 60);

  // If no update in 30+ minutes, consider stalled
  if (ageMinutes > 30) {
    return { status: 'stalled', ageMinutes };
  }

  // Check execution stats
  if (workflow.execution_stats?.failed_runs > 3) {
    return { status: 'failed', failedRuns: workflow.execution_stats.failed_runs };
  }

  return { status: 'healthy' };
}

/**
 * Handle stalled workflows
 */
async function handleStalledWorkflow(base44, workflow) {
  try {
    // Create recovery notification
    await base44.entities.ActivityLog.create({
      action_type: 'alert',
      message: `Workflow ${workflow.name} appears stalled, initiating recovery`,
      metadata: {
        workflow_id: workflow.id,
        action: 'stalled_recovery'
      },
      severity: 'warning'
    });

    // Reset workflow state
    await base44.asServiceRole.entities.Workflow.update(workflow.id, {
      status: 'active',
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error handling stalled workflow:', error);
  }
}

/**
 * Escalate failed workflows
 */
async function escalateFailedWorkflow(base44, workflow) {
  try {
    // Create escalation alert
    await base44.entities.ActivityLog.create({
      action_type: 'alert',
      message: `Workflow ${workflow.name} has failed multiple times, escalating for review`,
      metadata: {
        workflow_id: workflow.id,
        action: 'escalated',
        failedRuns: workflow.execution_stats?.failed_runs || 0
      },
      severity: 'critical'
    });

    // Mark for manual review
    await base44.asServiceRole.entities.Workflow.update(workflow.id, {
      status: 'paused',
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error escalating workflow:', error);
  }
}