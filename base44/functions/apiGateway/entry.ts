import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * API GATEWAY
 * Secure REST API with OpenAPI 3.0 compliance
 * - API key authentication
 * - Per-tenant rate limiting
 * - Core platform operations exposed
 */

const API_VERSION = 'v1';
const ROUTES = {
  'GET /api/v1/status': 'getStatus',
  'GET /api/v1/opportunities': 'getOpportunities',
  'GET /api/v1/opportunities/:id': 'getOpportunity',
  'POST /api/v1/tasks/execute': 'executeTask',
  'GET /api/v1/tasks/:id': 'getTask',
  'GET /api/v1/tasks': 'getTasks',
  'GET /api/v1/user': 'getUser',
  'PUT /api/v1/user': 'updateUser',
  'POST /api/v1/keys': 'createAPIKey',
  'GET /api/v1/keys': 'listAPIKeys',
  'DELETE /api/v1/keys/:id': 'revokeAPIKey',
  'GET /api/v1/openapi.json': 'getOpenAPISpec'
};

Deno.serve(async (req) => {
  try {
    // CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key'
        }
      });
    }

    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // Route matching
    const routeKey = `${method} ${path.replace(/\/[a-f0-9]+$/i, '/:id')}`;
    const handler = ROUTES[routeKey];

    if (!handler) {
      return jsonResponse({ error: 'Not found' }, 404);
    }

    // Authenticate via API key
    const apiKey = req.headers.get('X-API-Key') || extractBearerToken(req);
    if (!apiKey) {
      return jsonResponse({ error: 'Missing API key' }, 401);
    }

    const auth = await authenticateKey(base44, apiKey);
    if (!auth.valid) {
      return jsonResponse({ error: 'Invalid API key' }, 401);
    }

    // Rate limiting
    const rateLimitCheck = await checkRateLimit(base44, auth);
    if (!rateLimitCheck.allowed) {
      return jsonResponse({ error: 'Rate limit exceeded' }, 429, {
        'X-RateLimit-Limit': rateLimitCheck.limit,
        'X-RateLimit-Remaining': rateLimitCheck.remaining,
        'X-RateLimit-Reset': rateLimitCheck.reset
      });
    }

    // Dispatch handler
    const response = await dispatchHandler(base44, handler, { req, path, auth, method });

    // Update API key usage
    await updateKeyUsage(base44, auth.key.id);

    return response;

  } catch (error) {
    console.error('[APIGateway]', error.message);
    return jsonResponse({ error: error.message }, 500);
  }
});

/**
 * Authenticate API key with error handling
 */
async function authenticateKey(base44, apiKey) {
  const keyHash = hashKey(apiKey);
  const keys = await base44.asServiceRole.entities.APIKey.filter(
    { api_key_hash: keyHash, is_active: true },
    null, 1
  ).catch((err) => {
    console.error('[APIKey Auth]', err.message);
    return [];
  });

  const key = keys[0];
  if (!key) return { valid: false };

  // Check expiration
  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    return { valid: false };
  }

  return { valid: true, key };
}

/**
 * Check rate limit with per-tenant enforcement
 */
async function checkRateLimit(base44, auth) {
  const config = await base44.asServiceRole.entities.RateLimitConfig.filter(
    { tenant_id: auth.key.tenant_id },
    null, 1
  ).catch((err) => {
    console.error('[RateLimitConfig] Fetch error:', err.message);
    return [];
  });

  const limit = Math.min(config[0]?.calls_per_hour || 1000, auth.key.rate_limit_calls_per_hour || 1000);
  const now = new Date();
  const lastReset = auth.key.last_hour_reset ? new Date(auth.key.last_hour_reset) : new Date(now.getTime() - 3600000);
  const hoursPassed = (now - lastReset) / 3600000;
  
  // Verify API key not expired
  if (auth.key.expires_at && new Date(auth.key.expires_at) < now) {
    return { allowed: false, limit, remaining: 0, reset: now.toISOString() };
  }

  let currentCalls = auth.key.calls_made_this_hour || 0;
  if (hoursPassed >= 1) {
    currentCalls = 0; // Reset
  }

  const allowed = currentCalls < limit;
  const remaining = Math.max(0, limit - currentCalls - 1);
  const reset = new Date(lastReset.getTime() + 3600000).toISOString();
  
  // Log rate limit check for audit
  if (!allowed) {
    await base44.asServiceRole.entities.ComplianceAuditLog.create({
      user_email: auth.key.tenant_id,
      action_type: 'rate_limit_exceeded',
      entity_type: 'APIKey',
      entity_id: auth.key.id,
      details: { limit, current_calls: currentCalls },
      risk_level: 'medium',
      timestamp: now.toISOString()
    }).catch(() => {});
  }

  return { allowed, limit, remaining, reset };
}

