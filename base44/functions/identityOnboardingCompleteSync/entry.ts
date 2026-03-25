/**
 * IDENTITY ONBOARDING COMPLETE SYNC
 * Triggered when identity finishes onboarding — syncs to ALL modules
 * Autopilot, Task Executor, Credential Vault, Execution Engine, Wallet
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { identity_id } = body;

    if (!identity_id) {
      return Response.json({ error: 'identity_id required' }, { status: 400 });
    }

    const syncs = {
      identity_id,
      timestamp: new Date().toISOString(),
      modules_synced: [],
      errors: []
    };

    // 1. Get the identity + user
    const identities = await base44.asServiceRole.entities.AIIdentity.filter(
      { id: identity_id },
      null,
      1
    ).catch(() => []);

    if (!identities.length) {
      return Response.json({ error: 'Identity not found' }, { status: 404 });
    }

    const identity = identities[0];
    const user_email = identity.user_email;

    // 2. Sync to Autopilot Module
    try {
      await base44.asServiceRole.entities.PlatformState.filter(
        { created_by: user_email },
        '-created_date',
        1
      ).then(async (states) => {
        if (states[0]) {
          await base44.asServiceRole.entities.PlatformState.update(states[0].id, {
            active_identity_id: identity_id,
            autopilot_enabled: true
          });
        }
      });
      syncs.modules_synced.push('autopilot');
    } catch (e) {
      syncs.errors.push(`Autopilot sync: ${e.message}`);
    }

    // 3. Sync to UserGoals (enables Autopilot execution)
    try {
      await base44.asServiceRole.entities.UserGoals.filter(
        { created_by: user_email },
        '-created_date',
        1
      ).then(async (goals) => {
        if (goals[0]) {
          await base44.asServiceRole.entities.UserGoals.update(goals[0].id, {
            autopilot_enabled: true,
            onboarded: true
          });
        }
      });
      syncs.modules_synced.push('user_goals');
    } catch (e) {
      syncs.errors.push(`UserGoals sync: ${e.message}`);
    }

    // 4. Sync to WithdrawalPolicy (enables financial ops)
    try {
      await base44.asServiceRole.entities.WithdrawalPolicy.filter(
        { created_by: user_email },
        '-created_date',
        1
      ).then(async (policies) => {
        if (policies[0]) {
          // Don't auto-enable — let user enable manually
          // Just mark as configured
          await base44.asServiceRole.entities.WithdrawalPolicy.update(policies[0].id, {
            label: 'Primary Withdrawal Policy'
          });
        }
      });
      syncs.modules_synced.push('withdrawal_policy');
    } catch (e) {
      syncs.errors.push(`WithdrawalPolicy sync: ${e.message}`);
    }

    // 5. Create default SpendingPolicy if none exists
    try {
      const policies = await base44.asServiceRole.entities.SpendingPolicy.filter(
        { created_by: user_email, category: 'global' },
        null,
        1
      ).catch(() => []);

      if (!policies.length) {
        await base44.asServiceRole.entities.SpendingPolicy.create({
          category: 'global',
          max_per_task: 50,
          max_per_day: 200,
          auto_approve_threshold: 10,
          min_roi_pct: 20,
          enabled: true
        });
        syncs.modules_synced.push('spending_policy_created');
      } else {
        syncs.modules_synced.push('spending_policy_exists');
      }
    } catch (e) {
      syncs.errors.push(`SpendingPolicy sync: ${e.message}`);
    }

    // 6. Trigger real-time identity sync broadcast
    try {
      const identityRoutingPolicies = await base44.asServiceRole.entities.IdentityRoutingPolicy.filter(
        { created_by: user_email },
        '-created_date',
        1
      ).catch(() => []);

      if (identityRoutingPolicies.length === 0) {
        // Create default routing policy
        await base44.asServiceRole.entities.IdentityRoutingPolicy.create({
          policy_name: 'Default Routing',
          is_default: true,
          identity_selection_strategy: 'active_first',
          fallback_identity_id: identity_id,
          rules: JSON.stringify([
            { condition: 'always', action: 'use_active_identity', priority: 100 }
          ])
        });
        syncs.modules_synced.push('identity_routing_policy_created');
      }
    } catch (e) {
      syncs.errors.push(`IdentityRoutingPolicy sync: ${e.message}`);
    }

    // 7. Log the completion event
    try {
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `✅ Identity "${identity.name}" onboarding complete — synced across all modules`,
        severity: 'success',
        metadata: {
          identity_id,
          identity_name: identity.name,
          modules: syncs.modules_synced,
          user_email
        }
      });
    } catch (e) {
      console.error('ActivityLog failed:', e.message);
    }

    return Response.json({
      success: true,
      syncs
    });

  } catch (error) {
    console.error('[identityOnboardingCompleteSync]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});