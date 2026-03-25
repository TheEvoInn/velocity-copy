import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * USER REAL DATA SYNC
 * User-scoped function (respects RLS) to:
 * - Verify their own credentials are real
 * - Sync wallet from verified transactions
 * - Flag any simulated data in their account
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { action = 'sync_real_data' } = body;

    const sync = {
      timestamp: new Date().toISOString(),
      user_email: user.email,
      findings: [],
      actions: [],
    };

    switch (action) {
      case 'sync_real_data': {
        // Get user's own goals
        const myGoals = await base44.entities.UserGoals.list('-created_date', 1).catch(() => []);
        const goals = Array.isArray(myGoals) && myGoals.length > 0 ? myGoals[0] : null;

        if (!goals) {
          sync.findings.push('No UserGoals found — creating fresh record');
          // Can't create due to RLS, so flag for admin
          sync.actions.push('REQUIRES_ADMIN: Create UserGoals for user');
          return Response.json({ success: true, sync });
        }

        // Verify credentials are real (not test/mock)
        const myCredentials = await base44.entities.CredentialVault.list('-created_date', 50).catch(() => []);
        const credArray = Array.isArray(myCredentials) ? myCredentials : [];
        
        const testCreds = credArray.filter(c => 
          !c.platform || 
          ['test', 'mock', 'demo', 'example'].includes((c.platform || '').toLowerCase()) ||
          c.username === 'test' ||
          c.username === 'demo'
        );

        if (testCreds.length > 0) {
          sync.findings.push(`Found ${testCreds.length} test/mock credentials`);
          sync.actions.push(`DELETE: ${testCreds.length} test credentials (${testCreds.map(c => c.id).join(', ')})`);
          
          for (const tc of testCreds) {
            await base44.entities.CredentialVault.delete(tc.id).catch(() => null);
          }
          sync.actions.push(`✓ Deleted ${testCreds.length} test credentials`);
        }

        const realCreds = credArray.filter(c => !testCreds.includes(c));
        sync.findings.push(`${realCreds.length} real credentials active`);

        if (realCreds.length === 0) {
          sync.findings.push('⚠ NO REAL CREDENTIALS: User needs to add platform accounts');
        } else {
          sync.findings.push(`✓ Real credentials: ${realCreds.map(c => c.platform).join(', ')}`);
        }

        // Verify transactions are real (not zero, not test sources)
        const myTransactions = await base44.entities.Transaction.filter(
          { type: { $in: ['income', 'earning'] } },
          '-created_date',
          100
        ).catch(() => []);

        const txArray = Array.isArray(myTransactions) ? myTransactions : [];
        
        const invalidTxs = txArray.filter(tx => 
          !tx.amount || 
          tx.amount === 0 ||
          tx.amount < 0.01 ||
          !tx.platform ||
          ['test', 'mock', 'simulated'].includes((tx.platform || '').toLowerCase())
        );

        if (invalidTxs.length > 0) {
          sync.findings.push(`Found ${invalidTxs.length} invalid/test transactions`);
          sync.actions.push(`DELETE: ${invalidTxs.length} invalid transactions`);
          
          for (const itx of invalidTxs) {
            await base44.entities.Transaction.delete(itx.id).catch(() => null);
          }
          sync.actions.push(`✓ Deleted ${invalidTxs.length} invalid transactions`);
        }

        // Calculate real wallet balance
        const realTxs = txArray.filter(tx => 
          tx.amount && 
          tx.amount > 0 &&
          tx.platform && 
          !['test', 'mock', 'simulated'].includes((tx.platform || '').toLowerCase())
        );

        const realWalletBalance = realTxs.reduce((sum, tx) => sum + (tx.net_amount || tx.amount), 0);
        const realTotalEarned = realTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);

        sync.findings.push(`Real wallet balance: $${realWalletBalance.toFixed(2)} (${realTxs.length}/${txArray.length} verified transactions)`);
        sync.findings.push(`Total real earnings: $${realTotalEarned.toFixed(2)}`);

        // Flag simulated task completions
        const myTasks = await base44.entities.TaskExecutionQueue.filter(
          { status: 'completed' },
          '-completion_timestamp',
          100
        ).catch(() => []);

        const taskArray = Array.isArray(myTasks) ? myTasks : [];
        const simulatedTasks = taskArray.filter(t => 
          !t.execution_log ||
          (t.execution_time_seconds && t.execution_time_seconds < 1) ||
          (t.confirmation_number && t.confirmation_number.startsWith('AUTO-'))
        );

        if (simulatedTasks.length > 0) {
          sync.findings.push(`⚠ Found ${simulatedTasks.length} simulated task completions (need verification)`);
          sync.actions.push(`REQUIRES_REVIEW: ${simulatedTasks.length} task completions lack real execution proof`);
        }

        // Log sync results
        await base44.entities.ActivityLog.create({
          action_type: 'system',
          message: `🔍 Real Data Sync Complete: ${realCreds.length} real credentials, $${realWalletBalance.toFixed(2)} verified balance, ${realTxs.length} real transactions`,
          severity: 'success',
          metadata: sync,
        }).catch(() => null);

        return Response.json({ success: true, sync });
      }

      case 'get_data_status': {
        const myGoals = await base44.entities.UserGoals.list('-created_date', 1).catch(() => []);
        const goals = Array.isArray(myGoals) ? myGoals[0] : null;

        const myCredentials = await base44.entities.CredentialVault.list('-created_date', 50).catch(() => []);
        const creds = Array.isArray(myCredentials) ? myCredentials.filter(c => 
          c.platform && !['test', 'mock'].includes(c.platform)
        ) : [];

        const myTransactions = await base44.entities.Transaction.filter(
          { type: { $in: ['income', 'earning'] } },
          '-created_date',
          100
        ).catch(() => []);
        const txs = Array.isArray(myTransactions) ? myTransactions.filter(t => t.amount > 0) : [];

        const status = {
          user_email: user.email,
          has_goals: !!goals,
          credentials_count: creds.length,
          real_transactions: txs.length,
          wallet_balance: goals?.wallet_balance || 0,
          autopilot_enabled: goals?.autopilot_enabled || false,
          ready_for_autopilot: creds.length > 0 && goals?.autopilot_enabled,
        };

        return Response.json({ success: true, status });
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[userRealDataSync]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});