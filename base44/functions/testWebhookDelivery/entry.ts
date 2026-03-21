/**
 * TEST WEBHOOK DELIVERY
 * Sends a test payload to a webhook endpoint to verify connectivity
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { webhook_id } = await req.json();

    if (!webhook_id) {
      return Response.json({ error: 'webhook_id required' }, { status: 400 });
    }

    // Fetch webhook
    const webhook = await base44.entities.WebhookConfig.read(webhook_id);

    if (!webhook || webhook.created_by !== user.email) {
      return Response.json({ error: 'Webhook not found' }, { status: 404 });
    }

    // Build test payload
    const testPayload = {
      event_type: webhook.events?.[0] || 'test.event',
      timestamp: new Date().toISOString(),
      test: true,
      data: {
        message: 'This is a test payload from VELOCITY',
      },
    };

    // Build headers
    const headers = new Headers({
      'Content-Type': 'application/json',
      ...webhook.headers,
    });

    // Add auth if configured
    if (webhook.auth_type === 'bearer_token') {
      headers.set('Authorization', `Bearer ${webhook.auth_value}`);
    } else if (webhook.auth_type === 'api_key') {
      headers.set('X-API-Key', webhook.auth_value);
    } else if (webhook.auth_type === 'basic') {
      headers.set('Authorization', `Basic ${webhook.auth_value}`);
    }

    // Send test request
    const startTime = Date.now();
    const response = await fetch(webhook.endpoint_url, {
      method: 'POST',
      headers,
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(webhook.timeout_seconds * 1000),
    });

    const responseTime = Date.now() - startTime;
    const responseText = await response.text();

    // Log result
    const delivery = {
      timestamp: new Date().toISOString(),
      event: 'webhook.test',
      status: response.ok ? 'success' : 'failed',
      response_code: response.status,
      response_time_ms: responseTime,
      error_message: response.ok ? null : responseText,
    };

    // Update webhook stats
    const recentDeliveries = webhook.recent_deliveries || [];
    recentDeliveries.unshift(delivery);

    await base44.entities.WebhookConfig.update(webhook_id, {
      last_triggered_at: new Date().toISOString(),
      last_status: delivery.status,
      recent_deliveries: recentDeliveries.slice(0, 50),
    });

    return Response.json({
      success: response.ok,
      message: response.ok ? 'Test sent successfully' : 'Test failed',
      status_code: response.status,
      response_time_ms: responseTime,
    });
  } catch (error) {
    console.error('Test webhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});