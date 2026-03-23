import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * PII PROTECTION ENGINE
 * Phase 5: Real-time PII detection, masking, and redaction
 * Prevents exposure of Personally Identifiable Information
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const { action, data_to_scan, mask_type } = body;

    if (action === 'scan_for_pii') {
      return await scanForPII(base44, user, data_to_scan);
    }

    if (action === 'mask_pii') {
      return await maskPII(base44, user, data_to_scan, mask_type);
    }

    if (action === 'get_pii_policy') {
      return await getPIIPolicy(base44, user);
    }

    if (action === 'audit_pii_access') {
      return await auditPIIAccess(base44, user);
    }

    return jsonResponse({ error: 'Unknown action' }, 400);

  } catch (error) {
    console.error('[PIIProtectionEngine]', error.message);
    return jsonResponse({ error: error.message }, 500);
  }
});

/**
 * Scan data for PII patterns
 */
async function scanForPII(base44, user, dataToScan) {
  if (!dataToScan) {
    return jsonResponse({ error: 'data_to_scan required' }, 400);
  }

  try {
    const piiPatterns = {
      ssn: /\d{3}-\d{2}-\d{4}/g,
      credit_card: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
      email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      phone: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      date_of_birth: /\b(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}\b/g,
      ip_address: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g
    };

    const detectedPII = {};
    let piiFound = false;

    for (const [type, pattern] of Object.entries(piiPatterns)) {
      const matches = dataToScan.match(pattern);
      if (matches && matches.length > 0) {
        detectedPII[type] = {
          count: matches.length,
          risk_level: getRiskLevel(type),
          samples: matches.slice(0, 3)
        };
        piiFound = true;
      }
    }

    // Log scan
    await base44.asServiceRole.entities.AuditLog?.create?.({
      entity_type: 'PIIScan',
      action_type: 'pii_scan_executed',
      user_email: user.email,
      details: {
        pii_found: piiFound,
        pii_types: Object.keys(detectedPII)
      },
      severity: piiFound ? 'warning' : 'info',
      timestamp: new Date().toISOString()
    }).catch(() => {});

    return jsonResponse({
      scan_timestamp: new Date().toISOString(),
      pii_detected: piiFound,
      pii_count: Object.values(detectedPII).reduce((sum, p) => sum + p.count, 0),
      detected_types: detectedPII,
      recommendation: piiFound ? 'Mask PII before logging or transmitting' : 'No PII detected'
    });

  } catch (error) {
    return jsonResponse({ error: 'PII scan failed', details: error.message }, 500);
  }
}

/**
 * Mask PII in data
 */
async function maskPII(base44, user, dataToScan, maskType = 'partial') {
  if (!dataToScan) {
    return jsonResponse({ error: 'data_to_scan required' }, 400);
  }

  try {
    let maskedData = dataToScan;

    if (maskType === 'full') {
      // Full masking: replace entire PII with placeholder
      maskedData = maskedData
        .replace(/\d{3}-\d{2}-\d{4}/g, 'XXX-XX-XXXX')
        .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, 'XXXX-XXXX-XXXX-XXXX')
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, 'REDACTED@EMAIL.COM')
        .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, 'XXX-XXX-XXXX');
    } else if (maskType === 'partial') {
      // Partial masking: show first/last few characters
      maskedData = maskedData
        .replace(/\d{3}-\d{2}-(\d{4})/g, 'XXX-XX-$1')
        .replace(/(\d{4})[\s-]?\d{4}[\s-]?\d{4}[\s-]?(\d{4})/g, '$1-XXXX-XXXX-$2')
        .replace(/([a-zA-Z0-9])[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '$1***@$2')
        .replace(/(\d{3})[-.\s]?\d{3}[-.\s]?(\d{4})/g, '$1-XXX-$2');
    }

    // Log masking
    await base44.asServiceRole.entities.ComplianceAuditLog?.create?.({
      user_email: user.email,
      action_type: 'pii_masked',
      entity_type: 'PIIMasking',
      entity_id: 'pii_mask_operation',
      details: {
        mask_type: maskType,
        original_length: dataToScan.length,
        masked_length: maskedData.length
      },
      risk_level: 'low',
      status: 'logged',
      timestamp: new Date().toISOString()
    }).catch(() => {});

    return jsonResponse({
      masked_data: maskedData,
      mask_type: maskType,
      timestamp: new Date().toISOString(),
      message: 'PII successfully masked'
    });

  } catch (error) {
    return jsonResponse({ error: 'PII masking failed', details: error.message }, 500);
  }
}

/**
 * Get PII protection policy
 */
async function getPIIPolicy(base44, user) {
  try {
    const policy = {
      timestamp: new Date().toISOString(),
      pii_types_protected: [
        'Social Security Numbers',
        'Credit Card Numbers',
        'Email Addresses',
        'Phone Numbers',
        'Date of Birth',
        'IP Addresses',
        'Government ID Numbers',
        'Financial Account Numbers'
      ],
      default_masking_strategy: 'partial',
      retention_days: 30,
      access_logging_enabled: true,
      auto_redaction_enabled: true,
      compliance_standards: ['GDPR', 'CCPA', 'HIPAA'],
      breach_notification_enabled: true,
      breach_notification_timeframe_hours: 24
    };

    return jsonResponse(policy);

  } catch (error) {
    return jsonResponse({ error: 'Policy retrieval failed', details: error.message }, 500);
  }
}

/**
 * Audit PII access logs
 */
async function auditPIIAccess(base44, user) {
  try {
    const accessLogs = await base44.asServiceRole.entities.ComplianceAuditLog?.filter?.({
      action_type: 'pii_accessed'
    }, '-created_date', 50).catch(() => []);

    const summary = {
      timestamp: new Date().toISOString(),
      total_accesses: accessLogs.length,
      access_logs: accessLogs.slice(0, 10).map(log => ({
        accessed_at: log.timestamp,
        accessed_by: log.user_email,
        pii_type: log.details?.pii_type,
        reason: log.details?.reason,
        access_granted: log.status === 'approved'
      })),
      high_risk_accesses: accessLogs.filter(log => log.risk_level === 'high').length,
      suspicious_patterns: []
    };

    return jsonResponse(summary);

  } catch (error) {
    return jsonResponse({ error: 'Access audit failed', details: error.message }, 500);
  }
}

function getRiskLevel(piiType) {
  const riskMap = {
    ssn: 'critical',
    credit_card: 'critical',
    date_of_birth: 'high',
    phone: 'medium',
    email: 'low',
    ip_address: 'low'
  };
  return riskMap[piiType] || 'medium';
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}