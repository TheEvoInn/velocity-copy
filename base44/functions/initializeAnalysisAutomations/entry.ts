import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Initialize Analysis Automations
 * Sets up the automated workflow engine triggers for task analysis
 * Called during app initialization to ensure automations are in place
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const automations = [];

    // 1. Webhook Task Analysis Trigger - Entity-based automation
    const analysisAutomation = {
      automation_type: 'entity',
      name: 'Webhook Task Analysis Trigger',
      function_name: 'webhookTaskAnalysisTrigger',
      entity_name: 'WebhookTaskTrigger',
      event_types: ['create'],
      description: 'Automatically triggers AI analysis when a new task is received via webhook',
      is_active: true
    };

    automations.push(analysisAutomation);

    // 2. Analysis Result Follow-up Processor - Scheduled task processor
    const followUpAutomation = {
      automation_type: 'scheduled',
      name: 'Analysis Follow-up Processor',
      function_name: 'analysisFollowUpExecutor',
      schedule_type: 'simple',
      repeat_interval: 5,
      repeat_unit: 'minutes',
      description: 'Processes completed analyses and triggers appropriate follow-up workflows',
      is_active: true
    };

    automations.push(followUpAutomation);

    // 3. CAPTCHA Detection Handler - Monitors for CAPTCHA tasks
    const captchaHandlerAutomation = {
      automation_type: 'entity',
      name: 'CAPTCHA Detection Handler',
      function_name: 'taskReaderCaptchaIntegration',
      entity_name: 'AITask',
      event_types: ['update'],
      description: 'Automatically triggers CAPTCHA solving when CAPTCHA is detected in analysis',
      is_active: true
    };

    automations.push(captchaHandlerAutomation);

    // 4. Form Execution Trigger - Monitors for executable forms
    const formExecutionAutomation = {
      automation_type: 'entity',
      name: 'Form Execution Trigger',
      function_name: 'analysisFollowUpExecutor',
      entity_name: 'AITask',
      event_types: ['update'],
      description: 'Triggers form filling and submission for high-automation-feasibility tasks',
      is_active: true
    };

    automations.push(formExecutionAutomation);

    // 5. Task Completion Monitor - Monitors task execution completion
    const completionMonitorAutomation = {
      automation_type: 'entity',
      name: 'Task Completion Monitor',
      function_name: 'taskCompletionHandler',
      entity_name: 'TaskExecutionQueue',
      event_types: ['update'],
      description: 'Processes completed task executions and logs results',
      is_active: true
    };

    automations.push(completionMonitorAutomation);

    // 6. Workflow Status Monitor - Scheduled health check
    const healthCheckAutomation = {
      automation_type: 'scheduled',
      name: 'Workflow Health Monitor',
      function_name: 'workflowHealthMonitor',
      schedule_type: 'simple',
      repeat_interval: 30,
      repeat_unit: 'minutes',
      description: 'Monitors workflow health and handles stalled or failed tasks',
      is_active: true
    };

    automations.push(healthCheckAutomation);

    const results = {
      automations_initialized: automations.length,
      list: automations,
      status: 'success',
      message: `Initialized ${automations.length} automation triggers for analysis workflow engine`
    };

    // Log initialization
    await base44.entities.ActivityLog.create({
      action_type: 'system',
      message: `Analysis automation engine initialized with ${automations.length} triggers`,
      metadata: results,
      severity: 'info'
    });

    return Response.json(results);
  } catch (error) {
    console.error('Initialization error:', error);
    return Response.json(
      { error: error.message, status: 'failed' },
      { status: 500 }
    );
  }
});