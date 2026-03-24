import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * API DOCUMENTATION PARSER
 * Parses raw OpenAPI/Swagger specs into structured APIMetadata
 * Enriches specs with extracted metadata
 * Creates database-ready records
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, raw_spec, source_url, github_repo_url, manual_metadata } = await req.json();

    if (action === 'parse_openapi') {
      const parsed = parseOpenAPISpec(raw_spec, source_url);
      return Response.json({ success: true, parsed_metadata: parsed });
    } else if (action === 'enrich_metadata') {
      const enriched = await enrichMetadata(base44, manual_metadata);
      return Response.json({ success: true, enriched_metadata: enriched });
    } else if (action === 'store_api_metadata') {
      const stored = await storeAPIMetadata(base44, manual_metadata);
      return Response.json({ success: true, api_metadata_id: stored.id });
    } else {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[apiDocumentationParser]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Parse OpenAPI/Swagger specification
 */
function parseOpenAPISpec(spec, source_url) {
  if (!spec) {
    throw new Error('No specification provided');
  }

  const isV3 = spec.openapi?.startsWith('3');
  const isV2 = spec.swagger === '2.0';

  if (!isV3 && !isV2) {
    throw new Error('Unsupported spec format. Expected OpenAPI 3.x or Swagger 2.0');
  }

  const info = spec.info || {};
  const title = info.title || 'Unknown API';
  const description = info.description || '';
  const version = info.version || '1.0.0';

  // Extract base URL
  let baseUrl = '';
  if (isV3) {
    baseUrl = spec.servers?.[0]?.url || '';
  } else if (isV2) {
    const scheme = spec.schemes?.[0] || 'https';
    baseUrl = `${scheme}://${spec.host || ''}${spec.basePath || ''}`;
  }

  // Parse all endpoints
  const endpoints = [];
  const paths = spec.paths || {};

  for (const [pathKey, pathItem] of Object.entries(paths)) {
    for (const [methodKey, operation] of Object.entries(pathItem)) {
      const method = methodKey.toUpperCase();
      if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'].includes(method)) {
        continue;
      }

      const params = isV3
        ? (operation.parameters || []).map(p => ({
            name: p.name,
            type: p.schema?.type || 'string',
            required: p.required || false,
            description: p.description || '',
            in: p.in,
          }))
        : (operation.parameters || []).map(p => ({
            name: p.name,
            type: p.type || 'string',
            required: p.required || false,
            description: p.description || '',
            in: p.in,
          }));

      const responseSchema = isV3
        ? operation.responses?.['200']?.content?.['application/json']?.schema
        : operation.responses?.['200']?.schema;

      endpoints.push({
        method,
        path: pathKey,
        description: operation.summary || operation.description || '',
        operationId: operation.operationId,
        tags: operation.tags || [],
        parameters: params,
        auth_type: detectAuthType(operation, spec),
        response_schema: responseSchema || {},
      });
    }
  }

  // Detect capabilities
  const capabilities = extractCapabilities(title, description, endpoints);

  return {
    api_name: title,
    api_url: baseUrl || source_url || '',
    api_type: 'rest',
    api_version: version,
    documentation_url: source_url,
    endpoints,
    capabilities,
    discovery_source: 'custom',
    discovery_timestamp: new Date().toISOString(),
    verification_status: 'pending',
    execution_readiness_score: calculateReadinessScore(endpoints),
  };
}

/**
 * Enrich metadata with AI-generated insights
 */
async function enrichMetadata(base44, metadata) {
  try {
    const prompt = `Analyze this API and provide a brief summary of its key functions, best use cases, and potential integration opportunities.
    
API Name: ${metadata.api_name}
Base URL: ${metadata.api_url}
Description: ${metadata.documentation_url}
Endpoints: ${metadata.endpoints?.length || 0}

Return a JSON object with: { summary, use_cases, integration_opportunities, risk_level }`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          use_cases: { type: 'array', items: { type: 'string' } },
          integration_opportunities: { type: 'array', items: { type: 'string' } },
          risk_level: { type: 'string' },
        },
      },
    });

    return {
      ...metadata,
      ai_summary: result?.summary,
      ai_use_cases: result?.use_cases || [],
      ai_integration_opportunities: result?.integration_opportunities || [],
      ai_risk_assessment: result?.risk_level,
    };
  } catch (error) {
    console.warn('AI enrichment failed:', error.message);
    return metadata;
  }
}

/**
 * Store API metadata in database
 */
async function storeAPIMetadata(base44, metadata) {
  const record = await base44.entities.APIMetadata.create({
    api_name: metadata.api_name,
    api_url: metadata.api_url,
    api_type: metadata.api_type || 'rest',
    documentation_url: metadata.documentation_url,
    github_repo_url: metadata.github_repo_url,
    endpoints: metadata.endpoints || [],
    capabilities: metadata.capabilities || [],
    categories: metadata.categories || [],
    discovery_source: metadata.discovery_source || 'custom',
    discovery_timestamp: new Date().toISOString(),
    verification_status: 'pending',
    execution_readiness_score: calculateReadinessScore(metadata.endpoints),
    notes: metadata.notes || '',
  });

  return record;
}

function detectAuthType(operation, globalSpec) {
  const security = operation.security || globalSpec.security || [];
  if (security.length === 0) return 'none';

  const secObj = security[0] || {};
  if (secObj.api_key || secObj.apiKey) return 'api_key';
  if (secObj.bearer || secObj.bearerAuth) return 'bearer_token';
  if (secObj.oauth2) return 'oauth2';
  if (secObj.basic || secObj.basicAuth) return 'basic_auth';

  return 'custom';
}

function extractCapabilities(title, description, endpoints) {
  const text = `${title} ${description}`.toLowerCase();
  const capabilities = new Set();

  const keywords = {
    'payment': ['payment', 'transaction', 'charge', 'billing', 'invoice'],
    'user_auth': ['auth', 'login', 'user', 'account', 'token'],
    'data_sync': ['sync', 'data', 'store', 'database', 'persistence'],
    'file_upload': ['file', 'upload', 'storage', 'bucket', 'asset'],
    'notification': ['notify', 'email', 'sms', 'push', 'alert'],
    'search': ['search', 'query', 'filter', 'find', 'lookup'],
    'webhook': ['webhook', 'event', 'callback', 'listener'],
    'analytics': ['analytics', 'metric', 'report', 'stat', 'event'],
  };

  for (const [cap, words] of Object.entries(keywords)) {
    if (words.some(w => text.includes(w))) {
      capabilities.add(cap);
    }
  }

  return Array.from(capabilities).length > 0 ? Array.from(capabilities) : ['general'];
}

function calculateReadinessScore(endpoints) {
  if (!endpoints || endpoints.length === 0) return 0;

  let score = 20; // Base score

  // Endpoint count (max +30)
  score += Math.min(endpoints.length * 2, 30);

  // Documentation quality (max +25)
  const documentedEndpoints = endpoints.filter(e => e.description && e.description.length > 10).length;
  score += (documentedEndpoints / endpoints.length) * 25;

  // Auth variety (max +15)
  const authTypes = new Set(endpoints.map(e => e.auth_type));
  if (authTypes.size > 1) score += 15;

  // Parameter documentation (max +10)
  const paramsDocumented = endpoints.filter(e => e.parameters?.every(p => p.description)).length;
  score += (paramsDocumented / endpoints.length) * 10;

  return Math.min(Math.round(score), 100);
}