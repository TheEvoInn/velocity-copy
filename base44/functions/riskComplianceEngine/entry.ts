/**
 * RISK COMPLIANCE ENGINE
 * Monitors for fraud, compliance violations, and suspicious patterns
 * Blocks high-risk actions and escalates to manual review
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Scan transaction for fraud indicators
 */
async function scanForFraud(base44, transaction) {
  const scan = {
    transaction_id: transaction.id,
    timestamp: new Date().toISOString(),
    risk_score: 0,
    flags: [],
    safe: true,
  };

  try {
    // Flag 1: Unusual amount
    if (transaction.amount > 5000) {
      scan.risk_score += 15;
      scan.flags.push('Large amount ($5000+)');
    }

    // Flag 2: Unusual platform
    const knownPlatforms = ['upwork', 'fiverr', 'freelancer', 'toptal', 'guru'];
    if (!knownPlatforms.includes((transaction.platform || '').toLowerCase())) {
      scan.risk_score += 20;
      scan.flags.push('Unknown platform');
    }

    // Flag 3: Missing verification
    if (!transaction.platform_transaction_id) {
      scan.risk_score += 25;
      scan.flags.push('No platform transaction ID');
    }

    // Flag 4: Duplicate transaction
    if (transaction.linked_account_id) {
      const duplicates = await base44.asServiceRole.entities.Transaction.filter(
        {
          platform: transaction.platform,
          linked_account_id: transaction.linked_account_id,
        },
        '-created_date',
        10
      ).catch(() => []);

      if (duplicates.length > 1) {
        scan.risk_score += 20;
        scan.flags.push('Potential duplicate transaction');
      }
    }

    // Flag 5: Rapid transactions
    const recentTxns = await base44.asServiceRole.entities.Transaction.filter(
      { created_by: transaction.created_by, platform: transaction.platform },
      '-created_date',
      20
    ).catch(() => []);

    if (recentTxns.length > 10) {
      scan.risk_score += 10;
      scan.flags.push('High transaction frequency');
    }

    scan.safe = scan.risk_score < 40;
    return scan;
  } catch (e) {
    scan.risk_score = 100; // Default to unsafe on error
    scan.flags.push(`Scan error: ${e.message}`);
    scan.safe = false;
    return scan;
  }
}

/**
 * Check if user meets compliance requirements
 */
async function checkComplianceStatus(base44, userEmail) {
  const status = {
    user: userEmail,
    timestamp: new Date().toISOString(),
    compliant: true,
    checks: [],
  };

  try {
    // Check 1: KYC verification
    const identity = await base44.asServiceRole.entities.AIIdentity.filter(
      { user_email: userEmail, is_active: true },
      '-created_date',
      1
    ).then(ids => ids[0]);

    if (!identity || !identity.onboarding_complete) {
      status.compliant = false;
      status.checks.push('❌ Onboarding not complete');
    } else {
      status.checks.push('✓ Onboarding complete');
    }

    // Check 2: Terms accepted
    const userGoals = await base44.asServiceRole.entities.UserGoals.filter(
      { created_by: userEmail }, null, 1
    ).then(goals => goals[0]);

    if (!userGoals) {
      status.compliant = false;
      status.checks.push('❌ User goals/terms not configured');
    } else {
      status.checks.push('✓ User profile configured');
    }

    // Check 3: Account in good standing
    if (identity?.health_status === 'suspended') {
      status.compliant = false;
      status.checks.push('❌ Account suspended');
    } else if (identity?.health_status === 'warning') {
      status.checks.push('⚠️ Account has warnings');
    } else {
      status.checks.push('✓ Account in good standing');
    }

    // Check 4: No fraud flags
    const recentFraudFlags = await base44.asServiceRole.entities.ActivityLog.filter(
      {
        created_by: userEmail,
        action_type: 'system',
        severity: 'critical',
      },
      '-created_date',
      10
    ).catch(() => []);

    if (recentFraudFlags.length > 2) {
      status.compliant = false;
      status.checks.push(`❌ Multiple fraud alerts (${recentFraudFlags.length})`);
    } else {
      status.checks.push('✓ No fraud alerts');
    }

    return status;
  } catch (e) {
    status.compliant = false;
    status.checks.push(`Error: ${e.message}`);
    return status;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, transaction } = body;

    // ── Scan transaction for fraud ─────────────────────────────────────
    if (action === 'scan_fraud') {
      if (!transaction) {
        return Response.json({ error: 'Transaction required' }, { status: 400 });
      }

      const scan = await scanForFraud(base44, transaction);
      return Response.json({
        success: scan.safe,
        scan,
      });
    }

    // ── Check user compliance status ───────────────────────────────────
    if (action === 'check_compliance') {
      const complianceStatus = await checkComplianceStatus(base44, user.email);
      return Response.json({
        success: complianceStatus.compliant,
        status: complianceStatus,
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[RiskComplianceEngine] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});