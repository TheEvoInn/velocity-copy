/**
 * SYSTEM HEALTH MONITOR
 * Runs continuous health checks (5 min intervals)
 * - Module connectivity checks
 * - Data integrity validation
 * - Detects stale/stuck tasks
 * - Auto-repairs minor issues
 * - Alerts admin on critical failures
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action = 'full_health_check' } = body;

    const report = {
      timestamp: new Date().toISOString(),
      checks_performed: 0,
      issues_found: [],
      auto_repairs: [],
      module_health: {},
      data_integrity: {},
      task_health: {},
      overall_status: 'healthy'
    };

    // ── MODULE CONNECTIVITY CHECK ──
    const modules = ['autopilot', 'discovery', 'vipz', 'ned', 'wallet', 'identity'];
    for (const mod of modules) {
      try {
        // Try to invoke module function or ping endpoint
        const testRes = await base44.asServiceRole.functions.invoke(`${mod}HealthCheck`, {
          action: 'ping'
        }).catch(() => null);

        report.module_health[mod] = testRes ? 'healthy' : 'unreachable';
        if (!testRes) {
          report.issues_found.push({
            severity: 'critical',
            module: mod,
            issue: 'Module unreachable'
          });
        }
      } catch (e) {
        report.module_health[mod] = 'error';
        report.issues_found.push({
          severity: 'warning',
          module: mod,
          issue: e.message
        });
      }
    }
    report.checks_performed++;

    // ── DATA INTEGRITY CHECKS ──
    
    // Check for orphaned tasks (stuck in 'executing' > 6h)
    const staleTasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
      { status: 'executing' }
    ).catch(() => []);

    const now = new Date();
    for (const task of staleTasks) {
      const age = (now - new Date(task.start_timestamp || task.queue_timestamp)) / (1000 * 60 * 60);
      if (age > 6) {
        report.issues_found.push({
          severity: 'warning',
          type: 'stale_task',
          task_id: task.id,
          age_hours: age.toFixed(1),
          issue: 'Task executing for >6 hours'
        });

        // Auto-repair: transition to needs_review
        await base44.asServiceRole.entities.TaskExecutionQueue.update(task.id, {
          status: 'needs_review'
        }).catch(() => {});

        report.auto_repairs.push({
          type: 'stale_task',
          task_id: task.id,
          action: 'Transitioned to needs_review'
        });
      }
    }
    report.task_health.stale_tasks = staleTasks.length;
    report.checks_performed++;

    // Check for failed tasks without proper logging
    const failedTasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
      { status: 'failed' },
      '-updated_date',
      20
    ).catch(() => []);

    let tasksWithoutLogs = 0;
    for (const task of failedTasks) {
      if (!task.error_message || task.error_message.length === 0) {
        tasksWithoutLogs++;
        // Mark for investigation
        report.issues_found.push({
          severity: 'info',
          type: 'missing_error_log',
          task_id: task.id
        });
      }
    }
    report.task_health.failed_tasks_missing_logs = tasksWithoutLogs;
    report.checks_performed++;

    // Check for opportunities without completion tracking
    const uncompletedOpps = await base44.asServiceRole.entities.Opportunity.filter(
      { status: 'completed' },
      '-updated_date',
      50
    ).catch(() => []);

    let oppsWithoutTransactions = 0;
    for (const opp of uncompletedOpps) {
      const txs = await base44.asServiceRole.entities.Transaction.filter(
        { opportunity_id: opp.id }
      ).catch(() => []);

      if (txs.length === 0 && !opp.no_revenue) {
        oppsWithoutTransactions++;
        report.issues_found.push({
          severity: 'warning',
          type: 'missing_transaction',
          opportunity_id: opp.id,
          issue: 'Completed opportunity has no associated transaction'
        });

        // Auto-repair: create placeholder transaction
        if (opp.profit_estimate_high && opp.profit_estimate_high > 0) {
          await base44.asServiceRole.entities.Transaction.create({
            type: 'income',
            amount: opp.profit_estimate_high,
            net_amount: opp.profit_estimate_high * 0.75,
            opportunity_id: opp.id,
            platform: opp.platform,
            category: opp.category,
            description: `[AUTO-REPAIR] ${opp.title}`,
            payout_status: 'available'
          }).catch(() => {});

          report.auto_repairs.push({
            type: 'missing_transaction',
            opportunity_id: opp.id,
            action: 'Created transaction record'
          });
        }
      }
    }
    report.data_integrity.opportunities_missing_transactions = oppsWithoutTransactions;
    report.checks_performed++;

    // Check for wallet balance consistency
    const wallets = await base44.asServiceRole.entities.UserGoals.list('-created_date', 100).catch(() => []);
    let walletInconsistencies = 0;

    for (const wallet of wallets) {
      const txs = await base44.asServiceRole.entities.Transaction.filter(
        { created_by: wallet.created_by || wallet.user_email },
        null,
        1000
      ).catch(() => []);

      let calculatedBalance = 0;
      let calculatedEarned = 0;

      for (const tx of txs) {
        if (tx.type === 'income') {
          calculatedBalance += (tx.net_amount || tx.amount || 0);
          calculatedEarned += (tx.amount || 0);
        } else if (tx.type === 'expense') {
          calculatedBalance -= (tx.net_amount || tx.amount || 0);
        }
      }

      const balanceDiff = Math.abs((wallet.wallet_balance || 0) - calculatedBalance);
      const earnedDiff = Math.abs((wallet.total_earned || 0) - calculatedEarned);

      if (balanceDiff > 1 || earnedDiff > 1) {
        walletInconsistencies++;
        report.issues_found.push({
          severity: 'warning',
          type: 'wallet_inconsistency',
          user: wallet.created_by,
          balance_diff: balanceDiff.toFixed(2),
          earned_diff: earnedDiff.toFixed(2)
        });

        // Auto-repair: sync wallet
        await base44.asServiceRole.entities.UserGoals.update(wallet.id, {
          wallet_balance: Math.max(calculatedBalance, 0),
          total_earned: calculatedEarned
        }).catch(() => {});

        report.auto_repairs.push({
          type: 'wallet_sync',
          user: wallet.created_by,
          action: 'Synced wallet balances'
        });
      }
    }
    report.data_integrity.wallet_inconsistencies = walletInconsistencies;
    report.checks_performed++;

    // ── OVERALL STATUS ──
    const criticalIssues = report.issues_found.filter(i => i.severity === 'critical').length;
    const warnings = report.issues_found.filter(i => i.severity === 'warning').length;

    if (criticalIssues > 0) {
      report.overall_status = 'critical';
    } else if (warnings > 0) {
      report.overall_status = 'warning';
    } else {
      report.overall_status = 'healthy';
    }

    // Log to EngineAuditLog
    await base44.asServiceRole.entities.EngineAuditLog.create({
      action_type: 'system_health_check',
      status: report.overall_status === 'healthy' ? 'success' : 'warning',
      metadata: {
        checks: report.checks_performed,
        issues: report.issues_found.length,
        repairs: report.auto_repairs.length,
        module_health: report.module_health,
        data_integrity: report.data_integrity,
        task_health: report.task_health
      }
    }).catch(() => {});

    // If critical issues, alert admin
    if (criticalIssues > 0) {
      await base44.asServiceRole.entities.Notification.create({
        type: 'system_alert',
        severity: 'urgent',
        title: 'System Health Alert',
        message: `${criticalIssues} critical issue(s) detected. ${report.auto_repairs.length} auto-repairs applied.`,
        action_type: 'review_required',
        action_data: report
      }).catch(() => {});
    }

    return Response.json({ success: true, report });
  } catch (error) {
    console.error('[SystemHealthMonitor] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});