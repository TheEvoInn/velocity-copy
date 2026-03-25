import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await req.json();

    // ── NEW: trigger_critical_alert ─────────────────────────────────────────
    // Handles named platform events with hub-specific quick-action routing
    if (action === 'trigger_critical_alert') {
      const body = await req.json();
      const { event_type, payload } = body;

      // Map event types → notification config + quick-action hub URL
      const EVENT_MAP = {
        // Crypto Hub — CIPHER
        staking_apy_drop: {
          severity: 'critical',
          title: '⚠️ Staking APY Drop Detected',
          getMessage: (p) => `${p.token || 'Token'} APY dropped from ${p.old_apy?.toFixed(1) || '?'}% to ${p.new_apy?.toFixed(1) || '?'}% on ${p.platform || 'platform'}. Review your staking position.`,
          action_url: '/CryptoAutomation',
          action_label: 'Review Crypto Hub',
          type: 'crypto_alert',
        },
        staking_reward_claimed: {
          severity: 'info',
          title: '💰 Staking Reward Claimed',
          getMessage: (p) => `$${p.amount?.toFixed(2) || 0} staking reward claimed for ${p.token || 'token'}.`,
          action_url: '/CryptoAutomation',
          action_label: 'View Crypto Hub',
          type: 'crypto_transaction',
        },
        wallet_low_balance: {
          severity: 'warning',
          title: '🔔 Wallet Balance Low',
          getMessage: (p) => `Wallet balance is $${p.balance?.toFixed(2) || 0} — below your safety threshold of $${p.threshold || 50}.`,
          action_url: '/VeloFinanceCommand',
          action_label: 'Open Finance Command',
          type: 'wallet_updated',
        },
        // Commerce Hub — MERCH
        storefront_conversion_threshold: {
          severity: 'info',
          title: '🎯 Conversion Milestone Reached',
          getMessage: (p) => `"${p.page_title || 'Storefront'}" hit ${p.conversion_rate?.toFixed(1) || '?'}% conversion rate — ${p.sales || 0} sales recorded.`,
          action_url: '/DigitalResellers',
          action_label: 'View Commerce Hub',
          type: 'storefront_alert',
        },
        storefront_revenue_milestone: {
          severity: 'info',
          title: '💵 Revenue Milestone',
          getMessage: (p) => `"${p.page_title || 'Storefront'}" crossed $${p.milestone || 0} in revenue!`,
          action_url: '/DigitalResellers',
          action_label: 'View Commerce Hub',
          type: 'storefront_alert',
        },
        storefront_published: {
          severity: 'info',
          title: '🚀 Storefront Published',
          getMessage: (p) => `"${p.page_title || 'New storefront'}" is now live and accepting orders.`,
          action_url: '/DigitalResellers',
          action_label: 'View Storefront',
          type: 'storefront_alert',
        },
        // Autopilot Hub — APEX
        autopilot_execution_block: {
          severity: 'critical',
          title: '🚫 Autopilot Execution Blocked',
          getMessage: (p) => `Task "${p.task_name || p.task_type || 'Unknown'}" is blocked: ${p.reason || 'missing data'}. Your input is required to resume.`,
          action_url: '/PendingInterventions',
          action_label: 'Resolve Intervention',
          type: 'autopilot_block',
        },
        autopilot_task_failed: {
          severity: 'warning',
          title: '✗ Autopilot Task Failed',
          getMessage: (p) => `Task "${p.task_name || p.task_type || 'Unknown'}" failed after ${p.retry_count || 0} retries: ${p.error || 'unknown error'}.`,
          action_url: '/VeloAutopilotControl',
          action_label: 'View Autopilot Hub',
          type: 'execution_failed',
        },
        autopilot_task_completed: {
          severity: 'info',
          title: '✓ Autopilot Task Completed',
          getMessage: (p) => `Task "${p.task_name || p.task_type || 'Unknown'}" completed${p.earnings ? ` — earned $${p.earnings.toFixed(2)}` : ''}.`,
          action_url: '/VeloAutopilotControl',
          action_label: 'View Autopilot Hub',
          type: 'task_completed',
        },
        autopilot_daily_target_reached: {
          severity: 'info',
          title: '🏆 Daily Target Reached',
          getMessage: (p) => `APEX hit your daily profit target of $${p.target?.toFixed(0) || 0}! Total today: $${p.earned?.toFixed(2) || 0}.`,
          action_url: '/VeloFinanceCommand',
          action_label: 'View Finance Command',
          type: 'task_completed',
        },
        // Discovery Hub — SCOUT
        high_score_opportunity: {
          severity: 'info',
          title: '⭐ High-Score Opportunity Found',
          getMessage: (p) => `SCOUT found "${p.title || 'New opportunity'}" — score ${p.score || 0}/100, estimated $${p.estimated_pay || 0}.`,
          action_url: '/Discovery',
          action_label: 'View Discovery Hub',
          type: 'opportunity',
        },
        // Identity Hub — NEXUS
        kyc_approved: {
          severity: 'info',
          title: '✓ KYC Verification Approved',
          getMessage: (p) => `Identity "${p.identity_name || 'Your identity'}" has been KYC verified at ${p.kyc_tier || 'standard'} tier. Autopilot clearances unlocked.`,
          action_url: '/VeloIdentityHub',
          action_label: 'View Identity Hub',
          type: 'kyc_approved',
        },
        kyc_rejected: {
          severity: 'critical',
          title: '✗ KYC Verification Rejected',
          getMessage: (p) => `Identity "${p.identity_name || 'Your identity'}" KYC was rejected: ${p.reason || 'review required'}. Resubmit documents.`,
          action_url: '/VeloIdentityHub',
          action_label: 'Fix Identity Hub',
          type: 'kyc_rejected',
        },
        credential_expiring: {
          severity: 'warning',
          title: '🔑 Credential Expiring Soon',
          getMessage: (p) => `Credential for "${p.platform || 'platform'}" expires in ${p.days_remaining || '?'} days. Rotate to prevent Autopilot disruption.`,
          action_url: '/VeloIdentityHub',
          action_label: 'Manage Credentials',
          type: 'credential_alert',
        },
        // Finance
        payout_delayed: {
          severity: 'warning',
          title: '⏰ Payout Delayed',
          getMessage: (p) => `Payout of $${p.amount?.toFixed(2) || 0} from ${p.platform || 'platform'} is delayed by ${p.delay_hours || '?'} hours.`,
          action_url: '/VeloFinanceCommand',
          action_label: 'Check Finance Command',
          type: 'wallet_updated',
        },
        income_recorded: {
          severity: 'info',
          title: '💸 Income Recorded',
          getMessage: (p) => `$${p.amount?.toFixed(2) || 0} income recorded from ${p.platform || 'platform'} via ${p.category || 'task'}.`,
          action_url: '/VeloFinanceCommand',
          action_label: 'View Finance Command',
          type: 'crypto_transaction',
        },
      };

      const config = EVENT_MAP[event_type];
      if (!config) {
        return Response.json({ error: `Unknown event_type: ${event_type}` }, { status: 400 });
      }

      const notification = await base44.asServiceRole.entities.Notification.create({
        type: config.type,
        severity: config.severity,
        title: config.title,
        message: config.getMessage(payload || {}),
        metadata: {
          action_url: config.action_url,
          action_label: config.action_label,
          event_type,
          payload,
        },
        is_read: false,
        is_dismissed: false,
        user_email: user.email,
        delivery_channels: config.severity === 'critical' ? ['in_app', 'email'] : ['in_app'],
      });

      // Auto-send email for critical alerts
      if (config.severity === 'critical') {
        const hubName = config.action_label.replace('View ', '').replace('Open ', '').replace('Fix ', '').replace('Resolve ', '');
        await base44.integrations.Core.SendEmail({
          to: user.email,
          subject: `[CRITICAL] ${config.title} — VELO AI`,
          body: `VELO AI Alert\n\n${config.title}\n\n${config.getMessage(payload || {})}\n\nQuick Action: Log in to your VELO AI dashboard and go to ${hubName} to resolve this immediately.\n\nThis alert was triggered automatically by the VELO AI platform.`,
        });
      }

      return Response.json({ success: true, notification_id: notification.id, event_type, severity: config.severity });
    }
    // ────────────────────────────────────────────────────────────────────────

    if (action === 'create_notification') {
      const { type, severity, title, message, related_entity_type, related_entity_id, action_type, delivery_channels } = await req.json();

      const notification = await base44.entities.Notification.create({
        type: type || 'system_alert',
        severity: severity || 'info',
        title,
        message,
        related_entity_type,
        related_entity_id,
        action_type: action_type || 'none',
        delivery_channels: delivery_channels || ['in_app'],
        is_read: false,
        is_dismissed: false,
        user_email: user.email,
        created_date: new Date().toISOString()
      });

      // Route to notification delivery pipeline
      if (delivery_channels?.includes('email')) {
        await base44.functions.invoke('notificationOrchestrator', {
          action: 'send_email_notification',
          notification_id: notification.id,
          user_email: user.email
        });
      }

      return Response.json({ success: true, notification_id: notification.id });
    }

    if (action === 'get_user_notifications') {
      const { limit = 50, unread_only = false } = await req.json();

      let query = { user_email: user.email };
      if (unread_only) {
        query.is_read = false;
      }

      const notifications = await base44.entities.Notification.filter(query, '-created_date', limit);

      return Response.json({ 
        success: true, 
        notifications,
        unread_count: notifications.filter(n => !n.is_read).length
      });
    }

    if (action === 'mark_as_read') {
      const { notification_id } = await req.json();

      await base44.entities.Notification.update(notification_id, {
        is_read: true,
        read_at: new Date().toISOString()
      });

      return Response.json({ success: true });
    }

    if (action === 'dismiss_notification') {
      const { notification_id } = await req.json();

      await base44.entities.Notification.update(notification_id, {
        is_dismissed: true,
        dismissed_at: new Date().toISOString()
      });

      return Response.json({ success: true });
    }

    if (action === 'check_escalation') {
      const notifications = await base44.entities.Notification.filter({
        user_email: user.email,
        is_read: false,
        severity: { $in: ['critical', 'urgent'] }
      });

      const criticalCount = notifications.filter(n => n.severity === 'critical').length;
      const urgentCount = notifications.filter(n => n.severity === 'urgent').length;
      const oldestCritical = notifications.find(n => n.severity === 'critical');

      const escalation = {
        has_escalation: criticalCount > 0,
        critical_count: criticalCount,
        urgent_count: urgentCount,
        oldest_critical_age: oldestCritical ? 
          Math.floor((Date.now() - new Date(oldestCritical.created_date).getTime()) / 1000 / 60) : 0,
        should_escalate_to_admin: criticalCount > 3 || (oldestCritical && 
          Math.floor((Date.now() - new Date(oldestCritical.created_date).getTime()) / 1000 / 3600) > 24)
      };

      if (escalation.should_escalate_to_admin) {
        await base44.entities.Notification.create({
          type: 'compliance_alert',
          severity: 'critical',
          title: 'Escalation Required - Multiple Critical Alerts',
          message: `User ${user.email} has ${criticalCount} unresolved critical alerts`,
          is_read: false,
          user_email: 'admin@velocity.io',
          delivery_channels: ['in_app', 'email']
        });
      }

      return Response.json({ success: true, escalation });
    }

    if (action === 'send_email_notification') {
      const { notification_id, user_email } = await req.json();

      const notification = await base44.entities.Notification.filter({
        id: notification_id
      }).then(r => r[0]);

      if (!notification) {
        return Response.json({ error: 'Notification not found' }, { status: 404 });
      }

      const actionUrl = notification.metadata?.action_url || '';
      const actionLabel = notification.metadata?.action_label || 'View Dashboard';
      const emailBody = `VELO AI Alert\n\n${notification.title}\n\n${notification.message}\n\nSeverity: ${notification.severity.toUpperCase()}\n\n${actionUrl ? `Quick Action: Go to ${actionLabel} in your VELO AI dashboard.` : 'No action required.'}\n\nLog in at your VELO AI platform URL.`;

      await base44.integrations.Core.SendEmail({
        to: user_email,
        subject: `[${notification.severity.toUpperCase()}] ${notification.title}`,
        body: emailBody
      });

      await base44.entities.Notification.update(notification_id, {
        email_sent: true,
        email_sent_at: new Date().toISOString()
      });

      return Response.json({ success: true });
    }

    if (action === 'process_alert_queue') {
      // Process pending notifications and apply escalation rules
      const pendingNotifications = await base44.entities.Notification.filter({
        is_dismissed: false
      }, '-created_date');

      let escalated = 0;
      for (const notif of pendingNotifications) {
        // Auto-dismiss old info-level notifications
        if (notif.severity === 'info') {
          const ageHours = (Date.now() - new Date(notif.created_date).getTime()) / 1000 / 3600;
          if (ageHours > 72) {
            await base44.entities.Notification.update(notif.id, { is_dismissed: true });
            continue;
          }
        }

        // Auto-dismiss warning-level after 30 days
        if (notif.severity === 'warning') {
          const ageDays = (Date.now() - new Date(notif.created_date).getTime()) / 1000 / 86400;
          if (ageDays > 30) {
            await base44.entities.Notification.update(notif.id, { is_dismissed: true });
            continue;
          }
        }

        // Escalate critical alerts that are > 24h old
        if (notif.severity === 'critical' && !notif.is_read) {
          const ageHours = (Date.now() - new Date(notif.created_date).getTime()) / 1000 / 3600;
          if (ageHours > 24) {
            escalated++;
            // Send escalation email to user
            if (!notif.email_sent) {
              await base44.functions.invoke('notificationOrchestrator', {
                action: 'send_email_notification',
                notification_id: notif.id,
                user_email: notif.user_email
              });
            }
          }
        }
      }

      return Response.json({ 
        success: true, 
        processed: pendingNotifications.length,
        escalated 
      });
    }

    if (action === 'get_notification_preferences') {
      const prefs = await base44.entities.NotificationPreference.filter({
        user_email: user.email
      }).then(r => r[0]) || {
        user_email: user.email,
        email_enabled: true,
        in_app_enabled: true,
        critical_alerts: true,
        urgent_alerts: true,
        warning_alerts: false,
        info_alerts: false,
        daily_digest: true,
        quiet_hours_start: '22:00',
        quiet_hours_end: '08:00'
      };

      return Response.json({ success: true, preferences: prefs });
    }

    if (action === 'update_notification_preferences') {
      const { email_enabled, in_app_enabled, critical_alerts, urgent_alerts, warning_alerts, info_alerts, daily_digest, quiet_hours_start, quiet_hours_end } = await req.json();

      const prefs = await base44.entities.NotificationPreference.filter({
        user_email: user.email
      }).then(r => r[0]);

      if (prefs) {
        await base44.entities.NotificationPreference.update(prefs.id, {
          email_enabled,
          in_app_enabled,
          critical_alerts,
          urgent_alerts,
          warning_alerts,
          info_alerts,
          daily_digest,
          quiet_hours_start,
          quiet_hours_end
        });
      } else {
        await base44.entities.NotificationPreference.create({
          user_email: user.email,
          email_enabled,
          in_app_enabled,
          critical_alerts,
          urgent_alerts,
          warning_alerts,
          info_alerts,
          daily_digest,
          quiet_hours_start,
          quiet_hours_end
        });
      }

      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Notification orchestrator error:', error);
    return Response.json(
      { error: error.message || 'Notification operation failed' },
      { status: 500 }
    );
  }
});