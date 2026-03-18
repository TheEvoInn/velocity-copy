import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Orchestrate autonomous profit generation across all modules
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action } = await req.json();

    // ── pre_flight_check ────────────────────────────────────────────────────────
    if (action === 'pre_flight_check') {
      const checks = {
        identities: false,
        active_identity: false,
        accounts: false,
        credentials: false,
        vault: false,
        ready_to_autopilot: false,
        issues: []
      };

      // Check identities
      const identities = await base44.asServiceRole.entities.AIIdentity.list();
      checks.identities = identities.length > 0;
      if (!checks.identities) checks.issues.push('No identities created');

      // Check active identity
      const activeIdentity = identities.find(i => i.is_active);
      checks.active_identity = !!activeIdentity;
      if (!checks.active_identity) checks.issues.push('No active identity selected');

      // Check accounts
      const accounts = await base44.asServiceRole.entities.LinkedAccountCreation.list();
      checks.accounts = accounts.length > 0;
      if (!checks.accounts) checks.issues.push('No accounts linked. Will auto-create on demand.');

      // Check credentials
      const creds = await base44.asServiceRole.entities.CredentialVault.filter({ is_active: true });
      checks.credentials = creds.length > 0;
      if (!checks.credentials) checks.issues.push('No credentials stored. Will generate on account creation.');

      // Determine readiness
      checks.ready_to_autopilot = checks.identities && checks.active_identity;

      return Response.json({
        success: true,
        checks,
        readiness_score: `${Math.round((Object.values(checks).filter(v => typeof v === 'boolean' && v).length / 5) * 100)}%`
      });
    }

    // ── ensure_identity ─────────────────────────────────────────────────────────
    if (action === 'ensure_identity') {
      let activeIdentity = null;

      // Try to get active identity
      const identities = await base44.asServiceRole.entities.AIIdentity.filter({ is_active: true });
      if (identities.length) {
        activeIdentity = identities[0];
      } else {
        // No active identity, find first or create default
        const allIdentities = await base44.asServiceRole.entities.AIIdentity.list();
        if (allIdentities.length) {
          activeIdentity = await base44.asServiceRole.entities.AIIdentity.update(allIdentities[0].id, { is_active: true });
        } else {
          // Create default identity
          activeIdentity = await base44.asServiceRole.entities.AIIdentity.create({
            name: 'Default Autopilot',
            role_label: 'Freelancer',
            email: user.email,
            is_active: true,
            skills: ['general', 'problem-solving', 'communication'],
            bio: 'Autonomous agent optimized for profit generation',
            tagline: 'Delivering results 24/7',
            communication_tone: 'professional'
          });

          await base44.asServiceRole.entities.ActivityLog.create({
            action_type: 'system',
            message: '🤖 Default identity auto-created for Autopilot',
            severity: 'info',
            metadata: { identity_id: activeIdentity.id }
          });
        }
      }

      return Response.json({
        success: true,
        identity: activeIdentity,
        message: activeIdentity.is_active ? 'Ready' : 'Activated'
      });
    }

    // ── ensure_account ──────────────────────────────────────────────────────────
    if (action === 'ensure_account') {
      const { platform, for_identity_id } = await req.json();

      // Get identity
      let identityId = for_identity_id;
      if (!identityId) {
        const active = await base44.asServiceRole.entities.AIIdentity.filter({ is_active: true });
        identityId = active[0]?.id;
      }

      if (!identityId) {
        return Response.json({
          success: false,
          error: 'No active identity. Run ensure_identity first.'
        });
      }

      // Check if account exists
      const existing = await base44.asServiceRole.entities.LinkedAccountCreation.filter({
        platform,
        identity_id: identityId,
        account_status: { $ne: 'banned' }
      });

      if (existing.length && existing[0].onboarding_completed) {
        return Response.json({
          success: true,
          account: existing[0],
          exists: true
        });
      }

      // Auto-create account
      const result = await base44.asServiceRole.functions.invoke('accountCreationEngine', {
        action: 'check_and_create_account',
        platform,
        identity_id: identityId,
        on_demand: true
      });

      return Response.json({
        success: result.data?.success,
        account: result.data?.account,
        created: result.data?.created,
        message: result.data?.message
      });
    }

    // ── full_autopilot_cycle ────────────────────────────────────────────────────
    if (action === 'full_autopilot_cycle') {
      const cycleResults = {
        timestamp: new Date().toISOString(),
        preflight: null,
        identity_ready: null,
        opportunities_found: 0,
        accounts_ensured: 0,
        tasks_executed: 0,
        earnings_generated: 0,
        errors: []
      };

      try {
        // 1. Pre-flight check
        const preflightRes = await base44.asServiceRole.functions.invoke('autopilotOrchestrator', {
          action: 'pre_flight_check'
        });
        cycleResults.preflight = preflightRes.data;

        if (!cycleResults.preflight.ready_to_autopilot) {
          // 2. Ensure identity
          const identityRes = await base44.asServiceRole.functions.invoke('autopilotOrchestrator', {
            action: 'ensure_identity'
          });
          cycleResults.identity_ready = identityRes.data?.identity;
        }

        // 3. Run opportunity scanning
        const scanRes = await base44.asServiceRole.functions.invoke('scanOpportunities', {
          action: 'scan',
          max_results: 10
        });
        cycleResults.opportunities_found = scanRes.data?.opportunities?.length || 0;

        // 4. Ensure accounts for discovered opportunities
        const opportunities = scanRes.data?.opportunities || [];
        const platformsNeeded = [...new Set(opportunities.map(o => o.platform || 'upwork'))];

        for (const platform of platformsNeeded) {
          const accountRes = await base44.asServiceRole.functions.invoke('autopilotOrchestrator', {
            action: 'ensure_account',
            platform
          });
          if (accountRes.data?.success) {
            cycleResults.accounts_ensured++;
          }
        }

        // 5. Run monitoring cycle
        const monitorRes = await base44.asServiceRole.functions.invoke('automatedPrizeMonitoring', {
          action: 'run_monitoring_cycle'
        });
        if (monitorRes.data?.cycle_completed) {
          cycleResults.earnings_generated += monitorRes.data?.results?.auto_claims_executed || 0;
        }

        // 6. Run account health check
        await base44.asServiceRole.functions.invoke('accountHealthMonitor', {
          action: 'check_all_account_health'
        });

      } catch (error) {
        cycleResults.errors.push(error.message);
      }

      // Log cycle
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'scan',
        message: `🤖 Autopilot cycle: ${cycleResults.opportunities_found} opportunities, ${cycleResults.accounts_ensured} accounts ensured, ${cycleResults.earnings_generated} actions completed`,
        severity: cycleResults.errors.length > 0 ? 'warning' : 'success',
        metadata: cycleResults
      });

      return Response.json({
        success: true,
        cycle: cycleResults
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});