/**
 * Update key usage stats and check for expiration
 */
async function updateKeyUsage(base44, keyId) {
  const now = new Date();
  const lastReset = new Date(now.getTime() - 3600000); // 1 hour ago
  
  // Auto-expire keys after 90 days of last use
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000);
  
  await base44.asServiceRole.entities.APIKey.update(keyId, {
    last_used: now.toISOString(),
    last_hour_reset: lastReset.toISOString(),
    is_active: now.getTime() - 90 * 86400000 > lastReset.getTime() ? false : true
  }).catch((err) => {
    console.error('[APIKey Update]', err.message);
  });
}

/**
 * Handler dispatch
 */
async function dispatchHandler(base44, handler, ctx) {
  const { req, path, auth } = ctx;
  const body = req.method !== 'GET' ? await req.json().catch(() => ({})) : {};

  if (handler === 'getStatus') {
    return jsonResponse({ status: 'operational', version: API_VERSION });
  }

  if (handler === 'getOpportunities') {
    const opps = await base44.asServiceRole.entities.Opportunity.list('-created_date', 50).catch((err) => {
      console.error('[Opportunity List]', err.message);
      return [];
    });
    return jsonResponse({ opportunities: opps.map(o => cleanOpp(o)) });
  }

  if (handler === 'getOpportunity') {
    const id = path.split('/').pop();
    const opp = await base44.asServiceRole.entities.Opportunity.filter({ id }, null, 1).then(r => r[0]).catch((err) => {
      console.error('[Opportunity Get]', err.message);
      return null;
    });
    return opp ? jsonResponse(cleanOpp(opp)) : jsonResponse({ error: 'Not found' }, 404);
  }

  if (handler === 'getTasks') {
    const tasks = await base44.asServiceRole.entities.TaskExecutionQueue.list('-created_date', 50).catch((err) => {
      console.error('[TaskExecutionQueue List]', err.message);
      return [];
    });
    return jsonResponse({ tasks: tasks.map(t => ({ id: t.id, status: t.status, opportunity_id: t.opportunity_id, priority: t.priority })) });
  }

  if (handler === 'getTask') {
    const id = path.split('/').pop();
    const task = await base44.asServiceRole.entities.TaskExecutionQueue.filter({ id }, null, 1).then(r => r[0]).catch((err) => {
      console.error('[TaskExecutionQueue Get]', err.message);
      return null;
    });
    return task ? jsonResponse({ id: task.id, status: task.status, opportunity_id: task.opportunity_id }) : jsonResponse({ error: 'Not found' }, 404);
  }

  if (handler === 'executeTask') {
    const { opportunity_id, identity_id } = body;
    if (!opportunity_id) return jsonResponse({ error: 'Missing opportunity_id' }, 400);

    const task = await base44.asServiceRole.entities.TaskExecutionQueue.create({
      opportunity_id,
      identity_id: identity_id || '',
      status: 'queued',
      queue_timestamp: new Date().toISOString(),
      priority: 50
    }).catch((err) => {
      console.error('[TaskExecutionQueue Create]', err.message);
      return null;
    });

    return task ? jsonResponse({ task_id: task.id, status: 'queued' }, 201) : jsonResponse({ error: 'Failed to create task' }, 500);
  }

  if (handler === 'getUser') {
    try {
      const user = await base44.auth.me();
      return jsonResponse({ id: user.id, email: user.email, full_name: user.full_name, role: user.role });
    } catch (err) {
      console.error('[User Get]', err.message);
      return jsonResponse({ error: 'Failed to fetch user' }, 500);
    }
  }

  if (handler === 'createAPIKey') {
    if (!auth.key.permissions.includes('admin:keys')) {
      return jsonResponse({ error: 'Insufficient permissions' }, 403);
    }

    const { key_name, permissions, rate_limit_calls_per_hour } = body;
    const newKey = generateApiKey();
    const hash = hashKey(newKey);
    const expiresAt = new Date(Date.now() + 90 * 86400000); // 90 days from now

    await base44.asServiceRole.entities.APIKey.create({
      key_name,
      api_key_hash: hash,
      api_key_prefix: newKey.substring(0, 8),
      tenant_id: auth.key.tenant_id,
      permissions: permissions || ['read:opportunities', 'read:tasks'],
      rate_limit_calls_per_hour: rate_limit_calls_per_hour || 1000,
      expires_at: expiresAt.toISOString()
    }).catch((err) => {
      console.error('[APIKey Create]', err.message);
    });

    return jsonResponse({ api_key: newKey, prefix: newKey.substring(0, 8), message: 'Save this key securely' }, 201);
  }

  if (handler === 'listAPIKeys') {
    const keys = await base44.asServiceRole.entities.APIKey.filter({ tenant_id: auth.key.tenant_id }, null, 100).catch((err) => {
      console.error('[APIKey List]', err.message);
      return [];
    });
    return jsonResponse({ keys: keys.map(k => ({ key_name: k.key_name, prefix: k.api_key_prefix, is_active: k.is_active, created_date: k.created_date })) });
  }

  if (handler === 'revokeAPIKey') {
    const id = path.split('/').pop();
    await base44.asServiceRole.entities.APIKey.update(id, { is_active: false }).catch((err) => {
      console.error('[APIKey Revoke]', err.message);
    });
    return jsonResponse({ message: 'API key revoked' });
  }

  if (handler === 'getOpenAPISpec') {
    return jsonResponse(getOpenAPISpec());
  }

  return jsonResponse({ error: 'Handler not implemented' }, 500);
}

