import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Dispatch webhook events to configured external endpoints
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event_type, event_data, run_async } = await req.json();

    if (!event_type || !event_data) {
      return Response.json({ error: 'event_type and event_data required' }, { status: 400 });
    }

    // Get all active webhooks matching this event type (use service role for background dispatch)
    const webhooks = await base44.asServiceRole.entities.WebhookConfig.filter({
      is_active: true,
      events: { $in: [event_type] }
    }).catch(() => []);

    if (!webhooks || webhooks.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'No webhooks configured for this event',
        dispatched: 0 
      });
    }

    const results = [];

    for (const webhook of webhooks) {
      if (webhook.test_mode) {
        console.log(`[TEST MODE] Would dispatch to ${webhook.endpoint_url}`);
        continue;
      }

      const payload = buildPayload(webhook, event_type, event_data);
      const headers = buildHeaders(webhook);

      try {
        const startTime = Date.now();
        const response = await fetch(webhook.endpoint_url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(webhook.timeout_seconds * 1000)
        });

        const responseTime = Date.now() - startTime;
        const success = response.ok;
        
        // Record delivery (use service role)
        await recordDelivery(base44.asServiceRole, webhook.id, event_type, success, response.status, responseTime, null);
        
        results.push({
          webhook_id: webhook.id,
          webhook_name: webhook.name,
          endpoint: webhook.endpoint_url,
          success,
          status_code: response.status,
          response_time_ms: responseTime
        });

      } catch (error) {
        // Record failed delivery (use service role)
        await recordDelivery(base44.asServiceRole, webhook.id, event_type, false, null, null, error.message);
        
        results.push({
          webhook_id: webhook.id,
          webhook_name: webhook.name,
          endpoint: webhook.endpoint_url,
          success: false,
          error: error.message
        });
      }
    }

    return Response.json({
      success: true,
      dispatched: webhooks.length,
      results
    });

  } catch (error) {
    console.error('Webhook dispatcher error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Build payload based on webhook configuration
function buildPayload(webhook, eventType, eventData) {
  const timestamp = new Date().toISOString();

  if (webhook.payload_format === 'custom' && webhook.custom_payload_template) {
    try {
      let template = webhook.custom_payload_template;
      
      // Replace variables
      template = template.replace(/\{\{event_type\}\}/g, eventType);
      template = template.replace(/\{\{timestamp\}\}/g, timestamp);
      
      // Replace event data variables
      for (const [key, value] of Object.entries(eventData)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        template = template.replace(regex, JSON.stringify(value));
      }
      
      return JSON.parse(template);
    } catch (e) {
      console.error('Custom payload template error:', e);
      return defaultPayload(eventType, eventData, timestamp);
    }
  }

  return defaultPayload(eventType, eventData, timestamp);
}

// Default payload structure
function defaultPayload(eventType, eventData, timestamp) {
  return {
    event: eventType,
    timestamp,
    data: eventData
  };
}

// Build HTTP headers
function buildHeaders(webhook) {
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Base44-WebhookDispatcher/1.0',
    ...webhook.headers
  };

  // Add authentication
  if (webhook.auth_type === 'bearer_token' && webhook.auth_value) {
    headers['Authorization'] = `Bearer ${webhook.auth_value}`;
  } else if (webhook.auth_type === 'api_key' && webhook.auth_value) {
    headers['X-API-Key'] = webhook.auth_value;
  } else if (webhook.auth_type === 'basic' && webhook.auth_value) {
    headers['Authorization'] = `Basic ${webhook.auth_value}`;
  }

  return headers;
}

// Record delivery attempt
async function recordDelivery(base44Client, webhookId, eventType, success, statusCode, responseTime, errorMessage) {
  try {
    const delivery = {
      timestamp: new Date().toISOString(),
      event: eventType,
      status: success ? 'success' : 'failed',
      response_code: statusCode,
      response_time_ms: responseTime,
      error_message: errorMessage
    };

    // Get current webhook (use appropriate base44 client method)
    const webhook = await base44Client.entities.WebhookConfig.get(webhookId);
    
    // Add delivery to recent list (keep last 50)
    const recentDeliveries = webhook.recent_deliveries || [];
    recentDeliveries.unshift(delivery);
    recentDeliveries.splice(50); // Keep only last 50

    // Update delivery stats
    const stats = webhook.delivery_stats || {
      total_deliveries: 0,
      successful_deliveries: 0,
      failed_deliveries: 0,
      success_rate: 0
    };

    stats.total_deliveries++;
    if (success) {
      stats.successful_deliveries++;
    } else {
      stats.failed_deliveries++;
    }
    stats.success_rate = Math.round((stats.successful_deliveries / stats.total_deliveries) * 100);

    // Update webhook
    await base44Client.entities.WebhookConfig.update(webhookId, {
      last_triggered_at: new Date().toISOString(),
      last_status: success ? 'success' : 'failed',
      recent_deliveries: recentDeliveries,
      delivery_stats: stats
    });

  } catch (error) {
    console.error('Failed to record delivery:', error);
  }
}