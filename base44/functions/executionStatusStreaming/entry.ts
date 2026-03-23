import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * EXECUTION STATUS STREAMING ENGINE
 * Real-time task/workflow status updates
 * - Live execution progress
 * - Step-by-step status tracking
 * - Error propagation
 * - Completion notifications
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, payload } = await req.json();

    if (action === 'watch_execution') {
      return await watchExecution(base44, user, payload);
    }
    if (action === 'get_execution_progress') {
      return await getExecutionProgress(base44, user, payload);
    }
    if (action === 'get_workflow_status') {
      return await getWorkflowStatus(base44, user, payload);
    }
    if (action === 'get_active_executions') {
      return await getActiveExecutions(base44, user);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[ExecutionStatusStreaming]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Get live execution for streaming
 */
async function watchExecution(base44, user, payload) {
  const { execution_id } = payload;

  const exec = await base44.asServiceRole.entities.TaskExecution.filter(
    { execution_id },
    null, 1
  ).then(r => r[0]).catch(() => null);

  if (!exec) {
    return Response.json({ error: 'Execution not found' }, { status: 404 });
  }

  return Response.json({
    success: true,
    execution: {
      id: execution_id,
      task_id: exec.task_id,
      status: exec.status,
      progress: calculateProgress(exec),
      start_time: exec.start_time,
      end_time: exec.end_time,
      duration_seconds: exec.duration_seconds,
      error: exec.error_message,
      streaming_endpoint: `/stream/execution/${execution_id}`,
      update_interval_ms: 500
    },
    message: 'Use streaming_endpoint for real-time updates'
  });
}

/**
 * Get execution progress with detailed step information
 */
async function getExecutionProgress(base44, user, payload) {
  const { execution_id, include_steps = true } = payload;

  const exec = await base44.asServiceRole.entities.TaskExecution.filter(
    { execution_id },
    null, 1
  ).then(r => r[0]).catch(() => null);

  if (!exec) {
    return Response.json({ error: 'Execution not found' }, { status: 404 });
  }

  const progress = {
    execution_id,
    status: exec.status,
    progress_percent: calculateProgress(exec),
    started_at: exec.start_time,
    updated_at: exec.updated_date,
    estimated_completion: estimateCompletion(exec),
    steps_completed: extractStepsCompleted(exec),
    current_step: extractCurrentStep(exec),
    errors: exec.error_message ? [{ message: exec.error_message, timestamp: exec.updated_date }] : []
  };

  return Response.json({
    success: true,
    progress
  });
}

/**
 * Get workflow status (multi-step execution)
 */
async function getWorkflowStatus(base44, user, payload) {
  const { workflow_id } = payload;

  // Get all executions for this workflow
  const tasks = await base44.asServiceRole.entities.TaskExecution.filter(
    { task_id: { $regex: `^${workflow_id}` } },
    '-created_date',
    100
  ).catch(() => []);

  const stepsMap = {};
  tasks.forEach(t => {
    const match = t.task_id.match(/_step_(\d+)$/);
    if (match) {
      const stepNum = parseInt(match[1]);
      stepsMap[stepNum] = {
        step: stepNum,
        status: t.status,
        duration_seconds: t.duration_seconds,
        result: t.result_summary,
        error: t.error_message
      };
    }
  });

  const steps = Object.values(stepsMap).sort((a, b) => a.step - b.step);
  const completed = steps.filter(s => s.status === 'completed').length;
  const failed = steps.filter(s => s.status === 'failed').length;

  return Response.json({
    success: true,
    workflow: {
      id: workflow_id,
      total_steps: steps.length,
      completed_steps: completed,
      failed_steps: failed,
      progress_percent: steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0,
      status: failed > 0 ? 'failed' : (completed === steps.length ? 'completed' : 'running'),
      steps
    }
  });
}

/**
 * Get all active executions for user
 */
async function getActiveExecutions(base44, user) {
  const executions = await base44.asServiceRole.entities.TaskExecution.filter(
    { status: { $in: ['running', 'queued', 'processing'] } },
    '-created_date',
    20
  ).catch(() => []);

  return Response.json({
    success: true,
    executions: executions.map(e => ({
      id: e.execution_id,
      task_id: e.task_id,
      status: e.status,
      progress: calculateProgress(e),
      started_at: e.start_time,
      duration_seconds: e.duration_seconds,
      priority: e.priority
    })),
    total_active: executions.length
  });
}

/**
 * Helper: Calculate progress percentage
 */
function calculateProgress(exec) {
  const statusProgress = {
    queued: 10,
    processing: 30,
    running: 60,
    paused: 60,
    completed: 100,
    failed: 100,
    cancelled: 0
  };
  return statusProgress[exec.status] || 0;
}

/**
 * Helper: Estimate completion time
 */
function estimateCompletion(exec) {
  if (exec.status === 'completed' || exec.status === 'failed') {
    return exec.end_time;
  }
  
  if (exec.duration_seconds && exec.status === 'running') {
    // Assume similar remaining time
    const estimatedMs = exec.duration_seconds * 2 * 1000;
    return new Date(new Date(exec.start_time).getTime() + estimatedMs).toISOString();
  }
  
  return null;
}

/**
 * Helper: Extract completed steps from execution
 */
function extractStepsCompleted(exec) {
  if (!exec.result_summary) return 0;
  const match = exec.result_summary.match(/step (\d+)/i);
  return match ? parseInt(match[1]) : 0;
}

/**
 * Helper: Extract current step from execution
 */
function extractCurrentStep(exec) {
  if (!exec.result_summary) return 'Unknown';
  return exec.result_summary.split(':')[0] || 'Unknown step';
}