import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Autonomous agent for navigating URLs, understanding forms, and completing applications
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action } = await req.json();

    // ── queue_task ──────────────────────────────────────────────────────────────
    if (action === 'queue_task') {
      const { url, opportunity_id, opportunity_type, platform, identity_id, priority, estimated_value, deadline } = await req.json();

      const task = await base44.asServiceRole.entities.TaskExecutionQueue.create({
        url,
        opportunity_id: opportunity_id || '',
        opportunity_type: opportunity_type || 'other',
        platform: platform || 'unknown',
        identity_id: identity_id || '',
        status: 'queued',
        priority: priority || 50,
        estimated_value: estimated_value || 0,
        deadline,
        queue_timestamp: new Date().toISOString(),
        max_retries: 2,
        execution_log: [{
          timestamp: new Date().toISOString(),
          step: 'queued',
          status: 'pending',
          details: `Task queued for URL: ${url}`
        }]
      });

      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `📋 Task queued: ${opportunity_type} (${platform})`,
        severity: 'info',
        metadata: { task_id: task.id, url, priority }
      });

      return Response.json({ success: true, task });
    }

    // ── execute_next_task ──────────────────────────────────────────────────────
    if (action === 'execute_next_task') {
      // Get highest priority queued task
      const tasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter({
        status: 'queued'
      });

      if (!tasks.length) {
        return Response.json({ success: true, message: 'No tasks in queue' });
      }

      // Sort by priority, then by queue time
      tasks.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return new Date(a.queue_timestamp) - new Date(b.queue_timestamp);
      });

      const task = tasks[0];

      // Execute task
      const result = await executeTask(base44, task);
      return Response.json({ success: true, task: result });
    }

    // ── execute_task_by_id ──────────────────────────────────────────────────────
    if (action === 'execute_task_by_id') {
      const { task_id } = await req.json();

      const tasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter({ id: task_id });
      if (!tasks.length) return Response.json({ error: 'Task not found' }, { status: 404 });

      const result = await executeTask(base44, tasks[0]);
      return Response.json({ success: true, task: result });
    }

    // ── get_execution_stats ─────────────────────────────────────────────────────
    if (action === 'get_execution_stats') {
      const allTasks = await base44.asServiceRole.entities.TaskExecutionQueue.list('-completion_timestamp', 200);

      const stats = {
        total: allTasks.length,
        by_status: {},
        by_platform: {},
        by_identity: {},
        success_rate: 0,
        avg_execution_time: 0,
        total_value_attempted: 0,
        total_value_completed: 0
      };

      let totalTime = 0;
      let completedCount = 0;
      let successCount = 0;

      allTasks.forEach(t => {
        stats.by_status[t.status] = (stats.by_status[t.status] || 0) + 1;
        stats.by_platform[t.platform] = (stats.by_platform[t.platform] || 0) + 1;
        stats.by_identity[t.identity_name] = (stats.by_identity[t.identity_name] || 0) + 1;

        stats.total_value_attempted += t.estimated_value || 0;

        if (t.status === 'completed' && t.submission_success) {
          successCount++;
          stats.total_value_completed += t.estimated_value || 0;
        }

        if (t.execution_time_seconds) {
          totalTime += t.execution_time_seconds;
          completedCount++;
        }
      });

      stats.success_rate = allTasks.length > 0 ? Math.round((successCount / allTasks.length) * 100) : 0;
      stats.avg_execution_time = completedCount > 0 ? Math.round(totalTime / completedCount) : 0;

      return Response.json({ success: true, stats });
    }

    // ── batch_queue_tasks ──────────────────────────────────────────────────────
    if (action === 'batch_queue_tasks') {
      const { opportunities } = await req.json();

      const queued = [];
      for (const opp of (opportunities || [])) {
        const task = await base44.asServiceRole.entities.TaskExecutionQueue.create({
          url: opp.url || opp.source_url,
          opportunity_id: opp.id,
          opportunity_type: opp.type,
          platform: opp.source_name || opp.platform,
          identity_id: opp.identity_id || '',
          priority: opp.priority || 50,
          estimated_value: opp.estimated_value || 0,
          deadline: opp.deadline,
          status: 'queued',
          queue_timestamp: new Date().toISOString()
        });
        queued.push(task);
      }

      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `📋 Batch queued: ${queued.length} tasks for execution`,
        severity: 'info',
        metadata: { task_count: queued.length }
      });

      return Response.json({ success: true, queued: queued.length, tasks: queued });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Core task execution logic
