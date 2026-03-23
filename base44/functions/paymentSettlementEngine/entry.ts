import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * PAYMENT SETTLEMENT ENGINE
 * Automated payment settlement and payout processing
 * - Batch settlement processing
 * - Payout scheduling
 * - Transaction reconciliation
 * - Fraud detection before settlement
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Verify user is admin for settlement operations
    if (user.role !== 'admin' && req.method !== 'GET') {
      return jsonResponse({ error: 'Admin access required' }, 403);
    }

    const body = req.method !== 'GET' ? await req.json().catch(() => ({})) : {};
    const { action } = body;

    if (action === 'get_pending_settlements') {
      return await getPendingSettlements(base44, user);
    }

    if (action === 'process_settlements') {
      return await processSettlements(base44, user, body);
    }

    if (action === 'settle_transaction') {
      return await settleTransaction(base44, user, body);
    }

    if (action === 'schedule_payout') {
      return await schedulePayout(base44, user, body);
    }

    if (action === 'verify_settlement_integrity') {
      return await verifySettlementIntegrity(base44, user);
    }

    return jsonResponse({ error: 'Unknown action' }, 400);

  } catch (error) {
    console.error('[PaymentSettlementEngine]', error.message);
    return jsonResponse({ error: error.message }, 500);
  }
});

/**
 * Get pending settlements ready for processing
 */
async function getPendingSettlements(base44, user) {
  try {
    const transactions = await base44.asServiceRole.entities.Transaction.filter(
      { payout_status: 'available' },
      '-created_date',
      100
    ).catch(() => []);

    const totalAmount = transactions.reduce((sum, t) => sum + (t.net_amount || 0), 0);

    return jsonResponse({
      total_pending: transactions.length,
      total_amount: totalAmount,
      transactions: transactions.map(t => ({
        id: t.id,
        amount: t.amount,
        net_amount: t.net_amount,
        platform: t.platform,
        category: t.category,
        created_date: t.created_date
      }))
    });
  } catch (error) {
    console.error('[Get Pending Settlements]', error.message);
    return jsonResponse({ error: 'Failed to fetch settlements' }, 500);
  }
}

/**
 * Process batch settlements
 */
async function processSettlements(base44, user, body) {
  const { transaction_ids = [], auto_detect = true } = body;

  try {
    let toSettle = transaction_ids;

    // Auto-detect if not specified
    if (auto_detect && toSettle.length === 0) {
      const pending = await base44.asServiceRole.entities.Transaction.filter(
        { payout_status: 'available' },
        '-created_date',
        200
      ).catch(() => []);
      toSettle = pending.map(t => t.id);
    }

    let processed = 0;
    let settled = 0;
    let failed = 0;

    for (const txId of toSettle) {
      const result = await settleTransaction(base44, user, { transaction_id: txId });
      processed++;

      if (result.status === 200) {
        const data = JSON.parse(await result.text());
        if (data.success) settled++;
        else failed++;
      }
    }

    // Log settlement batch
    await base44.asServiceRole.entities.AuditLog.create({
      entity_type: 'Transaction',
      action_type: 'batch_settlement',
      user_email: user.email,
      details: {
        total_processed: processed,
        settled,
        failed,
        transaction_ids: toSettle.slice(0, 10) // Log first 10
      },
      severity: failed > 0 ? 'medium' : 'low',
      timestamp: new Date().toISOString()
    }).catch(() => {});

    return jsonResponse({
      success: true,
      processed,
      settled,
      failed
    });
  } catch (error) {
    console.error('[Process Settlements]', error.message);
    return jsonResponse({ error: 'Failed to process settlements' }, 500);
  }
}

/**
 * Settle individual transaction
 */
