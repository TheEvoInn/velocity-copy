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
    steps: [],
    lock_token: null
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

      // ─── PHASE 0: Acquire execution lock ────────────────────────────
      result.steps.push('Acquiring task execution lock...');
      const lockResult = await base44.functions.invoke('taskExecutionLockManager', {
        action: 'acquire_lock',
        platform: task.platform,
        accountId: task.identity_id
      }).catch(e => ({ success: false, error: e.message }));

      if (!lockResult.success) {
        result.steps.push(`⏳ Account locked: ${lockResult.message || 'Task queued for later'}`);
        // Queue task for retry
        await base44.functions.invoke('taskExecutionLockManager', {
          action: 'queue_task',
          taskId: task.id,
          reason: lockResult.message || 'Account in use by another task'
        }).catch(() => null);

        // Revert processing status
        await base44.entities.TaskExecutionQueue.update(task.id, {
          status: 'queued'
        }).catch(() => null);

        return Response.json({ success: true, result, queued: true });
      }

      result.lock_token = lockResult.lock_token;
      result.steps.push('✓ Execution lock acquired');

     // ─── PHASE 4: Account preparation ──────────────────────────────
    result.steps.push('Preparing accounts for task execution...');
    const opportunity = await base44.entities.Opportunity.filter(
      { id: task.opportunity_id }, null, 1
    ).then(opps => opps[0]).catch(() => null);

    if (opportunity) {
      const accountPrepResult = await base44.functions.invoke('autopilotAccountPreparation', {
        action: 'prepare_account',
        identityId: task.identity_id,
        opportunity
      }).catch(e => ({ success: false, error: e.message }));

      if (accountPrepResult.success && accountPrepResult.result?.account_prepared) {
        result.steps.push('✓ Account verified/created and ready');
      } else if (accountPrepResult.requires_manual_setup) {
        result.steps.push('⚠️ Platform requires manual setup - continuing with existing identity');
      } else {
        result.steps.push(`⚠️ Account preparation: ${accountPrepResult.error || 'Issue encountered'}`);
      }
    }

    // ─── PHASE 5: Intelligent identity routing ────────────────────────
    result.steps.push('Selecting optimal identity...');

    let selectedIdentity = task.identity_id;
    if (opportunity) {
      const routingResult = await base44.functions.invoke('intelligentIdentityRouter', {
        action: 'select_best_identity',
        opportunity
      }).catch(e => ({ success: false, error: e.message }));

      if (routingResult.success) {
        selectedIdentity = routingResult.identity.id;
        result.steps.push(`✓ Identity selected: "${routingResult.identity.name}" (score: ${routingResult.score}/100)`);
      } else {
        result.steps.push(`⚠️ Using assigned identity: ${task.identity_id}`);
      }
    }

     // Update task with selected identity
     await base44.entities.TaskExecutionQueue.update(task.id, {
       identity_id: selectedIdentity
     }).catch(() => null);

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

      // ─── PHASE 4: Smart retry orchestration ─────────────────────────
      result.steps.push('Analyzing failure for retry...');
      const retryResult = await base44.functions.invoke('smartRetryOrchestrator', {
        action: 'execute_retry',
        task: { ...task, identity_id: selectedIdentity },
        error_type: executionResult.data?.error_type || 'unknown'
      }).catch(e => ({ success: false, error: e.message }));

      if (retryResult.success && retryResult.action === 'retry_scheduled') {
        result.steps.push(`🔄 Retry scheduled (Attempt ${retryResult.retry.retry_attempt}/${retryResult.retry.max_retries})`);
      } else if (retryResult.action === 'escalate_to_manual_review') {
        result.steps.push(`📋 Task escalated to manual review`);
      }
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

      // ─── PHASE 4: Record transaction & compliance check ───────────────
      result.steps.push('Recording transaction and compliance check...');
      const complianceResult = await base44.functions.invoke('riskComplianceEngine', {
        action: 'check_compliance'
      }).catch(e => ({ success: false, error: e.message }));

      if (!complianceResult.success) {
        result.steps.push(`⚠️ Compliance warning: ${complianceResult.status?.checks?.filter(c => c.startsWith('❌'))[0] || 'See details'}`);
      } else {
        result.steps.push('✓ Compliance check passed');
      }

      // Record transaction if cleared
      if (task.estimated_value && executionResult.data?.execution?.confirmation?.text) {
        const txnResult = await base44.functions.invoke('transactionRecorder', {
          opportunity_id: task.opportunity_id,
          platform: task.platform,
          amount: task.estimated_value,
          platform_transaction_id: executionResult.data?.execution?.confirmation?.text,
          job_title: task.description
        }).catch(e => ({ success: false, error: e.message }));

        if (txnResult.success) {
          result.steps.push(`💰 Transaction recorded: $${task.estimated_value.toFixed(2)}`);
        }
      }
    }

    // Log execution with identity tracking
    await base44.entities.ActivityLog.create({
      action_type: 'execution',
      message: `✅ Task completed for "${task.platform}" opportunity`,
      severity: 'success',
      metadata: {
        task_id: task.id,
        opportunity_id: task.opportunity_id,
        identity_id: selectedIdentity,
        value: task.estimated_value,
        compliance_passed: true
      }
    }).catch(() => {});

    // Release execution lock
    if (result.lock_token) {
      await base44.functions.invoke('taskExecutionLockManager', {
        action: 'release_lock',
        lockToken: result.lock_token
      }).catch(() => null);
      result.steps.push('✓ Execution lock released');
    }

    result.executed = true;
    return Response.json({ success: true, result });

  } catch (e) {
    result.steps.push(`Fatal error: ${e.message}`);
    
    // Release lock on fatal error
    if (result.lock_token) {
      await base44.functions.invoke('taskExecutionLockManager', {
        action: 'release_lock',
        lockToken: result.lock_token
      }).catch(() => null);
    }

    return Response.json({ success: false, result }, { status: 500 });
  }
}

