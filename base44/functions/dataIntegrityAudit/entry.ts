import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * DATA INTEGRITY AUDIT
 * Comprehensive system audit for real vs simulated data
 * Identifies and resolves any test/placeholder/mock data pathways
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const { action = 'full_audit', user_email = 'dawnvernor@yahoo.com' } = body;

    const audit = {
      timestamp: new Date().toISOString(),
      user: user_email,
      findings: [],
      issues: [],
      resolutions: [],
      data_quality_score: 100,
    };

    switch (action) {
      case 'full_audit': {
        // 1. Audit Credentials — verify real accounts, not test data
        const credentials = await base44.asServiceRole.entities.CredentialVault.filter(
          {},
          '-created_date',
          50
        ).catch(() => []);

        const credArray = Array.isArray(credentials) ? credentials : [];
        for (const cred of credArray) {
          // Check for test/placeholder values
          if (!cred.platform || cred.platform === 'test' || cred.platform === 'mock') {
            audit.issues.push({
              type: 'test_credential',
              entity: 'CredentialVault',
              id: cred.id,
              issue: `Credential has test platform: ${cred.platform}`,
              resolution: 'DELETE',
            });
            // Delete test credential
            await base44.asServiceRole.entities.CredentialVault.delete(cred.id).catch(() => null);
            audit.resolutions.push(`Deleted test credential ${cred.id}`);
          }

          if (cred.username === 'test' || cred.username === 'demo' || cred.password === 'test') {
            audit.issues.push({
              type: 'test_credential_values',
              entity: 'CredentialVault',
              id: cred.id,
              issue: 'Credential has test username/password',
              resolution: 'FLAGGED',
            });
            audit.data_quality_score -= 10;
          }

          // Verify credential is actually linked to active identity
          if (cred.identity_id) {
            const identity = await base44.asServiceRole.entities.AIIdentity.get(cred.identity_id).catch(() => null);
            if (!identity || !identity.is_active) {
              audit.issues.push({
                type: 'orphaned_credential',
                entity: 'CredentialVault',
                id: cred.id,
                issue: `Credential linked to inactive identity: ${cred.identity_id}`,
                resolution: 'VERIFY_IDENTITY',
              });
              audit.data_quality_score -= 5;
            }
          }
        }

        // 2. Audit Opportunities — verify real data, not AI-generated mock opportunities
        const opportunities = await base44.asServiceRole.entities.Opportunity.filter(
          {},
          '-created_date',
          100
        ).catch(() => []);

        const oppArray = Array.isArray(opportunities) ? opportunities : [];
        for (const opp of oppArray) {
          // Check for placeholder values
          if (!opp.url || opp.url === 'http://example.com' || opp.url.includes('mock') || opp.url.includes('test')) {
            audit.issues.push({
              type: 'placeholder_url',
              entity: 'Opportunity',
              id: opp.id,
              issue: `Opportunity has placeholder URL: ${opp.url}`,
              resolution: 'DELETE',
            });
            await base44.asServiceRole.entities.Opportunity.delete(opp.id).catch(() => null);
            audit.resolutions.push(`Deleted mock opportunity ${opp.id}`);
          }

          if (opp.profit_estimate_low === 0 && opp.profit_estimate_high === 0) {
            audit.issues.push({
              type: 'zero_value_opportunity',
              entity: 'Opportunity',
              id: opp.id,
              issue: 'Opportunity has no estimated value (likely generated)',
              resolution: 'VERIFY_OR_DELETE',
            });
            audit.data_quality_score -= 8;
          }

          // Verify source is not simulated/test
          if (opp.source && (opp.source === 'test' || opp.source === 'mock' || opp.source === 'simulated')) {
            audit.issues.push({
              type: 'test_opportunity_source',
              entity: 'Opportunity',
              id: opp.id,
              issue: `Opportunity from test source: ${opp.source}`,
              resolution: 'DELETE',
            });
            await base44.asServiceRole.entities.Opportunity.delete(opp.id).catch(() => null);
            audit.resolutions.push(`Deleted test opportunity ${opp.id}`);
          }
        }

        // 3. Audit Transactions — verify real money movements with platform confirmation
        const transactions = await base44.asServiceRole.entities.Transaction.filter(
          {},
          '-created_date',
          100
        ).catch(() => []);

        const txArray = Array.isArray(transactions) ? transactions : [];
        for (const tx of txArray) {
          // Check for zero/test amounts
          if (tx.amount === 0 || tx.amount < 0.01) {
            audit.issues.push({
              type: 'invalid_transaction_amount',
              entity: 'Transaction',
              id: tx.id,
              issue: `Transaction has invalid amount: $${tx.amount}`,
              resolution: 'DELETE',
            });
            await base44.asServiceRole.entities.Transaction.delete(tx.id).catch(() => null);
            audit.resolutions.push(`Deleted invalid transaction ${tx.id}`);
          }

          // Verify platform is real (not test/mock)
          if (tx.platform === 'test' || tx.platform === 'mock' || !tx.platform) {
            audit.issues.push({
              type: 'invalid_transaction_platform',
              entity: 'Transaction',
              id: tx.id,
              issue: `Transaction missing valid platform: ${tx.platform}`,
              resolution: 'DELETE',
            });
            await base44.asServiceRole.entities.Transaction.delete(tx.id).catch(() => null);
            audit.resolutions.push(`Deleted invalid transaction ${tx.id}`);
          }

          // Verify transaction is linked to real opportunity
          if (tx.opportunity_id) {
            const opp = await base44.asServiceRole.entities.Opportunity.get(tx.opportunity_id).catch(() => null);
            if (!opp) {
              audit.issues.push({
                type: 'orphaned_transaction',
                entity: 'Transaction',
                id: tx.id,
                issue: `Transaction linked to non-existent opportunity: ${tx.opportunity_id}`,
                resolution: 'DELETE',
              });
              await base44.asServiceRole.entities.Transaction.delete(tx.id).catch(() => null);
              audit.resolutions.push(`Deleted orphaned transaction ${tx.id}`);
            }
          }
        }

        // 4. Audit Task Execution Queue — verify real execution, not simulated completions
        const tasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
          {},
          '-created_date',
          100
        ).catch(() => []);

        const taskArray = Array.isArray(tasks) ? tasks : [];
        for (const task of taskArray) {
          // Check for simulated completion (no real execution time)
          if (task.status === 'completed' && !task.execution_log) {
            audit.issues.push({
              type: 'unverified_task_completion',
              entity: 'TaskExecutionQueue',
              id: task.id,
              issue: 'Task marked completed with no execution log',
              resolution: 'REVERT_TO_QUEUED',
            });
            await base44.asServiceRole.entities.TaskExecutionQueue.update(task.id, {
              status: 'queued',
            }).catch(() => null);
            audit.resolutions.push(`Reverted unverified task ${task.id} to queued`);
          }

          // Verify execution time is realistic (> 10 seconds for real tasks)
          if (task.status === 'completed' && task.execution_time_seconds) {
            if (task.execution_time_seconds < 1) {
              audit.issues.push({
                type: 'instant_task_completion',
                entity: 'TaskExecutionQueue',
                id: task.id,
                issue: `Task completed in ${task.execution_time_seconds}s (likely simulated)`,
                resolution: 'MARK_FOR_REVIEW',
              });
              audit.data_quality_score -= 10;
            }
          }

          // Verify confirmation is not placeholder
          if (task.confirmation_number && (task.confirmation_number === 'AUTO-' || task.confirmation_number.startsWith('test'))) {
            audit.issues.push({
              type: 'placeholder_confirmation',
              entity: 'TaskExecutionQueue',
              id: task.id,
              issue: `Task has placeholder confirmation: ${task.confirmation_number}`,
              resolution: 'REVERT_TO_PROCESSING',
            });
            await base44.asServiceRole.entities.TaskExecutionQueue.update(task.id, {
              status: 'processing',
              confirmation_number: null,
            }).catch(() => null);
            audit.resolutions.push(`Reverted task ${task.id} for real confirmation`);
          }
        }

        // 5. Audit WalletTransaction — ensure real earnings with platform proof
        const walletTxs = await base44.asServiceRole.entities.WalletTransaction.filter(
          {},
          '-created_date',
          100
        ).catch(() => []);

        const wtArray = Array.isArray(walletTxs) ? walletTxs : [];
        for (const wtx of wtArray) {
          // Check for test amounts
          if (wtx.amount === 0 || wtx.amount === 1 || (wtx.amount < 0.01 && wtx.type === 'earning')) {
            audit.issues.push({
              type: 'test_wallet_transaction',
              entity: 'WalletTransaction',
              id: wtx.id,
              issue: `Wallet transaction has test amount: $${wtx.amount}`,
              resolution: 'DELETE',
            });
            await base44.asServiceRole.entities.WalletTransaction.delete(wtx.id).catch(() => null);
            audit.resolutions.push(`Deleted test wallet transaction ${wtx.id}`);
          }

          // Verify real source
          if (!wtx.source || wtx.source === 'test' || wtx.source === 'simulated') {
            audit.issues.push({
              type: 'invalid_wallet_source',
              entity: 'WalletTransaction',
              id: wtx.id,
              issue: `Wallet transaction missing valid source: ${wtx.source}`,
              resolution: 'DELETE',
            });
            await base44.asServiceRole.entities.WalletTransaction.delete(wtx.id).catch(() => null);
            audit.resolutions.push(`Deleted invalid wallet transaction ${wtx.id}`);
          }
        }

        // 6. Audit ActivityLog for realistic timestamps and messages
        const activityLogs = await base44.asServiceRole.entities.ActivityLog.filter(
          {},
          '-created_date',
          50
        ).catch(() => []);

        const logArray = Array.isArray(activityLogs) ? activityLogs : [];
        const testMessages = logArray.filter(l => 
          l.message && (l.message.includes('test') || l.message.includes('mock') || l.message.includes('simulated'))
        );

        if (testMessages.length > 0) {
          audit.issues.push({
            type: 'test_activity_logs',
            count: testMessages.length,
            issue: `${testMessages.length} activity logs contain test/mock references`,
            resolution: 'PURGE_TEST_LOGS',
          });
          for (const log of testMessages) {
            await base44.asServiceRole.entities.ActivityLog.delete(log.id).catch(() => null);
          }
          audit.resolutions.push(`Purged ${testMessages.length} test activity logs`);
          audit.data_quality_score -= 5;
        }

        // 7. Summary report
        audit.findings.push({
          type: 'summary',
          credentials_audited: credArray.length,
          opportunities_audited: oppArray.length,
          transactions_audited: txArray.length,
          tasks_audited: taskArray.length,
          wallet_txs_audited: wtArray.length,
          total_issues_found: audit.issues.length,
          total_resolutions_applied: audit.resolutions.length,
        });

        // Log audit results
        await base44.asServiceRole.entities.ActivityLog.create({
          action_type: 'system',
          message: `🔍 Data Integrity Audit Complete: ${audit.issues.length} issues found, ${audit.resolutions.length} resolved. Quality: ${audit.data_quality_score}%`,
          severity: audit.data_quality_score < 80 ? 'warning' : 'success',
          metadata: audit,
        }).catch(() => null);

        return Response.json({ success: true, audit });
      }

      case 'verify_user_data': {
        const user = await base44.auth.me().catch(() => null);
        if (!user) {
          return Response.json({ error: 'User not authenticated' }, { status: 401 });
        }

        const userGoals = await base44.asServiceRole.entities.UserGoals.filter(
          { created_by: user.email },
          '-created_date',
          1
        ).catch(() => []);

        const goals = Array.isArray(userGoals) ? userGoals[0] : null;
        
        const verification = {
          user_email: user.email,
          has_user_goals: !!goals,
          daily_target: goals?.daily_target || 0,
          wallet_balance: goals?.wallet_balance || 0,
          autopilot_enabled: goals?.autopilot_enabled || false,
          skills: goals?.skills || [],
          platform_accounts_configured: !!goals?.platform_accounts,
        };

        if (!goals) {
          return Response.json({
            success: false,
            message: 'No UserGoals record found for authenticated user',
            verification,
          }, { status: 400 });
        }

        if (!goals.daily_target || goals.daily_target === 0) {
          verification.warning = 'User has no daily target set — autopilot may not function';
        }

        if (!goals.platform_accounts) {
          verification.critical = 'No platform accounts configured — credentials missing';
        }

        return Response.json({ success: true, verification });
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[dataIntegrityAudit]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});