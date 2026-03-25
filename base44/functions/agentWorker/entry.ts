/**
 * AGENT WORKER — Agentic autonomous task execution engine
 * Executes queued opportunities using real browser automation, LLM reasoning, and credential injection
 * Full end-to-end: task analysis → step-by-step execution → form filling → submission → verification
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // ─── queue_task: Add opportunity to execution queue ───────────────────────
    if (action === 'queue_task') {
      const {
        url, opportunity_id, opportunity_type, platform, identity_id, vault_id,
        credential_available, priority, estimated_value, deadline
      } = body;

      const task = await base44.asServiceRole.entities.TaskExecutionQueue.create({
        url,
        opportunity_id,
        opportunity_type,
        platform,
        identity_id,
        status: 'queued',
        priority: priority || 50,
        estimated_value,
        deadline,
        queue_timestamp: new Date().toISOString(),
        retry_count: 0,
        max_retries: 2
      });

      return Response.json({
        success: true,
        task: {
          id: task.id,
          status: task.status,
          opportunity_id: task.opportunity_id
        }
      });
    }

    // ─── execute_next_task: Pull from queue and execute ────────────────────────
    if (action === 'execute_next_task') {
      // Fetch highest-priority queued task
      const tasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
        { status: 'queued' },
        '-priority',
        1
      ).catch(() => []);

      if (!tasks.length) {
        return Response.json({ success: true, message: 'No queued tasks', task: null });
      }

      const task = tasks[0];

      // Update task status to processing
      await base44.asServiceRole.entities.TaskExecutionQueue.update(task.id, {
        status: 'processing',
        start_timestamp: new Date().toISOString()
      });

      // Execute task with LLM reasoning + browser automation
      const executionResult = await executeTaskWithLLMAndBrowser(base44, task);

      // Update task with results
      await base44.asServiceRole.entities.TaskExecutionQueue.update(task.id, {
        status: executionResult.success ? 'completed' : 'failed',
        completion_timestamp: new Date().toISOString(),
        submission_success: executionResult.success,
        confirmation_text: executionResult.confirmation,
        error_message: executionResult.error,
        execution_log: executionResult.logs || [],
        screenshot_url: executionResult.screenshot_url,
        execution_time_seconds: executionResult.execution_time
      });

      return Response.json({
        success: true,
        task: {
          id: task.id,
          status: executionResult.success ? 'completed' : 'failed',
          execution_result: executionResult
        }
      });
    }

    // ─── get_execution_stats: Return aggregated statistics ────────────────────
    if (action === 'get_execution_stats') {
      const allTasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter({}, null, 1000).catch(() => []);
      const completed = allTasks.filter(t => t.status === 'completed');
      const failed = allTasks.filter(t => t.status === 'failed');
      const totalValue = completed.reduce((s, t) => s + (t.estimated_value || 0), 0);

      const stats = {
        total_tasks: allTasks.length,
        completed: completed.length,
        failed: failed.length,
        success_rate: allTasks.length > 0 ? (completed.length / allTasks.length * 100).toFixed(1) : 0,
        total_value_completed: totalValue
      };

      return Response.json({ success: true, stats });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('[AgentWorker]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Execute task end-to-end: LLM analysis → browser automation → form filling → submission
 */
