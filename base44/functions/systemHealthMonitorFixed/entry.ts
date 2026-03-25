import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * SYSTEM HEALTH MONITOR (Fixed v2)
 * Records platform health metrics to SystemMetrics entity (no RLS conflicts)
 * Checks: autopilot status, task queue health, error rates, credential health
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const timestamp = new Date().toISOString();
    const metrics = [];

    // 1. Autopilot Health
    try {
      const states = await base44.asServiceRole.entities.PlatformState.list().catch(() => []);
      const ps = states[0];
      if (ps) {
        const autopilotHealth = {
          metric_type: 'automation_status',
          timestamp,
          source: 'systemHealthMonitor',
          severity: ps.emergency_stop_engaged ? 'critical' : 'info',
          status: ps.emergency_stop_engaged ? 'failed' : ps.autopilot_enabled ? 'healthy' : 'degraded',
          data: {
            autopilot_enabled: ps.autopilot_enabled,
            emergency_stop: ps.emergency_stop_engaged,
            cycle_count_today: ps.cycle_count_today || 0,
            tasks_completed_today: ps.tasks_completed_today || 0,
            current_queue_count: ps.current_queue_count || 0,
            last_error: ps.last_error || null
          },
          tags: ['autopilot', 'core'],
          alert_sent: false
        };
        metrics.push(autopilotHealth);
      }
    } catch (e) {
      console.error('Autopilot health check failed:', e.message);
      metrics.push({
        metric_type: 'health_check',
        timestamp,
        source: 'systemHealthMonitor',
        severity: 'warning',
        status: 'failed',
        error_message: e.message,
        tags: ['autopilot', 'error']
      });
    }

    // 2. Task Queue Health
    try {
      const queued = await base44.asServiceRole.entities.TaskExecutionQueue.filter({ status: 'queued' }, null, 100).catch(() => []);
      const processing = await base44.asServiceRole.entities.TaskExecutionQueue.filter({ status: 'processing' }, null, 100).catch(() => []);
      const failed = await base44.asServiceRole.entities.TaskExecutionQueue.filter({ status: 'failed' }, null, 100).catch(() => []);

      const queuedCount = Array.isArray(queued) ? queued.length : 0;
      const processingCount = Array.isArray(processing) ? processing.length : 0;
      const failedCount = Array.isArray(failed) ? failed.length : 0;

      const totalTasks = queuedCount + processingCount + failedCount;
      const successRate = totalTasks > 0 ? ((totalTasks - failedCount) / totalTasks) * 100 : 100;

      metrics.push({
        metric_type: 'task_execution',
        timestamp,
        source: 'systemHealthMonitor',
        severity: failedCount > 10 ? 'warning' : 'info',
        status: successRate >= 90 ? 'healthy' : successRate >= 70 ? 'degraded' : 'failed',
        data: {
          queued_count: queuedCount,
          processing_count: processingCount,
          failed_count: failedCount,
          total_in_flight: totalTasks
        },
        success_rate: successRate,
        tags: ['task_execution', 'queue'],
        alert_sent: false
      });
    } catch (e) {
      console.error('Task queue health check failed:', e.message);
      metrics.push({
        metric_type: 'task_execution',
        timestamp,
        source: 'systemHealthMonitor',
        severity: 'warning',
        status: 'failed',
        error_message: e.message,
        tags: ['task_execution', 'error']
      });
    }

    // 3. Credential Health
    try {
      const expired = await base44.asServiceRole.entities.CredentialVault.filter(
        { is_active: true, expires_at: { $lt: new Date().toISOString() } },
        null,
        100
      ).catch(() => []);
      const expiredCount = Array.isArray(expired) ? expired.length : 0;

      metrics.push({
        metric_type: 'credential_health',
        timestamp,
        source: 'systemHealthMonitor',
        severity: expiredCount > 5 ? 'critical' : expiredCount > 0 ? 'warning' : 'info',
        status: expiredCount === 0 ? 'healthy' : 'degraded',
        data: {
          expired_credentials: expiredCount
        },
        tags: ['credentials', 'vault'],
        alert_sent: expiredCount > 0 ? false : true
      });
    } catch (e) {
      console.error('Credential health check failed:', e.message);
    }

    // 4. Write all metrics to SystemMetrics
    let created = 0;
    for (const metric of metrics) {
      try {
        await base44.asServiceRole.entities.SystemMetrics.create(metric);
        created++;
      } catch (e) {
        console.error('Failed to create metric:', e.message);
      }
    }

    // 5. Log activity
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `✅ System health check complete: ${created} metrics recorded`,
      severity: 'success',
      metadata: { metrics_recorded: created, check_timestamp: timestamp }
    }).catch(() => {});

    return Response.json({
      success: true,
      metrics_recorded: created,
      timestamp,
      metrics
    });

  } catch (error) {
    console.error('[systemHealthMonitor] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});