import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await req.json();

    if (action === 'reconcile_transactions') {
      const transactions = await base44.entities.Transaction.filter({
        created_by: user.email
      });

      const issues = [];
      const duplicates = [];
      const balanceErrors = [];

      // Check for duplicate transactions (same amount, platform, within 5 min)
      for (let i = 0; i < transactions.length; i++) {
        for (let j = i + 1; j < transactions.length; j++) {
          const t1 = transactions[i];
          const t2 = transactions[j];

          if (t1.amount === t2.amount && 
              t1.platform === t2.platform &&
              Math.abs(new Date(t1.created_date).getTime() - new Date(t2.created_date).getTime()) < 5 * 60 * 1000) {
            duplicates.push({ id1: t1.id, id2: t2.id, amount: t1.amount });
            issues.push({ type: 'duplicate', severity: 'high', ids: [t1.id, t2.id] });
          }
        }
      }

      // Check for balance consistency
      let expectedBalance = 0;
      const userGoals = await base44.entities.UserGoals.filter({
        created_by: user.email
      }).then(r => r[0]);

      const actualBalance = userGoals?.wallet_balance || 0;
      
      for (const t of transactions.sort((a, b) => new Date(a.created_date) - new Date(b.created_date))) {
        if (t.type === 'income') {
          expectedBalance += (t.net_amount || t.amount);
        } else if (t.type === 'expense') {
          expectedBalance -= t.amount;
        }
      }

      if (Math.abs(expectedBalance - actualBalance) > 0.01) {
        balanceErrors.push({
          expected: expectedBalance,
          actual: actualBalance,
          variance: actualBalance - expectedBalance
        });
        issues.push({ type: 'balance_mismatch', severity: 'critical', variance: actualBalance - expectedBalance });
      }

      // Check for missing required fields
      const incompleteTransactions = transactions.filter(t => 
        !t.platform || !t.category || (t.type === 'income' && !t.opportunity_id)
      );

      if (incompleteTransactions.length > 0) {
        issues.push({ type: 'incomplete_data', severity: 'medium', count: incompleteTransactions.length });
      }

      // Log audit record
      await base44.entities.AuditLog.create({
        entity_type: 'Transaction',
        action_type: 'reconciliation',
        user_email: user.email,
        details: {
          total_transactions: transactions.length,
          duplicates_found: duplicates.length,
          balance_variance: balanceErrors[0]?.variance || 0,
          incomplete_count: incompleteTransactions.length
        },
        status: issues.length > 0 ? 'issues_found' : 'clean',
        severity: issues.some(i => i.severity === 'critical') ? 'critical' : 
                 issues.some(i => i.severity === 'high') ? 'high' : 'low'
      });

      return Response.json({
        success: true,
        total_transactions: transactions.length,
        issues_found: issues.length,
        duplicates: duplicates.length,
        balance_variance: balanceErrors.length > 0 ? balanceErrors[0].variance : 0,
        incomplete: incompleteTransactions.length,
        details: issues
      });
    }

    if (action === 'detect_anomalies') {
      const transactions = await base44.entities.Transaction.filter({
        created_by: user.email,
        created_date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() }
      });

      const anomalies = [];

      // Calculate average transaction amount
      const avgAmount = transactions.reduce((sum, t) => sum + (t.amount || 0), 0) / Math.max(transactions.length, 1);
      const stdDev = Math.sqrt(
        transactions.reduce((sum, t) => sum + Math.pow((t.amount || 0) - avgAmount, 2), 0) / Math.max(transactions.length, 1)
      );

      // Flag transactions > 3 standard deviations from mean
      for (const t of transactions) {
        if (Math.abs((t.amount || 0) - avgAmount) > 3 * stdDev) {
          anomalies.push({
            transaction_id: t.id,
            amount: t.amount,
            deviation: ((t.amount - avgAmount) / avgAmount * 100).toFixed(2) + '%',
            type: 'outlier_amount'
          });
        }

        // Check for unusual platforms
        if (t.platform && t.platform.toLowerCase().includes('unknown')) {
          anomalies.push({
            transaction_id: t.id,
            amount: t.amount,
            platform: t.platform,
            type: 'unknown_platform'
          });
        }

        // Check for rapid-fire transactions (more than 5 in 1 hour from same platform)
        const sameHour = transactions.filter(tx =>
          tx.platform === t.platform &&
          Math.abs(new Date(tx.created_date).getTime() - new Date(t.created_date).getTime()) < 60 * 60 * 1000
        );

        if (sameHour.length > 5) {
          anomalies.push({
            transaction_id: t.id,
            platform: t.platform,
            count_in_hour: sameHour.length,
            type: 'rapid_fire'
          });
          break; // Only flag once per platform
        }
      }

      if (anomalies.length > 0) {
        await base44.entities.AuditLog.create({
          entity_type: 'Transaction',
          action_type: 'anomaly_detection',
          user_email: user.email,
          details: { anomalies_found: anomalies.length },
          status: 'anomalies_detected',
          severity: anomalies.some(a => a.type === 'unknown_platform') ? 'high' : 'medium'
        });
      }

      return Response.json({ success: true, anomalies_found: anomalies.length, anomalies });
    }

    if (action === 'get_audit_logs') {
      const { limit = 100, entity_type = null } = await req.json();

      let query = { user_email: user.email };
      if (entity_type) {
        query.entity_type = entity_type;
      }

      const logs = await base44.entities.AuditLog.filter(query, '-created_date', limit);

      return Response.json({ success: true, logs, total: logs.length });
    }

    if (action === 'resolve_duplicate') {
      const { keep_id, remove_id, merge_data = {} } = await req.json();

      // Log the resolution
      await base44.entities.AuditLog.create({
        entity_type: 'Transaction',
        action_type: 'duplicate_resolution',
        user_email: user.email,
        details: { kept_id: keep_id, removed_id: remove_id, merged_fields: Object.keys(merge_data) },
        status: 'resolved'
      });

      // Update kept transaction with merged data
      await base44.entities.Transaction.update(keep_id, merge_data);

      // Delete duplicate (soft delete via status)
      await base44.entities.Transaction.update(remove_id, { status: 'deleted_duplicate' });

      return Response.json({ success: true, message: 'Duplicate resolved' });
    }

    if (action === 'fix_balance') {
      const userGoals = await base44.entities.UserGoals.filter({
        created_by: user.email
      }).then(r => r[0]);

      if (!userGoals) {
        return Response.json({ error: 'User goals not found' }, { status: 404 });
      }

      const transactions = await base44.entities.Transaction.filter({
        created_by: user.email,
        status: { $ne: 'deleted_duplicate' }
      });

      // Recalculate balance from transactions
      let calculatedBalance = 0;
      for (const t of transactions) {
        if (t.type === 'income') {
          calculatedBalance += (t.net_amount || t.amount);
        } else if (t.type === 'expense') {
          calculatedBalance -= t.amount;
        }
      }

      const oldBalance = userGoals.wallet_balance;

      // Update user goals with correct balance
      await base44.entities.UserGoals.update(userGoals.id, {
        wallet_balance: calculatedBalance
      });

      // Log the fix
      await base44.entities.AuditLog.create({
        entity_type: 'UserGoals',
        action_type: 'balance_correction',
        user_email: user.email,
        details: { old_balance: oldBalance, new_balance: calculatedBalance, variance: calculatedBalance - oldBalance },
        status: 'corrected',
        severity: 'high'
      });

      return Response.json({ 
        success: true, 
        old_balance: oldBalance,
        new_balance: calculatedBalance,
        correction: calculatedBalance - oldBalance
      });
    }

    if (action === 'full_data_integrity_check') {
      // Run all checks
      const recResults = await base44.functions.invoke('dataIntegrityVerifier', {
        action: 'reconcile_transactions'
      });

      const anomResults = await base44.functions.invoke('dataIntegrityVerifier', {
        action: 'detect_anomalies'
      });

      const overallStatus = recResults.data.issues_found === 0 && anomResults.data.anomalies_found === 0 ? 'healthy' : 'issues_detected';

      return Response.json({
        success: true,
        timestamp: new Date().toISOString(),
        overall_status: overallStatus,
        reconciliation: {
          issues: recResults.data.issues_found,
          duplicates: recResults.data.duplicates,
          balance_variance: recResults.data.balance_variance,
          incomplete: recResults.data.incomplete
        },
        anomalies: {
          detected: anomResults.data.anomalies_found
        }
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Data integrity verifier error:', error);
    return Response.json(
      { error: error.message || 'Data integrity check failed' },
      { status: 500 }
    );
  }
});