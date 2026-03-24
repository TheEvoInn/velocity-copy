import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * API EXECUTION ANALYTICS
 * Tracks performance metrics, success rates, identifies top-performing APIs
 * Updates APIMetadata execution_readiness_score
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, api_id, time_period } = await req.json();

    if (action === 'get_api_performance') {
      return await getAPIPerformance(base44, api_id, time_period);
    } else if (action === 'get_top_apis') {
      return await getTopAPIs(base44, time_period);
    } else if (action === 'update_readiness_score') {
      return await updateReadinessScore(base44, api_id);
    } else if (action === 'batch_update_scores') {
      return await batchUpdateScores(base44);
    } else {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[apiExecutionAnalytics]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Get performance metrics for an API
 */
async function getAPIPerformance(base44, apiId, timePeriod = '7d') {
  const api = await base44.entities.APIMetadata.get(apiId);
  if (!api) {
    return Response.json({ error: 'API not found' }, { status: 404 });
  }

  // Calculate time range
  const now = Date.now();
  const daysBack = timePeriod === '30d' ? 30 : timePeriod === '24h' ? 1 : 7;
  const startTime = now - daysBack * 24 * 60 * 60 * 1000;

  // Fetch logs for period
  const logs = await base44.entities.APIDiscoveryLog.filter({
    api_id: apiId,
    action_type: 'used_by_autopilot',
  }, '-created_date', 500);

  const periodLogs = logs.filter(l => new Date(l.timestamp).getTime() >= startTime);

  const successful = periodLogs.filter(l => l.status === 'success').length;
  const failed = periodLogs.filter(l => l.status === 'failed').length;
  const total = periodLogs.length;

  const responseTimes = periodLogs
    .filter(l => l.response_time_ms)
    .map(l => l.response_time_ms);

  const avgResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b) / responseTimes.length
    : 0;

  const successRate = total > 0 ? (successful / total) * 100 : 0;
  const reliability = (successful / total) * 100;

  return Response.json({
    success: true,
    api_id: apiId,
    api_name: api.api_name,
    time_period: timePeriod,
    total_executions: total,
    successful: successful,
    failed: failed,
    success_rate: successRate.toFixed(1),
    reliability_score: reliability.toFixed(1),
    avg_response_time_ms: avgResponseTime.toFixed(0),
    min_response_time_ms: Math.min(...responseTimes),
    max_response_time_ms: Math.max(...responseTimes),
    readiness_score: api.execution_readiness_score || 0,
  });
}

/**
 * Get top performing APIs
 */
async function getTopAPIs(base44, timePeriod = '7d') {
  const apis = await base44.entities.APIMetadata.list('-created_date', 100);
  if (!apis || apis.length === 0) {
    return Response.json({
      success: true,
      top_apis: [],
      message: 'No APIs found',
    });
  }

  const performanceData = [];

  for (const api of apis) {
    try {
      const perf = await getAPIPerformance(base44, api.id, timePeriod);
      if (perf.data) {
        performanceData.push({
          api_id: api.id,
          api_name: api.api_name,
          executions: perf.data.total_executions,
          success_rate: parseFloat(perf.data.success_rate),
          reliability: parseFloat(perf.data.reliability_score),
          avg_response_time: parseFloat(perf.data.avg_response_time_ms),
        });
      }
    } catch (e) {
      console.warn(`Performance fetch failed for ${api.api_name}:`, e.message);
    }
  }

  // Sort by success rate
  const sorted = performanceData
    .sort((a, b) => b.success_rate - a.success_rate)
    .slice(0, 10);

  return Response.json({
    success: true,
    time_period: timePeriod,
    top_apis: sorted,
    total_apis_analyzed: performanceData.length,
  });
}

/**
 * Update execution readiness score for an API
 */
async function updateReadinessScore(base44, apiId) {
  const api = await base44.entities.APIMetadata.get(apiId);
  if (!api) {
    return Response.json({ error: 'API not found' }, { status: 404 });
  }

  // Get recent performance
  const perfData = await getAPIPerformance(base44, apiId, '7d');
  const perf = perfData.data;

  if (!perf) {
    return Response.json({ error: 'Failed to get performance data' }, { status: 400 });
  }

  // Calculate readiness score (0-100)
  // 40% success rate, 30% reliability, 20% response time, 10% documentation quality
  const successScore = Math.min(100, (parseFloat(perf.success_rate) / 100) * 40);
  const reliabilityScore = Math.min(100, (parseFloat(perf.reliability_score) / 100) * 30);
  const responseTimeScore = Math.max(0, 20 - (parseFloat(perf.avg_response_time_ms) / 1000)); // Penalize slow responses
  const docQualityScore = 10; // Assume good docs if API is verified

  const readinessScore = successScore + reliabilityScore + responseTimeScore + docQualityScore;

  // Update API metadata
  await base44.entities.APIMetadata.update(apiId, {
    execution_readiness_score: Math.round(readinessScore),
    last_verified: new Date().toISOString(),
    success_rate_observed: parseFloat(perf.success_rate),
    average_response_time_ms: parseFloat(perf.avg_response_time_ms),
  });

  return Response.json({
    success: true,
    api_id: apiId,
    api_name: api.api_name,
    execution_readiness_score: Math.round(readinessScore),
    success_rate: perf.success_rate,
    reliability: perf.reliability_score,
    recommendation: readinessScore > 75 ? 'ready' : readinessScore > 50 ? 'monitor' : 'investigate',
  });
}

/**
 * Batch update readiness scores for all APIs
 */
async function batchUpdateScores(base44) {
  const apis = await base44.entities.APIMetadata.list('-created_date', 100);

  const results = {
    apis_updated: 0,
    high_readiness: 0,
    medium_readiness: 0,
    low_readiness: 0,
    errors: [],
    timestamp: new Date().toISOString(),
  };

  for (const api of apis) {
    try {
      const result = await updateReadinessScore(base44, api.id);
      if (result.data?.execution_readiness_score) {
        results.apis_updated++;
        const score = result.data.execution_readiness_score;
        if (score >= 75) results.high_readiness++;
        else if (score >= 50) results.medium_readiness++;
        else results.low_readiness++;
      }
    } catch (error) {
      console.warn(`Readiness update failed for ${api.api_name}:`, error.message);
      results.errors.push({
        api_id: api.id,
        error: error.message,
      });
    }
  }

  return Response.json(results);
}