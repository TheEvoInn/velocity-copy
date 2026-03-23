import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Cross-Module Notification Trigger Engine
 * Routes events from VIPZ, NED, Autopilot, Workflow to notification system
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try {
      user = await base44.auth.me();
    } catch {
      // Allow service role calls
      user = { email: 'system@velocitysystem.io', role: 'admin' };
    }
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, module_source, event_type, event_data } = await req.json();

    if (action === 'trigger_from_module') {
      return await triggerNotificationFromModule(base44, user, module_source, event_type, event_data);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Cross-trigger error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function triggerNotificationFromModule(base44, user, moduleSource, eventType, eventData) {
  try {
    let notificationPayload = {};

    // ─── AUTOPILOT TRIGGERS ─────────────────────────────────────────────────
    if (moduleSource === 'autopilot') {
      if (eventType === 'task_completed') {
        notificationPayload = {
          type: 'autopilot_execution',
          severity: 'info',
          title: `✅ Task Completed: ${eventData.task_title || 'Autopilot Task'}`,
          message: `Your autopilot task completed successfully. Earned: $${eventData.earnings || 0}.`,
          related_entity_type: 'TaskExecutionQueue',
          related_entity_id: eventData.task_id,
          action_type: 'none',
          source_module: 'autopilot',
          delivery_channels: ['in_app']
        };
      } else if (eventType === 'task_failed') {
        notificationPayload = {
          type: 'system_alert',
          severity: 'warning',
          title: `⚠️ Task Failed: ${eventData.task_title}`,
          message: `Autopilot encountered an error: ${eventData.error_message}. Manual review recommended.`,
          related_entity_type: 'TaskExecutionQueue',
          related_entity_id: eventData.task_id,
          action_type: 'review_required',
          source_module: 'autopilot',
          delivery_channels: ['in_app', 'email']
        };
      } else if (eventType === 'autopilot_activated') {
        notificationPayload = {
          type: 'autopilot_execution',
          severity: 'info',
          title: '🚀 Autopilot Activated',
          message: 'Your autonomous automation engine is now running. Monitor progress in the dashboard.',
          action_type: 'none',
          source_module: 'autopilot',
          delivery_channels: ['in_app']
        };
      }
    }

    // ─── VIPZ TRIGGERS ──────────────────────────────────────────────────────
    if (moduleSource === 'vipz') {
      if (eventType === 'page_published') {
        notificationPayload = {
          type: 'opportunity_alert',
          severity: 'info',
          title: `📄 Landing Page Published: ${eventData.page_title}`,
          message: `Your storefront "${eventData.page_title}" is live and collecting revenue.`,
          related_entity_type: 'DigitalStorefront',
          related_entity_id: eventData.storefront_id,
          action_type: 'none',
          source_module: 'vipz',
          delivery_channels: ['in_app']
        };
      } else if (eventType === 'revenue_milestone') {
        notificationPayload = {
          type: 'opportunity_alert',
          severity: 'info',
          title: `💰 Revenue Milestone Reached: $${eventData.milestone_amount}`,
          message: `Your storefronts have generated $${eventData.total_revenue} in revenue!`,
          action_type: 'none',
          source_module: 'vipz',
          delivery_channels: ['in_app']
        };
      } else if (eventType === 'conversion_spike') {
        notificationPayload = {
          type: 'opportunity_alert',
          severity: 'info',
          title: `📈 High Conversion Activity Detected`,
          message: `${eventData.page_title} achieved ${eventData.conversion_rate}% conversion rate today.`,
          related_entity_type: 'DigitalStorefront',
          related_entity_id: eventData.storefront_id,
          action_type: 'none',
          source_module: 'vipz',
          delivery_channels: ['in_app']
        };
      }
    }

    // ─── NED TRIGGERS ───────────────────────────────────────────────────────
    if (moduleSource === 'ned') {
      if (eventType === 'airdrop_claimed') {
        notificationPayload = {
          type: 'opportunity_alert',
          severity: 'info',
          title: `🎁 Airdrop Claimed: ${eventData.token_symbol}`,
          message: `Successfully claimed ${eventData.amount} ${eventData.token_symbol} tokens ($${eventData.value_usd}).`,
          related_entity_type: 'CryptoOpportunity',
          related_entity_id: eventData.opportunity_id,
          action_type: 'none',
          source_module: 'ned',
          delivery_channels: ['in_app']
        };
      } else if (eventType === 'mining_reward') {
        notificationPayload = {
          type: 'opportunity_alert',
          severity: 'info',
          title: `⚒️ Mining Reward Earned: $${eventData.reward_usd}`,
          message: `Your mining operation earned $${eventData.reward_usd} today (${eventData.coin_symbol}).`,
          related_entity_type: 'MiningOperation',
          related_entity_id: eventData.operation_id,
          action_type: 'none',
          source_module: 'ned',
          delivery_channels: ['in_app']
        };
      } else if (eventType === 'staking_reward') {
        notificationPayload = {
          type: 'opportunity_alert',
          severity: 'info',
          title: `💎 Staking Reward Claimed: $${eventData.reward_usd}`,
          message: `Your ${eventData.token_symbol} staking position earned $${eventData.reward_usd} in rewards.`,
          related_entity_type: 'StakingPosition',
          related_entity_id: eventData.position_id,
          action_type: 'none',
          source_module: 'ned',
          delivery_channels: ['in_app']
        };
      } else if (eventType === 'high_risk_opportunity') {
        notificationPayload = {
          type: 'system_alert',
          severity: 'warning',
          title: `⚠️ High Risk Crypto Opportunity Detected`,
          message: `"${eventData.title}" has a high risk score (${eventData.risk_score}/100). Manual review recommended.`,
          related_entity_type: 'CryptoOpportunity',
          related_entity_id: eventData.opportunity_id,
          action_type: 'review_required',
          source_module: 'ned',
          delivery_channels: ['in_app', 'email']
        };
      }
    }

    // ─── WORKFLOW TRIGGERS ──────────────────────────────────────────────────
    if (moduleSource === 'workflow') {
      if (eventType === 'workflow_completed') {
        notificationPayload = {
          type: 'autopilot_execution',
          severity: 'info',
          title: `✅ Workflow Completed: ${eventData.workflow_name}`,
          message: `Your workflow "${eventData.workflow_name}" finished execution successfully.`,
          related_entity_type: 'Workflow',
          related_entity_id: eventData.workflow_id,
          action_type: 'none',
          source_module: 'workflow',
          delivery_channels: ['in_app']
        };
      } else if (eventType === 'workflow_failed') {
        notificationPayload = {
          type: 'system_alert',
          severity: 'urgent',
          title: `❌ Workflow Failed: ${eventData.workflow_name}`,
          message: `Workflow failed at step "${eventData.failed_step}": ${eventData.error_message}`,
          related_entity_type: 'Workflow',
          related_entity_id: eventData.workflow_id,
          action_type: 'review_required',
          source_module: 'workflow',
          delivery_channels: ['in_app', 'email']
        };
      }
    }

    // ─── COMPLIANCE TRIGGERS ────────────────────────────────────────────────
    if (moduleSource === 'compliance') {
      if (eventType === 'kyc_required') {
        notificationPayload = {
          type: 'compliance_alert',
          severity: 'urgent',
          title: '🔐 KYC Verification Required',
          message: 'Your account requires identity verification to continue. Complete KYC to activate autopilot.',
          action_type: 'user_input_required',
          source_module: 'compliance',
          delivery_channels: ['in_app', 'email']
        };
      } else if (eventType === 'kyc_approved') {
        notificationPayload = {
          type: 'system_alert',
          severity: 'info',
          title: '✅ KYC Verification Approved',
          message: 'Your identity has been verified. All platform features are now available.',
          action_type: 'none',
          source_module: 'compliance',
          delivery_channels: ['in_app']
        };
      }
    }

    // Create notification if payload is set
    if (Object.keys(notificationPayload).length === 0) {
      return Response.json(
        { error: `No matching trigger for module="${moduleSource}" event="${eventType}"` },
        { status: 400 }
      );
    }

    const notification = await base44.asServiceRole.entities.Notification.create({
      ...notificationPayload,
      created_by: user.email,
      is_read: false,
      is_dismissed: false,
      priority_index: getPriorityIndex(notificationPayload.severity),
      metadata: eventData
    });

    // Send email if delivery channel includes email
    if (notificationPayload.delivery_channels.includes('email')) {
      await base44.functions.invoke('notificationEmailService', {
        action: 'send_email',
        notification_id: notification.id,
        notification_data: notification
      }).catch(e => console.error('Email send failed:', e.message));
    }

    return Response.json({
      success: true,
      notification_id: notification.id,
      message: `Notification created from ${moduleSource}`,
      notification: notification
    });
  } catch (error) {
    console.error('Trigger error:', error.message);
    return Response.json(
      { error: `Failed to create notification: ${error.message}` },
      { status: 500 }
    );
  }
}

function getPriorityIndex(severity) {
  const priorities = { info: 25, warning: 50, urgent: 75, critical: 100 };
  return priorities[severity] || 25;
}