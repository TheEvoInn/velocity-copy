/**
 * Auto Execution Worker — Background service that automatically executes queued tasks
 * Processes tasks marked as auto_execute with status='queued'
 * Prioritizes by estimated value to maximize daily profit
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

async function executeTaskBatch(base44, tasks, userEmail) {
  const results = {
    total_tasks: tasks.length,
    executed: 0,
    failed: 0,
    skipped: 0,
    total_value: 0,
    execution_logs: [],
  };

  // Sort by estimated value (high to low) for maximum profit prioritization
  const sortedTasks = tasks.sort((a, b) => (b.estimated_value || 0) - (a.estimated_value || 0));

  for (const task of sortedTasks) {
    const log = {
      task_id: task.id,
      opportunity_id: task.opportunity_id,
      estimated_value: task.estimated_value || 0,
      status: 'pending',
      timestamp: new Date().toISOString(),
    };

    try {
      // Update task status to 'processing'
      await base44.asServiceRole.entities.TaskExecutionQueue.update(task.id, {
        status: 'processing',
        start_timestamp: new Date().toISOString(),
      });

      // Invoke browserbaseExecutor
      const execResult = await base44.asServiceRole.functions.invoke('browserbaseExecutor', {
        action: 'execute_task',
        task_id: task.id,
        form_data: task.form_data_submitted || {},
      });

      if (execResult?.data?.status === 'completed' || execResult?.data?.submit_success) {
        log.status = 'executed';
        results.executed++;
        results.total_value += task.estimated_value || 0;
        log.method = execResult.data.method || 'browserbase';
      } else {
        log.status = 'failed';
        log.error = execResult?.data?.error || 'Unknown error';
        results.failed++;
      }
    } catch (error) {
      log.status = 'error';
      log.error = error.message;
      results.failed++;

      // Mark task as failed
      await base44.asServiceRole.entities.TaskExecutionQueue.update(task.id, {
        status: 'failed',
        error_message: error.message,
        error_type: 'execution_error',
      });
    }

    results.execution_logs.push(log);
  }

  return results;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Allow authenticated users or service role invocation
    if (!user && req.headers.get('authorization') !== `Bearer ${Deno.env.get('BASE44_SERVICE_TOKEN')}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = user?.email || 'system';
    const body = await req.json().catch(() => ({}));
    const { max_concurrent = 5, max_daily_spend = 500 } = body;

    // Fetch all queued auto-execute tasks for this user
    const queuedTasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter({
      status: 'queued',
      created_by: userEmail,
    });

    // Filter for auto_execute tasks and sort by value
    const autoExecuteTasks = queuedTasks.filter(t => t.auto_execute !== false);

    if (autoExecuteTasks.length === 0) {
      return Response.json({
        success: true,
        message: 'No queued auto-execute tasks found',
        tasks_processed: 0,
      });
    }

    // Limit batch size to max_concurrent
    const tasksToExecute = autoExecuteTasks.slice(0, max_concurrent);

    // Check daily spending limit
    const totalValue = tasksToExecute.reduce((sum, t) => sum + (t.estimated_value || 0), 0);
    if (totalValue > max_daily_spend) {
      // Execute only up to spend limit, prioritized by value
      let cumulative = 0;
      const limitedTasks = [];
      for (const task of tasksToExecute.sort((a, b) => (b.estimated_value || 0) - (a.estimated_value || 0))) {
        if (cumulative + (task.estimated_value || 0) <= max_daily_spend) {
          limitedTasks.push(task);
          cumulative += task.estimated_value || 0;
        }
      }
      tasksToExecute.length = 0;
      tasksToExecute.push(...limitedTasks);
    }

    // Execute batch
    const batchResults = await executeTaskBatch(base44, tasksToExecute, userEmail);

    // Log execution cycle
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'auto_execution',
      message: `Auto Execution Worker: Executed ${batchResults.executed}/${batchResults.total_tasks} tasks, earned $${batchResults.total_value}`,
      severity: batchResults.executed > 0 ? 'success' : 'info',
      metadata: {
        executed: batchResults.executed,
        failed: batchResults.failed,
        total_value: batchResults.total_value,
        tasks_processed: batchResults.total_tasks,
      },
    });

    return Response.json({
      success: true,
      ...batchResults,
    });
  } catch (error) {
    console.error('[autoExecutionWorker] Fatal:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});