import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * API HEALTH MONITORING SCHEDULER
 * Scheduled health checks (hourly), degraded service detection
 * Automatic failover recommendations, dashboard alerts
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, api_id } = await req.json();

    if (action === 'run_health_check') {
      return await runHealthCheck(base44);
    } else if (action === 'check_single_api') {
      return await checkSingleAPI(base44, api_id);
    } else if (action === 'generate_alerts') {
      return await generateAlerts(base44);
    } else {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[apiHealthMonitoringScheduler]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Run comprehensive health check on all verified APIs
 */
async function runHealthCheck(base44) {
  const apis = await base44.entities.APIMetadata.filter({
    verification_status: 'verified',
  }, '-execution_readiness_score', 100);

  const results = {
    timestamp: new Date().toISOString(),
    total_apis: apis.length,
    healthy: 0,
    degraded: 0,
    unreachable: 0,
    checks: [],
  };

  for (const api of apis) {
    try {
      const health = await checkSingleAPI(base44, api.id);
      const status = health.data?.status || 'unknown';
      results.checks.push({
        api_id: api.id,
        api_name: api.api_name,
        status,
        response_time_ms: health.data?.response_time_ms,
        status_code: health.data?.status_code,
      });

      if (status === 'healthy') results.healthy++;
      else if (status === 'degraded') results.degraded++;
      else if (status === 'unreachable') results.unreachable++;
    } catch (error) {
      console.warn(`Health check failed for ${api.api_name}:`, error.message);
      results.checks.push({
        api_id: api.id,
        api_name: api.api_name,
        status: 'error',
        error: error.message,
      });
      results.unreachable++;
    }
  }

  return Response.json(results);
}

/**
 * Check health of a single API
 */
async function checkSingleAPI(base44, apiId) {
  const api = await base44.entities.APIMetadata.get(apiId);
  if (!api || !api.endpoints || api.endpoints.length === 0) {
    return Response.json({ error: 'API or endpoints not found' }, { status: 404 });
  }

  const endpoint = api.endpoints[0];
  const url = `${api.api_url}${endpoint.path}`;

  const startTime = Date.now();
  let statusCode = 0;
  let status = 'unreachable';
  let responseTime = 0;
  let error = null;

  try {
    const response = await fetch(url, {
      method: endpoint.method || 'HEAD',
      headers: { 'User-Agent': 'VELOCITY-HealthMonitor/1.0' },
      timeout: 10000,
    });

    responseTime = Date.now() - startTime;
    statusCode = response.status;

    if (statusCode < 300) {
      status = 'healthy';
    } else if (statusCode < 500) {
      status = 'degraded';
    } else {
      status = 'unreachable';
    }
  } catch (err) {
    responseTime = Date.now() - startTime;
    error = err.message;
    status = 'unreachable';
  }

  // Log health check result
  await base44.entities.APIDiscoveryLog.create({
    api_id: apiId,
    api_name: api.api_name,
    action_type: 'health_check',
    status: status === 'healthy' ? 'success' : 'failed',
    http_status_code: statusCode,
    response_time_ms: responseTime,
    error_message: error,
    timestamp: new Date().toISOString(),
  }).catch(() => null);

  // Update API health status
  await base44.entities.APIMetadata.update(apiId, {
    last_verified: new Date().toISOString(),
    verification_status: status === 'healthy' ? 'verified' : status === 'degraded' ? 'unreliable' : 'deprecated',
  }).catch(() => null);

  return Response.json({
    success: true,
    api_id: apiId,
    api_name: api.api_name,
    status,
    status_code: statusCode,
    response_time_ms: responseTime,
    error: error || null,
    recommendation: status !== 'healthy' ? 'investigate' : 'ok',
  });
}

/**
 * Generate alerts for degraded/unreachable APIs
 */
async function generateAlerts(base44) {
  // Get recent health checks
  const logs = await base44.entities.APIDiscoveryLog.filter({
    action_type: 'health_check',
  }, '-created_date', 200);

  // Group by API and find recent failures
  const apiStatus = {};
  for (const log of logs) {
    if (!apiStatus[log.api_id]) {
      apiStatus[log.api_id] = {
        name: log.api_name,
        checks: [],
      };
    }
    apiStatus[log.api_id].checks.push(log);
  }

  const alerts = [];

  for (const [apiId, data] of Object.entries(apiStatus)) {
    const recentChecks = data.checks.slice(0, 5);
    const failures = recentChecks.filter(c => c.status === 'failed').length;

    // Alert if 3+ recent failures
    if (failures >= 3) {
      alerts.push({
        api_id: apiId,
        api_name: data.name,
        alert_type: 'repeated_failures',
        severity: 'high',
        message: `${data.name} has failed ${failures} of last 5 health checks`,
      });
    }

    // Alert if slow responses
    const slowChecks = recentChecks.filter(c => c.response_time_ms > 5000);
    if (slowChecks.length >= 2) {
      alerts.push({
        api_id: apiId,
        api_name: data.name,
        alert_type: 'slow_response',
        severity: 'medium',
        message: `${data.name} has slow response times (avg: ${(slowChecks.reduce((s, c) => s + c.response_time_ms, 0) / slowChecks.length).toFixed(0)}ms)`,
      });
    }
  }

  // Create notifications for alerts
  for (const alert of alerts) {
    try {
      await base44.entities.Notification?.create?.({
        type: 'api_health_alert',
        severity: alert.severity,
        title: `API Health Alert: ${alert.api_name}`,
        message: alert.message,
        icon: 'alert-triangle',
        read: false,
        created_at: new Date().toISOString(),
      }).catch(() => null);
    } catch (e) {
      console.warn('Alert notification creation failed:', e.message);
    }
  }

  return Response.json({
    success: true,
    total_alerts: alerts.length,
    alerts,
    timestamp: new Date().toISOString(),
  });
}