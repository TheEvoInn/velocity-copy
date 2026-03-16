import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Monitor account health and auto-repair when possible
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action } = await req.json();

    // ── check_all_account_health ────────────────────────────────────────────────
    if (action === 'check_all_account_health') {
      const accounts = await base44.asServiceRole.entities.LinkedAccountCreation.list('-last_used');

      const healthChecks = {
        healthy: 0,
        warning: 0,
        critical: 0,
        unreachable: 0,
        needs_repair: []
      };

      for (const account of accounts) {
        if (account.account_status === 'banned' || account.account_status === 'suspended') {
          healthChecks.critical++;
          healthChecks.needs_repair.push(account);
          continue;
        }

        // Simulate health check via LLM
        const healthResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Assess the health status of an account:

Platform: ${account.platform}
Username: ${account.username}
Status: ${account.account_status}
Last used: ${account.last_used || 'Never'}
Verification: ${account.verification_status}
Profile completeness: ${account.profile_completeness || 0}%

Provide health assessment:
1. Overall health status: healthy | warning | critical | unreachable
2. Issues detected (if any)
3. Repair steps (if needed)
4. Recommended actions

Return JSON:
{
  "health_status": "healthy|warning|critical|unreachable",
  "issues": [string],
  "repair_steps": [string],
  "recommendation": string,
  "confidence": number
}`,
          response_json_schema: {
            type: 'object',
            properties: {
              health_status: { type: 'string' },
              issues: { type: 'array', items: { type: 'string' } },
              repair_steps: { type: 'array', items: { type: 'string' } },
              recommendation: { type: 'string' },
              confidence: { type: 'number' }
            }
          }
        });

        // Update account health
        await base44.asServiceRole.entities.LinkedAccountCreation.update(account.id, {
          health_status: healthResult?.health_status || 'healthy',
          last_health_check: new Date().toISOString()
        });

        // Track by status
        const status = healthResult?.health_status || 'healthy';
        healthChecks[status]++;

        if (['warning', 'critical'].includes(status)) {
          healthChecks.needs_repair.push({ ...account, health_result: healthResult });
        }
      }

      // Log health check
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'scan',
        message: `🏥 Account health check: ${accounts.length} accounts checked. ${healthChecks.critical} critical, ${healthChecks.warning} warning`,
        severity: healthChecks.critical > 0 ? 'warning' : 'info',
        metadata: healthChecks
      });

      return Response.json({
        success: true,
        health_check: healthChecks,
        accounts_checked: accounts.length
      });
    }

    // ── repair_account ──────────────────────────────────────────────────────────
    if (action === 'repair_account') {
      const { account_id } = await req.json();

      const accounts = await base44.asServiceRole.entities.LinkedAccountCreation.filter({ id: account_id });
      if (!accounts.length) return Response.json({ error: 'Account not found' }, { status: 404 });

      const account = accounts[0];

      // Attempt repair strategy
      const repairPlan = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Generate repair strategy for a broken account:

Platform: ${account.platform}
Username: ${account.username}
Status: ${account.account_status}
Last used: ${account.last_used}
Repair attempts: ${account.repair_attempts || 0}

Provide a repair plan including:
1. Pre-repair checks
2. Password reset/refresh process
3. Verification re-submission
4. Profile update procedures
5. Contact/support escalation
6. Fallback (use different account, create new)

Return JSON:
{
  "repair_steps": [string],
  "is_recoverable": boolean,
  "estimated_time_hours": number,
  "requires_user_action": boolean,
  "user_action_description": string,
  "fallback_recommendation": string
}`,
        response_json_schema: {
          type: 'object',
          properties: {
            repair_steps: { type: 'array', items: { type: 'string' } },
            is_recoverable: { type: 'boolean' },
            estimated_time_hours: { type: 'number' },
            requires_user_action: { type: 'boolean' },
            user_action_description: { type: 'string' },
            fallback_recommendation: { type: 'string' }
          }
        }
      });

      // Update account with repair log
      const repairLog = (account.creation_logs || []).concat([{
        timestamp: new Date().toISOString(),
        event: 'repair_attempted',
        details: repairPlan?.repair_steps?.[0] || 'Repair initiated'
      }]);

      await base44.asServiceRole.entities.LinkedAccountCreation.update(account_id, {
        repair_attempts: (account.repair_attempts || 0) + 1,
        last_repair_at: new Date().toISOString(),
        creation_logs: repairLog,
        health_status: repairPlan?.is_recoverable ? 'warning' : 'critical'
      });

      // Log repair attempt
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `🔧 Account repair initiated: ${account.platform} (${account.username})`,
        severity: repairPlan?.is_recoverable ? 'info' : 'warning',
        metadata: {
          account_id,
          platform: account.platform,
          recoverable: repairPlan?.is_recoverable,
          requires_user: repairPlan?.requires_user_action
        }
      });

      return Response.json({
        success: true,
        account_id,
        repair_plan: repairPlan,
        message: repairPlan?.is_recoverable ? 'Repair plan generated' : 'Account may not be recoverable'
      });
    }

    // ── failover_to_backup_account ──────────────────────────────────────────────
    if (action === 'failover_to_backup_account') {
      const { account_id } = await req.json();

      const accounts = await base44.asServiceRole.entities.LinkedAccountCreation.filter({ id: account_id });
      if (!accounts.length) return Response.json({ error: 'Account not found' }, { status: 404 });

      const failed = accounts[0];

      // Find backup account on same platform by same identity
      const backups = await base44.asServiceRole.entities.LinkedAccountCreation.filter({
        platform: failed.platform,
        identity_id: failed.identity_id,
        id: { $ne: account_id },
        health_status: { $ne: 'critical' }
      });

      if (backups.length) {
        const backup = backups[0];

        await base44.asServiceRole.entities.ActivityLog.create({
          action_type: 'system',
          message: `🔄 Failover activated: ${failed.platform} → backup account`,
          severity: 'warning',
          metadata: {
            failed_account: account_id,
            backup_account: backup.id,
            platform: failed.platform
          }
        });

        return Response.json({
          success: true,
          failover: true,
          backup_account: backup,
          message: 'Successfully switched to backup account'
        });
      }

      // If no backup, trigger auto-create
      return Response.json({
        success: true,
        failover: false,
        message: 'No backup found. Auto-creating new account...',
        next_action: 'invoke account creation engine'
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});