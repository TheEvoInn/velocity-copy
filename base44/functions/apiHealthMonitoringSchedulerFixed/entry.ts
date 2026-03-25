import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * API HEALTH MONITORING SCHEDULER (Fixed v2)
 * Checks all verified APIs every 6 hours for health status, response time, and reliability
 * Records to SystemMetrics entity (no RLS conflicts)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const timestamp = new Date().toISOString();
    const metrics = [];

    // Get all verified APIs
    const apis = await base44.asServiceRole.entities.APIMetadata.filter(
      { verification_status: 'verified' },
      '-last_verified',
      100
    ).catch(() => []);

    if (!Array.isArray(apis) || apis.length === 0) {
      return Response.json({
        success: true,
        message: 'No verified APIs to monitor',
        timestamp
      });
    }

    console.log(`[apiHealthMonitoring] Checking ${apis.length} APIs`);

    // Check each API
    for (const api of apis) {
      if (!api || !api.api_url) continue;

      try {
        const startTime = Date.now();
        const response = await fetch(api.api_url, {
          method: 'GET',
          timeout: 10000,
          headers: { 'User-Agent': 'VELOCITY-HealthCheck/1.0' }
        }).catch(e => ({ ok: false, status: 0, error: e.message }));

        const duration = Date.now() - startTime;
        const isHealthy = response.ok || (response.status >= 200 && response.status < 500);
        const status = response.ok ? 'healthy' : response.status === 0 ? 'failed' : 'degraded';

        const metric = {
          metric_type: 'api_status',
          timestamp,
          source: 'apiHealthMonitoringScheduler',
          severity: response.ok ? 'info' : 'warning',
          status,
          data: {
            api_name: api.api_name,
            api_id: api.id,
            endpoint: api.api_url,
            http_status: response.status || 'timeout',
            response_time_ms: duration,
            is_responsive: response.ok
          },
          duration_seconds: duration / 1000,
          success_rate: response.ok ? 100 : 0,
          error_message: response.error || (response.status === 0 ? 'No response (timeout)' : null),
          tags: ['api', 'health_check', api.api_name],
          alert_sent: false
        };

        metrics.push(metric);

        // Update API metadata with latest check
        await base44.asServiceRole.entities.APIMetadata.update(api.id, {
          last_verified: timestamp,
          verification_status: response.ok ? 'verified' : 'unreliable'
        }).catch(e => console.error(`Failed to update API ${api.api_name}:`, e.message));

      } catch (e) {
        console.error(`Failed to check API ${api.api_name}:`, e.message);
        metrics.push({
          metric_type: 'api_status',
          timestamp,
          source: 'apiHealthMonitoringScheduler',
          severity: 'warning',
          status: 'failed',
          data: {
            api_name: api.api_name,
            api_id: api.id
          },
          error_message: e.message,
          tags: ['api', 'error']
        });
      }
    }

    // Write all metrics to SystemMetrics
    let created = 0;
    for (const metric of metrics) {
      try {
        await base44.asServiceRole.entities.SystemMetrics.create(metric);
        created++;
      } catch (e) {
        console.error('Failed to create metric:', e.message);
      }
    }

    // Count health summary
    const healthy = metrics.filter(m => m.status === 'healthy').length;
    const degraded = metrics.filter(m => m.status === 'degraded').length;
    const failed = metrics.filter(m => m.status === 'failed').length;

    // Log activity
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `🔍 API Health Check: ${healthy}/${apis.length} healthy, ${degraded} degraded, ${failed} failed`,
      severity: failed > 3 ? 'warning' : 'success',
      metadata: { healthy, degraded, failed, total_apis: apis.length }
    }).catch(() => {});

    return Response.json({
      success: true,
      apis_checked: apis.length,
      metrics_recorded: created,
      summary: { healthy, degraded, failed },
      timestamp
    });

  } catch (error) {
    console.error('[apiHealthMonitoringScheduler] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});