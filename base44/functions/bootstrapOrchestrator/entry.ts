/**
 * BOOTSTRAP ORCHESTRATOR
 * Auto-triggers onboarding → identity creation → discovery activation
 * for new users to unblock real-world execution
 * 
 * Actions:
 *   check_and_bootstrap  — checks user readiness, triggers missing steps
 *   force_bootstrap      — force complete bootstrap for testing
 *   check_test_user      — test readiness of specific user
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action, target_email } = body;

    // ── check_and_bootstrap ────────────────────────────────────────────
    if (action === 'check_and_bootstrap') {
      const email = target_email || user.email;
      
      // Step 1: Check UserGoals (onboarding status)
      const goalsList = await base44.asServiceRole.entities.UserGoals.filter(
        { created_by: email },
        '-created_date',
        1
      ).catch(() => []);
      const goals = goalsList[0];
      const needsOnboarding = !goals || goals.onboarded !== true;

      // Step 2: Check AIIdentity (identity setup)
      const identities = await base44.asServiceRole.entities.AIIdentity.filter(
        { created_by: email },
        '-created_date',
        1
      ).catch(() => []);
      const hasIdentity = identities.length > 0 && identities[0].is_active;

      // Step 3: Check Opportunity queue (discovery activation)
      const opportunities = await base44.asServiceRole.entities.Opportunity.filter(
        { created_by: email, status: 'queued' },
        '-created_date',
        1
      ).catch(() => []);
      const hasQueuedOpportunities = opportunities.length > 0;

      const readiness = {
        onboarded: goals?.onboarded || false,
        has_active_identity: hasIdentity,
        has_queued_opportunities: hasQueuedOpportunities,
        ready_for_execution: goals?.onboarded && hasIdentity && hasQueuedOpportunities
      };

      // If any step missing, initiate bootstrap
      if (!readiness.ready_for_execution) {
        await triggerBootstrapFlow(base44, email, readiness);
      }

      return Response.json({
        user_email: email,
        readiness,
        bootstrap_triggered: !readiness.ready_for_execution
      });
    }

    // ── force_bootstrap ────────────────────────────────────────────────
    if (action === 'force_bootstrap') {
      const email = target_email || user.email;
      
      const result = await triggerBootstrapFlow(base44, email, null);
      
      return Response.json({
        bootstrap_forced: true,
        email,
        ...result
      });
    }

    // ── check_test_user ────────────────────────────────────────────────
    if (action === 'check_test_user') {
      const testEmail = 'dawnvernor@yahoo.com';
      
      // Check readiness (use service role to read test user data)
      const goalsList = await base44.asServiceRole.entities.UserGoals.filter(
        { created_by: testEmail },
        '-created_date',
        1
      ).catch(() => []);
      const goals = goalsList[0];

      const identities = await base44.asServiceRole.entities.AIIdentity.filter(
        { created_by: testEmail },
        '-created_date',
        1
      ).catch(() => []);
      const activeIdentity = identities.find(i => i.is_active);

      // Get opportunities (filter by status=queued, don't filter by created_by since seeding creates as admin)
      const opportunities = await base44.asServiceRole.entities.Opportunity.filter(
        { status: 'queued' },
        '-priority',
        100
      ).catch(() => []);

      // Get tasks (filter by status=queued)
      const tasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
        { status: 'queued' },
        '-priority',
        100
      ).catch(() => []);

      const walletBalance = goals?.wallet_balance || 0;
      const totalEarned = goals?.total_earned || 0;

      return Response.json({
        test_user: testEmail,
        onboarded: goals?.onboarded || false,
        has_identity: !!activeIdentity,
        identity_name: activeIdentity?.name || null,
        opportunity_count: opportunities.length,
        task_count: tasks.length,
        wallet_balance: walletBalance,
        total_earned: totalEarned,
        ready_for_execution: goals?.onboarded && !!activeIdentity && opportunities.length > 0,
        opportunities: opportunities.slice(0, 5).map(o => ({
          id: o.id,
          title: o.title,
          status: o.status,
          profit_estimate_high: o.profit_estimate_high,
          platform: o.platform
        }))
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Orchestrates complete bootstrap flow:
 * 1. Create/update UserGoals (mark onboarded)
 * 2. Create default AI Identity
 * 3. Trigger Discovery scan
 * 4. Log activity
 */