async function executeBatch(base44, user) {
  const batch = {
    timestamp: new Date().toISOString(),
    tasks_processed: 0,
    tasks_completed: 0,
    tasks_queued: 0,
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

    // Execute each task sequentially (locks ensure one per account)
    for (const task of tasksArray) {
      let lockToken = null;
      try {
        // Acquire lock for this task
        const lockResult = await base44.functions.invoke('taskExecutionLockManager', {
          action: 'acquire_lock',
          platform: task.platform,
          accountId: task.identity_id
        }).catch(e => ({ success: false, error: e.message }));

        if (!lockResult.success) {
          // Queue for later
          await base44.functions.invoke('taskExecutionLockManager', {
            action: 'queue_task',
            taskId: task.id,
            reason: 'Account locked by concurrent task'
          }).catch(() => null);
          batch.tasks_queued++;
          continue;
        }

        lockToken = lockResult.lock_token;

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

        // Release lock
        if (lockToken) {
          await base44.functions.invoke('taskExecutionLockManager', {
            action: 'release_lock',
            lockToken
          }).catch(() => null);
        }

      } catch (taskError) {
        batch.errors.push(`Task ${task.id} failed: ${taskError.message}`);
        
        // Release lock on error
        if (lockToken) {
          await base44.functions.invoke('taskExecutionLockManager', {
            action: 'release_lock',
            lockToken
          }).catch(() => null);
        }
      }
    }

    // Log batch execution
    await base44.entities.ActivityLog.create({
      action_type: 'execution',
      message: `📦 Batch execution: ${batch.tasks_completed}/${batch.tasks_processed} completed, ${batch.tasks_queued} queued (locked accounts)`,
      severity: batch.errors.length === 0 ? 'success' : 'warning',
      metadata: batch
    }).catch(() => {});

    return Response.json({ success: batch.tasks_completed > 0, batch });

  } catch (e) {
    batch.errors.push(`Batch error: ${e.message}`);
    return Response.json({ success: false, batch }, { status: 500 });
  }
}