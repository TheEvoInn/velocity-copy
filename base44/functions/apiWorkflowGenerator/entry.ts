import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * API WORKFLOW GENERATOR
 * Auto-generates execution templates for discovered APIs
 * Creates credential requirements, parameter mappings, error handling
 * Populates APIIntegrationTemplate for Autopilot execution
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, api_id, api_metadata } = await req.json();

    if (action === 'generate_template') {
      return await generateTemplate(base44, api_id, api_metadata);
    } else if (action === 'batch_generate_templates') {
      return await batchGenerateTemplates(base44);
    } else if (action === 'get_template') {
      return await getTemplate(base44, api_id);
    } else {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[apiWorkflowGenerator]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Generate execution template for an API
 */
async function generateTemplate(base44, api_id, api_metadata) {
  if (!api_id && !api_metadata) {
    return Response.json({ error: 'Missing api_id or api_metadata' }, { status: 400 });
  }

  const api = api_metadata || (await base44.entities.APIMetadata.get(api_id));
  if (!api) {
    return Response.json({ error: 'API not found' }, { status: 404 });
  }

  // Check if template already exists
  const existingTemplates = await base44.entities.APIIntegrationTemplate.filter({
    api_id: api.id,
  }, '-created_at', 1);

  if (existingTemplates.length > 0) {
    return Response.json({
      success: true,
      template_id: existingTemplates[0].id,
      message: 'Template already exists',
    });
  }

  // Generate credential requirements
  const credentialReqs = generateCredentialRequirements(api);

  // Generate parameter mappings for first endpoint
  const parameterMappings = generateParameterMappings(api.endpoints?.[0] || {});

  // Generate response parsing rules
  const responseParsing = generateResponseParsing(api.endpoints?.[0]?.response_schema || {});

  // Generate error handling strategy
  const errorHandling = generateErrorHandling(api.endpoints || []);

  // Generate test payload
  const testPayload = generateTestPayload(api.endpoints?.[0] || {});

  // Create integration template
  const template = await base44.entities.APIIntegrationTemplate.create({
    api_id: api.id,
    api_name: api.api_name,
    execution_type: determineExecutionType(api),
    required_credentials: credentialReqs,
    parameter_mapping: parameterMappings,
    response_parsing: responseParsing,
    error_handling: errorHandling,
    test_payload: testPayload,
    expected_test_response: {},
    ready_for_use: false,
    created_by_autopilot: false,
    notes: `Auto-generated for ${api.api_name} with ${api.endpoints?.length || 0} endpoints`,
  });

  // Log template creation
  await base44.entities.APIDiscoveryLog.create({
    api_id: api.id,
    api_name: api.api_name,
    action_type: 'integrated',
    status: 'success',
    details: {
      template_id: template.id,
      execution_type: template.execution_type,
      credentials_required: credentialReqs.length,
    },
    timestamp: new Date().toISOString(),
  });

  return Response.json({
    success: true,
    template_id: template.id,
    api_id: api.id,
    api_name: api.api_name,
    template,
  });
}

/**
 * Generate credential requirements based on API auth type
 */
function generateCredentialRequirements(api) {
  const requirements = [];
  const endpoints = api.endpoints || [];

  // Collect all auth types used
  const authTypes = new Set(endpoints.map(e => e.auth_type).filter(Boolean));

  for (const authType of authTypes) {
    switch (authType) {
      case 'api_key':
        requirements.push({
          field_name: 'api_key',
          field_type: 'string',
          encryption_required: true,
          storage_location: 'credential_vault',
          description: 'API key for authentication',
        });
        break;
      case 'bearer_token':
        requirements.push({
          field_name: 'bearer_token',
          field_type: 'string',
          encryption_required: true,
          storage_location: 'credential_vault',
          description: 'Bearer token for OAuth/JWT',
        });
        break;
      case 'basic_auth':
        requirements.push(
          {
            field_name: 'username',
            field_type: 'string',
            encryption_required: true,
            storage_location: 'credential_vault',
            description: 'Username for basic auth',
          },
          {
            field_name: 'password',
            field_type: 'string',
            encryption_required: true,
            storage_location: 'credential_vault',
            description: 'Password for basic auth',
          }
        );
        break;
      case 'oauth2':
        requirements.push({
          field_name: 'oauth_token',
          field_type: 'string',
          encryption_required: true,
          storage_location: 'credential_vault',
          description: 'OAuth2 access token',
        });
        break;
    }
  }

  return requirements.length > 0 ? requirements : [{ field_name: 'none', field_type: 'none' }];
}

/**
 * Generate parameter mappings for task → API
 */
function generateParameterMappings(endpoint) {
  const mappings = {};

  if (!endpoint.parameters) return mappings;

  for (const param of endpoint.parameters) {
    // Map common parameter names to task fields
    if (param.name.includes('id')) {
      mappings[`task.entity_id`] = `params.${param.name}`;
    } else if (param.name.includes('query') || param.name.includes('search')) {
      mappings[`task.description`] = `params.${param.name}`;
    } else if (param.name.includes('limit') || param.name.includes('count')) {
      mappings[`task.priority`] = `params.${param.name}`;
    } else {
      mappings[`task.metadata.${param.name}`] = `params.${param.name}`;
    }
  }

  return mappings;
}

/**
 * Generate response parsing rules
 */
function generateResponseParsing(responseSchema) {
  if (!responseSchema || Object.keys(responseSchema).length === 0) {
    return {
      extract_path: '$',
      expected_fields: ['data', 'id', 'status'],
    };
  }

  const properties = responseSchema.properties || {};
  const fieldNames = Object.keys(properties).slice(0, 5);

  return {
    extract_path: '$.data',
    expected_fields: fieldNames.length > 0 ? fieldNames : ['status', 'message'],
    transform_function: 'return {success: true, data: response.data || response};',
  };
}

/**
 * Generate error handling strategy
 */
function generateErrorHandling(endpoints) {
  return {
    retry_on_status_codes: [408, 429, 500, 502, 503, 504],
    max_retries: 3,
    backoff_ms: 1000,
    fallback_action: 'request_user_intervention',
  };
}

/**
 * Generate test payload for first endpoint
 */
function generateTestPayload(endpoint) {
  const payload = {
    method: endpoint.method || 'GET',
    path: endpoint.path || '/',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'VELOCITY-Autopilot/1.0',
    },
    params: {},
  };

  // Add sample parameters
  if (endpoint.parameters) {
    for (const param of endpoint.parameters.slice(0, 3)) {
      if (param.type === 'string') {
        payload.params[param.name] = 'test_value';
      } else if (param.type === 'number') {
        payload.params[param.name] = 123;
      } else if (param.type === 'boolean') {
        payload.params[param.name] = true;
      }
    }
  }

  return payload;
}

