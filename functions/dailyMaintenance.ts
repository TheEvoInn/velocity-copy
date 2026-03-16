/**
 * Daily Maintenance — runs at midnight
 * - Resets account daily limits
 * - Runs opportunity lifecycle maintenance
 * - Scores all linked accounts
 * - Auto-renews active earning goals
 * - Logs daily summary
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const results = { reset: false, lifecycle: null, scoring: false, goals: 0 };

    // 1. Reset account daily limits + clear expired cooldowns
    const resetRes = await base44.asServiceRole.functions.invoke('accountRotationEngine', { action: 'reset_daily_limits' });
    results.reset = resetRes?.data?.success || false;

    // 2. Run opportunity lifecycle maintenance
    const lifecycleRes = await base44.asServiceRole.functions.invoke('opportunityLifecycle', { action: 'run_maintenance' });
    results.lifecycle = lifecycleRes?.data || {};

    // 3. Re-score all accounts
    const scoreRes = await base44.asServiceRole.functions.invoke('accountRotationEngine', { action: 'score_accounts' });
    results.scoring = scoreRes?.data?.success || false;

    // 4. Auto-renew completed earning goals
    const goals = await base44.asServiceRole.entities.EarningGoal.list();
    for (const goal of goals) {
      if (goal.status === 'completed' && goal.auto_renew) {
        const now = new Date();
        let newStart = now.toISOString().split('T')[0];
        let newEnd = null;

        await base44.asServiceRole.entities.EarningGoal.create({
          period: goal.period,
          target_amount: goal.target_amount,
          current_amount: 0,
          ai_allocation_pct: goal.ai_allocation_pct,
          start_date: newStart,
          end_date: newEnd,
          status: 'active',
          auto_renew: true,
          notes: `Auto-renewed from goal ${goal.id}`,
          milestone_alerts: goal.milestone_alerts
        });
        results.goals++;
      }
    }

    // 5. Compute yesterday's earnings for daily summary
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const allTransactions = await base44.asServiceRole.entities.Transaction.list('-created_date', 100);
    const yesterdayIncome = allTransactions
      .filter(t => t.type === 'income' && t.created_date?.startsWith(yesterdayStr))
      .reduce((s, t) => s + (t.amount || 0), 0);

    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `Daily maintenance complete. Yesterday's earnings: $${yesterdayIncome.toFixed(2)}. Accounts reset. ${results.lifecycle?.expired || 0} opps expired, ${results.lifecycle?.reactivated || 0} reactivated. ${results.goals} goals auto-renewed.`,
      severity: 'info',
      metadata: results
    });

    return Response.json({ success: true, results });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});