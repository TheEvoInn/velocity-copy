import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * API CREDENTIAL MAPPER
 * Handles secure credential injection for API calls
 * Maps credential vault → API authentication headers
 * Supports api_key, bearer_token, basic_auth, oauth2
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, api_id, template_id, credential_id, auth_type } = await req.json();

    if (action === 'get_injection_headers') {
      return await getInjectionHeaders(base44, api_id, credential_id);
    } else if (action === 'validate_credentials') {
      return await validateCredentials(base44, api_id, credential_id);
    } else if (action === 'map_request_headers') {
      return await mapRequestHeaders(base44, template_id, credential_id);
    } else if (action === 'test_credential_injection') {
      return await testCredentialInjection(base44, api_id, credential_id);
    } else {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[apiCredentialMapper]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Get authentication headers to inject into API request
 */
async function getInjectionHeaders(base44, api_id, credential_id) {
  if (!api_id) {
    return Response.json({ error: 'Missing api_id' }, { status: 400 });
  }

  // Fetch API metadata to determine auth type
  const api = await base44.entities.APIMetadata.get(api_id);
  if (!api) {
    return Response.json({ error: 'API not found' }, { status: 404 });
  }

  const authType = api.endpoints?.[0]?.auth_type || 'none';

  // If no credentials needed, return empty headers
  if (authType === 'none') {
    return Response.json({
      success: true,
      headers: {},
      auth_type: 'none',
    });
  }

  // Fetch credentials (if credential_id provided)
  let credentials = {};
  if (credential_id) {
    try {
      const cred = await base44.entities.PlatformCredential.get(credential_id);
      if (cred) {
        credentials = cred;
      }
    } catch (e) {
      console.warn(`Credential ${credential_id} not found, using defaults`);
    }
  }

  // Generate headers based on auth type
  const headers = generateAuthHeaders(authType, credentials);

  // Log credential access
  await base44.entities.APIDiscoveryLog.create({
    api_id,
    api_name: api.api_name,
    action_type: 'used_by_autopilot',
    status: 'success',
    details: {
      credential_access: true,
      auth_type: authType,
      headers_generated: true,
    },
    timestamp: new Date().toISOString(),
  });

  return Response.json({
    success: true,
    auth_type: authType,
    headers,
    expires_in_seconds: 3600,
  });
}

/**
 * Generate auth headers based on credential type
 */
function generateAuthHeaders(authType, credentials) {
  const headers = {};

  switch (authType) {
    case 'api_key':
      // Try multiple common header names
      if (credentials.api_key_encrypted) {
        // In real scenario, decrypt here
        headers['X-API-Key'] = credentials.api_key_encrypted;
        headers['Authorization'] = `Bearer ${credentials.api_key_encrypted}`;
      }
      break;

    case 'bearer_token':
      if (credentials.webhook_token_encrypted) {
        headers['Authorization'] = `Bearer ${credentials.webhook_token_encrypted}`;
      } else if (credentials.api_key_encrypted) {
        headers['Authorization'] = `Bearer ${credentials.api_key_encrypted}`;
      }
      break;

    case 'basic_auth':
      if (credentials.username_email && credentials.password_encrypted) {
        const base64 = btoa(`${credentials.username_email}:${credentials.password_encrypted}`);
        headers['Authorization'] = `Basic ${base64}`;
      }
      break;

    case 'oauth2':
      if (credentials.webhook_token_encrypted) {
        headers['Authorization'] = `Bearer ${credentials.webhook_token_encrypted}`;
      }
      break;
  }

  headers['User-Agent'] = 'VELOCITY-Autopilot/1.0';
  headers['Accept'] = 'application/json';

  return headers;
}

/**
 * Validate that credentials exist and are properly configured
 */
async function validateCredentials(base44, api_id, credential_id) {
  const api = await base44.entities.APIMetadata.get(api_id);
  if (!api) {
    return Response.json({ error: 'API not found' }, { status: 404 });
  }

  const authType = api.endpoints?.[0]?.auth_type || 'none';

  if (authType === 'none') {
    return Response.json({
      success: true,
      valid: true,
      message: 'No credentials required',
    });
  }

  if (!credential_id) {
    return Response.json({
      success: false,
      valid: false,
      error: `Credentials required for ${authType} authentication`,
    });
  }

  try {
    const cred = await base44.entities.PlatformCredential.get(credential_id);
    if (!cred) {
      return Response.json({
        success: false,
        valid: false,
        error: 'Credential not found',
      });
    }

    // Validate required fields for auth type
    const isValid = validateCredentialFields(authType, cred);

    return Response.json({
      success: true,
      valid: isValid,
      auth_type: authType,
      credential_platform: cred.platform,
      message: isValid ? 'Credentials valid' : 'Credential missing required fields',
    });
  } catch (error) {
    return Response.json({
      success: false,
      valid: false,
      error: error.message,
    });
  }
}

/**
 * Validate credential has required fields for auth type
 */
function validateCredentialFields(authType, credential) {
  switch (authType) {
    case 'api_key':
      return !!credential.api_key_encrypted;
    case 'bearer_token':
      return !!credential.webhook_token_encrypted || !!credential.api_key_encrypted;
    case 'basic_auth':
      return !!(credential.username_email && credential.password_encrypted);
    case 'oauth2':
      return !!credential.webhook_token_encrypted;
    default:
      return true;
  }
}

/**
 * Map request to include authentication headers
 */
async function mapRequestHeaders(base44, template_id, credential_id) {
  if (!template_id) {
    return Response.json({ error: 'Missing template_id' }, { status: 400 });
  }

  const template = await base44.entities.APIIntegrationTemplate.get(template_id);
  if (!template) {
    return Response.json({ error: 'Template not found' }, { status: 404 });
  }

  const api = await base44.entities.APIMetadata.get(template.api_id);
  if (!api) {
    return Response.json({ error: 'API not found' }, { status: 404 });
  }

  // Get injection headers
  const headersResponse = await getInjectionHeaders(base44, api.id, credential_id);
  const injectionHeaders = headersResponse.headers || {};

  // Merge with template test payload headers
  const mergedHeaders = {
    ...template.test_payload?.headers || {},
    ...injectionHeaders,
  };

  return Response.json({
    success: true,
    template_id,
    headers: mergedHeaders,
    auth_type: headersResponse.auth_type,
  });
}

/**
 * Test credential injection by making a test API call
 */
async function testCredentialInjection(base44, api_id, credential_id) {
  const api = await base44.entities.APIMetadata.get(api_id);
  if (!api || !api.endpoints || api.endpoints.length === 0) {
    return Response.json({ error: 'API or endpoints not found' }, { status: 404 });
  }

  const endpoint = api.endpoints[0];
  const url = `${api.api_url}${endpoint.path}`;

  // Get injection headers
  const headersResponse = await getInjectionHeaders(base44, api_id, credential_id);
  const headers = headersResponse.headers || {};

  const startTime = Date.now();
  let success = false;
  let statusCode = 0;
  let responseTime = 0;
  let error = null;

  try {
    const response = await fetch(url, {
      method: endpoint.method || 'GET',
      headers,
    });

    responseTime = Date.now() - startTime;
    statusCode = response.status;
    success = statusCode < 500;
  } catch (err) {
    responseTime = Date.now() - startTime;
    success = false;
    error = err.message;
  }

  // Log test result
  await base44.entities.APIDiscoveryLog.create({
    api_id,
    api_name: api.api_name,
    action_type: 'tested',
    status: success ? 'success' : 'failed',
    http_status_code: statusCode,
    response_time_ms: responseTime,
    error_message: error,
    timestamp: new Date().toISOString(),
  });

  return Response.json({
    success,
    api_id,
    api_name: api.api_name,
    status_code: statusCode,
    response_time_ms: responseTime,
    error: error || null,
  });
}