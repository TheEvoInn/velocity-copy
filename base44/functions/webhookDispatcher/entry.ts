/**
 * WEBHOOK DISPATCHER
 * Receives incoming webhooks, validates signatures, maps payloads, and syncs to entities
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    // Extract webhook ID from URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const webhookId = pathParts[pathParts.length - 1];

    if (!webhookId || req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // Fetch webhook config
    const webhook = await base44.entities.WebhookConfig.read(webhookId);

    if (!webhook || webhook.created_by !== user.email) {
      return new Response(JSON.stringify({ error: 'Webhook not found' }), { status: 404 });
    }

    if (!webhook.is_active) {
      return new Response(JSON.stringify({ error: 'Webhook is inactive' }), { status: 403 });
    }

    // Parse incoming payload
    const rawBody = await req.text();
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), { status: 400 });
    }

    // Validate auth if configured
    if (webhook.auth_type !== 'none') {
      const authHeader = req.headers.get('authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401 });
      }

      if (webhook.auth_type === 'bearer_token' && !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Invalid bearer token' }), { status: 401 });
      }

      const token = authHeader.split(' ')[1];
      if (token !== webhook.auth_value) {
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
      }
    }

    // Log delivery attempt
    const startTime = Date.now();
    let syncResult = { success: false, entity_id: null, error: null };

    // Apply payload mapping if configured
    if (webhook.payload_mapping && webhook.payload_mapping.field_mappings) {
      const mappedPayload = applyMapping(payload, webhook.payload_mapping.field_mappings);
      const entityType = webhook.payload_mapping.target_entity;

      try {
        syncResult = await syncToEntity(base44, user, entityType, mappedPayload, webhookId);
      } catch (syncErr) {
        syncResult.error = syncErr.message;
      }
    }

    const responseTime = Date.now() - startTime;

    // Update webhook stats
    const delivery = {
      timestamp: new Date().toISOString(),
      event: webhook.events?.[0] || 'webhook.received',
      status: syncResult.success ? 'success' : 'failed',
      response_code: syncResult.success ? 200 : 400,
      response_time_ms: responseTime,
      error_message: syncResult.error,
    };

    // Push to recent_deliveries
    const recentDeliveries = webhook.recent_deliveries || [];
    recentDeliveries.unshift(delivery);

    await base44.entities.WebhookConfig.update(webhookId, {
      last_triggered_at: new Date().toISOString(),
      last_status: delivery.status,
      recent_deliveries: recentDeliveries.slice(0, 50),
      delivery_stats: {
        total_deliveries: (webhook.delivery_stats?.total_deliveries || 0) + 1,
        successful_deliveries: (webhook.delivery_stats?.successful_deliveries || 0) + (syncResult.success ? 1 : 0),
        failed_deliveries: (webhook.delivery_stats?.failed_deliveries || 0) + (syncResult.success ? 0 : 1),
        success_rate: ((webhook.delivery_stats?.successful_deliveries || 0) + (syncResult.success ? 1 : 0)) / ((webhook.delivery_stats?.total_deliveries || 0) + 1) * 100,
      },
    });

    // Log to ActivityLog
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'webhook_received',
      message: `Webhook '${webhook.name}' received and processed`,
      severity: syncResult.success ? 'success' : 'warning',
      metadata: {
        webhook_id: webhookId,
        entity_type: webhook.payload_mapping?.target_entity,
        entity_id: syncResult.entity_id,
        response_time_ms: responseTime,
        success: syncResult.success,
      },
      created_by: user.email,
    });

    return new Response(
      JSON.stringify({
        success: syncResult.success,
        entity_id: syncResult.entity_id,
        message: syncResult.success ? 'Payload synced' : 'Sync failed',
      }),
      { status: syncResult.success ? 200 : 400 }
    );
  } catch (error) {
    console.error('Webhook dispatcher error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

/**
 * Apply field mappings to incoming payload
 */
function applyMapping(payload, mappings) {
  const result = {};
  mappings.forEach(({ source, target, transform }) => {
    let value = getNestedValue(payload, source);

    if (transform && value !== undefined) {
      try {
        value = new Function('val', `return ${transform}`)(value);
      } catch (e) {
        console.warn(`Transform failed for ${source}:`, e);
      }
    }

    setNestedValue(result, target, value);
  });
  return result;
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, prop) => current?.[prop], obj);
}

function setNestedValue(obj, path, value) {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    current[parts[i]] = current[parts[i]] || {};
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

/**
 * Sync mapped payload to target entity
 */
async function syncToEntity(base44, user, entityType, payload, webhookId) {
  try {
    // Validate required fields exist
    if (!payload || Object.keys(payload).length === 0) {
      throw new Error('Payload is empty after mapping');
    }

    // Create or update entity based on type
    let entity;
    switch (entityType) {
      case 'Opportunity':
        entity = await base44.entities.Opportunity.create({
          title: payload.title || 'Webhook Import',
          description: payload.description,
          platform: payload.platform,
          category: payload.category || 'arbitrage',
          profit_estimate_low: payload.profit_estimate_low,
          profit_estimate_high: payload.profit_estimate_high,
          url: payload.url,
          deadline: payload.deadline,
          status: 'new',
          source: `webhook:${webhookId}`,
        });
        break;

      case 'Transaction':
        entity = await base44.entities.Transaction.create({
          transaction_type: payload.transaction_type || 'reward_earned',
          amount: payload.amount,
          value_usd: payload.value_usd,
          wallet_address: payload.wallet_address,
          status: payload.status || 'completed',
          timestamp: new Date().toISOString(),
          source: `webhook:${webhookId}`,
        });
        break;

      case 'CryptoWallet':
        entity = await base44.entities.CryptoWallet.create({
          wallet_name: payload.wallet_name,
          wallet_type: payload.wallet_type || 'ethereum',
          address: payload.address,
          status: 'active',
          source: `webhook:${webhookId}`,
        });
        break;

      case 'StakingPosition':
        entity = await base44.entities.StakingPosition.create({
          token_symbol: payload.token_symbol,
          platform: payload.platform,
          amount_staked: payload.amount_staked,
          apy_percentage: payload.apy_percentage,
          status: 'active',
          source: `webhook:${webhookId}`,
        });
        break;

      case 'TaskExecutionQueue':
        entity = await base44.entities.TaskExecutionQueue.create({
          url: payload.url,
          opportunity_type: payload.opportunity_type || 'other',
          platform: payload.platform,
          identity_id: payload.identity_id || 'default',
          status: 'queued',
          priority: payload.priority || 50,
          source: `webhook:${webhookId}`,
        });
        break;

      case 'ActivityLog':
        entity = await base44.entities.ActivityLog.create({
          action_type: payload.action_type || 'system',
          message: payload.message || 'Webhook event',
          severity: payload.severity || 'info',
          metadata: payload.metadata,
        });
        break;

      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }

    return {
      success: true,
      entity_id: entity.id,
    };
  } catch (error) {
    return {
      success: false,
      entity_id: null,
      error: error.message,
    };
  }
}