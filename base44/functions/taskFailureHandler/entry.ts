import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Called when a task execution fails
 * Triggers the smart retry analysis and orchestration pipeline
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      task_id,
      error_message,
      http_status,
      platform,
      execution_log,
    } = await req.json();

    if (!task_id) {
      return Response.json({ error: 'Missing task_id' }, { status: 400 });
    }

    console.log(`Processing failure for task ${task_id}: ${error_message}`);

    // Step 1: Analyze the error
    const analysisResult = await base44.functions.invoke('smartErrorAnalyzer', {
      task_id,
      error_message,
      http_status,
      platform,
      execution_log,
    });

    console.log('Analysis result:', analysisResult);

    if (!analysisResult) {
      return Response.json({
        status: 'error',
        message: 'Error analysis failed',
      }, { status: 500 });
    }

    // Step 2: Check if user input required (intervention)
    if (analysisResult.requires_user_input) {
      const interventionResult = await base44.functions.invoke('createUserIntervention', {
        task_id,
        requirement_type: analysisResult.error_type,
        data_schema: buildDataSchema(analysisResult),
        priority: 85
      }).catch(() => null);

      if (interventionResult) {
        return Response.json({
          task_id,
          analysis: analysisResult,
          intervention_created: true,
          intervention_id: interventionResult.intervention_id,
          message: 'User intervention required',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Step 3: Orchestrate retry if recoverable
    let retryResult = null;
    if (analysisResult.is_recoverable) {
      retryResult = await base44.functions.invoke('smartRetryOrchestrator', {
        task_id,
        analysis: analysisResult,
        force_retry: false,
      });
    } else {
      // Not recoverable - escalate immediately
      await base44.entities.TaskExecutionQueue.update(task_id, {
        status: 'failed',
        needs_manual_review: true,
        manual_review_reason: `Unrecoverable error: ${analysisResult.error_type}`,
      });

      // Create escalation record
      await base44.entities.ActivityLog.create({
        action_type: 'alert',
        message: `Task escalated due to ${analysisResult.error_type}`,
        metadata: {
          task_id,
          error_type: analysisResult.error_type,
          error_message,
        },
        severity: 'critical',
      });

      retryResult = {
        status: 'escalated',
        reason: analysisResult.error_type,
      };
    }

    return Response.json({
      task_id,
      analysis: analysisResult,
      retry_result: retryResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Task failure handler error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function buildDataSchema(analysis) {
  const schemas = {
    'captcha': {
      type: 'object',
      properties: {
        captcha_solution: { type: 'string', description: 'Captcha solution code' }
      },
      required: ['captcha_solution']
    },
    'credential': {
      type: 'object',
      properties: {
        platform: { type: 'string' },
        username: { type: 'string' },
        password: { type: 'string' }
      },
      required: ['platform', 'username', 'password']
    },
    'two_factor': {
      type: 'object',
      properties: {
        code: { type: 'string', description: '2FA code' }
      },
      required: ['code']
    }
  };
  return schemas[analysis.error_type] || { type: 'object', properties: {} };
}