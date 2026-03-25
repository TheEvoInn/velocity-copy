import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * ADVANCED RISK MANAGEMENT ENGINE — TIER 5
 * Real-time fraud detection, account health monitoring, compliance auditing
 * Prevents account bans, credential failures, regulatory violations
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    if (action === 'scan_account_health') return await scanAccountHealth(base44, user, body);
    if (action === 'detect_fraud_signals') return await detectFraudSignals(base44, user);
    if (action === 'check_rate_limits') return await checkRateLimits(base44, user, body);
    if (action === 'audit_compliance') return await auditCompliance(base44, user);
    if (action === 'get_risk_profile') return await getRiskProfile(base44, user);

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[AdvancedRiskManagement]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Scan health status of all linked accounts
 */
async function scanAccountHealth(base44, user, payload) {
  try {
    const accounts = await base44.asServiceRole.entities.LinkedAccount.filter(
      { created_by: user.email },
      null,
      100
    ).catch(() => []);

    const health = {
      total_accounts: accounts.length,
      healthy: 0,
      warning: 0,
      critical: 0,
      accounts: []
    };

    for (const account of accounts) {
      let status = account.health_status || 'healthy';
      let risk_score = 0;

      // Factor 1: Cooldown check
      if (account.cooldown_until && new Date(account.cooldown_until) > new Date()) {
        status = 'cooldown';
        risk_score += 50;
      }

      // Factor 2: Daily application limit
      const today = new Date().toDateString();
      const applied_today = account.applications_today || 0;
      const daily_limit = account.daily_application_limit || 10;
      if (applied_today >= daily_limit * 0.8) {
        risk_score += 30;
      }
      if (applied_today >= daily_limit) {
        status = 'warning';
        risk_score += 50;
      }

      // Factor 3: Account age (younger = more risky)
      const age_days = Math.floor((Date.now() - new Date(account.created_date).getTime()) / (24 * 60 * 60 * 1000));
      if (age_days < 7) risk_score += 40;
      if (age_days < 30) risk_score += 20;

      // Factor 4: Success rate
      const success_rate = account.success_rate || 50;
      if (success_rate < 30) {
        status = 'warning';
        risk_score += 40;
      }

      // Update status if needed
      if (status !== account.health_status) {
        await base44.asServiceRole.entities.LinkedAccount.update(account.id, {
          health_status: status
        }).catch(() => null);
      }

      if (status === 'healthy') health.healthy++;
      else if (status === 'warning') health.warning++;
      else health.critical++;

      health.accounts.push({
        id: account.id,
        platform: account.platform,
        username: account.username,
        status,
        risk_score: Math.min(100, risk_score),
        applied_today,
        daily_limit,
        cooldown_until: account.cooldown_until,
        success_rate,
        last_used: account.last_used
      });
    }

    return Response.json({
      success: true,
      health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Detect fraud signals across activities
 */
async function detectFraudSignals(base44, user) {
  try {
    const signals = [];

    // Signal 1: Rapid successive submissions
    const recentTasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
      { created_by: user.email, created_date: { $gte: new Date(Date.now() - 60 * 60 * 1000).toISOString() } },
      '-created_date',
      50
    ).catch(() => []);

    if (recentTasks.length > 20) {
      signals.push({
        type: 'rapid_execution',
        severity: 'warning',
        message: `${recentTasks.length} tasks in last hour (normal: 5-10)`,
        risk_score: 40
      });
    }

    // Signal 2: Unusual spending pattern
    const transactions = await base44.asServiceRole.entities.Transaction.filter(
      { type: 'expense', created_date: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() } },
      null,
      100
    ).catch(() => []);

    const totalSpent = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const avgTransaction = transactions.length > 0 ? totalSpent / transactions.length : 0;
    const highSpenders = transactions.filter(t => t.amount > avgTransaction * 2);

    if (highSpenders.length > 5) {
      signals.push({
        type: 'abnormal_spending',
        severity: 'critical',
        message: `${highSpenders.length} above-average transactions in 24h`,
        risk_score: 60
      });
    }

    // Signal 3: Failed credential access
    const auditLogs = await base44.asServiceRole.entities.SecretAuditLog.filter(
      { event_type: 'secret_failed_auth', created_date: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() } },
      null,
      100
    ).catch(() => []);

    if (auditLogs.length > 3) {
      signals.push({
        type: 'credential_failures',
        severity: 'warning',
        message: `${auditLogs.length} failed credential accesses in 24h`,
        risk_score: 50
      });
    }

    const fraud_score = signals.reduce((sum, s) => sum + s.risk_score, 0) / Math.max(1, signals.length);

    // Log if high fraud risk
    if (fraud_score > 40) {
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'alert',
        message: `⚠️ Fraud Risk Detected: Score ${Math.round(fraud_score)}/100`,
        severity: fraud_score > 60 ? 'critical' : 'warning',
        metadata: { signals, fraud_score }
      }).catch(() => null);
    }

    return Response.json({
      success: true,
      fraud_score: Math.round(fraud_score),
      signals,
      risk_level: fraud_score > 60 ? 'critical' : fraud_score > 40 ? 'warning' : 'normal'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Check rate-limit headroom for accounts
 */
async function checkRateLimits(base44, user, payload) {
  try {
    const { platform } = payload;

    const accounts = await base44.asServiceRole.entities.LinkedAccount.filter(
      { platform, created_by: user.email },
      null,
      10
    ).catch(() => []);

    const limits = [];

    for (const account of accounts) {
      const daily_limit = account.daily_application_limit || 10;
      const applied_today = account.applications_today || 0;
      const headroom = daily_limit - applied_today;
      const headroom_pct = Math.round((headroom / daily_limit) * 100);

      limits.push({
        platform: account.platform,
        username: account.username,
        daily_limit,
        applied_today,
        headroom,
        headroom_pct,
        status: headroom_pct >= 50 ? 'available' : headroom_pct > 0 ? 'limited' : 'exhausted',
        can_execute: headroom > 0
      });
    }

    const available = limits.filter(l => l.can_execute).length;
    const exhausted = limits.filter(l => !l.can_execute).length;

    return Response.json({
      success: true,
      platform,
      summary: { total: limits.length, available, exhausted },
      limits
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Audit compliance: tax, KYC, regulatory
 */
async function auditCompliance(base44, user) {
  try {
    // Check 1: Tax withholding
    const transactions = await base44.asServiceRole.entities.Transaction.filter(
      { type: 'income', created_date: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() } },
      null,
      1000
    ).catch(() => []);

    const totalIncome = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalWithheld = transactions.reduce((sum, t) => sum + (t.tax_withheld || 0), 0);
    const withholding_rate = totalIncome > 0 ? (totalWithheld / totalIncome * 100).toFixed(1) : 0;

    // Check 2: KYC status
    const identities = await base44.asServiceRole.entities.AIIdentity.filter(
      { created_by: user.email },
      null,
      100
    ).catch(() => []);

    const kyc_verified = identities.filter(i => i.kyc_verified_data?.kyc_tier && i.kyc_verified_data.kyc_tier !== 'none').length;
    const kyc_coverage_pct = Math.round((kyc_verified / Math.max(1, identities.length)) * 100);

    // Check 3: Credential freshness
    const credentials = await base44.asServiceRole.entities.CredentialVault.filter(
      { created_by: user.email },
      null,
      1000
    ).catch(() => []);

    const stale_credentials = credentials.filter(c => {
      if (!c.last_accessed) return false;
      const days_since_access = (Date.now() - new Date(c.last_accessed).getTime()) / (24 * 60 * 60 * 1000);
      return days_since_access > 30;
    }).length;

    const issues = [];
    if (withholding_rate < 15) issues.push(`Tax withholding low: ${withholding_rate}% (recommend 20%)`);
    if (kyc_coverage_pct < 80) issues.push(`KYC coverage: ${kyc_coverage_pct}% (recommend 100%)`);
    if (stale_credentials > 0) issues.push(`${stale_credentials} credentials not accessed in 30+ days`);

    return Response.json({
      success: true,
      compliance: {
        tax_withholding: { rate_pct: parseFloat(withholding_rate), total_income: totalIncome, total_withheld: totalWithheld },
        kyc: { verified: kyc_verified, total: identities.length, coverage_pct: kyc_coverage_pct },
        credentials: { total: credentials.length, stale: stale_credentials, fresh_pct: Math.round(((credentials.length - stale_credentials) / Math.max(1, credentials.length)) * 100) }
      },
      issues,
      compliance_score: 100 - (issues.length * 20)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get unified risk profile
 */
async function getRiskProfile(base44, user) {
  try {
    const health = await scanAccountHealth(base44, user, {});
    const fraud = await detectFraudSignals(base44, user);
    const compliance = await auditCompliance(base44, user);

    const weighted_risk = (
      (health.data?.health?.critical || 0) * 40 +
      (fraud.data?.fraud_score || 0) * 30 +
      Math.max(0, 100 - (compliance.data?.compliance_score || 0)) * 30
    ) / 100;

    const risk_level = weighted_risk > 70 ? 'critical' : weighted_risk > 50 ? 'high' : weighted_risk > 30 ? 'medium' : 'low';

    return Response.json({
      success: true,
      risk_profile: {
        overall_risk_score: Math.round(weighted_risk),
        risk_level,
        can_execute: risk_level !== 'critical',
        components: {
          account_health: health.data?.health,
          fraud_risk: fraud.data?.risk_level,
          compliance_score: compliance.data?.compliance_score
        }
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}