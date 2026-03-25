import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * TIER 5 RISK MITIGATION ORCHESTRATOR
 * Master gatekeeper for Tier 4 execution
 * Validates risk profile before allowing autonomous profit cycle to proceed
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    if (action === 'gate_tier4_execution') return await gateTier4Execution(base44, user);
    if (action === 'resolve_risk_blocks') return await resolveRiskBlocks(base44, user, body);
    if (action === 'get_gate_status') return await getGateStatus(base44, user);

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[Tier5RiskMitigation]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Gate Tier 4 execution — verify risk profile before allowing cycle
 */
async function gateTier4Execution(base44, user) {
  try {
    const blocks = [];

    // ─── Check 1: Account Health ───────────────────────────────────────
    const healthResult = await base44.asServiceRole.functions.invoke(
      'advancedRiskManagementEngine',
      { action: 'scan_account_health' }
    ).catch(e => ({ error: e.message }));

    if (healthResult.data?.health?.critical > 0) {
      blocks.push({
        block_type: 'account_health',
        severity: 'critical',
        message: `${healthResult.data.health.critical} accounts in critical state`,
        resolution: 'Monitor account health and resolve cooldowns or suspensions'
      });
    }

    // ─── Check 2: Fraud Risk ──────────────────────────────────────────
    const fraudResult = await base44.asServiceRole.functions.invoke(
      'advancedRiskManagementEngine',
      { action: 'detect_fraud_signals' }
    ).catch(e => ({ error: e.message }));

    if (fraudResult.data?.risk_level === 'critical') {
      blocks.push({
        block_type: 'fraud_risk',
        severity: 'critical',
        message: `Fraud risk score ${fraudResult.data.fraud_score}/100`,
        resolution: 'Pause execution and investigate fraud signals'
      });
    }

    // ─── Check 3: Credential Health ───────────────────────────────────
    const credentials = await base44.asServiceRole.entities.CredentialVault.filter(
      { created_by: user.email, is_active: true },
      null,
      1000
    ).catch(() => []);

    const expired = credentials.filter(c => c.expires_at && new Date(c.expires_at) < new Date()).length;
    if (expired > 0) {
      blocks.push({
        block_type: 'expired_credentials',
        severity: 'warning',
        message: `${expired} credentials expired`,
        resolution: 'Rotate or refresh expired credentials'
      });
    }

    // ─── Check 4: Compliance ──────────────────────────────────────────
    const complianceResult = await base44.asServiceRole.functions.invoke(
      'advancedRiskManagementEngine',
      { action: 'audit_compliance' }
    ).catch(e => ({ error: e.message }));

    if ((complianceResult.data?.compliance_score || 0) < 60) {
      blocks.push({
        block_type: 'compliance_issues',
        severity: 'warning',
        message: `Compliance score ${complianceResult.data?.compliance_score}/100`,
        resolution: complianceResult.data?.issues?.join('; ') || 'Address compliance issues'
      });
    }

    // ─── Check 5: Identity Readiness ──────────────────────────────────
    const identities = await base44.asServiceRole.entities.AIIdentity.filter(
      { created_by: user.email, is_active: true },
      null,
      100
    ).catch(() => []);

    const ready_identities = identities.filter(i => i.onboarding_complete && i.kyc_verified_data?.autopilot_clearance?.can_submit_grant_applications).length;
    if (ready_identities === 0) {
      blocks.push({
        block_type: 'no_ready_identities',
        severity: 'critical',
        message: 'No identities ready for autonomous execution',
        resolution: 'Complete onboarding and KYC for at least one identity'
      });
    }

    // ─── Verdict ──────────────────────────────────────────────────────
    const canExecute = blocks.filter(b => b.severity === 'critical').length === 0;

    if (!canExecute) {
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'alert',
        message: `🚫 Tier 4 Blocked: ${blocks.length} risk blocks detected`,
        severity: 'critical',
        metadata: { blocks }
      }).catch(() => null);
    }

    return Response.json({
      success: canExecute,
      can_execute: canExecute,
      blocks,
      message: canExecute
        ? 'All risk checks passed. Tier 4 execution approved.'
        : `Tier 4 execution blocked: ${blocks.filter(b => b.severity === 'critical').length} critical blocks`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get current gate status without execution
 */
async function getGateStatus(base44, user) {
  try {
    const result = await gateTier4Execution(base44, user);
    return result;
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Attempt to resolve risk blocks
 */
async function resolveRiskBlocks(base44, user, payload) {
  const { block_type } = payload;

  try {
    const resolutions = {
      account_health: async () => {
        const accounts = await base44.asServiceRole.entities.LinkedAccount.filter(
          { created_by: user.email, health_status: 'critical' },
          null,
          10
        ).catch(() => []);

        // Create intervention for each critical account
        for (const account of accounts) {
          await base44.asServiceRole.entities.UserIntervention.create({
            user_email: user.email,
            task_id: `health_check_${account.id}`,
            requirement_type: 'manual_review',
            required_data: `Review account ${account.username} on ${account.platform}. Status: ${account.health_status}`,
            status: 'pending',
            priority: 95
          }).catch(() => null);
        }

        return { success: true, message: `Created ${accounts.length} intervention(s) for critical accounts` };
      },
      
      expired_credentials: async () => {
        const creds = await base44.asServiceRole.entities.CredentialVault.filter(
          { created_by: user.email, expires_at: { $lt: new Date().toISOString() } },
          null,
          100
        ).catch(() => []);

        // Mark stale credentials as inactive
        for (const cred of creds) {
          await base44.asServiceRole.entities.CredentialVault.update(cred.id, {
            is_active: false
          }).catch(() => null);
        }

        return { success: true, message: `Deactivated ${creds.length} expired credential(s)` };
      },

      no_ready_identities: async () => {
        return {
          success: false,
          message: 'Manual intervention required: Complete identity onboarding in dashboard'
        };
      },

      fraud_risk: async () => {
        const tasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
          { created_by: user.email, status: 'queued' },
          null,
          1000
        ).catch(() => []);

        let paused = 0;
        for (const task of tasks.slice(0, 20)) {
          await base44.asServiceRole.entities.TaskExecutionQueue.update(task.id, {
            status: 'paused'
          }).catch(() => null);
          paused++;
        }

        return { success: true, message: `Paused ${paused} queued task(s) pending fraud review` };
      }
    };

    const resolution = resolutions[block_type];
    if (!resolution) {
      return Response.json({ error: 'Unknown block type' }, { status: 400 });
    }

    const result = await resolution();

    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `✅ Risk Resolution: ${block_type} - ${result.message}`,
      severity: 'info',
      metadata: { block_type, resolution_result: result }
    }).catch(() => null);

    return Response.json({ success: true, ...result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}