async function executeTaskWithLLMAndBrowser(base44, task) {
  const executionLog = [];
  const startTime = Date.now();

  try {
    executionLog.push({ step: 'initialize', status: 'started', timestamp: new Date().toISOString() });

    // Step 1: Fetch credential from vault
    let credentials = null;
    if (task.vault_id) {
      const vaultEntry = await base44.asServiceRole.entities.CredentialVault.filter(
        { id: task.vault_id },
        null,
        1
      ).catch(() => []);
      if (vaultEntry.length > 0) {
        credentials = vaultEntry[0];
      }
    }

    executionLog.push({ step: 'credential_loaded', status: 'success', timestamp: new Date().toISOString() });

    // Step 2: Use LLM to analyze page and form
    executionLog.push({ step: 'llm_page_analysis', status: 'started', timestamp: new Date().toISOString() });

    const llmAnalysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Analyze this webpage and identify the form fields, submission method, and required data:
      URL: ${task.url}
      Opportunity Type: ${task.opportunity_type}
      Platform: ${task.platform}
      
      Return a JSON schema with:
      - form_fields: array of {name, type, required, label}
      - submit_button_selector: CSS selector for submit button
      - form_action: URL where form submits
      - captcha_present: boolean
      - estimated_steps: array of sequential steps to complete
      
      Be specific and accurate for real form submission.`,
      response_json_schema: {
        type: 'object',
        properties: {
          form_fields: { type: 'array' },
          submit_button_selector: { type: 'string' },
          form_action: { type: 'string' },
          captcha_present: { type: 'boolean' },
          estimated_steps: { type: 'array' },
          confidence: { type: 'number' }
        }
      }
    }).catch(e => ({ data: { error: e.message } }));

    if (llmAnalysis.data?.error) {
      executionLog.push({ step: 'llm_analysis_failed', status: 'error', details: llmAnalysis.data.error });
      return {
        success: false,
        error: 'LLM page analysis failed: ' + llmAnalysis.data.error,
        logs: executionLog,
        execution_time: Math.round((Date.now() - startTime) / 1000)
      };
    }

    const pageAnalysis = llmAnalysis.data;
    executionLog.push({
      step: 'llm_analysis_complete',
      status: 'success',
      details: `Detected ${pageAnalysis.form_fields?.length || 0} form fields, captcha: ${pageAnalysis.captcha_present}`
    });

    // Step 3: Real browser automation
    executionLog.push({ step: 'browser_navigation', status: 'started' });

    const browserExecution = await base44.asServiceRole.functions.invoke('browserbaseExecutor', {
      action: 'navigate_and_fill_form',
      url: task.url,
      page_analysis: pageAnalysis,
      form_data: credentials ? JSON.parse(credentials.encrypted_payload) : null,
      task_id: task.id
    }).catch(e => ({ data: { success: false, error: e.message } }));

    if (!browserExecution.data?.success) {
      executionLog.push({
        step: 'browser_execution_failed',
        status: 'error',
        details: browserExecution.data?.error
      });
      return {
        success: false,
        error: 'Browser automation failed: ' + browserExecution.data?.error,
        logs: executionLog,
        execution_time: Math.round((Date.now() - startTime) / 1000)
      };
    }

    executionLog.push({
      step: 'form_filled_and_submitted',
      status: 'success',
      details: `Filled ${browserExecution.data.fields_filled || 0} fields, submitted form`
    });

    // Step 4: Verify submission
    const verification = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Analyze this HTML and determine if the form submission was successful:
      HTML: ${browserExecution.data.final_html?.substring(0, 2000) || 'N/A'}
      
      Return JSON with:
      - submission_successful: boolean
      - confirmation_message: string
      - next_steps: string array
      - error: string if failed`,
      response_json_schema: {
        type: 'object',
        properties: {
          submission_successful: { type: 'boolean' },
          confirmation_message: { type: 'string' },
          next_steps: { type: 'array' },
          error: { type: 'string' }
        }
      }
    }).catch(() => null);

    const isSuccessful = verification?.data?.submission_successful || browserExecution.data?.submission_confirmed;

    executionLog.push({
      step: 'verification_complete',
      status: isSuccessful ? 'success' : 'failed',
      details: verification?.data?.confirmation_message || 'Submission status unclear'
    });

    return {
      success: isSuccessful,
      confirmation: verification?.data?.confirmation_message || 'Task executed',
      logs: executionLog,
      screenshot_url: browserExecution.data?.screenshot_url,
      execution_time: Math.round((Date.now() - startTime) / 1000)
    };

  } catch (error) {
    executionLog.push({ step: 'fatal_error', status: 'error', details: error.message });
    return {
      success: false,
      error: error.message,
      logs: executionLog,
      execution_time: Math.round((Date.now() - startTime) / 1000)
    };
  }
}