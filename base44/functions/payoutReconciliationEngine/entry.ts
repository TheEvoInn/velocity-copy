import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * PAYOUT RECONCILIATION ENGINE
 * Real-time settlement tracking and discrepancy detection across all platforms
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'reconcile';

    if (action === 'reconcile') {
      return await reconcilePayouts(base44, user);
    }

    if (action === 'get_discrepancies') {
      return await getDiscrepancies(base44, user);
    }

    if (action === 'get_payout_status') {
      return await getPayoutStatus(base44, user);
    }

    return jsonResponse({ error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('[PayoutReconciliationEngine]', error.message);
    return jsonResponse({ error: error.message }, 500);
  }
});

/**
 * Reconcile payouts across all platforms
 */
async function reconcilePayouts(base44, user) {
  const transactions = await base44.entities.Transaction
    .filter({ created_by: user.email }, '-created_date', 500)
    .catch(() => []);

  const byPlatform = {};
  transactions.forEach(t => {
    if (!byPlatform[t.platform]) byPlatform[t.platform] = { gross: 0, fees: 0, net: 0, count: 0 };
    byPlatform[t.platform].gross += t.amount || 0;
    byPlatform[t.platform].fees += t.platform_fee || 0;
    byPlatform[t.platform].net += t.net_amount || 0;
    byPlatform[t.platform].count += 1;
  });

  const discrepancies = [];
  Object.entries(byPlatform).forEach(([platform, data]) => {
    const calculated = data.gross - data.fees;
    if (Math.abs(calculated - data.net) > 0.01) {
      discrepancies.push({
        platform,
        expected_net: calculated,
        actual_net: data.net,
        variance: data.net - calculated
      });
    }
  });

  return jsonResponse({
    reconciliation_timestamp: new Date().toISOString(),
    total_transactions: transactions.length,
    platforms_reconciled: Object.keys(byPlatform).length,
    platform_summary: byPlatform,
    discrepancies,
    reconciliation_status: discrepancies.length === 0 ? 'balanced' : 'issues_found'
  });
}

/**
 * Get discrepancies
 */
async function getDiscrepancies(base44, user) {
  const transactions = await base44.entities.Transaction
    .filter({ created_by: user.email }, '-created_date', 500)
    .catch(() => []);

  const discrepancies = [];

  transactions.forEach(t => {
    if (t.payout_status === 'pending' && new Date(t.payout_date) < new Date(Date.now() - 172800000)) {
      discrepancies.push({
        transaction_id: t.id,
        type: 'delayed_payout',
        platform: t.platform,
        amount: t.net_amount,
        expected_date: t.payout_date,
        days_delayed: Math.floor((Date.now() - new Date(t.payout_date)) / 86400000),
        severity: 'medium'
      });
    }

    if (t.tax_withheld > t.net_amount * 0.5) {
      discrepancies.push({
        transaction_id: t.id,
        type: 'unusual_withholding',
        platform: t.platform,
        amount: t.amount,
        withheld: t.tax_withheld,
        rate_pct: t.tax_rate_pct,
        severity: 'high'
      });
    }
  });

  return jsonResponse({
    total_discrepancies: discrepancies.length,
    discrepancies: discrepancies.slice(0, 50),
    action_required: discrepancies.length > 0
  });
}

/**
 * Get payout status
 */
async function getPayoutStatus(base44, user) {
  const transactions = await base44.entities.Transaction
    .filter({ created_by: user.email }, '-created_date', 100)
    .catch(() => []);

  const statusBreakdown = {
    available: transactions.filter(t => t.payout_status === 'available').length,
    pending: transactions.filter(t => t.payout_status === 'pending').length,
    in_transit: transactions.filter(t => t.payout_status === 'in_transit').length,
    cleared: transactions.filter(t => t.payout_status === 'cleared').length
  };

  const totals = {
    available: transactions
      .filter(t => t.payout_status === 'available')
      .reduce((sum, t) => sum + (t.net_amount || 0), 0),
    pending: transactions
      .filter(t => t.payout_status === 'pending')
      .reduce((sum, t) => sum + (t.net_amount || 0), 0),
    cleared: transactions
      .filter(t => t.payout_status === 'cleared')
      .reduce((sum, t) => sum + (t.net_amount || 0), 0)
  };

  return jsonResponse({
    status_breakdown: statusBreakdown,
    totals_by_status: totals,
    total_cleared: totals.cleared,
    pending_amount: totals.pending,
    available_amount: totals.available,
    last_updated: new Date().toISOString()
  });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}