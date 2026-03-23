import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * WEBHOOK RETRY ENGINE
 * Handles failed webhook deliveries with exponential backoff
 * - Tracks delivery attempts
 * - Implements exponential backoff (1s, 2s, 4s, 8s, 16s)
 * - Max 5 retry attempts per webhook
 * - Logs failures for audit
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === 'get_pending_retries') {
      return await getPendingRetries(base44, user);
    }

    if (action === 'retry_webhook') {
      return await retryWebhook(base44, user, body);
    }

    if (action === 'process_retry_queue') {
      return await processRetryQueue(base44, user);
    }

    if (action === 'get_retry_history') {
      return await getRetryHistory(base44, user, body);
    }

    return jsonResponse({ error: 'Unknown action' }, 400);

  } catch (error) {
    console.error('[WebhookRetryEngine]', error.message);
    return jsonResponse({ error: error.message }, 500);
  }
});

/**
 * Get pending webhook retries
 */
async function getPendingRetries(base44, user) {
  try {
    const retries = await base44.asServiceRole.entities.WebhookConfig.filter(
      { status: 'retry_pending' },
      '-updated_date',
      100
    ).catch(() => []);

    return jsonResponse({
      total_pending: retries.length,
      retries: retries.map(r => ({
        id: r.id,
        webhook_url: r.webhook_url,
        last_attempt: r.last_attempt,
        retry_count: r.retry_count,
        next_retry: calculateNextRetry(r.retry_count, r.updated_date)
      }))
    });
  } catch (error) {
    console.error('[Get Pending Retries]', error.message);
    return jsonResponse({ error: 'Failed to fetch retries' }, 500);
  }
}

/**
 * Retry a single webhook
 */
async function retryWebhook(base44, user, body) {
  const { webhook_id } = body;
  if (!webhook_id) {
    return jsonResponse({ error: 'webhook_id required' }, 400);
  }

  try {
    const webhook = await base44.asServiceRole.entities.WebhookConfig.filter(
      { id: webhook_id },
      null, 1
    ).then(r => r[0]).catch(() => null);

    if (!webhook) {
      return jsonResponse({ error: 'Webhook not found' }, 404);
    }

    // Check retry count
    const retryCount = webhook.retry_count || 0;
    if (retryCount >= 5) {
      await base44.asServiceRole.entities.WebhookConfig.update(webhook_id, {
        status: 'failed_max_retries',
        updated_date: new Date().toISOString()
      }).catch(() => {});
      return jsonResponse({ error: 'Max retries exceeded' }, 400);
    }

    // Calculate backoff delay
    const delayMs = calculateBackoffDelay(retryCount);
    
    // Attempt delivery
    const deliveryResult = await attemptWebhookDelivery(webhook, body.payload || {});

    if (deliveryResult.success) {
      // Mark as delivered
      await base44.asServiceRole.entities.WebhookConfig.update(webhook_id, {
        status: 'delivered',
        last_attempt: new Date().toISOString(),
        updated_date: new Date().toISOString()
      }).catch(() => {});

      return jsonResponse({ 
        success: true, 
        message: 'Webhook delivered successfully',
        retry_count: retryCount 
      });
    } else {
      // Schedule next retry
      const nextRetry = new Date(Date.now() + delayMs);
      await base44.asServiceRole.entities.WebhookConfig.update(webhook_id, {
        status: 'retry_pending',
        retry_count: retryCount + 1,
        last_attempt: new Date().toISOString(),
        next_retry: nextRetry.toISOString(),
        updated_date: new Date().toISOString()
      }).catch(() => {});

      // Log failure
      await base44.asServiceRole.entities.AuditLog.create({
        entity_type: 'WebhookConfig',
        entity_id: webhook_id,
        action_type: 'webhook_retry_failed',
        user_email: 'system@autopilot',
        details: {
          retry_count: retryCount + 1,
          next_retry: nextRetry.toISOString(),
          error: deliveryResult.error
        },
        severity: retryCount + 1 >= 4 ? 'high' : 'medium',
        timestamp: new Date().toISOString()
      }).catch(() => {});

      return jsonResponse({ 
        success: false,
        message: 'Retry scheduled',
        retry_count: retryCount + 1,
        next_retry_ms: delayMs
      });
    }
  } catch (error) {
    console.error('[Retry Webhook]', error.message);
    return jsonResponse({ error: 'Failed to retry webhook' }, 500);
  }
}

/**
 * Process entire retry queue
 */
async function processRetryQueue(base44, user) {
  try {
    const now = new Date();
    const pending = await base44.asServiceRole.entities.WebhookConfig.filter(
      { status: 'retry_pending' },
      null, 100
    ).catch(() => []);

    let processed = 0;
    let succeeded = 0;
    let scheduled = 0;

    for (const webhook of pending) {
      const nextRetry = new Date(webhook.next_retry || webhook.updated_date);
      
      // Only retry if time window has passed
      if (nextRetry <= now) {
        const result = await retryWebhook(base44, user, { webhook_id: webhook.id });
        processed++;
        
        if (result.status === 200) {
          const data = JSON.parse(await result.text());
          if (data.success) succeeded++;
          else scheduled++;
        }
      }
    }

    return jsonResponse({
      processed,
      succeeded,
      scheduled: processed - succeeded
    });
  } catch (error) {
    console.error('[Process Retry Queue]', error.message);
    return jsonResponse({ error: 'Failed to process queue' }, 500);
  }
}

/**
 * Get retry history for a webhook
 */
async function getRetryHistory(base44, user, body) {
  const { webhook_id } = body;
  if (!webhook_id) {
    return jsonResponse({ error: 'webhook_id required' }, 400);
  }

  try {
    const history = await base44.asServiceRole.entities.AuditLog.filter(
      { entity_id: webhook_id, action_type: 'webhook_retry_failed' },
      '-timestamp',
      50
    ).catch(() => []);

    return jsonResponse({
      webhook_id,
      total_failures: history.length,
      history: history.map(h => ({
        timestamp: h.timestamp,
        retry_count: h.details?.retry_count,
        error: h.details?.error,
        next_retry: h.details?.next_retry
      }))
    });
  } catch (error) {
    console.error('[Get Retry History]', error.message);
    return jsonResponse({ error: 'Failed to fetch history' }, 500);
  }
}

/**
 * Utilities
 */
function calculateBackoffDelay(retryCount) {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s
  const delays = [1000, 2000, 4000, 8000, 16000];
  return delays[Math.min(retryCount, delays.length - 1)];
}

function calculateNextRetry(retryCount, lastUpdate) {
  const delayMs = calculateBackoffDelay(retryCount);
  const nextTime = new Date(new Date(lastUpdate).getTime() + delayMs);
  return nextTime.toISOString();
}

async function attemptWebhookDelivery(webhook, payload) {
  try {
    const response = await fetch(webhook.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Retry': 'true',
        'X-Timestamp': new Date().toISOString()
      },
      body: JSON.stringify(payload),
      timeout: 10000 // 10s timeout
    });

    if (response.status >= 200 && response.status < 300) {
      return { success: true };
    } else {
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}