/**
 * Payout Verifier — verifies real payments from PayPal and Stripe
 * Used to confirm actual earnings before depositing to wallet
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID');
const PAYPAL_CLIENT_SECRET = Deno.env.get('PAYPAL_CLIENT_SECRET');
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');

// ── PayPal helpers ────────────────────────────────────────────────────────────

async function getPayPalAccessToken() {
  const creds = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);
  const res = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal auth failed: ${err}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function verifyPayPalPayment(transactionId) {
  const token = await getPayPalAccessToken();
  const res = await fetch(`https://api-m.paypal.com/v2/payments/captures/${transactionId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) {
    // Try orders API if captures fails
    const orderRes = await fetch(`https://api-m.paypal.com/v2/checkout/orders/${transactionId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!orderRes.ok) throw new Error(`PayPal transaction ${transactionId} not found`);
    const order = await orderRes.json();
    return {
      verified: order.status === 'COMPLETED',
      status: order.status,
      amount: parseFloat(order.purchase_units?.[0]?.amount?.value || 0),
      currency: order.purchase_units?.[0]?.amount?.currency_code || 'USD',
      payer_email: order.payer?.email_address,
      transaction_id: transactionId,
      provider: 'paypal',
    };
  }
  const capture = await res.json();
  return {
    verified: capture.status === 'COMPLETED',
    status: capture.status,
    amount: parseFloat(capture.amount?.value || 0),
    currency: capture.amount?.currency_code || 'USD',
    transaction_id: transactionId,
    provider: 'paypal',
  };
}

async function listRecentPayPalPayments(days = 7) {
  const token = await getPayPalAccessToken();
  const startDate = new Date(Date.now() - days * 86400000).toISOString().split('.')[0] + 'Z';
  const res = await fetch(
    `https://api-m.paypal.com/v1/reporting/transactions?start_date=${startDate}&end_date=${new Date().toISOString().split('.')[0] + 'Z'}&fields=all&page_size=20`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`PayPal transactions list failed: ${res.status}`);
  const data = await res.json();
  return (data.transaction_details || []).map(t => ({
    transaction_id: t.transaction_info?.transaction_id,
    amount: parseFloat(t.transaction_info?.transaction_amount?.value || 0),
    currency: t.transaction_info?.transaction_amount?.currency_code || 'USD',
    status: t.transaction_info?.transaction_status,
    date: t.transaction_info?.transaction_initiation_date,
    payer_email: t.payer_info?.email_address,
    provider: 'paypal',
  }));
}

// ── Stripe helpers ────────────────────────────────────────────────────────────

async function verifyStripePayment(paymentIntentId) {
  const res = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
    headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
  });
  if (!res.ok) {
    // Try charges
    const chargeRes = await fetch(`https://api.stripe.com/v1/charges/${paymentIntentId}`, {
      headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
    });
    if (!chargeRes.ok) throw new Error(`Stripe payment ${paymentIntentId} not found`);
    const charge = await chargeRes.json();
    return {
      verified: charge.status === 'succeeded',
      status: charge.status,
      amount: charge.amount / 100,
      currency: charge.currency?.toUpperCase() || 'USD',
      transaction_id: paymentIntentId,
      provider: 'stripe',
    };
  }
  const pi = await res.json();
  return {
    verified: pi.status === 'succeeded',
    status: pi.status,
    amount: pi.amount_received / 100,
    currency: pi.currency?.toUpperCase() || 'USD',
    transaction_id: paymentIntentId,
    provider: 'stripe',
  };
}

async function listRecentStripePayments(days = 7) {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const res = await fetch(
    `https://api.stripe.com/v1/payment_intents?limit=20&created[gte]=${since}`,
    { headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` } }
  );
  if (!res.ok) throw new Error(`Stripe list failed: ${res.status}`);
  const data = await res.json();
  return (data.data || []).map(pi => ({
    transaction_id: pi.id,
    amount: pi.amount_received / 100,
    currency: pi.currency?.toUpperCase() || 'USD',
    status: pi.status,
    date: new Date(pi.created * 1000).toISOString(),
    provider: 'stripe',
  }));
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, payload } = await req.json();

    // Verify a specific transaction ID
    if (action === 'verify_payment') {
      const { transaction_id, provider } = payload;
      let result;
      if (provider === 'paypal') {
        if (!PAYPAL_CLIENT_ID) return Response.json({ error: 'PayPal not configured' }, { status: 500 });
        result = await verifyPayPalPayment(transaction_id);
      } else if (provider === 'stripe') {
        if (!STRIPE_SECRET_KEY) return Response.json({ error: 'Stripe not configured' }, { status: 500 });
        result = await verifyStripePayment(transaction_id);
      } else {
        return Response.json({ error: 'Unknown provider. Use: paypal or stripe' }, { status: 400 });
      }

      // If verified, deposit to wallet
      if (result.verified) {
        const goals = await base44.entities.UserGoals.list();
        const wallet = goals[0];
        if (wallet) {
          await base44.entities.Transaction.create({
            type: 'income',
            amount: result.amount,
            net_amount: result.amount,
            platform: provider,
            description: `Verified ${provider} payment: ${transaction_id}`,
            payout_status: 'cleared',
            confirmation_number: transaction_id,
          });
          await base44.entities.UserGoals.update(wallet.id, {
            wallet_balance: (wallet.wallet_balance || 0) + result.amount,
            total_earned: (wallet.total_earned || 0) + result.amount,
          });
          await base44.entities.ActivityLog.create({
            action_type: 'wallet_update',
            message: `✅ Payment verified & deposited: $${result.amount} from ${provider} (${transaction_id})`,
            severity: 'success',
            metadata: result,
          });
        }
      }

      return Response.json({ success: true, ...result });
    }

    // List recent payments from all configured providers
    if (action === 'list_recent_payments') {
      const days = payload?.days || 7;
      const payments = [];
      const errors = [];

      if (PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET) {
        try {
          const ppPayments = await listRecentPayPalPayments(days);
          payments.push(...ppPayments);
        } catch (e) {
          errors.push({ provider: 'paypal', error: e.message });
        }
      }

      if (STRIPE_SECRET_KEY) {
        try {
          const stripePayments = await listRecentStripePayments(days);
          payments.push(...stripePayments);
        } catch (e) {
          errors.push({ provider: 'stripe', error: e.message });
        }
      }

      return Response.json({ success: true, payments, errors, total: payments.length });
    }

    // Sync: check for new completed payments and auto-deposit unrecorded ones
    if (action === 'sync_payments') {
      const days = payload?.days || 3;
      const synced = [];
      const errors = [];

      const syncProvider = async (paymentsFn, providerName) => {
        const payments = await paymentsFn(days);
        for (const p of payments) {
          if (!p.transaction_id || p.amount <= 0) continue;
          // Check if already recorded
          const existing = await base44.entities.Transaction.filter({ confirmation_number: p.transaction_id });
          if (existing.length > 0) continue;
          // Only sync completed/succeeded payments
          const isCompleted = ['COMPLETED', 'succeeded', 'S'].includes(p.status);
          if (!isCompleted) continue;

          const goals = await base44.entities.UserGoals.list();
          const wallet = goals[0];
          await base44.entities.Transaction.create({
            type: 'income',
            amount: p.amount,
            net_amount: p.amount,
            platform: providerName,
            description: `Auto-synced ${providerName} payment`,
            payout_status: 'cleared',
            confirmation_number: p.transaction_id,
          });
          if (wallet) {
            await base44.entities.UserGoals.update(wallet.id, {
              wallet_balance: (wallet.wallet_balance || 0) + p.amount,
              total_earned: (wallet.total_earned || 0) + p.amount,
            });
          }
          synced.push({ provider: providerName, amount: p.amount, transaction_id: p.transaction_id });
        }
      };

      if (PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET) {
        try { await syncProvider(listRecentPayPalPayments, 'paypal'); }
        catch (e) { errors.push({ provider: 'paypal', error: e.message }); }
      }
      if (STRIPE_SECRET_KEY) {
        try { await syncProvider(listRecentStripePayments, 'stripe'); }
        catch (e) { errors.push({ provider: 'stripe', error: e.message }); }
      }

      if (synced.length > 0) {
        await base44.entities.ActivityLog.create({
          action_type: 'wallet_update',
          message: `💰 Payment sync: ${synced.length} new payment(s) deposited`,
          severity: 'success',
          metadata: { synced, errors },
        });
      }

      return Response.json({ success: true, synced, errors, total_synced: synced.length });
    }

    return Response.json({ error: 'Unknown action. Use: verify_payment, list_recent_payments, sync_payments' }, { status: 400 });

  } catch (error) {
    console.error('[payoutVerifier] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});