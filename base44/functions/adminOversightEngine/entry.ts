import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * ADMIN OVERSIGHT ENGINE
 * Phase 3: Secure admin controls without exposing user PII
 * Admins can monitor, audit, and intervene while respecting data isolation
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return jsonResponse({ error: 'Admin access required' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === 'get_platform_overview') {
      return await getPlatformOverview(base44, user);
    }

    if (action === 'get_module_health') {
      return await getModuleHealth(base44, user);
    }

    if (action === 'list_critical_alerts') {
      return await listCriticalAlerts(base44, user);
    }

    if (action === 'audit_user_activity') {
      return await auditUserActivity(base44, user, body.user_email);
    }

    if (action === 'escalate_intervention') {
      return await escalateIntervention(base44, user, body.entity_type, body.entity_id);
    }

    return jsonResponse({ error: 'Unknown action' }, 400);

  } catch (error) {
    console.error('[AdminOversightEngine]', error.message);
    return jsonResponse({ error: error.message }, 500);
  }
});

/**
 * Get high-level platform overview (no PII exposure)
 */
async function getPlatformOverview(base44, user) {
  try {
    // Get aggregated stats without exposing user data
    const auditLogs = await base44.asServiceRole.entities.AuditLog?.filter?.({}, '-created_date', 100).catch(() => []);
    
    const notifications = await base44.asServiceRole.entities.Notification?.filter?.({}, '-created_date', 50).catch(() => []);

    // Count by action type
    const actionCounts = {};
    auditLogs.forEach(log => {
      actionCounts[log.action_type] = (actionCounts[log.action_type] || 0) + 1;
    });

    // Count by severity
    const severityCounts = {};
    notifications.forEach(notif => {
      severityCounts[notif.severity] = (severityCounts[notif.severity] || 0) + 1;
    });

    return jsonResponse({
      timestamp: new Date().toISOString(),
      platform_status: 'operational',
      overview: {
        recent_actions: auditLogs.length,
        action_distribution: actionCounts,
        active_alerts: severityCounts,
        unread_notifications: notifications.filter(n => !n.is_read).length
      },
      recommendation: 'Monitor critical and urgent alerts regularly'
    });

  } catch (error) {
    return jsonResponse({ error: 'Overview retrieval failed', details: error.message }, 500);
  }
}

/**
 * Check health of all modules
 */
async function getModuleHealth(base44, user) {
  try {
    const modules = [
      { name: 'Autopilot', entity: 'AITask', event_type: 'task_executed' },
      { name: 'Discovery', entity: 'Opportunity', event_type: 'opportunity_queued' },
      { name: 'Wallet', entity: 'Transaction', event_type: 'transaction_recorded' },
      { name: 'Identity', entity: 'AIIdentity', event_type: 'identity_created' },
      { name: 'Credentials', entity: 'CredentialVault', event_type: 'credential_accessed' },
      { name: 'Notifications', entity: 'Notification', event_type: 'notification_sent' }
    ];

    const health = {
      timestamp: new Date().toISOString(),
      modules: []
    };

    for (const module of modules) {
      const recentEvents = await base44.asServiceRole.entities.AuditLog?.filter?.({
        action_type: module.event_type
      }, '-created_date', 10).catch(() => []);

      const lastEventTime = recentEvents.length > 0 ? new Date(recentEvents[0].timestamp) : null;
      const statusOk = lastEventTime && (Date.now() - lastEventTime.getTime()) < 300000; // 5 min

      health.modules.push({
        name: module.name,
        status: statusOk ? 'healthy' : 'idle',
        last_event: lastEventTime?.toISOString() || 'never',
        recent_activity: recentEvents.length
      });
    }

    return jsonResponse(health);

  } catch (error) {
    return jsonResponse({ error: 'Module health check failed', details: error.message }, 500);
  }
}

/**
 * List critical and urgent alerts (no user PII)
 */
async function listCriticalAlerts(base44, user) {
  try {
    const alerts = await base44.asServiceRole.entities.Notification?.filter?.({
      severity: { $in: ['critical', 'urgent'] }
    }, '-created_date', 50).catch(() => []);

    const summary = {
      timestamp: new Date().toISOString(),
      total_critical_alerts: alerts.filter(a => a.severity === 'critical').length,
      total_urgent_alerts: alerts.filter(a => a.severity === 'urgent').length,
      alerts: alerts.map(a => ({
        id: a.id,
        type: a.type,
        severity: a.severity,
        title: a.title,
        created_at: a.created_date,
        action_required: a.action_type !== 'none'
      }))
    };

    // Log audit access
    await base44.asServiceRole.entities.AuditLog?.create?.({
      entity_type: 'AdminOversight',
      action_type: 'critical_alerts_viewed',
      user_email: user.email,
      details: {
        critical_count: summary.total_critical_alerts,
        urgent_count: summary.total_urgent_alerts
      },
      severity: 'info',
      timestamp: new Date().toISOString()
    }).catch(() => {});

    return jsonResponse(summary);

  } catch (error) {
    return jsonResponse({ error: 'Alert retrieval failed', details: error.message }, 500);
  }
}

