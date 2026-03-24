import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * API METADATA EXTRACTOR
 * Scrapes GitHub and OpenAPI registries for open-source APIs
 * Extracts endpoint schemas and metadata
 * Returns structured APIMetadata for storage
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, source, query, url } = body;

    // Only admins can trigger discovery
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    if (action === 'scan_github') {
      return await scanGitHub(base44, query);
    } else if (action === 'scan_openapi_registry') {
      return await scanOpenAPIRegistry(base44, query);
    } else if (action === 'extract_from_url') {
      return await extractFromURL(base44, { url: url || query?.url });
    } else {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[apiMetadataExtractor]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Scan GitHub for open-source APIs
 * Search for repos with API specs (swagger.json, openapi.yaml, etc.)
 */
async function scanGitHub(base44, query) {
  const searchQueries = [
    `${query || 'api'} openapi.json in:file language:json`,
    `${query || 'api'} swagger.yaml in:file language:yaml`,
    `${query || 'api'} openapi.yaml in:file language:yaml`,
  ];

  const results = [];

  for (const q of searchQueries) {
    try {
      const url = `https://api.github.com/search/code?q=${encodeURIComponent(q)}&per_page=10`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'VELOCITY-API-Discovery/1.0',
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) continue;

      const data = await response.json();
      for (const item of data.items || []) {
        const rawUrl = item.html_url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
        const specResponse = await fetch(rawUrl);
        if (specResponse.ok) {
          const spec = await specResponse.json();
          results.push({
            source: 'github',
            github_repo_url: item.repository.html_url,
            spec_file_path: item.path,
            spec_content: spec,
            raw_spec_url: rawUrl,
          });
        }
      }
    } catch (e) {
      console.warn(`GitHub scan failed for query: ${q}`, e.message);
    }
  }

  return Response.json({
    action: 'scan_github',
    found_count: results.length,
    results,
  });
}

/**
 * Scan OpenAPI Registry (publicly available)
 * https://openapi.directory - directory of public APIs
 */
async function scanOpenAPIRegistry(base44, query) {
  try {
    const url = 'https://openapi.directory/api/apis';
    const response = await fetch(url);

    if (!response.ok) {
      return Response.json({ error: 'Failed to fetch OpenAPI registry' }, { status: 500 });
    }

    const registry = await response.json();
    const filtered = (registry.apis || []).filter(api =>
      !query || api.name.toLowerCase().includes(query.toLowerCase()) || api.description?.toLowerCase().includes(query.toLowerCase())
    );

    const results = [];
    for (const api of filtered.slice(0, 20)) {
      try {
        const specUrl = api.specs?.[0]?.url;
        if (!specUrl) continue;

        const specResponse = await fetch(specUrl);
        if (specResponse.ok) {
          const spec = await specResponse.json();
          results.push({
            source: 'openapi_registry',
            api_name: api.name,
            api_url: api.url,
            documentation_url: api.specs?.[0]?.url,
            spec_content: spec,
          });
        }
      } catch (e) {
        console.warn(`OpenAPI registry fetch failed for ${api.name}`, e.message);
      }
    }

    return Response.json({
      action: 'scan_openapi_registry',
      found_count: results.length,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Extract metadata from a direct OpenAPI/Swagger URL
 */
async function extractFromURL(base44, query) {
  if (!query || !query.url) {
    return Response.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    const response = await fetch(query.url);
    if (!response.ok) {
      return Response.json({ error: `Failed to fetch from ${query.url}` }, { status: 400 });
    }

    const spec = await response.json();

    // Parse OpenAPI 3.0 / Swagger 2.0 spec
    const metadata = parseOpenAPISpec(spec, query.url);

    return Response.json({
      action: 'extract_from_url',
      metadata,
      raw_spec: spec,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Parse OpenAPI/Swagger spec into APIMetadata format
 */
function parseOpenAPISpec(spec, url) {
  const isV3 = spec.openapi?.startsWith('3');
  const isV2 = spec.swagger === '2.0';

  const title = spec.info?.title || 'Unknown API';
  const description = spec.info?.description || '';
  const baseUrl = isV3
    ? spec.servers?.[0]?.url || ''
    : spec.basePath ? `${spec.host || ''}${spec.basePath}` : '';

  const endpoints = [];

  if (isV3) {
    // OpenAPI 3.0
    const paths = spec.paths || {};
    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, details] of Object.entries(methods)) {
        if (['get', 'post', 'put', 'delete', 'patch', 'head'].includes(method.toLowerCase())) {
          endpoints.push({
            method: method.toUpperCase(),
            path,
            description: details.summary || details.description || '',
            parameters: (details.parameters || []).map(p => ({
              name: p.name,
              type: p.schema?.type || 'string',
              required: p.required || false,
              description: p.description || '',
            })),
            auth_type: detectAuthType(details),
            response_schema: details.responses?.['200']?.content?.['application/json']?.schema || {},
          });
        }
      }
    }
  } else if (isV2) {
    // Swagger 2.0
    const paths = spec.paths || {};
    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, details] of Object.entries(methods)) {
        if (['get', 'post', 'put', 'delete', 'patch', 'head'].includes(method.toLowerCase())) {
          endpoints.push({
            method: method.toUpperCase(),
            path,
            description: details.summary || details.description || '',
            parameters: (details.parameters || []).map(p => ({
              name: p.name,
              type: p.type || 'string',
              required: p.required || false,
              description: p.description || '',
            })),
            auth_type: detectAuthType(details),
            response_schema: details.responses?.['200']?.schema || {},
          });
        }
      }
    }
  }

  return {
    api_name: title,
    api_url: baseUrl || url,
    api_type: 'rest',
    documentation_url: spec.externalDocs?.url || url,
    endpoints,
    capabilities: extractCapabilities(title, description, endpoints),
    discovery_source: 'custom',
    discovery_timestamp: new Date().toISOString(),
    verification_status: 'pending',
    execution_readiness_score: 0,
  };
}

function detectAuthType(details) {
  const security = details.security || [];
  if (security.length === 0) return 'none';
  if (security.some(s => s.api_key)) return 'api_key';
  if (security.some(s => s.bearer)) return 'bearer_token';
  if (security.some(s => s.oauth2)) return 'oauth2';
  if (security.some(s => s.basic)) return 'basic_auth';
  return 'custom';
}

function extractCapabilities(title, description, endpoints) {
  const capabilities = [];
  const text = `${title} ${description}`.toLowerCase();

  if (text.includes('payment') || text.includes('transaction')) capabilities.push('payment');
  if (text.includes('auth') || text.includes('user') || text.includes('login')) capabilities.push('user_auth');
  if (text.includes('data') || text.includes('sync')) capabilities.push('data_sync');
  if (text.includes('file') || text.includes('upload') || text.includes('storage')) capabilities.push('file_upload');
  if (text.includes('notification') || text.includes('email')) capabilities.push('notification');
  if (text.includes('search') || text.includes('query')) capabilities.push('search');
  if (text.includes('webhook')) capabilities.push('webhook');

  return capabilities.length > 0 ? capabilities : ['general'];
}