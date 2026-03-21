import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Webhook Task Analysis Trigger
 * Automatically triggered when a webhook receives a new task
 * Invokes the task analysis orchestrator
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { webhook_id, task_data } = payload;

    if (!webhook_id || !task_data) {
      return Response.json({ error: 'Missing webhook_id or task_data' }, { status: 400 });
    }

    // Create initial task record
    const task = await base44.entities.TaskExecutionQueue.create({
      url: task_data.url,
      opportunity_type: 'application',
      platform: task_data.platform || 'unknown',
      status: 'queued',
      priority: task_data.priority || 50,
      estimated_value: task_data.estimated_value || 0,
      deadline: task_data.deadline,
      queue_timestamp: new Date().toISOString(),
      page_structure: null,
      form_fields_detected: [],
      submission_success: false
    });

    // Get webhook config for identity assignment
    const webhook = await base44.entities.WebhookTaskTrigger.filter({
      id: webhook_id,
      created_by: user.email
    });

    if (!webhook || webhook.length === 0) {
      throw new Error('Webhook not found');
    }

    const webhookConfig = webhook[0];
    const identityId = webhookConfig.task_parameters?.identity_id || user.email;

    // Invoke analysis orchestrator
    const analysisResponse = await base44.asServiceRole.functions.invoke('taskAnalysisOrchestrator', {
      taskId: task.id,
      url: task_data.url,
      taskName: task_data.task_name,
      webhookId: webhook_id,
      identityId: identityId
    });

    if (!analysisResponse.data?.success) {
      throw new Error('Analysis orchestration failed');
    }

    // Update task with analysis results
    await base44.entities.TaskExecutionQueue.update(task.id, {
      status: 'analyzing',
      workflow_id: analysisResponse.data.workflowId
    });

    // Log activity
    await base44.entities.ActivityLog.create({
      action_type: 'scan',
      message: `Webhook triggered analysis for task: ${task_data.url}`,
      metadata: {
        task_id: task.id,
        webhook_id: webhook_id,
        workflow_id: analysisResponse.data.workflowId
      },
      severity: 'info'
    });

    return Response.json({
      success: true,
      taskId: task.id,
      workflowId: analysisResponse.data.workflowId,
      status: 'analysis_started'
    });
  } catch (error) {
    console.error('Webhook analysis trigger error:', error);
    
    // Log error activity
    try {
      const base44 = createClientFromRequest(req);
      await base44.entities.ActivityLog.create({
        action_type: 'alert',
        message: `Webhook analysis trigger failed: ${error.message}`,
        metadata: { error: error.message },
        severity: 'critical'
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return Response.json({ error: error.message }, { status: 500 });
  }
});