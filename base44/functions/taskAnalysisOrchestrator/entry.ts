import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Task Analysis Orchestrator
 * Automatically analyzes tasks received via webhook using AI
 * Triggers follow-up workflows based on analysis results
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { taskId, url, taskName, webhookId } = payload;

    if (!taskId || !url) {
      return Response.json({ error: 'Missing taskId or url' }, { status: 400 });
    }

    // Create analysis workflow record
    const workflow = await base44.entities.Workflow.create({
      name: `Analysis: ${taskName || url}`,
      description: `Automated AI analysis workflow for task ${taskId}`,
      status: 'active',
      nodes: [],
      edges: [],
      triggers: ['webhook'],
      trigger_config: { webhook_id: webhookId },
      execution_config: {
        max_retries: 3,
        timeout_seconds: 300,
        parallel_execution: false,
        error_handling: 'retry'
      }
    });

    // Queue AI analysis task
    const analysisTask = await base44.entities.AITask.create({
      task_type: 'url_analysis',
      status: 'queued',
      priority: 100,
      url: url,
      task_name: taskName,
      webhook_id: webhookId,
      workflow_id: workflow.id,
      analysis_config: {
        analyze_forms: true,
        detect_captcha: true,
        extract_metadata: true,
        ai_enabled: true
      },
      created_at: new Date().toISOString()
    });

    // Trigger immediate AI analysis
    const analysisResult = await analyzeTaskWithAI(base44, analysisTask.id, url, taskName);

    // Update task with analysis results
    await base44.entities.AITask.update(analysisTask.id, {
      status: 'completed',
      analysis_results: analysisResult,
      completed_at: new Date().toISOString()
    });

    // Trigger follow-up workflows based on results
    await triggerFollowUpWorkflows(base44, analysisTask.id, analysisResult, workflow.id);

    return Response.json({
      success: true,
      taskId,
      workflowId: workflow.id,
      analysisTaskId: analysisTask.id,
      resultsReady: true
    });
  } catch (error) {
    console.error('Task analysis error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Analyze task URL using configured AI
 */
async function analyzeTaskWithAI(base44, taskId, url, taskName) {
  const aiApiKey = Deno.env.get('GOOGLE_AI_API_KEY') || Deno.env.get('OPENAI_API_KEY');

  if (!aiApiKey) {
    throw new Error('AI API key not configured');
  }

  const analysisPrompt = `Analyze this web form/task and provide:
1. Page type and purpose
2. Required form fields and their types
3. Potential CAPTCHAs or security measures
4. Success indicators
5. Estimated completion time
6. Risk assessment (1-10)
7. Automation feasibility (1-10)

URL: ${url}
Task Name: ${taskName || 'Unknown'}

Provide response as JSON.`;

  try {
    // Use base44 InvokeLLM integration
    const response = await base44.integrations.Core.InvokeLLM({
      prompt: analysisPrompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: 'object',
        properties: {
          page_type: { type: 'string' },
          purpose: { type: 'string' },
          form_fields: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                type: { type: 'string' },
                required: { type: 'boolean' }
              }
            }
          },
          captcha_detected: { type: 'boolean' },
          captcha_type: { type: 'string' },
          success_indicators: {
            type: 'array',
            items: { type: 'string' }
          },
          estimated_time_minutes: { type: 'number' },
          risk_score: { type: 'number' },
          automation_feasibility: { type: 'number' },
          blockers: {
            type: 'array',
            items: { type: 'string' }
          },
          recommendations: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    });

    return {
      status: 'success',
      analyzedAt: new Date().toISOString(),
      data: response.data,
      taskId
    };
  } catch (error) {
    console.error('AI analysis failed:', error);
    return {
      status: 'failed',
      error: error.message,
      taskId,
      analyzedAt: new Date().toISOString()
    };
  }
}

/**
 * Trigger follow-up workflows based on analysis results
 */
async function triggerFollowUpWorkflows(base44, taskId, analysisResult, workflowId) {
  if (!analysisResult.data) return;

  const { captcha_detected, automation_feasibility, risk_score, blockers } = analysisResult.data;

  // Create follow-up tasks based on analysis
  const followUpTasks = [];

  // CAPTCHA detected - queue captcha solver
  if (captcha_detected) {
    followUpTasks.push({
      task_type: 'captcha_solve',
      status: 'queued',
      priority: 90,
      parent_task_id: taskId,
      workflow_id: workflowId,
      config: {
        captcha_type: analysisResult.data.captcha_type,
        auto_solve: true
      }
    });
  }

  // High automation feasibility - queue execution
  if (automation_feasibility >= 7 && blockers.length === 0) {
    followUpTasks.push({
      task_type: 'form_fill_execute',
      status: 'queued',
      priority: 85,
      parent_task_id: taskId,
      workflow_id: workflowId,
      config: {
        auto_submit: true,
        retry_on_failure: true
      }
    });
  }

  // High risk - flag for review
  if (risk_score >= 7) {
    followUpTasks.push({
      task_type: 'manual_review',
      status: 'pending',
      priority: 70,
      parent_task_id: taskId,
      workflow_id: workflowId,
      config: {
        reason: 'High risk score',
        risk_level: 'high'
      }
    });
  }

  // Create all follow-up tasks
  for (const followUpTask of followUpTasks) {
    await base44.entities.AITask.create(followUpTask);
  }

  return followUpTasks.length;
}