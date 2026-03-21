/**
 * WEBHOOK EVENT AUTOMATION
 * Triggered by entity automations to fire webhook events
 * Bridges entity mutations to webhook notifications
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { automation, event, data, old_data, args } = body;

    // Extract event details from automation trigger
    const entityName = event.entity_name;
    const entityId = event.entity_id;
    const eventType = event.type; // 'create', 'update', 'delete'

    // Map entity mutations to webhook events
    let webhookEventType = null;
    let webhookData = data;

    if (entityName === 'TaskExecutionQueue') {
      if (eventType === 'update' && data?.status === 'completed') {
        webhookEventType = 'task.completed';
        webhookData = data;
      } else if (eventType === 'update' && data?.status === 'failed') {
        webhookEventType = 'task.failed';
      } else if (eventType === 'create') {
        webhookEventType = 'task.queued';
      }
    }

    if (entityName === 'Transaction') {
      if (eventType === 'create') {
        webhookEventType = 'transaction.created';
      } else if (eventType === 'update' && data?.status === 'completed') {
        webhookEventType = 'transaction.completed';
      }
    }

    if (entityName === 'CryptoTransaction') {
      if (eventType === 'create') {
        webhookEventType = 'transaction.created';
      } else if (eventType === 'update' && data?.status === 'completed') {
        webhookEventType = 'transaction.completed';
      }
    }

    if (entityName === 'UserGoals') {
      if (eventType === 'update' && data?.onboarded === true && old_data?.onboarded !== true) {
        webhookEventType = 'onboarding.completed';
        webhookData = {
          email: data.created_by,
          identity_verified: !!data.preferred_identity_id,
          kyc_verified: !!data.kyc_verified,
          wallets_count: data.wallet_count || 0,
          credentials_count: data.credentials_count || 0
        };
      }
    }

    if (entityName === 'Opportunity') {
      if (eventType === 'create') {
        webhookEventType = 'opportunity.new';
      }
    }

    if (entityName === 'CryptoWallet') {
      if (eventType === 'create') {
        webhookEventType = 'wallet.added';
      }
    }

    if (entityName === 'EncryptedCredential') {
      if (eventType === 'create') {
        webhookEventType = 'credential.added';
      }
    }

    // If no webhook event mapped, exit gracefully
    if (!webhookEventType) {
      return Response.json({
        success: true,
        message: `No webhook event mapped for ${entityName}.${eventType}`
      });
    }

    // Get user email from data
    const userEmail = data?.created_by || old_data?.created_by;
    if (!userEmail) {
      return Response.json({
        success: true,
        message: 'No user email found in entity data'
      });
    }

    // Create service role client to fetch and trigger webhooks
    const base44 = createClientFromRequest(req);

    // Fetch webhooks subscribed to this event
    const webhooks = await base44.asServiceRole.entities.WebhookConfig.filter({
      is_active: true,
      events: { $in: [webhookEventType] }
    });

    if (!webhooks || webhooks.length === 0) {
      return Response.json({
        success: true,
        message: 'No active webhooks for this event',
        webhooks_triggered: 0
      });
    }

    // Trigger webhook event engine
    const webhookResults = await base44.asServiceRole.functions.invoke('webhookEventEngine', {
      action: 'trigger_event',
      event_type: webhookEventType,
      entity_data: webhookData
    });

    return Response.json({
      success: true,
      entity: entityName,
      event_type: eventType,
      webhook_event: webhookEventType,
      webhooks_triggered: webhookResults.data?.webhooks_triggered || 0,
      results: webhookResults.data?.results
    });

  } catch (error) {
    console.error('Webhook event automation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});