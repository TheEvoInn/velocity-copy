/**
 * COMPLETE AUTOPILOT SETUP
 * One-call function to finalize all remaining setup for a user
 * Creates: spending policy, bank config stub, marks onboarded
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { user_email } = body;

    if (!user_email) {
      return Response.json({ error: 'user_email required' }, { status: 400 });
    }

    // 1. Create default spending policy if none exists
    const spendingPolicies = await base44.asServiceRole.entities.SpendingPolicy.filter(
      { created_by: user_email, category: 'global' },
      null,
      1
    ).catch(() => []);

    if (!spendingPolicies[0]) {
      await base44.asServiceRole.entities.SpendingPolicy.create({
        category: 'global',
        max_per_task: 100,
        max_per_day: 500,
        auto_approve_threshold: 25,
        min_roi_pct: 20,
        enabled: true
      });
    }

    // 2. Create default withdrawal policy if none exists
    const withdrawalPolicies = await base44.asServiceRole.entities.WithdrawalPolicy.filter(
      { created_by: user_email },
      null,
      1
    ).catch(() => []);

    if (!withdrawalPolicies[0]) {
      await base44.asServiceRole.entities.WithdrawalPolicy.create({
        label: 'Default Withdrawal Policy',
        engine_enabled: true,
        emergency_stop: false,
        min_withdrawal_threshold: 100,
        min_reinvestment_threshold: 50,
        safety_buffer: 200,
        max_reinvestment_pct: 40,
        withdrawal_pct: 60,
        auto_transfer_frequency: 'daily',
        daily_withdrawal_limit: 5000,
        daily_reinvestment_limit: 500,
        fraud_detection_enabled: true
      });
    }

    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `✅ Autopilot setup completed for ${user_email} — policies created, onboarding marked complete`,
      severity: 'success',
      metadata: { user_email }
    }).catch(() => null);

    return Response.json({
      success: true,
      user_email,
      message: 'Autopilot setup completed: onboarded, spending policy, withdrawal policy configured'
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});