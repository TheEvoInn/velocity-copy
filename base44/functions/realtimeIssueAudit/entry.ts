import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * REAL-TIME ISSUE AUDIT
 * Monitors user task execution and logs issues as they occur
 * Tracks: errors, rate-limits, auth failures, credential issues, task failures
 * User: dawnvernor@yahoo.com
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const { action = 'audit_active_tasks', user_email = 'dawnvernor@yahoo.com' } = body;

    switch (action) {
      // Full audit of all active tasks for user
      case 'audit_active_tasks': {
        const auditLog = {
          timestamp: new Date().toISOString(),
          user: user_email,
          issues_found: [],
          warnings: [],
          status: 'healthy',
        };

        try {
          // Get all active tasks for this user
          const activeTasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
            { status: { $in: ['queued', 'processing'] } },
            '-created_date',
            50
          ).catch(() => []);

          // Check for error patterns
          const taskArray = Array.isArray(activeTasks) ? activeTasks : [];
          
          for (const task of taskArray) {
            // Check retry count approaching limit
            if (task.retry_count && task.max_retries && task.retry_count >= task.max_retries - 1) {
              auditLog.issues_found.push({
                type: 'max_retries_approaching',
                task_id: task.id,
                message: `Task ${task.id} on ${task.platform}: ${task.retry_count}/${task.max_retries} retries`,
                severity: 'critical',
              });
              auditLog.status = 'warning';
            }

            // Check for stale tasks (queued > 30 min)
            const queuedTime = new Date(task.queue_timestamp);
            const ageMinutes = (Date.now() - queuedTime.getTime()) / 60000;
            if (ageMinutes > 30 && task.status === 'queued') {
              auditLog.warnings.push({
                type: 'stale_task',
                task_id: task.id,
                message: `Task ${task.id} queued for ${ageMinutes.toFixed(0)} minutes`,
              });
            }

            // Check error message presence
            if (task.error_message) {
              auditLog.issues_found.push({
                type: 'task_error',
                task_id: task.id,
                error: task.error_message,
                error_type: task.error_type,
                severity: 'warning',
              });
            }
          }

          // Check credential expiration
          const credentials = await base44.asServiceRole.entities.CredentialVault.filter(
            {},
            '-created_date',
            20
          ).catch(() => []);

          const credArray = Array.isArray(credentials) ? credentials : [];
          const now = new Date();

          for (const cred of credArray) {
            if (cred.expiration_date) {
              const expDate = new Date(cred.expiration_date);
              const daysUntilExpiry = (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

              if (daysUntilExpiry < 0) {
                auditLog.issues_found.push({
                  type: 'expired_credential',
                  platform: cred.platform,
                  message: `Credential for ${cred.platform} expired ${Math.abs(daysUntilExpiry).toFixed(0)} days ago`,
                  severity: 'critical',
                });
                auditLog.status = 'critical';
              } else if (daysUntilExpiry < 7) {
                auditLog.warnings.push({
                  type: 'credential_expiring_soon',
                  platform: cred.platform,
                  days_remaining: daysUntilExpiry.toFixed(1),
                });
              }
            }
          }

          // Check for pending interventions
          const interventions = await base44.asServiceRole.entities.UserIntervention.filter(
            { status: 'pending' },
            '-created_date',
            10
          ).catch(() => []);

          const intArray = Array.isArray(interventions) ? interventions : [];
          if (intArray.length > 0) {
            auditLog.warnings.push({
              type: 'pending_interventions',
              count: intArray.length,
              message: `${intArray.length} user interventions awaiting action`,
            });
          }

          // Check for recent errors in activity log
          const errorLogs = await base44.asServiceRole.entities.ActivityLog.filter(
            { severity: { $in: ['critical', 'warning'] } },
            '-created_date',
            10
          ).catch(() => []);

          const errArray = Array.isArray(errorLogs) ? errorLogs : [];
          const recentErrors = errArray.filter(e => {
            const logTime = new Date(e.created_date);
            const ageMinutes = (Date.now() - logTime.getTime()) / 60000;
            return ageMinutes < 5; // Last 5 minutes
          });

          if (recentErrors.length > 0) {
            auditLog.issues_found.push({
              type: 'recent_errors',
              count: recentErrors.length,
              message: `${recentErrors.length} errors in last 5 minutes`,
              severity: 'warning',
            });
          }
        } catch (e) {
          auditLog.issues_found.push({
            type: 'audit_error',
            message: `Audit failed: ${e.message}`,
            severity: 'critical',
          });
        }

        // Log audit results
        if (auditLog.issues_found.length > 0 || auditLog.status !== 'healthy') {
          await base44.asServiceRole.entities.ActivityLog.create({
            action_type: 'alert',
            message: `🔍 Real-time audit for ${user_email}: ${auditLog.issues_found.length} issues found`,
            severity: auditLog.status === 'critical' ? 'critical' : 'warning',
            metadata: auditLog,
          }).catch(() => null);
        }

        return Response.json({ success: true, audit: auditLog });
      }

      // Monitor specific task
      case 'monitor_task': {
        const { task_id } = body;
        if (!task_id) return Response.json({ error: 'task_id required' }, { status: 400 });

        const task = await base44.asServiceRole.entities.TaskExecutionQueue.get(task_id).catch(() => null);
        if (!task) return Response.json({ error: 'Task not found' }, { status: 404 });

        const status = {
          task_id,
          status: task.status,
          platform: task.platform,
          retry_count: task.retry_count || 0,
          max_retries: task.max_retries || 2,
          error: task.error_message,
          error_type: task.error_type,
          last_update: task.updated_date,
          queued_since: task.queue_timestamp,
        };

        // Check if task is stuck
        if (task.status === 'processing') {
          const processingTime = (Date.now() - new Date(task.start_timestamp).getTime()) / 60000;
          if (processingTime > 10) {
            status.warning = `Task processing for ${processingTime.toFixed(1)} minutes`;
          }
        }

        return Response.json({ success: true, task_status: status });
      }

      // Get real-time error stream
      case 'get_error_stream': {
        const minutes = body.minutes || 5;
        const since = new Date(Date.now() - minutes * 60 * 1000);

        const errors = await base44.asServiceRole.entities.ActivityLog.filter(
          { severity: { $in: ['critical', 'warning'] } },
          '-created_date',
          30
        ).catch(() => []);

        const errArray = Array.isArray(errors) ? errors : [];
        const recentErrors = errArray.filter(e => new Date(e.created_date) > since);

        return Response.json({
          success: true,
          time_window_minutes: minutes,
          error_count: recentErrors.length,
          errors: recentErrors.map(e => ({
            timestamp: e.created_date,
            severity: e.severity,
            message: e.message,
            metadata: e.metadata,
          })),
        });
      }

      // Trigger recovery for failed task
      case 'recover_task': {
        const { task_id } = body;
        if (!task_id) return Response.json({ error: 'task_id required' }, { status: 400 });

        const task = await base44.asServiceRole.entities.TaskExecutionQueue.get(task_id).catch(() => null);
        if (!task) return Response.json({ error: 'Task not found' }, { status: 404 });

        if (task.status !== 'failed') {
          return Response.json({ error: 'Task is not failed' }, { status: 400 });
        }

        // Reset for retry
        await base44.asServiceRole.entities.TaskExecutionQueue.update(task_id, {
          status: 'queued',
          retry_count: (task.retry_count || 0) + 1,
          error_message: null,
          error_type: null,
        });

        await base44.asServiceRole.entities.ActivityLog.create({
          action_type: 'system',
          message: `🔄 Manual recovery triggered for task ${task_id}`,
          severity: 'info',
          metadata: { task_id, previous_status: task.status },
        }).catch(() => null);

        return Response.json({
          success: true,
          message: `Task ${task_id} queued for retry`,
          retry_count: (task.retry_count || 0) + 1,
        });
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[realtimeIssueAudit]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});