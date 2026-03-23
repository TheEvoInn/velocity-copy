/**
 * UNIFIED TASK ORCHESTRATOR (UTOE v2)
 * Central routing hub for all task sources: Discovery, VIPZ, NED, Autopilot
 * - Accepts tasks from any module
 * - Routes to execution engine (Autopilot, VIPZ, NED)
 * - Tracks real-time progress
 * - Triggers user intervention on blockers
 * - Syncs with Notifications automatically
 * - Logs ALL operations to ActivityLog
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, payload } = body;

    // ── ROUTE_TASK: Accept task from any source, route to execution ──
    if (action === 'route_task') {
      const {
        source_module, // 'discovery' | 'vipz' | 'ned' | 'autopilot'
        opportunity_id,
        task_type, // 'freelance_job', 'email_campaign', 'crypto_stake', etc.
        priority,
        identity_id,
        deadline,
        estimated_value
      } = payload;

      // Validate task
      if (!opportunity_id || !source_module || !task_type) {
        return Response.json({ error: 'Missing required fields' }, { status: 400 });
      }

      // Fetch opportunity for context
      const opps = await base44.asServiceRole.entities.Opportunity.filter({ id: opportunity_id });
      const opp = opps[0];
      if (!opp) return Response.json({ error: 'Opportunity not found' }, { status: 404 });

      // Route based on source + type
      let routeTarget = 'autopilot'; // default
      if (source_module === 'vipz') routeTarget = 'vipz_engine';
      else if (source_module === 'ned') routeTarget = 'ned_engine';
      else if (source_module === 'discovery') routeTarget = 'autopilot';

      // Create task execution record
      const task = await base44.asServiceRole.entities.TaskExecutionQueue.create({
        opportunity_id,
        url: opp.url,
        opportunity_type: opp.opportunity_type || task_type,
        platform: opp.platform || source_module,
        identity_id: identity_id || opp.identity_id,
        status: 'queued',
        priority: priority || 50,
        estimated_value: estimated_value || opp.profit_estimate_high || 0,
        deadline: deadline || opp.deadline,
        queue_timestamp: new Date().toISOString(),
        route_target: routeTarget,
        source_module,
        execution_log: [{
          timestamp: new Date().toISOString(),
          step: 'routed',
          status: 'completed',
          details: `Task routed from ${source_module} to ${routeTarget}`
        }]
      });

      // Update opportunity status
      await base44.asServiceRole.entities.Opportunity.update(opportunity_id, {
        status: 'queued',
        task_execution_id: task.id
      }).catch(() => {});

      // Log to ActivityLog
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `🔀 Task routed: ${opp.title} (${source_module} → ${routeTarget})`,
        severity: 'info',
        metadata: {
          task_id: task.id,
          opportunity_id,
          route: `${source_module} → ${routeTarget}`
        }
      }).catch(() => {});

      return Response.json({
        success: true,
        task_id: task.id,
        route_target: routeTarget,
        status: 'queued'
      });
    }

    // ── UPDATE_PROGRESS: Update task progress ──
    if (action === 'update_progress') {
      const { task_id, step, status, details, blocker_type } = payload;

      const task = await base44.asServiceRole.entities.TaskExecutionQueue.read(task_id);
      if (!task) return Response.json({ error: 'Task not found' }, { status: 404 });

      const newLog = [...(task.execution_log || []), {
        timestamp: new Date().toISOString(),
        step,
        status,
        details,
        blocker_type: blocker_type || null
      }];

      let taskUpdate = {
        execution_log: newLog,
        updated_at: new Date().toISOString()
      };

      // If blocker detected, transition to needs_review
      if (blocker_type) {
        taskUpdate.status = 'needs_review';
        // Trigger user intervention
        await base44.asServiceRole.entities.UserIntervention.create({
          task_id,
          requirement_type: blocker_type, // 'captcha', 'form_validation', 'credential_invalid', etc.
          required_data: details || '',
          status: 'pending',
          created_at: new Date().toISOString()
        }).catch(() => {});

        // Notify user
        await base44.asServiceRole.entities.Notification.create({
          type: 'user_action_required',
          severity: 'warning',
          title: 'Task Blocked — Action Required',
          message: `Task requires your attention: ${blocker_type}`,
          related_entity_type: 'TaskExecutionQueue',
          related_entity_id: task_id,
          action_type: 'user_input_required',
          is_read: false
        }).catch(() => {});
      }

      await base44.asServiceRole.entities.TaskExecutionQueue.update(task_id, taskUpdate);

      // Log
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `📋 Task progress: ${step} → ${status}${blocker_type ? ` (⚠️ ${blocker_type})` : ''}`,
        severity: blocker_type ? 'warning' : 'info',
        metadata: { task_id, step, status, blocker_type }
      }).catch(() => {});

      return Response.json({ success: true, task_status: taskUpdate.status });
    }

    // ── COMPLETE_TASK: Mark task as completed ──
    if (action === 'complete_task') {
      const { task_id, revenue_earned, confirmation_data } = payload;

      const task = await base44.asServiceRole.entities.TaskExecutionQueue.read(task_id);
      if (!task) return Response.json({ error: 'Task not found' }, { status: 404 });

      // Update task
      await base44.asServiceRole.entities.TaskExecutionQueue.update(task_id, {
        status: 'completed',
        completion_timestamp: new Date().toISOString(),
        execution_time_seconds: Math.floor(
          (Date.now() - new Date(task.queue_timestamp).getTime()) / 1000
        ),
        submission_confirmed: true,
        confirmation_number: confirmation_data?.confirmation_number
      });

      // Update opportunity
      if (task.opportunity_id) {
        await base44.asServiceRole.entities.Opportunity.update(task.opportunity_id, {
          status: 'completed',
          submission_confirmed: true,
          confirmation_number: confirmation_data?.confirmation_number,
          submission_timestamp: new Date().toISOString()
        }).catch(() => {});

        // Sync to wallet via realTimeSyncOrchestrator
        try {
          await base44.asServiceRole.functions.invoke('realTimeSyncOrchestrator', {
            action: 'sync_task_completion',
            payload: {
              task_id,
              revenue_generated: revenue_earned || 0,
              description: `Task completed: ${task.opportunity_type}`
            }
          });
        } catch (e) {
          console.error('Wallet sync error:', e.message);
        }
      }

      // Log
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `✅ Task completed: ${revenue_earned ? `$${revenue_earned} earned` : 'submitted'}`,
        severity: 'success',
        metadata: { task_id, revenue_earned, confirmation_data }
      }).catch(() => {});

      return Response.json({
        success: true,
        task_id,
        revenue_earned,
        status: 'completed'
      });
    }

    // ── GET_TASK_STATUS: Real-time task status ──
    if (action === 'get_task_status') {
      const { task_id } = payload;
      const task = await base44.asServiceRole.entities.TaskExecutionQueue.read(task_id);
      if (!task) return Response.json({ error: 'Task not found' }, { status: 404 });

      return Response.json({
        success: true,
        task: {
          id: task.id,
          status: task.status,
          opportunity_type: task.opportunity_type,
          priority: task.priority,
          estimated_value: task.estimated_value,
          queue_timestamp: task.queue_timestamp,
          execution_log: task.execution_log,
          latest_step: task.execution_log?.[task.execution_log.length - 1]?.step,
          blocker: task.execution_log?.find(e => e.blocker_type)?.blocker_type
        }
      });
    }

    // ── LIST_ACTIVE_TASKS: All in-progress tasks ──
    if (action === 'list_active_tasks') {
      const tasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
        { status: 'queued' },
        '-priority',
        50
      );

      return Response.json({
        success: true,
        count: tasks.length,
        tasks: tasks.map(t => ({
          id: t.id,
          opportunity_type: t.opportunity_type,
          priority: t.priority,
          status: t.status,
          estimated_value: t.estimated_value,
          queue_age_seconds: Math.floor((Date.now() - new Date(t.queue_timestamp).getTime()) / 1000)
        }))
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[UnifiedTaskOrchestrator] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});