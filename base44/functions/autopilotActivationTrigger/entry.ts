import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Autopilot Activation Trigger
 * Fires immediately when user completes setup:
 * KYC approved → Identity selected → Autopilot toggle ON
 * 
 * This is the critical missing link that triggers:
 * 1. Opportunity ingestion
 * 2. Identity routing initialization
 * 3. Execution engine wake-up
 * 4. First automated cycle
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const { trigger_type, kyc_id, identity_id, force_immediate } = payload;

    // Fetch user goals to check setup status
    const userGoals = (await base44.entities.UserGoals.filter({ created_by: user.email }))[0];
    if (!userGoals) {
      return Response.json({ error: 'User goals not configured' }, { status: 400 });
    }

    // Verify KYC is approved
    let kycVerified = false;
    if (kyc_id) {
      const kyc = (await base44.asServiceRole.entities.KYCVerification.filter({ id: kyc_id }))[0];
      kycVerified = kyc?.status === 'verified' || kyc?.admin_status === 'approved';
    } else {
      const kycRecords = await base44.asServiceRole.entities.KYCVerification.filter({
        created_by: user.email,
        status: 'verified'
      });
      kycVerified = kycRecords.length > 0;
    }

    // Verify identity is selected
    let activeIdentity = null;
    if (identity_id) {
      activeIdentity = (await base44.asServiceRole.entities.AIIdentity.filter({ id: identity_id }))[0];
    } else {
      const identities = await base44.asServiceRole.entities.AIIdentity.filter({
        created_by: user.email,
        is_active: true
      });
      activeIdentity = identities[0];
    }

    // Check all conditions
    const allConditionsMet = kycVerified && activeIdentity && userGoals.autopilot_enabled;

    // Log activation attempt
    await base44.asServiceRole.entities.EngineAuditLog.create({
      event_type: 'autopilot_activation_attempt',
      module: 'autopilotActivationTrigger',
      status: allConditionsMet ? 'success' : 'incomplete',
      details: {
        kyc_verified: kycVerified,
        identity_active: !!activeIdentity,
        autopilot_enabled: userGoals.autopilot_enabled,
        trigger_type
      },
      actor: user.email,
      user_id: user.id
    });

    if (!allConditionsMet) {
      return Response.json({
        success: false,
        message: 'Autopilot activation prerequisites not met',
        checks: {
          kyc_verified: kycVerified,
          identity_selected: !!activeIdentity,
          autopilot_enabled: userGoals.autopilot_enabled
        }
      });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ALL CONDITIONS MET — START ACTIVATION SEQUENCE
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    const activationLog = {
      timestamp: new Date().toISOString(),
      user_email: user.email,
      identity_id: activeIdentity.id,
      identity_name: activeIdentity.name,
      steps: []
    };

    try {
      // Step 1: Initialize PlatformState if needed
      const states = await base44.asServiceRole.entities.PlatformState.filter({});
      let platformState = states[0];

      if (!platformState) {
        platformState = await base44.asServiceRole.entities.PlatformState.create({
          autopilot_enabled: true,
          emergency_stop_engaged: false,
          system_health: 'initializing',
          current_queue_count: 0,
          cycle_count_today: 0,
          tasks_completed_today: 0,
          revenue_generated_today: 0
        });
      } else {
        await base44.asServiceRole.entities.PlatformState.update(platformState.id, {
          autopilot_enabled: true,
          emergency_stop_engaged: false,
          system_health: 'initializing'
        });
      }

      activationLog.steps.push({
        step: 'platform_state_initialized',
        status: 'success',
        timestamp: new Date().toISOString()
      });

      // Step 2: Mark identity as active (ensure only one active)
      const otherIdentities = await base44.asServiceRole.entities.AIIdentity.filter({
        created_by: user.email,
        is_active: true,
        id: { $ne: activeIdentity.id }
      });

      for (const id of otherIdentities) {
        await base44.asServiceRole.entities.AIIdentity.update(id.id, { is_active: false });
      }

      if (!activeIdentity.is_active) {
        await base44.asServiceRole.entities.AIIdentity.update(activeIdentity.id, {
          is_active: true,
          last_used_at: new Date().toISOString()
        });
      }

      activationLog.steps.push({
        step: 'identity_activated',
        status: 'success',
        identity_id: activeIdentity.id,
        timestamp: new Date().toISOString()
      });

      // Step 3: Trigger immediate opportunity ingestion
      try {
        const ingestRes = await base44.asServiceRole.functions.invoke('scanOpportunities', {
          sources: ['ai_web', 'rapidapi', 'n8n'],
          force_scan: true,
          identity_id: activeIdentity.id
        });

        const opportunitiesFound = ingestRes.data?.opportunities_found || 0;
        activationLog.steps.push({
          step: 'opportunity_scan',
          status: ingestRes.data?.success ? 'success' : 'warning',
          opportunities_found: opportunitiesFound,
          timestamp: new Date().toISOString()
        });
      } catch (e) {
        activationLog.steps.push({
          step: 'opportunity_scan',
          status: 'error',
          error: e.message,
          timestamp: new Date().toISOString()
        });
      }

      // Step 4: Initialize identity routing
      try {
        await base44.asServiceRole.functions.invoke('intelligentIdentityRouter', {
          action: 'initialize_routing',
          primary_identity_id: activeIdentity.id
        });

        activationLog.steps.push({
          step: 'identity_routing_initialized',
          status: 'success',
          timestamp: new Date().toISOString()
        });
      } catch (e) {
        activationLog.steps.push({
          step: 'identity_routing_initialized',
          status: 'error',
          error: e.message,
          timestamp: new Date().toISOString()
        });
      }

      // Step 5: Queue high-value opportunities for immediate execution
      try {
        const newOpps = await base44.asServiceRole.entities.Opportunity.filter(
          { status: 'new', auto_execute: true },
          '-overall_score',
          10
        );

        let queued = 0;
        for (const opp of newOpps) {
          if (!opp.url) continue;

          const task = await base44.asServiceRole.entities.TaskExecutionQueue.create({
            opportunity_id: opp.id,
            url: opp.url,
            opportunity_type: opp.opportunity_type || 'other',
            platform: opp.platform,
            identity_id: activeIdentity.id,
            status: 'queued',
            priority: calculatePriority(opp),
            estimated_value: opp.profit_estimate_high || 0,
            deadline: opp.deadline,
            queue_timestamp: new Date().toISOString()
          });

          await base44.asServiceRole.entities.Opportunity.update(opp.id, {
            status: 'queued',
            task_execution_id: task.id,
            identity_id: activeIdentity.id
          });

          queued++;
        }

        activationLog.steps.push({
          step: 'initial_queue_population',
          status: 'success',
          tasks_queued: queued,
          timestamp: new Date().toISOString()
        });
      } catch (e) {
        activationLog.steps.push({
          step: 'initial_queue_population',
          status: 'error',
          error: e.message,
          timestamp: new Date().toISOString()
        });
      }

      // Step 6: Execute first cycle immediately
      try {
        const cycleRes = await base44.asServiceRole.functions.invoke('unifiedAutopilot', {
          action: 'autopilot_full_cycle'
        });

        activationLog.steps.push({
          step: 'first_cycle_executed',
          status: cycleRes.data?.success ? 'success' : 'warning',
          cycle_data: cycleRes.data?.cycle,
          timestamp: new Date().toISOString()
        });
      } catch (e) {
        activationLog.steps.push({
          step: 'first_cycle_executed',
          status: 'error',
          error: e.message,
          timestamp: new Date().toISOString()
        });
      }

      // Step 7: Update UserGoals to mark onboarded
      await base44.entities.UserGoals.update(userGoals.id, {
        onboarded: true,
        autopilot_enabled: true
      });

      activationLog.steps.push({
        step: 'user_goals_updated',
        status: 'success',
        timestamp: new Date().toISOString()
      });

      // Step 8: Log successful activation
      await base44.asServiceRole.entities.EngineAuditLog.create({
        event_type: 'autopilot_activation_complete',
        module: 'autopilotActivationTrigger',
        status: 'success',
        details: activationLog,
        actor: user.email,
        user_id: user.id
      });

      // Step 9: Create notification
      await base44.asServiceRole.entities.Notification.create({
        type: 'system_alert',
        severity: 'info',
        title: '🚀 Autopilot Activated',
        message: `Autopilot is now running with identity: ${activeIdentity.name}. Scanning opportunities and executing tasks...`,
        icon: 'Zap',
        color: 'cyan',
        delivery_channels: ['in_app', 'email'],
        source_module: 'autopilot'
      });

      return Response.json({
        success: true,
        message: 'Autopilot activation complete',
        activation_log: activationLog,
        identity: {
          id: activeIdentity.id,
          name: activeIdentity.name
        }
      });

    } catch (error) {
      // Log activation failure
      await base44.asServiceRole.entities.EngineAuditLog.create({
        event_type: 'autopilot_activation_failed',
        module: 'autopilotActivationTrigger',
        status: 'error',
        details: {
          error_message: error.message,
          activation_log: activationLog
        },
        actor: user.email,
        user_id: user.id
      });

      return Response.json({
        success: false,
        error: error.message,
        partial_activation: activationLog
      }, { status: 500 });
    }

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function calculatePriority(opportunity) {
  let score = 50;
  if (opportunity.time_sensitivity === 'immediate') score += 30;
  else if (opportunity.time_sensitivity === 'hours') score += 20;
  const estValue = opportunity.profit_estimate_high || opportunity.profit_estimate_low || 0;
  if (estValue > 1000) score += 25;
  else if (estValue > 500) score += 15;
  if (opportunity.velocity_score > 75 && opportunity.risk_score < 50) score += 10;
  return Math.min(100, Math.max(0, score));
}