import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * COMPLIANCE AUDIT ENGINE
 * Comprehensive logging of all autonomous AI actions for regulatory compliance
 * Tracks identity usage, task execution, financial decisions, and policy violations
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'get_audit_logs';

    if (action === 'log_autonomous_action') {
      return await logAutonomousAction(base44, user, body);
    }

    if (action === 'get_audit_logs') {
      return await getAuditLogs(base44, user, body);
    }

    if (action === 'get_compliance_report') {
      return await getComplianceReport(base44, user);
    }

    return jsonResponse({ error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('[ComplianceAuditEngine]', error.message);
    return jsonResponse({ error: error.message }, 500);
  }
});

/**
 * Log an autonomous AI action
 */
async function logAutonomousAction(base44, user, data) {
  const {
    action_type,
    entity_type,
    entity_id,
    identity_id,
    details,
    risk_level = 'low'
  } = data;

  await base44.entities.ComplianceAuditLog.create({
    user_email: user.email,
    action_type,
    entity_type,
    entity_id,
    identity_id,
    details,
    risk_level,
    timestamp: new Date().toISOString(),
    status: 'logged'
  }).catch(() => {});

  return jsonResponse({ message: 'Action logged' });
}

/**
 * Get audit logs with filtering
 */
async function getAuditLogs(base44, user, data) {
  const {
    entity_type,
    risk_level,
    days = 30,
    limit = 100
  } = data;

  const cutoff = new Date(Date.now() - days * 86400000).toISOString();

  const query = {
    user_email: user.email,
    ...(entity_type && { entity_type }),
    ...(risk_level && { risk_level })
  };

  const logs = await base44.entities.ComplianceAuditLog
    .filter(query, '-timestamp', limit)
    .catch(() => []);

  const filtered = logs.filter(l => l.timestamp > cutoff);

  return jsonResponse({
    total: filtered.length,
    logs: filtered.map(l => ({
      id: l.id,
      action_type: l.action_type,
      entity_type: l.entity_type,
      risk_level: l.risk_level,
      timestamp: l.timestamp,
      details: l.details
    }))
  });
}

/**
 * Generate compliance report
 */
async function getComplianceReport(base44, user) {
  const days7 = new Date(Date.now() - 7 * 86400000).toISOString();
  const days30 = new Date(Date.now() - 30 * 86400000).toISOString();

  const logs7d = await base44.entities.ComplianceAuditLog
    .filter({ user_email: user.email }, '-timestamp', 1000)
    .catch(() => [])
    .then(l => l.filter(x => x.timestamp > days7));

  const logs30d = await base44.entities.ComplianceAuditLog
    .filter({ user_email: user.email }, '-timestamp', 1000)
    .catch(() => [])
    .then(l => l.filter(x => x.timestamp > days30));

  const highRiskActions = logs30d.filter(l => l.risk_level === 'high' || l.risk_level === 'critical').length;

  return jsonResponse({
    report_date: new Date().toISOString(),
    period_days: 30,
    total_actions_30d: logs30d.length,
    total_actions_7d: logs7d.length,
    high_risk_actions: highRiskActions,
    action_breakdown: {
      task_execution: logs30d.filter(l => l.action_type === 'task_executed').length,
      identity_usage: logs30d.filter(l => l.action_type === 'identity_used').length,
      financial_decision: logs30d.filter(l => l.action_type === 'financial_decision').length,
      account_access: logs30d.filter(l => l.action_type === 'account_accessed').length,
      policy_violation: logs30d.filter(l => l.action_type === 'policy_violation').length
    },
    compliance_status: highRiskActions > 5 ? 'attention_needed' : 'compliant',
    recommendations: highRiskActions > 5 ? ['Review high-risk actions', 'Adjust spending policies'] : ['No issues detected']
  });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}