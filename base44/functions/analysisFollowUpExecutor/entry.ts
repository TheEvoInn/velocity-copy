import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Analysis Follow-Up Executor
 * Executes follow-up workflows triggered by analysis results
 * Handles CAPTCHA solving, form filling, manual reviews, etc.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { analysisTaskId, taskType, config } = payload;

    if (!analysisTaskId || !taskType) {
      return Response.json({ error: 'Missing analysisTaskId or taskType' }, { status: 400 });
    }

    // Get the analysis task
    const analysisTasks = await base44.entities.AITask.filter({
      id: analysisTaskId,
      created_by: user.email
    });

    if (!analysisTasks || analysisTasks.length === 0) {
      return Response.json({ error: 'Analysis task not found' }, { status: 404 });
    }

    const analysisTask = analysisTasks[0];
    let result = { success: false };

    // Route to appropriate handler
    switch (taskType) {
      case 'captcha_solve':
        result = await handleCaptchaSolving(base44, analysisTask, config);
        break;
      case 'form_fill_execute':
        result = await handleFormFilling(base44, analysisTask, config);
        break;
      case 'credential_injection':
        result = await handleCredentialInjection(base44, analysisTask, config);
        break;
      case 'manual_review':
        result = await handleManualReview(base44, analysisTask, config);
        break;
      case 'error_recovery':
        result = await handleErrorRecovery(base44, analysisTask, config);
        break;
      default:
        return Response.json({ error: 'Unknown task type' }, { status: 400 });
    }

    return Response.json(result);
  } catch (error) {
    console.error('Follow-up executor error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Handle CAPTCHA solving
 */
async function handleCaptchaSolving(base44, analysisTask, config) {
  const { captcha_type } = config;

  try {
    // Invoke CAPTCHA solver
    const captchaResult = await base44.asServiceRole.functions.invoke('captchaSolver', {
      captcha_type: captcha_type,
      auto_solve: true,
      analysis_task_id: analysisTask.id
    });

    // Update analysis task with CAPTCHA result
    await base44.entities.AITask.update(analysisTask.id, {
      status: 'captcha_solving_completed',
      captcha_result: captchaResult.data,
      updated_at: new Date().toISOString()
    });

    return {
      success: true,
      taskType: 'captcha_solve',
      result: captchaResult.data
    };
  } catch (error) {
    console.error('CAPTCHA solving failed:', error);
    return {
      success: false,
      taskType: 'captcha_solve',
      error: error.message
    };
  }
}

/**
 * Handle form filling and submission
 */
async function handleFormFilling(base44, analysisTask, config) {
  const { auto_submit, retry_on_failure } = config;

  try {
    // Get analysis results
    const analysisResults = analysisTask.analysis_results?.data || {};
    const { form_fields } = analysisResults;

    if (!form_fields || form_fields.length === 0) {
      return {
        success: false,
        taskType: 'form_fill_execute',
        error: 'No form fields detected in analysis'
      };
    }

    // Create execution task
    const executionTask = await base44.entities.TaskExecutionQueue.create({
      url: analysisTask.url,
      opportunity_type: 'application',
      platform: 'auto_filled',
      status: 'executing',
      priority: 80,
      form_fields_detected: form_fields,
      page_structure: analysisResults,
      execution_log: [{
        timestamp: new Date().toISOString(),
        step: 'form_fill_execution_started',
        status: 'executing',
        details: `Executing form fill for ${form_fields.length} fields`
      }]
    });

    // Log activity
    await base44.entities.ActivityLog.create({
      action_type: 'user_action',
      message: `Form filling initiated for ${analysisTask.url}`,
      metadata: {
        analysis_task_id: analysisTask.id,
        execution_task_id: executionTask.id,
        field_count: form_fields.length
      },
      severity: 'info'
    });

    return {
      success: true,
      taskType: 'form_fill_execute',
      executionTaskId: executionTask.id,
      fieldCount: form_fields.length,
      autoSubmit: auto_submit
    };
  } catch (error) {
    console.error('Form filling failed:', error);
    return {
      success: false,
      taskType: 'form_fill_execute',
      error: error.message
    };
  }
}

/**
 * Handle credential injection preparation
 */
async function handleCredentialInjection(base44, analysisTask, config) {
  const { platform, credential_type } = config;

  try {
    // Check for available credentials
    const credentials = await base44.entities.EncryptedCredential.filter({
      platform: platform,
      credential_type: credential_type,
      is_active: true,
      created_by: (await base44.auth.me()).email
    });

    if (!credentials || credentials.length === 0) {
      return {
        success: false,
        taskType: 'credential_injection',
        error: 'No credentials available for injection',
        credentialRequired: true
      };
    }

    // Update analysis task with credential readiness
    await base44.entities.AITask.update(analysisTask.id, {
      status: 'credentials_ready',
      credentials_available: credentials.length,
      updated_at: new Date().toISOString()
    });

    return {
      success: true,
      taskType: 'credential_injection',
      credentialsAvailable: credentials.length,
      readyForInjection: true
    };
  } catch (error) {
    console.error('Credential injection preparation failed:', error);
    return {
      success: false,
      taskType: 'credential_injection',
      error: error.message
    };
  }
}

/**
 * Handle manual review queue
 */
async function handleManualReview(base44, analysisTask, config) {
  const { reason, risk_level } = config;

  try {
    // Create review task
    const reviewTask = await base44.entities.TaskReviewQueue.create({
      analysis_task_id: analysisTask.id,
      url: analysisTask.url,
      reason: reason,
      risk_level: risk_level,
      status: 'pending_review',
      created_at: new Date().toISOString(),
      analysis_summary: analysisTask.analysis_results?.data
    });

    // Log activity
    await base44.entities.ActivityLog.create({
      action_type: 'alert',
      message: `Task flagged for manual review: ${reason}`,
      metadata: {
        analysis_task_id: analysisTask.id,
        review_task_id: reviewTask.id,
        risk_level: risk_level
      },
      severity: risk_level === 'high' ? 'critical' : 'warning'
    });

    return {
      success: true,
      taskType: 'manual_review',
      reviewTaskId: reviewTask.id,
      riskLevel: risk_level,
      reason: reason
    };
  } catch (error) {
    console.error('Manual review handling failed:', error);
    return {
      success: false,
      taskType: 'manual_review',
      error: error.message
    };
  }
}

/**
 * Handle error recovery and retries
 */
async function handleErrorRecovery(base44, analysisTask, config) {
  const { error_type, retry_count, max_retries } = config;

  try {
    if (retry_count >= (max_retries || 3)) {
      // Max retries exceeded - escalate to manual review
      return await handleManualReview(base44, analysisTask, {
        reason: `Max retries exceeded for ${error_type}`,
        risk_level: 'high'
      });
    }

    // Create retry task
    const retryTask = await base44.entities.AITask.create({
      task_type: 'error_recovery_retry',
      status: 'queued',
      priority: 75,
      parent_task_id: analysisTask.id,
      original_error: error_type,
      retry_count: (retry_count || 0) + 1,
      max_retries: max_retries || 3,
      config: {
        delay_seconds: Math.pow(2, retry_count || 0) * 10, // Exponential backoff
        exponential_backoff: true
      }
    });

    return {
      success: true,
      taskType: 'error_recovery',
      retryTaskId: retryTask.id,
      retryCount: (retry_count || 0) + 1,
      nextRetryDelay: Math.pow(2, retry_count || 0) * 10
    };
  } catch (error) {
    console.error('Error recovery failed:', error);
    return {
      success: false,
      taskType: 'error_recovery',
      error: error.message
    };
  }
}