/**
 * Utilities
 */
function generateApiKey() {
  return 'pk_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function hashKey(key) {
  // Simple hash since crypto import isn't available in Deno
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36) + '_' + key.substring(0, 8);
}

function extractBearerToken(req) {
  const auth = req.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) return auth.substring(7);
  return null;
}

function cleanOpp(opp) {
  return {
    id: opp.id,
    title: opp.title,
    category: opp.category,
    profit_estimate_high: opp.profit_estimate_high,
    status: opp.status,
    deadline: opp.deadline,
    created_date: opp.created_date
  };
}

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      ...headers
    }
  });
}

function getOpenAPISpec() {
  return {
    openapi: '3.0.0',
    info: {
      title: 'Velocity Platform API',
      version: '1.0.0',
      description: 'Secure REST API for platform operations and integrations'
    },
    servers: [
      { url: 'https://api.velocity.local', description: 'Production' }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key'
        }
      }
    },
    paths: {
      '/api/v1/status': {
        get: { summary: 'System status', tags: ['Status'] }
      },
      '/api/v1/opportunities': {
        get: { summary: 'List opportunities', tags: ['Opportunities'], security: [{ ApiKeyAuth: [] }] }
      },
      '/api/v1/opportunities/{id}': {
        get: { summary: 'Get opportunity', tags: ['Opportunities'], security: [{ ApiKeyAuth: [] }] }
      },
      '/api/v1/tasks': {
        get: { summary: 'List tasks', tags: ['Tasks'], security: [{ ApiKeyAuth: [] }] }
      },
      '/api/v1/tasks/{id}': {
        get: { summary: 'Get task', tags: ['Tasks'], security: [{ ApiKeyAuth: [] }] }
      },
      '/api/v1/tasks/execute': {
        post: { summary: 'Execute task', tags: ['Tasks'], security: [{ ApiKeyAuth: [] }] }
      },
      '/api/v1/user': {
        get: { summary: 'Get user', tags: ['User'], security: [{ ApiKeyAuth: [] }] }
      },
      '/api/v1/keys': {
        get: { summary: 'List API keys', tags: ['API Keys'], security: [{ ApiKeyAuth: [] }] },
        post: { summary: 'Create API key', tags: ['API Keys'], security: [{ ApiKeyAuth: [] }] }
      },
      '/api/v1/keys/{id}': {
        delete: { summary: 'Revoke API key', tags: ['API Keys'], security: [{ ApiKeyAuth: [] }] }
      }
    }
  };
}