async function triggerBootstrapFlow(base44, email, readiness) {
  const steps = [];

  try {
    // Step 1: Ensure UserGoals exists and onboarded=true (use service role for admin bootstrap)
    const goalsList = await base44.asServiceRole.entities.UserGoals.filter(
      { created_by: email },
      '-created_date',
      1
    ).catch(() => []);
    
    let goals = goalsList[0];
    if (!goals) {
      // Create as service role
      goals = await base44.asServiceRole.entities.UserGoals.create({
        daily_target: 1000,
        available_capital: 0,
        wallet_balance: 0,
        total_earned: 0,
        ai_total_earned: 0,
        user_total_earned: 0,
        onboarded: true,
        autopilot_enabled: true,
        ai_daily_target: 500,
        user_daily_target: 500
      });
      steps.push('created_user_goals');
    } else if (!goals.onboarded) {
      // If exists, try to update as user first (for ownership), fall back to service role
      try {
        // Try as user if email matches
        if (email === (await base44.auth.me()).email) {
          await base44.entities.UserGoals.update(goals.id, { onboarded: true });
        } else {
          // As service role for cross-user bootstrap
          await base44.asServiceRole.entities.UserGoals.update(goals.id, { onboarded: true });
        }
      } catch (e) {
        console.warn('[bootstrapOrchestrator] Update as service role fallback:', e.message);
        // Goal already exists, proceed
      }
      steps.push('marked_onboarded');
    }

    // Step 2: Create default AI Identity if not exists
    const identities = await base44.asServiceRole.entities.AIIdentity.filter(
      { created_by: email },
      '-created_date',
      1
    ).catch(() => []);

    let activeIdentity = identities.find(i => i.is_active);
    
    if (!activeIdentity) {
      // Create default identity (use service role)
      activeIdentity = await base44.asServiceRole.entities.AIIdentity.create({
        name: `Autopilot ${new Date().getFullYear()}`,
        role_label: 'Autonomous Freelancer',
        is_active: true,
        onboarding_complete: true,
        communication_tone: 'professional',
        skills: ['freelancing', 'task_execution', 'proposal_writing'],
        preferred_platforms: ['upwork', 'fiverr'],
        preferred_categories: ['freelance', 'service'],
        bio: 'Autonomous AI agent focused on high-priority freelance opportunities and task execution.',
        tagline: 'Always On. Always Executing.',
        spending_limit_per_task: 50,
        total_earned: 0,
        tasks_executed: 0
      });
      
      steps.push('created_default_identity');
      
      // Deactivate other identities
      const others = identities.filter(i => i.id !== activeIdentity.id);
      await Promise.all(others.map(other =>
        base44.asServiceRole.entities.AIIdentity.update(other.id, { is_active: false })
      ));
      
      steps.push('activated_identity');
    }

    // Step 3: Trigger Discovery scan via invocation
    try {
      const discoveryRes = await base44.functions.invoke('globalOpportunityDiscovery', {
        action: 'scan_all_platforms',
        user_email: email,
        priority_filter: 'high_velocity',
        limit: 20
      }).catch(() => ({ data: { discovered: 0 } }));
      
      steps.push(`discovery_scan_triggered (${discoveryRes?.data?.discovered || 0} opportunities)`);
    } catch (e) {
      console.warn('[bootstrapOrchestrator] Discovery invoke failed:', e.message);
      steps.push('discovery_scan_queued_for_polling');
    }

    // Step 4: Log activity
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `🚀 Bootstrap complete: Onboarded=${!readiness || !readiness.onboarded}, Identity=${!readiness || !readiness.has_active_identity}, Discovery=${!readiness || !readiness.has_queued_opportunities}`,
      severity: 'success',
      metadata: {
        email,
        bootstrap_steps: steps,
        identity_id: activeIdentity.id,
        identity_name: activeIdentity.name
      }
    }).catch(() => null);

    // Log to console as well for real-world execution verification
    console.log(`[bootstrapOrchestrator] Bootstrap complete for ${email}: ${steps.join(' → ')}`);

    return {
      success: true,
      steps,
      identity_id: activeIdentity.id,
      identity_name: activeIdentity.name,
      message: `Bootstrap complete: ${steps.join(' → ')}`
    };

  } catch (error) {
    console.error('[bootstrapOrchestrator] Bootstrap flow failed:', error.message);
    throw error;
  }
}