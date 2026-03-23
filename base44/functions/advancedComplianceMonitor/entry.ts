import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * ADVANCED COMPLIANCE MONITOR
 * Real-time compliance tracking and policy enforcement
 * - Policy violation detection
 * - Risk aggregation
 * - Regulatory reporting
 * - Automated remediation
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

    if (action === 'get_compliance_status') {
      return await getComplianceStatus(base44, user);
    }

    if (action === 'detect_violations') {
      return await detectViolations(base44, user);
    }

    if (action === 'get_risk_summary') {
      return await getRiskSummary(base44, user);
    }

    if (action === 'initiate_remediation') {
      return await initiateRemediation(base44, user, body);
    }

    if (action === 'generate_compliance_report') {
      return await generateComplianceReport(base44, user, body);
    }

    return jsonResponse({ error: 'Unknown action' }, 400);

  } catch (error) {
    console.error('[AdvancedComplianceMonitor]', error.message);
    return jsonResponse({ error: error.message }, 500);
  }
});

/**
 * Get current compliance status
 */
async function getComplianceStatus(base44, user) {
  try {
    const auditLogs = await base44.asServiceRole.entities.ComplianceAuditLog.filter(
      {},
      '-timestamp',
      1000
    ).catch(() => []);

    const flagged = auditLogs.filter(l => l.status === 'flagged' || l.risk_level === 'critical');
    const violations = auditLogs.filter(l => l.status === 'violation_confirmed');
    
    // Calculate compliance score (0-100)
    const total = auditLogs.length;
    const clean = auditLogs.filter(l => l.status === 'approved').length;
    const complianceScore = total > 0 ? Math.round((clean / total) * 100) : 100;

    return jsonResponse({
      compliance_score: complianceScore,
      total_records: total,
      flagged_count: flagged.length,
      violations_count: violations.length,
      status: complianceScore >= 90 ? 'compliant' : complianceScore >= 70 ? 'at_risk' : 'non_compliant',
      last_audit: auditLogs[0]?.timestamp || null
    });
  } catch (error) {
    console.error('[Get Compliance Status]', error.message);
    return jsonResponse({ error: 'Failed to get status' }, 500);
  }
}

/**
 * Detect policy violations
 */
async function detectViolations(base44, user) {
  try {
    const violations = [];

    // Check spending policies
    const spending = await base44.asServiceRole.entities.SpendingPolicy.list(null, 100).catch(() => []);
    for (const policy of spending) {
      const today = new Date().toISOString().split('T')[0];
      const dailyTxns = await base44.asServiceRole.entities.Transaction.filter(
        { category: policy.category, created_date: { $gte: today } },
        null, 1000
      ).catch(() => []);

      const dailyTotal = dailyTxns.reduce((sum, t) => sum + (t.amount || 0), 0);
      if (dailyTotal > (policy.max_per_day || 10000)) {
        violations.push({
          type: 'daily_spending_limit_exceeded',
          policy_id: policy.id,
          category: policy.category,
          limit: policy.max_per_day,
          current: dailyTotal,
          severity: 'high'
        });
      }
    }

    // Check rate limits
    const keys = await base44.asServiceRole.entities.APIKey.filter(
      { is_active: true },
      null, 100
    ).catch(() => []);

    for (const key of keys) {
      if (key.calls_made_this_hour > key.rate_limit_calls_per_hour) {
        violations.push({
          type: 'rate_limit_exceeded',
          key_id: key.id,
          limit: key.rate_limit_calls_per_hour,
          current: key.calls_made_this_hour,
          severity: 'medium'
        });
      }
    }

    // Check identity sync conflicts
    const syncLogs = await base44.asServiceRole.entities.IdentitySyncLog.filter(
      { status: 'conflicts_detected' },
      '-sync_timestamp',
      100
    ).catch(() => []);

    for (const log of syncLogs.slice(0, 10)) {
      violations.push({
        type: 'identity_sync_conflict',
        identity_id: log.identity_id,
        conflicts_found: log.conflicts_found,
        severity: 'high'
      });
    }

    return jsonResponse({
      total_violations: violations.length,
      by_severity: {
        critical: violations.filter(v => v.severity === 'critical').length,
        high: violations.filter(v => v.severity === 'high').length,
        medium: violations.filter(v => v.severity === 'medium').length,
        low: violations.filter(v => v.severity === 'low').length
      },
      violations: violations.slice(0, 50)
    });
  } catch (error) {
    console.error('[Detect Violations]', error.message);
    return jsonResponse({ error: 'Failed to detect violations' }, 500);
  }
}

/**
 * Get aggregated risk summary
 */
