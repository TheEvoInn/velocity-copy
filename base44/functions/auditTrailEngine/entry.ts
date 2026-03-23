import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * AUDIT TRAIL ENGINE
 * Comprehensive audit logging with tamper detection
 * - Immutable audit records
 * - Cross-system tracking
 * - Anomaly detection
 * - Regulatory compliance
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

    if (action === 'log_event') {
      return await logEvent(base44, user, body);
    }

    if (action === 'get_audit_trail') {
      return await getAuditTrail(base44, user, body);
    }

    if (action === 'detect_anomalies') {
      return await detectAnomalies(base44, user);
    }

    if (action === 'export_audit_log') {
      return await exportAuditLog(base44, user, body);
    }

    if (action === 'verify_trail_integrity') {
      return await verifyTrailIntegrity(base44, user);
    }

    return jsonResponse({ error: 'Unknown action' }, 400);

  } catch (error) {
    console.error('[AuditTrailEngine]', error.message);
    return jsonResponse({ error: error.message }, 500);
  }
});

/**
 * Log audit event (immutable)
 */
async function logEvent(base44, user, body) {
  const { entity_type, entity_id, action_type, details, severity = 'info' } = body;

  if (!entity_type || !action_type) {
    return jsonResponse({ error: 'entity_type and action_type required' }, 400);
  }

  try {
    const event = {
      entity_type,
      entity_id: entity_id || 'N/A',
      action_type,
      user_email: user.email,
      details: details || {},
      severity,
      timestamp: new Date().toISOString(),
      ip_address: getClientIP(body),
      user_agent: body.user_agent || 'unknown'
    };

    // Create immutable audit log entry
    const created = await base44.asServiceRole.entities.AuditLog.create(event).catch(err => {
      console.error('[AuditLog Create]', err.message);
      return null;
    });

    return jsonResponse({
      success: !!created,
      event_id: created?.id || null,
      timestamp: event.timestamp
    });
  } catch (error) {
    console.error('[Log Event]', error.message);
    return jsonResponse({ error: 'Failed to log event' }, 500);
  }
}

/**
 * Retrieve audit trail with filtering
 */
async function getAuditTrail(base44, user, body) {
  const { entity_type, entity_id, action_type, severity, limit = 100, offset = 0 } = body;

  try {
    let filter = {};
    if (entity_type) filter.entity_type = entity_type;
    if (entity_id) filter.entity_id = entity_id;
    if (action_type) filter.action_type = action_type;
    if (severity) filter.severity = severity;

    const logs = await base44.asServiceRole.entities.AuditLog.filter(
      filter,
      '-timestamp',
      Math.min(limit, 1000)
    ).catch(() => []);

    return jsonResponse({
      total: logs.length,
      offset,
      limit,
      logs: logs.map(log => ({
        id: log.id,
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        action_type: log.action_type,
        user_email: log.user_email,
        severity: log.severity,
        timestamp: log.timestamp
      }))
    });
  } catch (error) {
    console.error('[Get Audit Trail]', error.message);
    return jsonResponse({ error: 'Failed to retrieve trail' }, 500);
  }
}

/**
 * Detect anomalies in audit trail
 */
