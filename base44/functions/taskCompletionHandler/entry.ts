import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Task Completion Handler
 * Processes task execution completion, logs results, and triggers downstream workflows
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { taskId, status, result } = payload;

    if (!taskId || !status) {
      return Response.json({ error: 'Missing taskId or status' }, { status: 400 });
    }

    // Get the task
    const tasks = await base44.entities.TaskExecutionQueue.filter({
      id: taskId,
      created_by: user.email
    });

    if (!tasks || tasks.length === 0) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }

    const task = tasks[0];

    // Process completion
    const completionTime = task.start_timestamp
      ? Math.round(
          (new Date().getTime() - new Date(task.start_timestamp).getTime()) / 1000
        )
      : 0;

    // Update task
    const updatedTask = await base44.entities.TaskExecutionQueue.update(task.id, {
      status: status,
      completion_timestamp: new Date().toISOString(),
      execution_time_seconds: completionTime,
      submission_success: status === 'completed'
    });

    // Log completion
    const logMessage =
      status === 'completed'
        ? `Task completed successfully in ${completionTime}s`
        : `Task ${status}: ${result?.error || 'Unknown error'}`;

    await base44.entities.ActivityLog.create({
      action_type: status === 'completed' ? 'success' : 'alert',
      message: logMessage,
      metadata: {
        task_id: taskId,
        status: status,
        execution_time: completionTime,
        url: task.url
      },
      severity: status === 'completed' ? 'success' : 'warning'
    });

    // Trigger downstream workflows based on result
    if (status === 'completed') {
      await triggerDownstreamWorkflows(base44, updatedTask, result);
    } else if (status === 'failed') {
      await handleTaskFailure(base44, updatedTask, result);
    }

    return Response.json({
      success: true,
      taskId,
      completionTime,
      status
    });
  } catch (error) {
    console.error('Task completion handling error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Trigger downstream workflows after successful completion
 */
async function triggerDownstreamWorkflows(base44, task, result) {
  try {
    // Create completion record
    const completionRecord = await base44.entities.ActivityLog.create({
      action_type: 'opportunity_found',
      message: `Task completed: ${task.url}`,
      metadata: {
        task_id: task.id,
        result: result,
        url: task.url,
        platform: task.platform
      },
      severity: 'success'
    });

    // If task has associated opportunity, update it
    if (task.opportunity_id) {
      await base44.entities.Opportunity.update(task.opportunity_id, {
        status: 'completed',
        submission_timestamp: new Date().toISOString(),
        submission_confirmed: true
      });
    }

    // Queue data enrichment task if needed
    if (result?.data) {
      await base44.entities.AITask.create({
        task_type: 'data_enrichment',
        status: 'queued',
        parent_task_id: task.id,
        priority: 40,
        config: { enrichment_data: result.data }
      });
    }
  } catch (error) {
    console.error('Downstream workflow trigger error:', error);
  }
}

/**
 * Handle task failures with retry logic
 */
async function handleTaskFailure(base44, task, result) {
  try {
    const currentRetryCount = (task.retry_count || 0) + 1;
    const maxRetries = task.max_retries || 2;

    if (currentRetryCount < maxRetries) {
      // Create retry task
      const retryTask = await base44.entities.TaskExecutionQueue.create({
        url: task.url,
        opportunity_type: task.opportunity_type,
        platform: task.platform,
        status: 'queued',
        priority: Math.min(task.priority + 10, 100),
        retry_count: currentRetryCount,
        max_retries: maxRetries,
        estimated_value: task.estimated_value,
        deadline: task.deadline,
        queue_timestamp: new Date().toISOString()
      });

      // Log retry
      await base44.entities.ActivityLog.create({
        action_type: 'alert',
        message: `Task retry ${currentRetryCount}/${maxRetries} scheduled`,
        metadata: {
          original_task_id: task.id,
          retry_task_id: retryTask.id,
          error: result?.error,
          retryCount: currentRetryCount
        },
        severity: 'warning'
      });

      return { retried: true, retryTaskId: retryTask.id };
    } else {
      // Max retries exceeded - flag for manual review
      const reviewTask = await base44.entities.TaskReviewQueue.create({
        url: task.url,
        reason: `Task failed after ${maxRetries} retries: ${result?.error || 'Unknown error'}`,
        risk_level: 'high',
        status: 'pending_review',
        analysis_summary: {
          url: task.url,
          error: result?.error,
          retryCount: currentRetryCount,
          maxRetries: maxRetries
        }
      });

      // Log escalation
      await base44.entities.ActivityLog.create({
        action_type: 'alert',
        message: `Task escalated to manual review after ${maxRetries} failed retries`,
        metadata: {
          original_task_id: task.id,
          review_task_id: reviewTask.id,
          error: result?.error
        },
        severity: 'critical'
      });

      return { escalated: true, reviewTaskId: reviewTask.id };
    }
  } catch (error) {
    console.error('Task failure handling error:', error);
  }
}