async function settleTransaction(base44, user, body) {
  const { transaction_id } = body;
  if (!transaction_id) {
    return jsonResponse({ error: 'transaction_id required' }, 400);
  }

  try {
    const tx = await base44.asServiceRole.entities.Transaction.filter(
      { id: transaction_id },
      null, 1
    ).then(r => r[0]).catch(() => null);

    if (!tx) {
      return jsonResponse({ error: 'Transaction not found' }, 404);
    }

    // Fraud detection
    const fraudRisk = await detectFraud(base44, tx);
    if (fraudRisk.isFraud) {
      await base44.asServiceRole.entities.Transaction.update(transaction_id, {
        payout_status: 'fraud_hold',
        updated_date: new Date().toISOString()
      }).catch(() => {});

      return jsonResponse({ 
        success: false, 
        error: 'Fraud risk detected',
        risk_score: fraudRisk.score
      }, 400);
    }

    // Mark as pending settlement
    const payoutDate = new Date(Date.now() + 2 * 86400000); // 2 days
    await base44.asServiceRole.entities.Transaction.update(transaction_id, {
      payout_status: 'pending',
      payout_date: payoutDate.toISOString(),
      updated_date: new Date().toISOString()
    }).catch(() => {});

    // Create settlement audit
    await base44.asServiceRole.entities.AuditLog.create({
      entity_type: 'Transaction',
      entity_id: transaction_id,
      action_type: 'settlement_initiated',
      user_email: user.email,
      details: {
        amount: tx.net_amount,
        payout_date: payoutDate.toISOString(),
        fraud_score: fraudRisk.score
      },
      severity: 'low',
      timestamp: new Date().toISOString()
    }).catch(() => {});

    return jsonResponse({
      success: true,
      transaction_id,
      payout_date: payoutDate.toISOString(),
      amount: tx.net_amount
    });
  } catch (error) {
    console.error('[Settle Transaction]', error.message);
    return jsonResponse({ error: 'Failed to settle transaction' }, 500);
  }
}

/**
 * Schedule payout for bank transfer
 */
async function schedulePayout(base44, user, body) {
  const { transaction_ids = [] } = body;

  try {
    const pending = await base44.asServiceRole.entities.Transaction.filter(
      { payout_status: 'pending' },
      '-payout_date',
      100
    ).catch(() => []);

    let scheduled = 0;

    for (const tx of pending) {
      const payoutTime = new Date(tx.payout_date);
      if (payoutTime <= new Date()) {
        await base44.asServiceRole.entities.Transaction.update(tx.id, {
          payout_status: 'processing',
          updated_date: new Date().toISOString()
        }).catch(() => {});
        scheduled++;
      }
    }

    return jsonResponse({
      success: true,
      scheduled,
      message: `${scheduled} payouts scheduled for processing`
    });
  } catch (error) {
    console.error('[Schedule Payout]', error.message);
    return jsonResponse({ error: 'Failed to schedule payouts' }, 500);
  }
}

/**
 * Verify settlement integrity
 */
async function verifySettlementIntegrity(base44, user) {
  try {
    const all = await base44.asServiceRole.entities.Transaction.list('-created_date', 500).catch(() => []);
    
    const statusBreakdown = {
      available: all.filter(t => t.payout_status === 'available').length,
      pending: all.filter(t => t.payout_status === 'pending').length,
      processing: all.filter(t => t.payout_status === 'processing').length,
      cleared: all.filter(t => t.payout_status === 'cleared').length,
      fraud_hold: all.filter(t => t.payout_status === 'fraud_hold').length
    };

    // Verify math: gross = net + fee + tax
    let integrityIssues = 0;
    for (const tx of all) {
      const expectedGross = (tx.net_amount || 0) + (tx.platform_fee || 0) + (tx.tax_withheld || 0);
      const tolerance = 0.01; // $0.01 tolerance
      if (Math.abs(expectedGross - (tx.amount || 0)) > tolerance) {
        integrityIssues++;
      }
    }

    return jsonResponse({
      total_transactions: all.length,
      status_breakdown: statusBreakdown,
      integrity_issues: integrityIssues,
      integrity_score: Math.round(((all.length - integrityIssues) / all.length) * 100)
    });
  } catch (error) {
    console.error('[Verify Integrity]', error.message);
    return jsonResponse({ error: 'Failed to verify integrity' }, 500);
  }
}

/**
 * Fraud detection
 */
async function detectFraud(base44, transaction) {
  let score = 0;

  // Amount anomaly
  if (transaction.amount > 100000) score += 15;
  if (transaction.platform_fee_pct > 50) score += 20;
  if (transaction.tax_rate_pct > 40) score += 10;

  // Platform risk
  if (transaction.platform === 'unknown') score += 25;

  // Pattern check
  const recentTxs = await base44.asServiceRole.entities.Transaction.filter(
    { created_by: transaction.created_by },
    '-created_date',
    20
  ).catch(() => []);

  const totalRecent = recentTxs.reduce((sum, t) => sum + (t.amount || 0), 0);
  if (totalRecent > 500000 && recentTxs.length > 15) score += 20;

  return {
    isFraud: score > 50,
    score
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}