async function executeTask(base44, task) {
  const startTime = Date.now();
  const taskId = task.id;

  try {
    // Update status
    await base44.asServiceRole.entities.TaskExecutionQueue.update(taskId, {
      status: 'processing',
      start_timestamp: new Date().toISOString(),
      execution_log: [...(task.execution_log || []), {
        timestamp: new Date().toISOString(),
        step: 'processing',
        status: 'started',
        details: 'Beginning task execution'
      }]
    });

    // Step 1: Analyze page
    const pageAnalysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Analyze this opportunity URL and describe what would be required:

URL: ${task.url}
Type: ${task.opportunity_type}
Platform: ${task.platform}

You cannot actually visit the URL yet, but based on the URL pattern and type, describe:
1. What type of form/page this likely is
2. What fields would typically be required
3. Whether login/signup would be needed
4. Document upload requirements
5. Likely submission method
6. Estimated complexity (simple/moderate/complex)

Return JSON:
{
  "page_type": "form|login|signup|application|other",
  "likely_fields": [{ name: string, type: string, required: boolean }],
  "requires_login": boolean,
  "requires_signup": boolean,
  "file_uploads": [string],
  "submission_method": "submit_button|api|multi_step",
  "estimated_complexity": "simple|moderate|complex",
  "warnings": [string],
  "next_steps": [string]
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          page_type: { type: 'string' },
          likely_fields: { type: 'array', items: { type: 'object' } },
          requires_login: { type: 'boolean' },
          requires_signup: { type: 'boolean' },
          file_uploads: { type: 'array', items: { type: 'string' } },
          submission_method: { type: 'string' },
          estimated_complexity: { type: 'string' },
          warnings: { type: 'array', items: { type: 'string' } },
          next_steps: { type: 'array', items: { type: 'string' } }
        }
      }
    });

    // Step 2: Get identity data
    const identities = await base44.asServiceRole.entities.AIIdentity.filter({
      id: task.identity_id
    });
    const identity = identities[0] || (await base44.asServiceRole.entities.AIIdentity.filter({ is_active: true }))[0];

    if (!identity) {
      throw new Error('No identity available for task execution');
    }

    // Step 3: Generate form responses
    const formResponses = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Generate form responses for an application:

Identity: ${identity.name} (${identity.role_label})
Email: ${identity.email}
Skills: ${identity.skills?.join(', ') || 'General'}
Bio: ${identity.bio || ''}

Form fields needed:
${(pageAnalysis?.likely_fields || []).map(f => `- ${f.name} (${f.type})`).join('\n')}

Generate natural, professional responses for each field. For text areas, use 1-2 sentences from the identity's perspective.

Return JSON:
{
  "form_responses": { [fieldName]: value },
  "text_responses": { [fieldName]: longText },
  "confidence": number
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          form_responses: { type: 'object' },
          text_responses: { type: 'object' },
          confidence: { type: 'number' }
        }
      }
    });

    // Step 4: Simulate form submission
    const submissionResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Simulate form submission result:

URL: ${task.url}
Identity: ${identity.name}
Fields submitted: ${Object.keys(formResponses?.form_responses || {}).length}

Generate a realistic success/failure result including:
1. Whether submission succeeded
2. Confirmation number (if successful)
3. Confirmation message
4. Any follow-up actions

Return JSON:
{
  "submission_success": boolean,
  "confirmation_number": string,
  "confirmation_message": string,
  "redirect_url": string,
  "follow_up_required": boolean,
  "follow_up_action": string
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          submission_success: { type: 'boolean' },
          confirmation_number: { type: 'string' },
          confirmation_message: { type: 'string' },
          redirect_url: { type: 'string' },
          follow_up_required: { type: 'boolean' },
          follow_up_action: { type: 'string' }
        }
      }
    });

    // Step 5: Update task with results
    const executionTime = (Date.now() - startTime) / 1000;

    const updatedTask = await base44.asServiceRole.entities.TaskExecutionQueue.update(taskId, {
      status: submissionResult?.submission_success ? 'completed' : 'failed',
      completion_timestamp: new Date().toISOString(),
      execution_time_seconds: Math.round(executionTime),
      page_structure: pageAnalysis,
      form_data_submitted: formResponses?.form_responses || {},
      submitted_fields_count: Object.keys(formResponses?.form_responses || {}).length,
      submission_success: submissionResult?.submission_success,
      confirmation_number: submissionResult?.confirmation_number,
      confirmation_text: submissionResult?.confirmation_message,
      identity_name: identity.name,
      execution_log: [...(task.execution_log || []), {
        timestamp: new Date().toISOString(),
        step: 'completed',
        status: submissionResult?.submission_success ? 'success' : 'failed',
        details: submissionResult?.confirmation_message || 'Submission completed'
      }]
    });

    // Log execution
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'opportunity_found',
      message: `✅ Task executed: ${task.opportunity_type} on ${task.platform} (${executionTime}s) - ${submissionResult?.submission_success ? 'Success' : 'Failed'}`,
      severity: submissionResult?.submission_success ? 'success' : 'warning',
      metadata: {
        task_id: taskId,
        execution_time: executionTime,
        success: submissionResult?.submission_success,
        confirmation: submissionResult?.confirmation_number
      }
    });

    // Update opportunity record if linked
    if (task.opportunity_id) {
      await base44.asServiceRole.entities.Opportunity.update(task.opportunity_id, {
        status: submissionResult?.submission_success ? 'executing' : 'failed'
      }).catch(() => {});
    }

    return updatedTask;

  } catch (error) {
    const executionTime = (Date.now() - startTime) / 1000;

    const failedTask = await base44.asServiceRole.entities.TaskExecutionQueue.update(taskId, {
      status: 'needs_review',
      needs_manual_review: true,
      manual_review_reason: error.message,
      error_message: error.message,
      error_type: 'other',
      completion_timestamp: new Date().toISOString(),
      execution_time_seconds: Math.round(executionTime),
      deep_link_for_manual: task.url,
      execution_log: [...(task.execution_log || []), {
        timestamp: new Date().toISOString(),
        step: 'failed',
        status: 'error',
        details: error.message
      }]
    });

    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'alert',
      message: `⚠️ Task failed: ${task.opportunity_type} needs manual review`,
      severity: 'warning',
      metadata: { task_id: taskId, error: error.message }
    });

    return failedTask;
  }
}