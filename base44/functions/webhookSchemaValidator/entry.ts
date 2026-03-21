import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Webhook Schema Validator
 * Validates webhook payloads against defined schemas before sending
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, webhook_id, payload, schema } = await req.json();

    // ─── VALIDATE_PAYLOAD ────────────────────────────────────────────────
    if (action === 'validate_payload') {
      const validation = validatePayloadAgainstSchema(payload, schema);
      return Response.json({ success: validation.valid, validation });
    }

    // ─── TEST_WEBHOOK ────────────────────────────────────────────────────
    if (action === 'test_webhook') {
      const testResult = await testWebhook(base44, webhook_id, user);
      return Response.json({ success: testResult.success, test: testResult });
    }

    // ─── VALIDATE_WEBHOOK_CONFIG ──────────────────────────────────────────
    if (action === 'validate_webhook_config') {
      const validation = await validateWebhookConfig(base44, webhook_id, user);
      return Response.json({ success: validation.valid, validation });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function validatePayloadAgainstSchema(payload, schema) {
  const errors = [];
  const warnings = [];

  if (!schema) {
    return {
      valid: true,
      errors,
      warnings: ['No schema provided - skipping validation']
    };
  }

  // Check required fields
  if (schema.required && Array.isArray(schema.required)) {
    for (const field of schema.required) {
      if (!(field in payload)) {
        errors.push(`Required field missing: ${field}`);
      }
    }
  }

  // Check field types
  if (schema.properties) {
    for (const [field, fieldSchema] of Object.entries(schema.properties)) {
      if (field in payload) {
        const value = payload[field];
        const expectedType = fieldSchema.type;

        // Type checking
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (expectedType && actualType !== expectedType) {
          errors.push(`Field "${field}" expected ${expectedType} but got ${actualType}`);
        }

        // Enum validation
        if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
          errors.push(`Field "${field}" has invalid value "${value}". Allowed: ${fieldSchema.enum.join(', ')}`);
        }

        // Pattern validation
        if (fieldSchema.pattern && typeof value === 'string') {
          const regex = new RegExp(fieldSchema.pattern);
          if (!regex.test(value)) {
            errors.push(`Field "${field}" does not match pattern: ${fieldSchema.pattern}`);
          }
        }

        // Min/max length
        if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
          errors.push(`Field "${field}" is too short (min: ${fieldSchema.minLength})`);
        }
        if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
          errors.push(`Field "${field}" is too long (max: ${fieldSchema.maxLength})`);
        }

        // Min/max value
        if (fieldSchema.minimum !== undefined && value < fieldSchema.minimum) {
          errors.push(`Field "${field}" value too small (min: ${fieldSchema.minimum})`);
        }
        if (fieldSchema.maximum !== undefined && value > fieldSchema.maximum) {
          errors.push(`Field "${field}" value too large (max: ${fieldSchema.maximum})`);
        }
      }
    }
  }

  // Check for extra fields (not in schema)
  if (schema.additionalProperties === false) {
    for (const field of Object.keys(payload)) {
      if (!schema.properties || !(field in schema.properties)) {
        warnings.push(`Extra field not in schema: ${field}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    payload_size_bytes: JSON.stringify(payload).length
  };
}

async function testWebhook(base44, webhookId, user) {
  try {
    const webhook = await base44.asServiceRole.entities.WebhookConfig.get(webhookId)
      .catch(() => null);

    if (!webhook) {
      return { success: false, error: 'Webhook not found' };
    }

    // Create test payload
    const testPayload = {
      event: 'test_event',
      timestamp: new Date().toISOString(),
      test: true,
      message: 'This is a test webhook payload'
    };

    // Send test
    try {
      const startTime = Date.now();
      const response = await fetch(webhook.endpoint_url, {
        method: 'POST',
        headers: buildHeaders(webhook),
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout((webhook.timeout_seconds || 30) * 1000)
      });

      const responseTime = Date.now() - startTime;

      return {
        success: response.ok,
        status_code: response.status,
        response_time_ms: responseTime,
        message: response.ok ? 'Webhook is reachable and responding' : 'Webhook returned error status'
      };
    } catch (e) {
      return {
        success: false,
        error: e.message,
        message: 'Failed to reach webhook endpoint'
      };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function validateWebhookConfig(base44, webhookId, user) {
  const validation = {
    valid: true,
    errors: [],
    warnings: [],
    checks: {}
  };

  try {
    const webhook = await base44.asServiceRole.entities.WebhookConfig.get(webhookId)
      .catch(() => null);

    if (!webhook) {
      validation.valid = false;
      validation.errors.push('Webhook configuration not found');
      return validation;
    }

    // Check endpoint URL
    validation.checks.endpoint_url = {
      valid: !!webhook.endpoint_url && webhook.endpoint_url.startsWith('http'),
      message: webhook.endpoint_url ? 'Valid URL format' : 'URL is missing'
    };
    if (!validation.checks.endpoint_url.valid) {
      validation.errors.push('Invalid endpoint URL');
      validation.valid = false;
    }

    // Check events
    validation.checks.events = {
      valid: webhook.events && Array.isArray(webhook.events) && webhook.events.length > 0,
      message: webhook.events?.length > 0 ? `${webhook.events.length} events configured` : 'No events configured'
    };
    if (!validation.checks.events.valid) {
      validation.warnings.push('No events configured - webhook will not be triggered');
    }

    // Check authentication
    validation.checks.authentication = {
      valid: !webhook.auth_type || webhook.auth_type === 'none' || webhook.auth_value,
      message: webhook.auth_type && webhook.auth_type !== 'none' ? `${webhook.auth_type} authentication configured` : 'No authentication'
    };
    if (!validation.checks.authentication.valid) {
      validation.errors.push('Authentication configured but credentials missing');
      validation.valid = false;
    }

    // Check custom payload template if needed
    if (webhook.payload_format === 'custom' && webhook.custom_payload_template) {
      try {
        JSON.parse(webhook.custom_payload_template);
        validation.checks.payload_template = { valid: true, message: 'Valid JSON' };
      } catch (e) {
        validation.checks.payload_template = { valid: false, message: 'Invalid JSON format' };
        validation.errors.push('Custom payload template contains invalid JSON');
        validation.valid = false;
      }
    }

    // Check retry config
    validation.checks.retry_config = {
      valid: webhook.retry_config?.max_retries > 0,
      message: `${webhook.retry_config?.max_retries || 3} max retries configured`
    };

    // Test connectivity
    try {
      const testStart = Date.now();
      const response = await fetch(webhook.endpoint_url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      }).catch(async () => {
        // Fallback to POST if HEAD not supported
        return fetch(webhook.endpoint_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"test":true}',
          signal: AbortSignal.timeout(5000)
        });
      });

      const testTime = Date.now() - testStart;
      validation.checks.connectivity = {
        valid: response.ok || response.status < 500,
        message: `Reachable (${response.status}) - ${testTime}ms`
      };
    } catch (e) {
      validation.checks.connectivity = { valid: false, message: `Not reachable: ${e.message}` };
      validation.warnings.push('Webhook endpoint is not currently reachable');
    }

  } catch (e) {
    validation.valid = false;
    validation.errors.push(e.message);
  }

  return validation;
}

function buildHeaders(webhook) {
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Base44-WebhookValidator/1.0',
    ...webhook.headers
  };

  if (webhook.auth_type === 'bearer_token' && webhook.auth_value) {
    headers['Authorization'] = `Bearer ${webhook.auth_value}`;
  } else if (webhook.auth_type === 'api_key' && webhook.auth_value) {
    headers['X-API-Key'] = webhook.auth_value;
  } else if (webhook.auth_type === 'basic' && webhook.auth_value) {
    headers['Authorization'] = `Basic ${webhook.auth_value}`;
  }

  return headers;
}