async function getRiskSummary(base44, user) {
  try {
    const auditLogs = await base44.asServiceRole.entities.ComplianceAuditLog.filter(
      {},
      '-timestamp',
      500
    ).catch(() => []);

    const riskBreakdown = {
      critical: auditLogs.filter(l => l.risk_level === 'critical').length,
      high: auditLogs.filter(l => l.risk_level === 'high').length,
      medium: auditLogs.filter(l => l.risk_level === 'medium').length,
      low: auditLogs.filter(l => l.risk_level === 'low').length
    };

    // Calculate trend (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const recentCritical = auditLogs.filter(
      l => l.risk_level === 'critical' && l.timestamp >= sevenDaysAgo
    ).length;

    return jsonResponse({
      risk_breakdown: riskBreakdown,
      total_risk_events: auditLogs.length,
      critical_events_7day: recentCritical,
      overall_risk_level: riskBreakdown.critical > 10 ? 'critical' : 
                          riskBreakdown.high > 20 ? 'high' :
                          riskBreakdown.medium > 50 ? 'medium' : 'low',
      requires_intervention: riskBreakdown.critical > 0
    });
  } catch (error) {
    console.error('[Get Risk Summary]', error.message);
    return jsonResponse({ error: 'Failed to get risk summary' }, 500);
  }
}

/**
 * Initiate automated remediation
 */
async function initiateRemediation(base44, user, body) {
  const { violation_id, violation_type, action_type } = body;

  try {
    if (!violation_type) {
      return jsonResponse({ error: 'violation_type required' }, 400);
    }

    let remediationResult = {
      violation_type,
      action_taken: null,
      success: false
    };

    // Handle spending policy violation
    if (violation_type === 'daily_spending_limit_exceeded') {
      const { policy_id } = body;
      await base44.asServiceRole.entities.SpendingPolicy.update(policy_id, {
        enabled: false,
        updated_date: new Date().toISOString()
      }).catch(() => {});
      remediationResult.action_taken = 'policy_disabled';
      remediationResult.success = true;
    }

    // Handle rate limit violation
    if (violation_type === 'rate_limit_exceeded') {
      const { key_id } = body;
      await base44.asServiceRole.entities.APIKey.update(key_id, {
        is_active: false,
        updated_date: new Date().toISOString()
      }).catch(() => {});
      remediationResult.action_taken = 'key_deactivated';
      remediationResult.success = true;
    }

    // Log remediation
    await base44.asServiceRole.entities.ComplianceAuditLog.create({
      user_email: user.email,
      action_type: 'remediation_action',
      entity_type: 'Violation',
      entity_id: violation_id || 'auto',
      details: remediationResult,
      risk_level: 'medium',
      timestamp: new Date().toISOString(),
      status: 'approved'
    }).catch(() => {});

    return jsonResponse(remediationResult);
  } catch (error) {
    console.error('[Initiate Remediation]', error.message);
    return jsonResponse({ error: 'Failed to initiate remediation' }, 500);
  }
}

/**
 * Generate compliance report
 */
async function generateComplianceReport(base44, user, body) {
  const { period = '7d' } = body;

  try {
    const periodMs = period === '30d' ? 30 * 86400000 : 7 * 86400000;
    const startDate = new Date(Date.now() - periodMs).toISOString();

    const auditLogs = await base44.asServiceRole.entities.ComplianceAuditLog.filter(
      { timestamp: { $gte: startDate } },
      '-timestamp',
      1000
    ).catch(() => []);

    const actionBreakdown = {};
    const riskBreakdown = {};

    for (const log of auditLogs) {
      actionBreakdown[log.action_type] = (actionBreakdown[log.action_type] || 0) + 1;
      riskBreakdown[log.risk_level] = (riskBreakdown[log.risk_level] || 0) + 1;
    }

    return jsonResponse({
      report_period: period,
      generated_at: new Date().toISOString(),
      total_events: auditLogs.length,
      action_breakdown: actionBreakdown,
      risk_breakdown: riskBreakdown,
      compliance_score: auditLogs.length > 0 ? 
        Math.round(((auditLogs.filter(l => l.status === 'approved').length / auditLogs.length) * 100)) : 100,
      top_actions: Object.entries(actionBreakdown)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([action, count]) => ({ action, count })),
      recommendations: generateRecommendations(riskBreakdown, auditLogs.length)
    });
  } catch (error) {
    console.error('[Generate Report]', error.message);
    return jsonResponse({ error: 'Failed to generate report' }, 500);
  }
}

/**
 * Generate recommendations based on compliance data
 */
function generateRecommendations(riskBreakdown, totalEvents) {
  const recommendations = [];

  if ((riskBreakdown.critical || 0) > 5) {
    recommendations.push('Immediate review of critical risk events required');
  }

  if ((riskBreakdown.high || 0) > 20) {
    recommendations.push('Implement additional controls for high-risk activities');
  }

  if (totalEvents < 100) {
    recommendations.push('Increase audit logging coverage for better visibility');
  }

  if (recommendations.length === 0) {
    recommendations.push('Maintain current compliance practices');
  }

  return recommendations;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}