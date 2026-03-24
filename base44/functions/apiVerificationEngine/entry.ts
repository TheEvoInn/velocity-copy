import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * API VERIFICATION ENGINE
 * Tests discovered APIs for functionality, responsiveness, and reliability
 * Updates verification status and execution readiness scores
 * Creates detailed verification logs
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, api_id, api_metadata } = await req.json();

    if (action === 'verify_api') {
      return await verifyAPI(base44, api_id, api_metadata);
    } else if (action === 'test_endpoint') {
      return await testEndpoint(base44, api_id, api_metadata);
    } else if (action === 'health_check') {
      return await performHealthCheck(base44, api_id);
    } else {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[apiVerificationEngine]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Full verification of an API
 */
async function verifyAPI(base44, api_id, api_metadata) {
  if (!api_id && !api_metadata) {
    return Response.json({ error: 'Missing api_id or api_metadata' }, { status: 400 });
  }

  const apiData = api_metadata || await base44.entities.APIMetadata.get(api_id);
  if (!apiData) {
    return Response.json({ error: 'API not found' }, { status: 404 });
  }

  const results = {
    api_id: apiData.id,
    api_name: apiData.api_name,
    overall_status: 'pending',
    tests_passed: 0,
    tests_failed: 0,
    tests_total: 0,
    endpoint_results: [],
    verification_timestamp: new Date().toISOString(),
  };

  // Test first 3 endpoints to verify API is working
  const endpointsToTest = (apiData.endpoints || []).slice(0, 3);

  for (const endpoint of endpointsToTest) {
    results.tests_total++;
    const testResult = await testEndpoint(base44, api_id, apiData, endpoint);

    if (testResult.success) {
      results.tests_passed++;
      results.overall_status = 'verified';
    } else {
      results.tests_failed++;
      if (results.overall_status !== 'verified') {
        results.overall_status = 'unreliable';
      }
    }

    results.endpoint_results.push(testResult);
  }

  // Update API metadata with verification status
  if (api_id) {
    const newStatus = results.tests_passed > 0 ? 'verified' : 'unreliable';
    const newScore = Math.round((results.tests_passed / results.tests_total) * 100);

    await base44.entities.APIMetadata.update(api_id, {
      verification_status: newStatus,
      execution_readiness_score: newScore,
      last_verified: new Date().toISOString(),
    });

    // Log verification
    await base44.entities.APIDiscoveryLog.create({
      api_id,
      api_name: apiData.api_name,
      action_type: 'verified',
      status: newStatus,
      details: results,
      verified_by: req.headers.get('user-email') || 'system',
      timestamp: new Date().toISOString(),
    });
  }

  return Response.json(results);
}

/**
 * Test a single endpoint
 */
async function testEndpoint(base44, api_id, api_metadata, endpoint = null) {
  const apiData = api_metadata;
  if (!apiData || !apiData.endpoints || apiData.endpoints.length === 0) {
    return { success: false, error: 'No endpoints available' };
  }

  const ep = endpoint || apiData.endpoints[0];
  const method = ep.method || 'GET';
  const path = ep.path || '/';
  const url = `${apiData.api_url}${path}`;

  const startTime = Date.now();
  let response;
  let responseTime = 0;
  let statusCode = 0;
  let success = false;

  try {
    const options = {
      method,
      headers: {
        'User-Agent': 'VELOCITY-API-Verification/1.0',
        'Accept': 'application/json',
      },
    };

    // Add basic auth if needed
    if (ep.auth_type === 'basic_auth') {
      options.headers['Authorization'] = 'Basic dGVzdDp0ZXN0'; // base64 test:test
    } else if (ep.auth_type === 'bearer_token') {
      options.headers['Authorization'] = 'Bearer test_token_12345';
    } else if (ep.auth_type === 'api_key') {
      options.headers['X-API-Key'] = 'test_api_key_12345';
    }

    response = await fetch(url, options);
    responseTime = Date.now() - startTime;
    statusCode = response.status;

    // Success if status is 2xx or 4xx (endpoint exists)
    // Failure if status is 5xx or timeout
    success = statusCode < 500;
  } catch (error) {
    responseTime = Date.now() - startTime;
    success = false;
  }

  return {
    endpoint: path,
    method,
    url,
    statusCode,
    responseTime,
    success,
    tested_at: new Date().toISOString(),
  };
}

/**
 * Perform health check on existing API
 */
async function performHealthCheck(base44, api_id) {
  const apiData = await base44.entities.APIMetadata.get(api_id);
  if (!apiData) {
    return Response.json({ error: 'API not found' }, { status: 404 });
  }

  const startTime = Date.now();
  let statusCode = 0;
  let responseTime = 0;
  let status = 'unknown';

  try {
    const response = await fetch(apiData.api_url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'VELOCITY-HealthCheck/1.0' },
    }).catch(() =>
      fetch(apiData.api_url, {
        method: 'GET',
        headers: { 'User-Agent': 'VELOCITY-HealthCheck/1.0' },
      })
    );

    responseTime = Date.now() - startTime;
    statusCode = response.status;
    status = statusCode < 500 ? 'healthy' : 'degraded';
  } catch (error) {
    responseTime = Date.now() - startTime;
    status = 'unreachable';
  }

  // Log health check
  await base44.entities.APIDiscoveryLog.create({
    api_id,
    api_name: apiData.api_name,
    action_type: 'health_check',
    status,
    http_status_code: statusCode,
    response_time_ms: responseTime,
    timestamp: new Date().toISOString(),
  });

  // Update API's last verified time if healthy
  if (status === 'healthy') {
    await base44.entities.APIMetadata.update(api_id, {
      last_verified: new Date().toISOString(),
    });
  }

  return Response.json({
    api_id,
    api_name: apiData.api_name,
    status,
    statusCode,
    responseTime,
    checked_at: new Date().toISOString(),
  });
}