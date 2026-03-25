import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * TASK RESUME AFTER INTERVENTION
 * Called when user provides missing data (CAPTCHA, credentials, decision, etc.)
 * Resumes queued task with user-provided context
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { intervention_id, user_response } = await req.json();
    if (!intervention_id) return Response.json({ error: 'intervention_id required' }, { status: 400 });

    // Fetch intervention
    const intervention = await base44.entities.UserIntervention.get(intervention_id).catch(() => null);
    if (!intervention) return Response.json({ error: 'Intervention not found' }, { status: 404 });
    if (intervention.status !== 'pending') {
      return Response.json({ error: 'Intervention already resolved' }, { status: 400 });
    }

    // Update intervention with user response
    await base44.asServiceRole.entities.UserIntervention.update(intervention_id, {
      user_response: user_response || {},
      status: 'resolved',
      resolved_at: new Date().toISOString()
    });

    // Fetch the associated task
    const task = await base44.asServiceRole.entities.TaskExecutionQueue.get(intervention.task_id).catch(() => null);
    if (!task) return Response.json({ error: 'Associated task not found' }, { status: 404 });

    // Prepare resume context
    const resumeContext = {
      ...task,
      intervention_data: user_response,
      intervention_resolved: true,
      retry_count: (task.retry_count || 0) + 1,
      status: 'queued',
      notes: `${task.notes || ''} [User provided intervention data - resuming]`
    };

    // Update task status back to queued
    await base44.asServiceRole.entities.TaskExecutionQueue.update(intervention.task_id, {
      status: 'queued',
      retry_count: resumeContext.retry_count,
      notes: resumeContext.notes,
      last_retry_at: new Date().toISOString()
    });

    // Trigger Autopilot to resume this specific task
    const resumeResult = await base44.functions.invoke('unifiedAutopilot', {
      action: 'resume_task',
      task_id: intervention.task_id,
      task_context: resumeContext
    }).catch(e => ({ data: { success: false, error: e.message } }));

    if (resumeResult.data?.success) {
      // Log success
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'user_action',
        message: `✅ Task resumed after user intervention (${intervention.requirement_type})`,
        severity: 'success',
        metadata: { task_id: intervention.task_id, intervention_id }
      }).catch(() => null);

      // Notify user
      await base44.asServiceRole.entities.Notification.create({
        type: 'success',
        severity: 'info',
        title: '✅ Task Resumed',
        message: `Your task has been resumed with the data you provided. Autopilot is processing it now.`,
        user_email: user.email,
        action_type: 'task_resumed',
        is_read: false
      }).catch(() => null);

      return Response.json({
        success: true,
        message: 'Task resumed successfully',
        task_id: intervention.task_id,
        intervention_id,
        status: 'queued',
        retry_count: resumeContext.retry_count
      });
    } else {
      // Resume failed
      await base44.asServiceRole.entities.Notification.create({
        type: 'warning',
        severity: 'warning',
        title: '⚠️ Task Resume Failed',
        message: `Failed to resume task after intervention: ${resumeResult.data?.error}. Please try again or contact support.`,
        user_email: user.email,
        action_type: 'task_resume_failed',
        is_read: false
      }).catch(() => null);

      return Response.json({
        success: false,
        error: resumeResult.data?.error || 'Unknown error during resume',
        task_id: intervention.task_id,
        partial_success: false
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[TaskResumeAfterIntervention]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});