/**
 * Determine execution type based on API characteristics
 */
function determineExecutionType(api) {
  const capabilities = api.capabilities || [];

  if (capabilities.includes('webhook')) return 'webhook_listener';
  if (capabilities.includes('event')) return 'polling';
  if (api.endpoints?.some(e => e.path.includes('batch'))) return 'batch_process';

  return 'direct_call';
}

/**
 * Batch generate templates for all verified APIs
 */
async function batchGenerateTemplates(base44) {
  const apis = await base44.entities.APIMetadata.filter({
    verification_status: 'verified',
  }, '-execution_readiness_score', 50);

  const results = {
    apis_processed: 0,
    templates_created: 0,
    failed: [],
    timestamp: new Date().toISOString(),
  };

  for (const api of apis) {
    try {
      const response = await generateTemplate(base44, api.id, api);
      if (response.template_id) {
        results.templates_created++;
      }
      results.apis_processed++;
    } catch (error) {
      console.warn(`Template generation failed for ${api.api_name}:`, error.message);
      results.failed.push({ api_id: api.id, error: error.message });
    }
  }

  return Response.json(results);
}

/**
 * Retrieve existing template for an API
 */
async function getTemplate(base44, api_id) {
  const templates = await base44.entities.APIIntegrationTemplate.filter({
    api_id,
  }, '-created_at', 1);

  if (templates.length === 0) {
    return Response.json({ error: 'Template not found' }, { status: 404 });
  }

  return Response.json({ success: true, template: templates[0] });
}