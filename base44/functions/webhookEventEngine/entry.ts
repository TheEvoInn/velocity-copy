/**
 * WEBHOOK EVENT ENGINE
 * Sends real-time notifications to registered webhooks when platform events occur
 * Integrates with: Task completion, Transaction recording, Onboarding completion
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const WEBHOOK_EVENTS = {
  'task.completed': 'Task completed successfully',
  'task.failed': 'Task failed',
  'task.queued': 'Task added to queue',
  'transaction.created': 'Transaction recorded',
  'transaction.completed': 'Transaction completed',
  'onboarding.step_completed': 'Onboarding step completed',
  'onboarding.completed': 'Onboarding fully completed',
  'opportunity.new': 'New opportunity discovered',
  'identity.created': 'New AI identity created',
  'wallet.added': 'New crypto wallet added',
  'credential.added': 'New credential stored'
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, event_type, entity_data } = await req.json();

    switch (action) {
      case 'trigger_event':
        return await triggerWebhookEvent(base44, user, event_type, entity_data);

      case 'get_available_events':
        return await getAvailableEvents();

      case 'test_webhook':
        return await testWebhook(base44, user, entity_data);

      case 'get_event_logs':
        return await getEventLogs(base44, user, entity_data);

      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Webhook event engine error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function triggerWebhookEvent(base44, user, eventType, entityData) {
  try {
    if (!WEBHOOK_EVENTS[eventType]) {
      return Response.json({ error: 'Unknown event type' }, { status: 400 });
    }

    // Fetch all webhooks subscribed to this event
    const webhooks = await base44.asServiceRole.entities.WebhookConfig.filter({
      created_by: user.email,
      is_active: true,
      events: { $in: [eventType] }
    });

    if (!webhooks || webhooks.length === 0) {
      return Response.json({
        success: true,
        message: 'No webhooks subscribed to this event',
        webhooks_triggered: 0
      });
    }

    // Prepare payload
    const payload = buildPayload(eventType, entityData);

    // Send to each webhook
    const results = [];
    for (const webhook of webhooks) {
      const result = await sendToWebhook(base44, user, webhook, eventType, payload);
      results.push(result);

      // Update webhook stats
      await updateWebhookStats(base44, webhook.id, result);
    }

    // Log event
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'webhook_event',
      message: `Event "${eventType}" triggered ${results.length} webhook(s)`,
      severity: results.some(r => r.success) ? 'success' : 'warning',
      metadata: {
        event_type: eventType,
        webhooks_triggered: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        timestamp: new Date().toISOString()
      }
    });

    return Response.json({
      success: true,
      event_type: eventType,
      webhooks_triggered: results.length,
      results
    });
  } catch (error) {
    console.error('Trigger event error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function buildPayload(eventType, entityData) {
  const timestamp = new Date().toISOString();
  const basePayload = {
    event: eventType,
    timestamp,
    data: entityData
  };

  // Enhance payload based on event type
  switch (eventType) {
    case 'task.completed':
      return {
        ...basePayload,
        summary: `Task completed with value: $${entityData.estimated_value || 0}`,
        details: {
          task_id: entityData.id,
          status: 'completed',
          value: entityData.estimated_value,
          platform: entityData.platform,
          completion_time: entityData.completion_timestamp
        }
      };

    case 'transaction.created':
      return {
        ...basePayload,
        summary: `Transaction recorded: $${entityData.value_usd || 0} ${entityData.token_symbol || 'USD'}`,
        details: {
          transaction_id: entityData.id,
          type: entityData.transaction_type,
          amount: entityData.amount,
          value_usd: entityData.value_usd,
          wallet: entityData.wallet_address,
          timestamp: entityData.timestamp
        }
      };

    case 'onboarding.completed':
      return {
        ...basePayload,
        summary: 'User completed platform onboarding',
        details: {
          user_email: entityData.email,
          identity_verified: entityData.identity_verified || false,
          kyc_verified: entityData.kyc_verified || false,
          wallets_added: entityData.wallets_count || 0,
          credentials_added: entityData.credentials_count || 0,
          autopilot_ready: true
        }
      };

    case 'onboarding.step_completed':
      return {
        ...basePayload,
        summary: `Onboarding step "${entityData.step_name}" completed`,
        details: {
          step: entityData.step_name,
          step_order: entityData.step_order,
          progress_percent: entityData.progress_percent
        }
      };

    case 'opportunity.new':
      return {
        ...basePayload,
        summary: `New opportunity: ${entityData.title} - Estimated: $${entityData.profit_estimate_high || 0}`,
        details: {
          opportunity_id: entityData.id,
          title: entityData.title,
          category: entityData.category,
          profit_estimate: `$${entityData.profit_estimate_low}-$${entityData.profit_estimate_high}`,
          platform: entityData.platform,
          deadline: entityData.deadline
        }
      };

    case 'wallet.added':
      return {
        ...basePayload,
        summary: `New wallet added: ${entityData.wallet_type}`,
        details: {
          wallet_id: entityData.id,
          wallet_name: entityData.wallet_name,
          type: entityData.wallet_type,
          address: entityData.address,
          is_primary: entityData.is_primary
        }
      };

    default:
      return basePayload;
  }
}

async function sendToWebhook(base44, user, webhook, eventType, payload) {
  const startTime = Date.now();
  let success = false;
  let error = null;
  let responseCode = 0;

  try {
    // Build headers
    const headers = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': eventType,
      'X-Webhook-Timestamp': new Date().toISOString(),
      ...(webhook.headers || {})
    };

    // Add authentication
    if (webhook.auth_type === 'bearer_token' && webhook.auth_value) {
      headers['Authorization'] = `Bearer ${webhook.auth_value}`;
    } else if (webhook.auth_type === 'api_key' && webhook.auth_value) {
      headers['X-API-Key'] = webhook.auth_value;
    }

    // Send with retry logic
    let lastError = null;
    const maxRetries = webhook.retry_config?.max_retries || 3;
    const retryDelay = webhook.retry_config?.retry_delay_seconds || 5;
    const backoffMultiplier = webhook.retry_config?.backoff_multiplier || 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(webhook.endpoint_url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          timeout: webhook.timeout_seconds * 1000 || 30000
        });

        responseCode = response.status;
        success = response.ok;

        if (success) {
          break; // Success, exit retry loop
        }

        if (response.status >= 500) {
          lastError = `Server error (${response.status})`;
          if (attempt < maxRetries) {
            const delay = retryDelay * Math.pow(backoffMultiplier, attempt);
            await new Promise(resolve => setTimeout(resolve, delay * 1000));
            continue;
          }
        } else if (response.status >= 400) {
          // Client errors don't retry
          lastError = `Client error (${response.status})`;
          break;
        }
      } catch (fetchError) {
        lastError = fetchError.message;
        if (attempt < maxRetries && attempt < 2) { // Only retry network errors up to 2 times
          const delay = retryDelay * Math.pow(backoffMultiplier, attempt);
          await new Promise(resolve => setTimeout(resolve, delay * 1000));
          continue;
        }
      }
    }

    if (!success && lastError) {
      error = lastError;
    }
  } catch (err) {
    success = false;
    error = err.message;
  }

  const responseTime = Date.now() - startTime;

  return {
    webhook_id: webhook.id,
    webhook_name: webhook.name,
    success,
    response_code: responseCode,
    response_time_ms: responseTime,
    error
  };
}

async function updateWebhookStats(base44, webhookId, result) {
  try {
    const webhook = await base44.asServiceRole.entities.WebhookConfig.read(webhookId);
    const stats = webhook.delivery_stats || {
      total_deliveries: 0,
      successful_deliveries: 0,
      failed_deliveries: 0,
      success_rate: 0
    };

    stats.total_deliveries += 1;
    if (result.success) {
      stats.successful_deliveries += 1;
    } else {
      stats.failed_deliveries += 1;
    }
    stats.success_rate = (stats.successful_deliveries / stats.total_deliveries) * 100;

    const delivery = {
      timestamp: new Date().toISOString(),
      event: result.event_type || 'webhook.triggered',
      status: result.success ? 'success' : 'failed',
      response_code: result.response_code,
      response_time_ms: result.response_time_ms,
      error_message: result.error
    };

    const recentDeliveries = webhook.recent_deliveries || [];
    recentDeliveries.unshift(delivery);

    await base44.asServiceRole.entities.WebhookConfig.update(webhookId, {
      last_triggered_at: new Date().toISOString(),
      last_status: result.success ? 'success' : 'failed',
      delivery_stats: stats,
      recent_deliveries: recentDeliveries.slice(0, 50)
    });
  } catch (error) {
    console.error('Update stats error:', error);
  }
}

async function testWebhook(base44, user, data) {
  try {
    const { webhook_id, event_type } = data;
    const webhook = await base44.asServiceRole.entities.WebhookConfig.read(webhook_id);

    if (!webhook || webhook.created_by !== user.email) {
      return Response.json({ error: 'Webhook not found' }, { status: 404 });
    }

    // Build test payload
    const testData = {
      id: 'test_123',
      email: user.email,
      estimated_value: 150,
      platform: 'test',
      completion_timestamp: new Date().toISOString()
    };

    const payload = buildPayload(event_type || 'task.completed', testData);
    const result = await sendToWebhook(base44, user, webhook, event_type || 'task.completed', payload);

    return Response.json({
      success: result.success,
      message: result.success ? 'Webhook test successful' : 'Webhook test failed',
      result
    });
  } catch (error) {
    console.error('Test webhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function getAvailableEvents() {
  return Response.json({
    success: true,
    events: Object.entries(WEBHOOK_EVENTS).map(([key, description]) => ({
      event_type: key,
      description
    }))
  });
}

async function getEventLogs(base44, user, data) {
  try {
    const { limit = 50 } = data;
    const logs = await base44.asServiceRole.entities.ActivityLog.filter({
      action_type: 'webhook_event',
      created_by: user.email
    }, '-created_date', limit);

    return Response.json({
      success: true,
      logs: logs || []
    });
  } catch (error) {
    console.error('Get event logs error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}