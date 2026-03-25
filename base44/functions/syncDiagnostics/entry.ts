import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * SYNC DIAGNOSTICS
 * Audits real-time sync health across all platform modules
 * Identifies bottlenecks, missing propagations, and out-of-sync states
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { action } = await req.json().catch(() => ({}));

    // ── AUDIT_SYNC_HEALTH: Full platform sync analysis ──
    if (action === 'audit_sync_health') {
      const diagnostics = {
        timestamp: new Date().toISOString(),
        user_email: user.email,
        modules: {}
      };

      // Task Queue Health
      try {
        const queued = await base44.entities.TaskExecutionQueue.filter({ status: 'queued' }, '', 1000).catch(() => []);
        const processing = await base44.entities.TaskExecutionQueue.filter({ status: 'processing' }, '', 1000).catch(() => []);
        const completed = await base44.entities.TaskExecutionQueue.filter({ status: 'completed' }, '-completion_timestamp', 100).catch(() => []);

        const avgCompletionTime = completed.length > 0
          ? completed.reduce((sum, t) => sum + (t.execution_time_seconds || 0), 0) / completed.length
          : 0;

        diagnostics.modules.task_execution = {
          health: queued.length + processing.length === 0 ? 'healthy' : queued.length > 50 ? 'warning' : 'healthy',
          queued_count: queued.length,
          processing_count: processing.length,
          completed_today: completed.length,
          avg_execution_seconds: Math.round(avgCompletionTime),
          oldest_queued: queued.length > 0 ? queued[0].queue_timestamp : null,
          queue_age_minutes: queued.length > 0 
            ? Math.round((Date.now() - new Date(queued[0].queue_timestamp).getTime()) / 60000)
            : 0
        };
      } catch (e) {
        diagnostics.modules.task_execution = { error: e.message, health: 'error' };
      }

      // Intervention Status Health
      try {
        const pending = await base44.entities.UserIntervention.filter({ status: 'pending' }, '', 1000).catch(() => []);
        const inProgress = await base44.entities.UserIntervention.filter({ status: 'in_progress' }, '', 1000).catch(() => []);
        const resolved = await base44.entities.UserIntervention.filter({ status: 'resolved' }, '-resolved_at', 100).catch(() => []);

        diagnostics.modules.user_interventions = {
          health: pending.length > 20 ? 'warning' : 'healthy',
          pending_count: pending.length,
          in_progress_count: inProgress.length,
          resolved_today: resolved.length,
          oldest_pending: pending.length > 0 ? pending[0].created_date : null,
          pending_age_hours: pending.length > 0
            ? Math.round((Date.now() - new Date(pending[0].created_date).getTime()) / 3600000)
            : 0
        };
      } catch (e) {
        diagnostics.modules.user_interventions = { error: e.message, health: 'error' };
      }

      // Wallet & Goals Sync
      try {
        const goals = await base44.entities.UserGoals.filter({ created_by: user.email }, '', 1).catch(() => []);
        if (goals && goals.length > 0) {
          const goal = goals[0];
          const transactions = await base44.entities.Transaction.filter({ created_by: user.email }, '-created_date', 100).catch(() => []);
          const txTotal = transactions.reduce((sum, tx) => sum + (tx.type === 'income' ? tx.amount : -tx.amount), 0);

          diagnostics.modules.wallet = {
            health: Math.abs((goal.wallet_balance || 0) - txTotal) < 0.01 ? 'healthy' : 'warning',
            wallet_balance: goal.wallet_balance,
            total_earned: goal.total_earned,
            transaction_count: transactions.length,
            calc_balance_from_tx: txTotal,
            balance_mismatch: Math.abs((goal.wallet_balance || 0) - txTotal) > 0.01,
            daily_target: goal.daily_target,
            ai_enabled: goal.autopilot_enabled
          };
        }
      } catch (e) {
        diagnostics.modules.wallet = { error: e.message, health: 'error' };
      }

      // Activity Log Health
      try {
        const logs = await base44.entities.ActivityLog.filter({}, '-created_date', 100).catch(() => []);
        diagnostics.modules.activity_log = {
          health: logs.length > 0 ? 'healthy' : 'warning',
          total_logs: logs.length,
          last_log_age_minutes: logs.length > 0 
            ? Math.round((Date.now() - new Date(logs[0].created_date).getTime()) / 60000)
            : null
        };
      } catch (e) {
        diagnostics.modules.activity_log = { error: e.message, health: 'error' };
      }

      // Calculate overall health
      const moduleHealths = Object.values(diagnostics.modules)
        .map(m => m.health)
        .filter(h => h !== 'error');
      const warnings = moduleHealths.filter(h => h === 'warning').length;
      const errors = Object.values(diagnostics.modules).filter(m => m.health === 'error').length;

      diagnostics.overall_health = errors > 0 ? 'error' : warnings > 0 ? 'warning' : 'healthy';
      diagnostics.summary = {
        healthy_modules: moduleHealths.filter(h => h === 'healthy').length,
        warning_modules: warnings,
        error_modules: errors,
        total_modules: Object.keys(diagnostics.modules).length
      };

      // Log diagnostics
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `📊 Sync health audit: ${diagnostics.overall_health}`,
        severity: 'info',
        metadata: diagnostics.summary
      }).catch(() => null);

      return jsonResponse(diagnostics);
    }

    // ── FIX_SYNC_ISSUES: Auto-correct identified mismatches ──
    if (action === 'fix_sync_issues') {
      const fixes = [];

      try {
        const goals = await base44.entities.UserGoals.filter({ created_by: user.email }, '', 1).catch(() => []);
        if (goals && goals.length > 0) {
          const goal = goals[0];
          const transactions = await base44.entities.Transaction.filter({ created_by: user.email }, '', 1000).catch(() => []);
          const txTotal = transactions.reduce((sum, tx) => sum + (tx.type === 'income' ? tx.amount : -tx.amount), 0);

          if (Math.abs((goal.wallet_balance || 0) - txTotal) > 0.01) {
            await base44.entities.UserGoals.update(goal.id, {
              wallet_balance: txTotal
            });
            fixes.push({ type: 'wallet_balance', from: goal.wallet_balance, to: txTotal });
          }
        }
      } catch (e) {
        fixes.push({ type: 'wallet_fix_failed', error: e.message });
      }

      // Revert stale in_progress tasks back to queued (60+ min timeout)
      try {
        const stale = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
          { status: 'processing' },
          'start_timestamp',
          100
        ).catch(() => []);

        for (const task of stale) {
          const ageMs = Date.now() - new Date(task.start_timestamp || Date.now()).getTime();
          if (ageMs > 3600000) { // 60 minutes
            await base44.asServiceRole.entities.TaskExecutionQueue.update(task.id, {
              status: 'queued',
              retry_count: (task.retry_count || 0) + 1
            }).catch(() => null);
            fixes.push({ type: 'task_timeout_reset', task_id: task.id });
          }
        }
      } catch (e) {
        fixes.push({ type: 'task_timeout_fix_failed', error: e.message });
      }

      return jsonResponse({ synced: true, fixes_applied: fixes.length, details: fixes });
    }

    return jsonResponse({ error: 'Unknown action' }, 400);

  } catch (error) {
    console.error('[SyncDiagnostics]', error.message);
    return jsonResponse({ error: error.message }, 500);
  }
});

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}