import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Autopilot Task Executor
 * Processes queued tasks from TaskExecutionQueue and executes them
 * Updates status through completion workflow
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action } = await req.json();

    // ─── EXECUTE_NEXT_TASK ─────────────────────────────────────────
    if (action === 'execute_next_task') {
      return await executeNextTask(base44, user);
    }

    // ─── EXECUTE_BATCH ────────────────────────────────────────────
    if (action === 'execute_batch') {
      return await executeBatch(base44, user);
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function executeNextTask(base44, user) {
  const result = {
    timestamp: new Date().toISOString(),
    executed: false,
    task_id: null,
    steps: []
  };

  try {
    // Get next highest priority queued task
    const tasks = await base44.entities.TaskExecutionQueue.filter(
      { created_by: user.email, status: 'queued' },
      '-priority',
      1
    ).catch(() => []);

    const tasksArray = Array.isArray(tasks) ? tasks : [];
    
    if (tasksArray.length === 0) {
      result.steps.push('No queued tasks found');
      return Response.json({ success: true, result });
    }

    const task = tasksArray[0];
    result.task_id = task.id;

    // Mark task as processing
    result.steps.push('Marking task as processing...');
    await base44.entities.TaskExecutionQueue.update(task.id, {
      status: 'processing',
      start_timestamp: new Date().toISOString()
    }).catch(e => {
      result.steps.push(`Error: ${e.message}`);
    });

    // Real browser automation execution (replaces simulation)
    // Step 1: Inject credentials from vault
    result.steps.push('Injecting credentials...');
    const credResult = await base44.functions.invoke('credentialInjection', {
      action: 'inject_task_credentials',
      task: { id: task.id, platform: task.platform, url: task.url, identity_id: task.identity_id }
    }).catch(e => ({ data: { success: false, error: e.message } }));

    if (!credResult.data?.success) {
      result.steps.push(`⚠️ Credential injection: ${credResult.data?.error || 'Failed'}`);
    } else {
      result.steps.push('✓ Credentials injected');
    }

    // Step 2: Analyze page and extract form fields
    result.steps.push('Analyzing page structure...');
    const pageAnalysisResult = await base44.functions.invoke('browserAutomationReal', {
      action: 'analyze_page',
      url: task.url
    }).catch(e => ({ data: { success: false, error: e.message } }));

    if (!pageAnalysisResult.data?.success) {
      result.steps.push(`⚠️ Page analysis: ${pageAnalysisResult.data?.error || 'Failed'}`);
    } else {
      result.steps.push(`✓ Found form fields`);
    }

    // Step 3: Fill forms with intelligent mapping
    result.steps.push('Filling form fields...');
    const formFillResult = await base44.functions.invoke('formFillingEngine', {
      action: 'build_form_data',
      formFields: pageAnalysisResult.data?.structure?.inputs || [],
      identity: { email: task.identity_id },
      opportunity: { title: task.description, description: task.description }
    }).catch(e => ({ data: { success: false, error: e.message } }));

    if (!formFillResult.data?.success) {
      result.steps.push(`⚠️ Form filling: ${formFillResult.data?.error || 'Failed'}`);
    } else {
      result.steps.push(`✓ Filled ${formFillResult.data?.fields_filled || 0} fields`);
    }

    // Step 4: Solve CAPTCHA if present
    result.steps.push('Checking for CAPTCHA...');
    const captchaResult = await base44.functions.invoke('captchaSolver', {
      action: 'check_captcha_service'
    }).catch(e => ({ data: { available: false } }));

    if (captchaResult.data?.available) {
      result.steps.push('✓ CAPTCHA solver ready');
    } else {
      result.steps.push('ℹ️ CAPTCHA solver not configured');
    }

    // Step 5: Execute real browser automation with form data
    result.steps.push('Executing browser automation...');
    const executionResult = await base44.functions.invoke('browserAutomationReal', {
      action: 'execute_task',
      task: {
        id: task.id,
        url: task.url,
        form_fields: formFillResult.data?.form_data || {},
        credentials: credResult.data?.credentials,
        authorization_headers: credResult.data?.authorization_headers
      }
    }).catch(e => ({ data: { success: false, error: e.message } }));

    if (!executionResult.data?.success) {
      result.steps.push(`❌ Execution failed: ${executionResult.data?.error || 'Unknown error'}`);
    } else {
      result.steps.push(`✓ Real submission completed`);
    }

    const executionSteps = [
      { step: 1, action: 'Inject credentials', status: credResult.data?.success ? 'completed' : 'failed' },
      { step: 2, action: 'Analyze page structure', status: pageAnalysisResult.data?.success ? 'completed' : 'failed' },
      { step: 3, action: 'Fill form data', status: formFillResult.data?.success ? 'completed' : 'failed' },
      { step: 4, action: 'Check CAPTCHA', status: 'completed' },
      { step: 5, action: 'Submit application', status: executionResult.data?.success ? 'completed' : 'failed' }
    ];

    // Mark task as completed (only if execution succeeded)
    result.steps.push('Finalizing completion...');
    const finalStatus = executionResult.data?.success ? 'completed' : 'failed';
    const finalSubmissionStatus = executionResult.data?.success ? true : false;

    await base44.entities.TaskExecutionQueue.update(task.id, {
      status: finalStatus,
      completion_timestamp: new Date().toISOString(),
      submission_success: finalSubmissionStatus,
      confirmation_number: executionResult.data?.execution?.confirmation?.text,
      confirmation_text: executionResult.data?.execution?.confirmation?.text,
      execution_steps: executionSteps,
      execution_time_seconds: Math.round((Date.now() - new Date(task.queue_timestamp).getTime()) / 1000),
      error_message: executionResult.data?.error
    }).catch(e => {
      result.steps.push(`Error: ${e.message}`);
    });

    // Update related opportunity (only mark as completed if submission succeeded)
    if (task.opportunity_id && finalSubmissionStatus) {
      await base44.entities.Opportunity.update(task.opportunity_id, {
        status: 'completed',
        submission_confirmed: true,
        submission_timestamp: new Date().toISOString(),
        confirmation_number: executionResult.data?.execution?.confirmation?.text
      }).catch(() => {});
    }

    // Log successful execution
    await base44.entities.ActivityLog.create({
      action_type: 'execution',
      message: `✅ Task completed for "${task.platform}" opportunity`,
      severity: 'success',
      metadata: {
        task_id: task.id,
        opportunity_id: task.opportunity_id,
        identity_id: task.identity_id,
        value: task.estimated_value
      }
    }).catch(() => {});

    result.executed = true;
    return Response.json({ success: true, result });

  } catch (e) {
    result.steps.push(`Fatal error: ${e.message}`);
    return Response.json({ success: false, result }, { status: 500 });
  }
}

async function executeBatch(base44, user) {
  const batch = {
    timestamp: new Date().toISOString(),
    tasks_processed: 0,
    tasks_completed: 0,
    errors: []
  };

  try {
    // Get all queued tasks
    const tasks = await base44.entities.TaskExecutionQueue.filter(
      { created_by: user.email, status: 'queued' },
      '-priority',
      10
    ).catch(() => []);

    const tasksArray = Array.isArray(tasks) ? tasks : [];
    batch.tasks_processed = tasksArray.length;

    // Execute each task sequentially
    for (const task of tasksArray) {
      try {
        // Mark as processing
        await base44.entities.TaskExecutionQueue.update(task.id, {
          status: 'processing',
          start_timestamp: new Date().toISOString()
        }).catch(() => {});

        // Real execution via browser automation
        const execResult = await base44.functions.invoke('browserAutomationReal', {
          action: 'execute_task',
          task: {
            id: task.id,
            url: task.url,
            form_fields: {},
            credentials: {}
          }
        }).catch(e => ({ data: { success: false, error: e.message } }));

        const executionSuccess = execResult.data?.success === true;

        // Update task with real results
        await base44.entities.TaskExecutionQueue.update(task.id, {
          status: executionSuccess ? 'completed' : 'failed',
          completion_timestamp: new Date().toISOString(),
          submission_success: executionSuccess,
          execution_time_seconds: execResult.data?.execution?.steps_completed || 0,
          error_message: execResult.data?.error
        }).catch(() => {});

        // Update opportunity if linked and execution succeeded
        if (task.opportunity_id && executionSuccess) {
          await base44.entities.Opportunity.update(task.opportunity_id, {
            status: 'completed',
            submission_confirmed: true
          }).catch(() => {});
        }

        if (executionSuccess) {
          batch.tasks_completed++;
        }

      } catch (taskError) {
        batch.errors.push(`Task ${task.id} failed: ${taskError.message}`);
      }
    }

    // Log batch execution
    await base44.entities.ActivityLog.create({
      action_type: 'execution',
      message: `📦 Batch execution: ${batch.tasks_completed}/${batch.tasks_processed} tasks completed`,
      severity: batch.errors.length === 0 ? 'success' : 'warning',
      metadata: batch
    }).catch(() => {});

    return Response.json({ success: batch.tasks_completed > 0, batch });

  } catch (e) {
    batch.errors.push(`Batch error: ${e.message}`);
    return Response.json({ success: false, batch }, { status: 500 });
  }
}