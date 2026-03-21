/**
 * Webhook Task Receiver
 * Handles incoming webhook requests and triggers Task Reader workflows
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { createHmac } from 'npm:crypto@1.0.1';

Deno.serve(async (req) => {
  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    // Parse URL to get webhook token from path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const webhookToken = pathParts[pathParts.length - 1];

    if (!webhookToken) {
      return Response.json({ error: 'Invalid webhook URL' }, { status: 400 });
    }

    // Get payload
    const payload = await req.json();
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('cf-connecting-ip') ||
                     'unknown';

    // Find webhook config by token
    const base44 = createClientFromRequest(req);
    const webhooks = await base44.entities.WebhookTaskTrigger.filter({
      webhook_token: webhookToken,
      status: 'active'
    });

    if (webhooks.length === 0) {
      return Response.json({ error: 'Invalid webhook token' }, { status: 401 });
    }

    const webhook = webhooks[0];

    // Validate rate limiting
    const recentRequests = (webhook.request_history || []).filter(r => {
      const requestTime = new Date(r.timestamp).getTime();
      const oneMinuteAgo = Date.now() - 60000;
      return requestTime > oneMinuteAgo;
    });

    const rateLimitConfig = webhook.rate_limiting || { enabled: true, requests_per_minute: 60 };
    if (rateLimitConfig.enabled && recentRequests.length >= rateLimitConfig.requests_per_minute) {
      return Response.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    // Validate IP whitelist/blacklist
    const security = webhook.security || {};
    if (security.ip_blacklist?.includes(clientIp)) {
      return Response.json({ error: 'IP address blocked' }, { status: 403 });
    }
    if (security.ip_whitelist?.length > 0 && !security.ip_whitelist.includes(clientIp)) {
      return Response.json({ error: 'IP address not whitelisted' }, { status: 403 });
    }

    // Validate payload signature if required
    if (security.require_payload_signature) {
      const signature = req.headers.get('x-webhook-signature');
      if (!signature) {
        return Response.json({ error: 'Missing webhook signature' }, { status: 400 });
      }

      const expectedSignature = createHmac('sha256', webhookToken)
        .update(JSON.stringify(payload))
        .digest('hex');

      if (signature !== expectedSignature) {
        return Response.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }
    }

    // Map payload to task parameters
    const taskParams = {
      ...(webhook.task_parameters || {}),
      url: payload.url || payload.data?.url || undefined,
      email: payload.email || payload.data?.email || undefined,
      name: payload.name || payload.data?.name || undefined,
      phone: payload.phone || payload.data?.phone || undefined,
      company: payload.company || payload.data?.company || undefined,
      description: payload.description || payload.data?.description || undefined
    };

    // Apply custom payload mappings
    if (webhook.payload_mapping && Array.isArray(webhook.payload_mapping)) {
      for (const mapping of webhook.payload_mapping) {
        const sourceValue = getNestedProperty(payload, mapping.source_field);

        if (mapping.required && !sourceValue) {
          return Response.json(
            { error: `Missing required field: ${mapping.source_field}` },
            { status: 400 }
          );
        }

        if (sourceValue) {
          const transformedValue = applyTransform(sourceValue, mapping.transform);
          taskParams[mapping.target_parameter] = transformedValue;
        }
      }
    }

    // Create task in Task Reader
    let taskId = null;
    try {
      const taskRecord = await base44.entities.ExternalTaskAnalysis.create({
        url: taskParams.url,
        task_name: webhook.webhook_name,
        page_type: 'generic_page',
        understanding: {
          confidence: 0.5,
          required_actions: [],
          form_fields: [],
          dependencies: [],
          validation_rules: [],
          error_paths: [],
          success_indicators: [],
          blockers: [],
          estimated_time_minutes: 5
        },
        actions: [],
        execution_status: 'analyzed',
        execution_log: [
          {
            timestamp: new Date().toISOString(),
            step: 'webhook_triggered',
            status: 'success',
            details: `Triggered via webhook: ${webhook.webhook_name}`
          }
        ],
        metadata: {
          source: 'webhook',
          webhook_id: webhook.id,
          webhook_name: webhook.webhook_name,
          task_parameters: taskParams,
          source_ip: clientIp
        },
        notes: `Webhook trigger from ${webhook.webhook_name}`
      });

      taskId = taskRecord.id;

      // Queue for execution if configured
      if (webhook.trigger_type !== 'generic_task') {
        await base44.entities.TaskExecutionQueue.create({
          opportunity_id: taskId,
          url: taskParams.url,
          opportunity_type: mapWebhookTypeToTaskType(webhook.trigger_type),
          platform: 'webhook',
          identity_id: webhook.task_parameters?.identity_id || 'default',
          status: 'queued',
          priority: webhook.task_parameters?.priority || 50,
          estimated_value: 0,
          deadline: new Date(Date.now() + 86400000).toISOString(),
          queue_timestamp: new Date().toISOString(),
          page_structure: {},
          form_fields_detected: []
        });
      }
    } catch (err) {
      console.error('Failed to create task:', err);
      return Response.json(
        { error: 'Failed to create task', details: err.message },
        { status: 500 }
      );
    }

    // Update webhook history
    const payloadHash = hashPayload(JSON.stringify(payload));
    await base44.entities.WebhookTaskTrigger.update(webhook.id, {
      request_history: [
        {
          timestamp: new Date().toISOString(),
          source_ip: clientIp,
          payload_hash: payloadHash,
          task_created: !!taskId,
          task_id: taskId,
          status: 'success',
          execution_time_ms: 0
        },
        ...(webhook.request_history || []).slice(0, 99)
      ]
    });

    // Log activity
    await base44.entities.ActivityLog.create({
      action_type: 'system',
      message: `Webhook triggered: ${webhook.webhook_name}`,
      metadata: {
        webhook_id: webhook.id,
        task_id: taskId,
        source_ip: clientIp,
        payload_hash: payloadHash
      },
      severity: 'info'
    });

    return Response.json({
      status: 'success',
      message: 'Task created from webhook',
      task_id: taskId,
      webhook_name: webhook.webhook_name
    });
  } catch (error) {
    console.error('Webhook receiver error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Helper: Get nested property from object
function getNestedProperty(obj, path) {
  return path.split('.').reduce((current, prop) => current?.[prop], obj);
}

// Helper: Apply transformation
function applyTransform(value, transform) {
  switch (transform) {
    case 'uppercase':
      return typeof value === 'string' ? value.toUpperCase() : value;
    case 'lowercase':
      return typeof value === 'string' ? value.toLowerCase() : value;
    case 'trim':
      return typeof value === 'string' ? value.trim() : value;
    case 'url_encode':
      return typeof value === 'string' ? encodeURIComponent(value) : value;
    case 'json_stringify':
      return typeof value === 'string' ? value : JSON.stringify(value);
    default:
      return value;
  }
}

// Helper: Hash payload
function hashPayload(data) {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);
  const hashBuffer = crypto.subtle.digestSync('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper: Map webhook trigger type to task execution type
function mapWebhookTypeToTaskType(type) {
  const mapping = {
    url_analysis: 'other',
    form_filling: 'application',
    grant_application: 'grant',
    job_application: 'job',
    generic_task: 'other'
  };
  return mapping[type] || 'other';
}