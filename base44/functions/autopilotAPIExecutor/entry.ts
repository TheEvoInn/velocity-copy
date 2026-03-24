import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * AUTOPILOT API EXECUTOR
 * Executes tasks using discovered APIs
 * Handles authentication, parameter mapping, response parsing, error handling
 * Integrated with Autopilot task execution pipeline
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, task_id, api_id, template_id, credential_id, task_data } = await req.json();

    if (action === 'execute_task') {
      return await executeTaskViaAPI(base44, task_id, api_id, template_id, credential_id, task_data);
    } else if (action === 'execute_with_retry') {
      return await executeWithRetry(base44, task_id, api_id, template_id, credential_id, task_data);
    } else if (action === 'batch_execute_tasks') {
      return await batchExecuteTasks(base44, task_id);
    } else {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[autopilotAPIExecutor]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Execute a task via API
 */
async function executeTaskViaAPI(base44, task_id, api_id, template_id, credential_id, task_data) {
  if (!api_id || !template_id) {
    return Response.json({ error: 'Missing api_id or template_id' }, { status: 400 });
  }

  // Fetch API and template
  const api = await base44.entities.APIMetadata.get(api_id);
  const template = await base44.entities.APIIntegrationTemplate.get(template_id);

  if (!api || !template) {
    return Response.json({ error: 'API or template not found' }, { status: 404 });
  }

  const endpoint = api.endpoints?.[0];
  if (!endpoint) {
    return Response.json({ error: 'No endpoints available' }, { status: 400 });
  }

  // Get authentication headers
  const headersResp = await base44.functions.invoke('apiCredentialMapper', {
    action: 'get_injection_headers',
    api_id,
    credential_id,
  });

  const headers = headersResp.data?.headers || {};

  // Build request body from task data and parameter mappings
  const requestBody = buildRequestBody(template.parameter_mapping, task_data, endpoint);

  // Execute API call
  const url = `${api.api_url}${endpoint.path}`;
  const startTime = Date.now();
  let response;
  let statusCode = 0;
  let responseData = null;
  let success = false;
  let error = null;

  try {
    const options = {
      method: endpoint.method || 'GET',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
    };

    if (endpoint.method !== 'GET' && Object.keys(requestBody).length > 0) {
      options.body = JSON.stringify(requestBody);
    }

    response = await fetch(url, options);
    statusCode = response.status;
    responseData = await response.json().catch(() => response.text());
    success = statusCode < 400;
  } catch (err) {
    error = err.message;
    success = false;
  }

  const responseTime = Date.now() - startTime;

  // Parse response
  const parsedResult = parseResponse(responseData, template.response_parsing);

  // Log execution
  await base44.entities.APIDiscoveryLog.create({
    api_id,
    api_name: api.api_name,
    action_type: 'used_by_autopilot',
    status: success ? 'success' : 'failed',
    http_status_code: statusCode,
    response_time_ms: responseTime,
    error_message: error,
    linked_task_id: task_id,
    timestamp: new Date().toISOString(),
  });

  // Track cost if applicable
  if (success && template.cost_per_call > 0) {
    try {
      const walletResp = await base44.functions.invoke('walletManager', {
        action: 'deduct_cost',
        cost: template.cost_per_call,
        reason: `API execution: ${api.api_name}`,
        api_id,
      });
    } catch (e) {
      console.warn('Wallet deduction failed:', e.message);
    }
  }

  return Response.json({
    success,
    task_id,
    api_id,
    api_name: api.api_name,
    status_code: statusCode,
    response_time_ms: responseTime,
    parsed_result: parsedResult,
    error: error || null,
  });
}

/**
 * Execute task with automatic retry on failure
 */
async function executeWithRetry(base44, task_id, api_id, template_id, credential_id, task_data) {
  const template = await base44.entities.APIIntegrationTemplate.get(template_id);
  const errorHandling = template?.error_handling || { max_retries: 3, backoff_ms: 1000 };
  const maxRetries = errorHandling.max_retries || 3;

  let lastResult = null;
  let retryCount = 0;

  for (let i = 0; i <= maxRetries; i++) {
    const result = await executeTaskViaAPI(base44, task_id, api_id, template_id, credential_id, task_data);
    lastResult = result;

    if (result.data?.success) {
      return result;
    }

    retryCount++;
    if (retryCount < maxRetries) {
      const backoffMs = errorHandling.backoff_ms || 1000;
      await new Promise(resolve => setTimeout(resolve, backoffMs * retryCount));
    }
  }

  // All retries failed
  const fallback = template?.error_handling?.fallback_action || 'request_user_intervention';
  if (fallback === 'request_user_intervention') {
    try {
      await base44.functions.invoke('createUserIntervention', {
        task_id,
        intervention_type: 'api_execution_failed',
        api_id,
        details: {
          retries_attempted: retryCount,
          last_error: lastResult?.data?.error,
        },
      });
    } catch (e) {
      console.warn('User intervention creation failed:', e.message);
    }
  }

  return lastResult;
}

/**
 * Build request body from task data and parameter mappings
 */
function buildRequestBody(parameterMappings, taskData, endpoint) {
  const body = {};

  if (!parameterMappings || Object.keys(parameterMappings).length === 0) {
    return body;
  }

  for (const [taskField, apiField] of Object.entries(parameterMappings)) {
    const value = getValueFromPath(taskData, taskField);
    if (value !== undefined && value !== null) {
      setValueAtPath(body, apiField, value);
    }
  }

  return body;
}

/**
 * Get value from nested object path (e.g., 'task.description')
 */
function getValueFromPath(obj, path) {
  const keys = path.split('.');
  let value = obj;
  for (const key of keys) {
    if (value && typeof value === 'object') {
      value = value[key];
    } else {
      return undefined;
    }
  }
  return value;
}

/**
 * Set value in nested object path
 */
function setValueAtPath(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key]) {
      current[key] = {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
}

/**
 * Parse API response according to template rules
 */
function parseResponse(responseData, responseParsing) {
  if (!responseParsing) {
    return responseData;
  }

  try {
    // Extract data at specified path
    let data = responseData;
    const extractPath = responseParsing.extract_path || '$';
    if (extractPath !== '$' && typeof responseData === 'object') {
      const keys = extractPath.split('.');
      for (const key of keys) {
        if (key === '$') continue;
        data = data[key];
      }
    }

    // Apply transform function if provided
    if (responseParsing.transform_function) {
      try {
        const transform = new Function('response', responseParsing.transform_function);
        data = transform(data);
      } catch (e) {
        console.warn('Response transform failed:', e.message);
      }
    }

    return data;
  } catch (error) {
    console.warn('Response parsing failed:', error.message);
    return responseData;
  }
}

/**
 * Batch execute multiple tasks via APIs
 */
async function batchExecuteTasks(base44, task_id) {
  // Fetch all pending tasks linked to an opportunity
  const tasks = await base44.entities.AITask.filter({
    status: 'queued',
  }, '-created_at', 10);

  const results = {
    tasks_processed: 0,
    tasks_succeeded: 0,
    tasks_failed: 0,
    executions: [],
    timestamp: new Date().toISOString(),
  };

  for (const task of tasks) {
    try {
      // Find matching API for this task
      const api = await findMatchingAPI(base44, task);
      if (!api) {
        results.tasks_failed++;
        continue;
      }

      // Get or create template
      const template = await getOrCreateTemplate(base44, api.id);
      if (!template) {
        results.tasks_failed++;
        continue;
      }

      // Execute task
      const result = await executeTaskViaAPI(base44, task.id, api.id, template.id, null, task);

      if (result.data?.success) {
        results.tasks_succeeded++;
      } else {
        results.tasks_failed++;
      }

      results.executions.push({
        task_id: task.id,
        api_id: api.id,
        success: result.data?.success,
      });

      results.tasks_processed++;
    } catch (error) {
      console.warn(`Task ${task.id} execution failed:`, error.message);
      results.tasks_failed++;
    }
  }

  return Response.json(results);
}

/**
 * Find best matching API for a task
 */
async function findMatchingAPI(base44, task) {
  // Query APIs that match task category
  const apis = await base44.entities.APIMetadata.filter({
    verification_status: 'verified',
  }, '-execution_readiness_score', 5);

  return apis.length > 0 ? apis[0] : null;
}

/**
 * Get or create integration template for API
 */
async function getOrCreateTemplate(base44, api_id) {
  const existing = await base44.entities.APIIntegrationTemplate.filter({
    api_id,
  }, '-created_at', 1);

  if (existing.length > 0) {
    return existing[0];
  }

  // Template doesn't exist, create one
  try {
    const result = await base44.functions.invoke('apiWorkflowGenerator', {
      action: 'generate_template',
      api_id,
    });
    return result.data?.template;
  } catch (error) {
    console.warn('Template generation failed:', error.message);
    return null;
  }
}