/**
 * Audit user activity (PII-safe: no exposing actual data, just action logs)
 */
async function auditUserActivity(base44, user, userEmail) {
  if (!userEmail) {
    return jsonResponse({ error: 'user_email required' }, 400);
  }

  try {
    // Get user's audit trail (filtered by RLS)
    const userAudits = await base44.asServiceRole.entities.AuditLog?.filter?.({
      user_email: userEmail
    }, '-created_date', 100).catch(() => []);

    // Count by action type
    const actionBreakdown = {};
    const severityBreakdown = {};

    userAudits.forEach(log => {
      actionBreakdown[log.action_type] = (actionBreakdown[log.action_type] || 0) + 1;
      severityBreakdown[log.severity] = (severityBreakdown[log.severity] || 0) + 1;
    });

    const report = {
      timestamp: new Date().toISOString(),
      user_email: userEmail,
      audit_period: 'last 100 actions',
      total_actions: userAudits.length,
      action_breakdown: actionBreakdown,
      severity_breakdown: severityBreakdown,
      latest_actions: userAudits.slice(0, 10).map(a => ({
        timestamp: a.timestamp,
        action: a.action_type,
        severity: a.severity,
        entity_type: a.entity_type
      })),
      risk_assessment: calculateRiskLevel(actionBreakdown, severityBreakdown)
    };

    // Log admin audit access
    await base44.asServiceRole.entities.AuditLog?.create?.({
      entity_type: 'AdminOversight',
      action_type: 'user_audit_accessed',
      user_email: user.email,
      details: {
        audited_user: userEmail,
        actions_reviewed: userAudits.length
      },
      severity: 'info',
      timestamp: new Date().toISOString()
    }).catch(() => {});

    return jsonResponse(report);

  } catch (error) {
    return jsonResponse({ error: 'User audit failed', details: error.message }, 500);
  }
}

/**
 * Escalate intervention request
 */
async function escalateIntervention(base44, user, entityType, entityId) {
  if (!entityType || !entityId) {
    return jsonResponse({ error: 'entity_type, entity_id required' }, 400);
  }

  try {
    // Create intervention record
    const intervention = await base44.asServiceRole.entities.UserIntervention?.create?.({
      entity_type: entityType,
      entity_id: entityId,
      status: 'escalated_to_admin',
      admin_email: user.email,
      escalated_at: new Date().toISOString(),
      priority: 'high',
      notes: `Admin escalation by ${user.full_name || user.email}`
    }).catch(() => null);

    if (!intervention) {
      return jsonResponse({ error: 'Failed to create intervention' }, 500);
    }

    // Log the escalation
    await base44.asServiceRole.entities.AuditLog?.create?.({
      entity_type: entityType,
      entity_id: entityId,
      action_type: 'admin_escalation',
      user_email: user.email,
      details: {
        escalation_reason: 'admin_override',
        intervention_id: intervention.id
      },
      severity: 'warning',
      timestamp: new Date().toISOString()
    }).catch(() => {});

    return jsonResponse({
      escalation_created: true,
      intervention_id: intervention.id,
      entity_type: entityType,
      entity_id: entityId,
      status: 'escalated_to_admin',
      message: `Intervention escalated for ${entityType} ${entityId}`
    });

  } catch (error) {
    return jsonResponse({ error: 'Escalation failed', details: error.message }, 500);
  }
}

/**
 * Calculate risk level based on patterns
 */
function calculateRiskLevel(actionBreakdown, severityBreakdown) {
  let riskScore = 0;

  // High-risk actions
  if ((actionBreakdown['credential_accessed'] || 0) > 10) riskScore += 20;
  if ((actionBreakdown['account_suspended'] || 0) > 0) riskScore += 30;
  if ((severityBreakdown['critical'] || 0) > 0) riskScore += 40;
  if ((severityBreakdown['warning'] || 0) > 5) riskScore += 15;

  if (riskScore >= 50) return 'HIGH';
  if (riskScore >= 20) return 'MEDIUM';
  return 'LOW';
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}