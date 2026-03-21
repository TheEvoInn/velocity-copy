/**
 * Webhook Manager
 * Manages webhook creation, configuration, token rotation, and analytics
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, payload } = body;

    // ACTION: Create webhook
    if (action === 'create_webhook') {
      const { webhook_name, trigger_type, description } = payload;

      // Generate secure token
      const token = generateSecureToken(32);

      const webhook = await base44.entities.WebhookTaskTrigger.create({
        webhook_name,
        trigger_type,
        description,
        webhook_url: generateWebhookUrl(token),
        webhook_token: token,
        status: 'active',
        task_parameters: {
          auto_solve_captcha: true,
          use_credentials: true,
          timeout_seconds: 300,
          priority: 50
        },
        rate_limiting: {
          enabled: true,
          requests_per_minute: 60,
          burst_limit: 10
        },
        security: {
          require_https: true,
          require_valid_token: true,
          require_payload_signature: true,
          ip_whitelist: [],
          ip_blacklist: []
        },
        failure_handling: {
          retry_on_failure: true,
          max_retries: 3,
          retry_delay_seconds: 60,
          send_failure_webhook: false
        },
        request_history: [],
        statistics: {
          total_requests: 0,
          successful_tasks: 0,
          failed_requests: 0,
          success_rate: 0,
          avg_execution_time_ms: 0
        }
      });

      return Response.json({
        status: 'success',
        webhook: {
          id: webhook.id,
          name: webhook.webhook_name,
          url: webhook.webhook_url,
          token: token,
          created_at: webhook.created_at
        }
      });
    }

    // ACTION: Update webhook configuration
    if (action === 'update_webhook') {
      const { webhook_id, config } = payload;

      const updated = await base44.entities.WebhookTaskTrigger.update(
        webhook_id,
        {
          task_parameters: config.task_parameters,
          payload_mapping: config.payload_mapping,
          expected_payload_schema: config.expected_payload_schema,
          rate_limiting: config.rate_limiting,
          security: config.security,
          failure_handling: config.failure_handling,
          webhook_events: config.webhook_events
        }
      );

      return Response.json({
        status: 'success',
        webhook: {
          id: updated.id,
          name: updated.webhook_name,
          url: updated.webhook_url
        }
      });
    }

    // ACTION: Rotate webhook token
    if (action === 'rotate_token') {
      const { webhook_id } = payload;

      const webhook = await base44.entities.WebhookTaskTrigger.filter({
        id: webhook_id,
        created_by: user.email
      });

      if (webhook.length === 0) {
        return Response.json({ error: 'Webhook not found' }, { status: 404 });
      }

      const newToken = generateSecureToken(32);

      await base44.entities.WebhookTaskTrigger.update(webhook_id, {
        webhook_token: newToken,
        webhook_url: generateWebhookUrl(newToken)
      });

      await base44.entities.ActivityLog.create({
        action_type: 'system',
        message: `Webhook token rotated: ${webhook[0].webhook_name}`,
        metadata: { webhook_id },
        severity: 'info'
      });

      return Response.json({
        status: 'success',
        new_token: newToken,
        new_url: generateWebhookUrl(newToken)
      });
    }

    // ACTION: Get webhook analytics
    if (action === 'get_analytics') {
      const { webhook_id } = payload;

      const webhook = await base44.entities.WebhookTaskTrigger.filter({
        id: webhook_id,
        created_by: user.email
      });

      if (webhook.length === 0) {
        return Response.json({ error: 'Webhook not found' }, { status: 404 });
      }

      const w = webhook[0];
      const stats = w.statistics || {};
      const history = w.request_history || [];

      return Response.json({
        status: 'success',
        analytics: {
          total_requests: stats.total_requests,
          successful_tasks: stats.successful_tasks,
          failed_requests: stats.failed_requests,
          success_rate: stats.success_rate || 0,
          avg_execution_time_ms: stats.avg_execution_time_ms || 0,
          last_request_at: stats.last_request_at,
          recent_requests: history.slice(0, 20)
        }
      });
    }

    // ACTION: Test webhook
    if (action === 'test_webhook') {
      const { webhook_id, test_payload } = payload;

      const webhook = await base44.entities.WebhookTaskTrigger.filter({
        id: webhook_id,
        created_by: user.email
      });

      if (webhook.length === 0) {
        return Response.json({ error: 'Webhook not found' }, { status: 404 });
      }

      try {
        // Simulate webhook call
        const response = await fetch(webhook[0].webhook_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-signature': generateSignature(
              JSON.stringify(test_payload),
              webhook[0].webhook_token
            )
          },
          body: JSON.stringify(test_payload)
        });

        const result = await response.json();

        return Response.json({
          status: 'success',
          test_result: {
            http_status: response.status,
            response: result,
            success: response.ok
          }
        });
      } catch (err) {
        return Response.json({
          status: 'error',
          error: err.message
        });
      }
    }

    // ACTION: Pause/Resume webhook
    if (action === 'toggle_webhook') {
      const { webhook_id, enabled } = payload;

      await base44.entities.WebhookTaskTrigger.update(webhook_id, {
        status: enabled ? 'active' : 'paused'
      });

      return Response.json({
        status: 'success',
        message: enabled ? 'Webhook enabled' : 'Webhook paused'
      });
    }

    // ACTION: Delete webhook
    if (action === 'delete_webhook') {
      const { webhook_id } = payload;

      await base44.entities.WebhookTaskTrigger.update(webhook_id, {
        status: 'disabled'
      });

      return Response.json({
        status: 'success',
        message: 'Webhook deleted'
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Webhook manager error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Helper: Generate secure token
function generateSecureToken(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Helper: Generate webhook URL
function generateWebhookUrl(token) {
  const baseUrl = Deno.env.get('APP_BASE_URL') || 'https://api.velocity.app';
  return `${baseUrl}/webhooks/task-reader/${token}`;
}

// Helper: Generate signature
function generateSignature(payload, token) {
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const key = encoder.encode(token);
  // Placeholder - would use actual HMAC in production
  return 'sig_' + Buffer.from(data).toString('hex').slice(0, 32);
}