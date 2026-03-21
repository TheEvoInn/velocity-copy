import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Autopilot Diagnostics & Repair
 * Runs daily to detect and fix broken activation chains, missing triggers,
 * stale states, or other issues preventing Autopilot from functioning
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const diagnostics = {
      timestamp: new Date().toISOString(),
      checks: [],
      repairs: [],
      issues_found: 0,
      issues_fixed: 0
    };

    // ━━━━ CHECK 1: User Goals Configuration ━━━━
    const userGoals = (await base44.asServiceRole.entities.UserGoals.filter({}))[0];
    
    if (!userGoals) {
      diagnostics.checks.push({
        check: 'user_goals_exists',
        status: 'failed',
        issue: 'No UserGoals record found'
      });
      diagnostics.issues_found++;
    } else {
      diagnostics.checks.push({
        check: 'user_goals_exists',
        status: 'ok',
        autopilot_enabled: userGoals.autopilot_enabled,
        onboarded: userGoals.onboarded
      });

      // Check if should be activated but isn't
      if (userGoals.autopilot_enabled && !userGoals.onboarded) {
        diagnostics.checks.push({
          check: 'onboarding_status',
          status: 'warning',
          issue: 'Autopilot enabled but onboarding incomplete'
        });
      }
    }

    // ━━━━ CHECK 2: KYC Verification ━━━━
    const kycs = await base44.asServiceRole.entities.KYCVerification.filter(
      { status: 'verified' },
      null,
      1
    );

    diagnostics.checks.push({
      check: 'kyc_verification',
      status: kycs.length > 0 ? 'ok' : 'warning',
      verified_count: kycs.length,
      issue: kycs.length === 0 ? 'No verified KYC found' : null
    });

    if (kycs.length === 0) {
      diagnostics.issues_found++;
    }

    // ━━━━ CHECK 3: Identity Setup ━━━━
    const activeIdentities = await base44.asServiceRole.entities.AIIdentity.filter(
      { is_active: true },
      null,
      1
    );

    diagnostics.checks.push({
      check: 'identity_active',
      status: activeIdentities.length > 0 ? 'ok' : 'warning',
      active_count: activeIdentities.length,
      issue: activeIdentities.length === 0 ? 'No active identity found' : null
    });

    if (activeIdentities.length === 0) {
      diagnostics.issues_found++;
    } else {
      // Verify identity has required fields
      const identity = activeIdentities[0];
      if (!identity.email || !identity.name) {
        diagnostics.checks.push({
          check: 'identity_completeness',
          status: 'failed',
          issue: `Identity missing required fields: ${!identity.email ? 'email' : ''} ${!identity.name ? 'name' : ''}`
        });
        diagnostics.issues_found++;
      } else {
        diagnostics.checks.push({
          check: 'identity_completeness',
          status: 'ok',
          identity_name: identity.name
        });
      }
    }

    // ━━━━ CHECK 4: Opportunity Queue ━━━━
    const queuedOpps = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
      { status: 'queued' },
      null,
      1
    );

    diagnostics.checks.push({
      check: 'execution_queue',
      status: queuedOpps.length > 0 ? 'ok' : 'warning',
      queued_tasks: queuedOpps.length,
      issue: queuedOpps.length === 0 ? 'No queued tasks found' : null
    });

    // ━━━━ CHECK 5: Platform State ━━━━
    const platformStates = await base44.asServiceRole.entities.PlatformState.filter({}, null, 1);
    
    if (platformStates.length === 0) {
      diagnostics.checks.push({
        check: 'platform_state',
        status: 'warning',
        issue: 'No PlatformState record found — initializing'
      });

      // Repair: Create platform state
      await base44.asServiceRole.entities.PlatformState.create({
        autopilot_enabled: userGoals?.autopilot_enabled || false,
        emergency_stop_engaged: false,
        system_health: 'initializing',
        current_queue_count: 0,
        cycle_count_today: 0,
        tasks_completed_today: 0,
        revenue_generated_today: 0
      });

      diagnostics.repairs.push({
        repair: 'platform_state_created',
        status: 'success'
      });
      diagnostics.issues_fixed++;
    } else {
      diagnostics.checks.push({
        check: 'platform_state',
        status: 'ok',
        autopilot_enabled: platformStates[0].autopilot_enabled
      });
    }

    // ━━━━ CHECK 6: Activity Logging ━━━━
    const recentLogs = await base44.asServiceRole.entities.ActivityLog.filter(
      {},
      '-created_date',
      5
    );

    diagnostics.checks.push({
      check: 'activity_logging',
      status: recentLogs.length > 0 ? 'ok' : 'warning',
      recent_logs: recentLogs.length,
      last_log_time: recentLogs[0]?.created_date || null
    });

    // ━━━━ CHECK 7: Execution History ━━━━
    const completedTasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
      { status: 'completed' },
      '-completion_timestamp',
      5
    );

    diagnostics.checks.push({
      check: 'execution_history',
      status: 'ok',
      completed_tasks_today: completedTasks.length,
      last_completion: completedTasks[0]?.completion_timestamp || null
    });

    // ━━━━ REPAIR TRIGGERS ━━━━

    // If autopilot is enabled and all conditions are met, ensure activation
    if (userGoals?.autopilot_enabled && kycs.length > 0 && activeIdentities.length > 0 && !userGoals.onboarded) {
      diagnostics.repairs.push({
        repair: 'triggering_autopilot_activation',
        status: 'in_progress'
      });

      try {
        await base44.asServiceRole.functions.invoke('autopilotActivationTrigger', {
          trigger_type: 'diagnostic_repair',
          kyc_id: kycs[0].id,
          identity_id: activeIdentities[0].id,
          force_immediate: true
        });

        diagnostics.repairs.push({
          repair: 'autopilot_activation',
          status: 'success'
        });
        diagnostics.issues_fixed++;
      } catch (e) {
        diagnostics.repairs.push({
          repair: 'autopilot_activation',
          status: 'failed',
          error: e.message
        });
      }
    }

    // If opportunities exist but queue is empty, populate queue
    if (queuedOpps.length === 0) {
      try {
        const newOpps = await base44.asServiceRole.entities.Opportunity.filter(
          { status: 'new', auto_execute: true },
          '-overall_score',
          10
        );

        if (newOpps.length > 0 && activeIdentities.length > 0) {
          diagnostics.repairs.push({
            repair: 'queue_population',
            status: 'in_progress',
            opportunities_to_queue: newOpps.length
          });

          let queued = 0;
          for (const opp of newOpps) {
            if (!opp.url) continue;

            await base44.asServiceRole.entities.TaskExecutionQueue.create({
              opportunity_id: opp.id,
              url: opp.url,
              opportunity_type: opp.opportunity_type || 'other',
              platform: opp.platform,
              identity_id: activeIdentities[0].id,
              status: 'queued',
              priority: 75,
              estimated_value: opp.profit_estimate_high || 0,
              deadline: opp.deadline,
              queue_timestamp: new Date().toISOString()
            });

            await base44.asServiceRole.entities.Opportunity.update(opp.id, {
              status: 'queued',
              task_execution_id: null,
              identity_id: activeIdentities[0].id
            });

            queued++;
          }

          diagnostics.repairs.push({
            repair: 'queue_population',
            status: 'success',
            tasks_queued: queued
          });
          diagnostics.issues_fixed++;
        }
      } catch (e) {
        diagnostics.repairs.push({
          repair: 'queue_population',
          status: 'failed',
          error: e.message
        });
      }
    }

    // Log diagnostics
    await base44.asServiceRole.entities.EngineAuditLog.create({
      event_type: 'autopilot_diagnostics_complete',
      module: 'autopilotDiagnosticsRepair',
      status: diagnostics.issues_found > 0 ? (diagnostics.issues_fixed > 0 ? 'warning' : 'critical') : 'healthy',
      details: diagnostics,
      actor: 'system',
      user_id: null
    });

    return Response.json({
      success: true,
      diagnostics
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});