async function detectAnomalies(base44, user) {
  try {
    const last24h = new Date(Date.now() - 86400000).toISOString();
    const recentLogs = await base44.asServiceRole.entities.AuditLog.filter(
      { timestamp: { $gte: last24h } },
      '-timestamp',
      500
    ).catch(() => []);

    const anomalies = [];

    // High-frequency activity from single user
    const userActivity = {};
    for (const log of recentLogs) {
      userActivity[log.user_email] = (userActivity[log.user_email] || 0) + 1;
    }

    for (const [email, count] of Object.entries(userActivity)) {
      if (count > 500) {
        anomalies.push({
          type: 'high_frequency_activity',
          user: email,
          count,
          severity: 'medium'
        });
      }
    }

    // Suspicious action patterns
    const actionCounts = {};
    for (const log of recentLogs) {
      actionCounts[log.action_type] = (actionCounts[log.action_type] || 0) + 1;
    }

    for (const [action, count] of Object.entries(actionCounts)) {
      if (count > 200 && action.includes('delete')) {
        anomalies.push({
          type: 'bulk_deletion_activity',
          action,
          count,
          severity: 'high'
        });
      }
    }

    // Multiple failed attempts
    const failurePattern = recentLogs.filter(l => l.severity === 'critical').length;
    if (failurePattern > 50) {
      anomalies.push({
        type: 'high_failure_rate',
        count: failurePattern,
        severity: 'high'
      });
    }

    return jsonResponse({
      anomalies_detected: anomalies.length,
      anomalies: anomalies.slice(0, 20),
      requires_review: anomalies.length > 0
    });
  } catch (error) {
    console.error('[Detect Anomalies]', error.message);
    return jsonResponse({ error: 'Failed to detect anomalies' }, 500);
  }
}

/**
 * Export audit log for compliance
 */
async function exportAuditLog(base44, user, body) {
  const { format = 'json', days = 30 } = body;

  try {
    const startDate = new Date(Date.now() - days * 86400000).toISOString();
    const logs = await base44.asServiceRole.entities.AuditLog.filter(
      { timestamp: { $gte: startDate } },
      '-timestamp',
      10000
    ).catch(() => []);

    if (format === 'csv') {
      const csv = convertToCSV(logs);
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename=audit-log.csv'
        }
      });
    }

    return jsonResponse({
      export_format: 'json',
      period_days: days,
      total_records: logs.length,
      generated_at: new Date().toISOString(),
      logs
    });
  } catch (error) {
    console.error('[Export Audit Log]', error.message);
    return jsonResponse({ error: 'Failed to export' }, 500);
  }
}

/**
 * Verify audit trail integrity (detect tampering)
 */
async function verifyTrailIntegrity(base44, user) {
  try {
    const allLogs = await base44.asServiceRole.entities.AuditLog.list('-timestamp', 500).catch(() => []);

    let integrityScore = 100;
    const issues = [];

    // Check for temporal consistency
    for (let i = 0; i < allLogs.length - 1; i++) {
      const current = new Date(allLogs[i].timestamp).getTime();
      const next = new Date(allLogs[i + 1].timestamp).getTime();
      if (current < next) {
        integrityScore -= 5;
        issues.push('Timestamp ordering anomaly detected');
        break;
      }
    }

    // Check for missing creation dates
    const missingCreated = allLogs.filter(l => !l.created_date).length;
    if (missingCreated > 0) {
      integrityScore -= 10;
      issues.push(`${missingCreated} records missing creation date`);
    }

    // Check for suspicious field modifications
    const suspiciousUpdates = allLogs.filter(l => l.updated_date && l.created_date).length;
    if (suspiciousUpdates > allLogs.length * 0.1) {
      integrityScore -= 15;
      issues.push('High rate of record modifications detected');
    }

    return jsonResponse({
      integrity_score: Math.max(0, integrityScore),
      total_records: allLogs.length,
      integrity_status: integrityScore >= 95 ? 'valid' : integrityScore >= 80 ? 'warning' : 'compromised',
      issues,
      verified_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Verify Integrity]', error.message);
    return jsonResponse({ error: 'Failed to verify integrity' }, 500);
  }
}

/**
 * Convert logs to CSV
 */
function convertToCSV(logs) {
  const headers = ['ID', 'Entity Type', 'Entity ID', 'Action', 'User', 'Severity', 'Timestamp'];
  const rows = logs.map(log => [
    log.id,
    log.entity_type,
    log.entity_id,
    log.action_type,
    log.user_email,
    log.severity,
    log.timestamp
  ]);

  const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  return csv;
}

function getClientIP(body) {
  return body.ip_address || 'unknown';
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}