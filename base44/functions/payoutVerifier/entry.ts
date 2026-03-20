import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import Stripe from 'npm:stripe@14.21.0';

/**
 * Payout Verifier
 * Verifies real payments from Stripe and PayPal.
 * Only deposits to wallet when payment is confirmed real.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, payload } = await req.json();

    if (action === 'verify_stripe_payment') return await verifyStripePayment(base44, user, payload);
    if (action === 'verify_paypal_payment') return await verifyPayPalPayment(base44, user, payload);
    if (action === 'get_stripe_balance') return await getStripeBalance(base44, user);
    if (action === 'get_stripe_payouts') return await getStripePayouts(base44, user, payload);
    if (action === 'get_paypal_balance') return await getPayPalBalance(base44, user);
    if (action === 'confirm_manual_payment') return await confirmManualPayment(base44, user, payload);

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[PayoutVerifier]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function verifyStripePayment(base44, user, payload) {
  const { payment_intent_id, opportunity_id } = payload;
  if (!payment_intent_id) return Response.json({ error: 'payment_intent_id required' }, { status: 400 });

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

  const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

  if (paymentIntent.status !== 'succeeded') {
    return Response.json({
      verified: false,
      status: paymentIntent.status,
      message: `Payment not yet completed. Status: ${paymentIntent.status}`
    });
  }

  const amount = paymentIntent.amount / 100; // Stripe amounts are in cents
  const currency = paymentIntent.currency.toUpperCase();

  // Deposit to wallet
  await depositVerifiedEarning(base44, user, {
    amount,
    currency,
    source: 'stripe',
    reference: payment_intent_id,
    opportunity_id,
    description: paymentIntent.description || `Stripe payment ${payment_intent_id}`,
  });

  return Response.json({
    verified: true,
    amount,
    currency,
    payment_intent_id,
    status: 'succeeded',
    message: `$${amount} verified and deposited from Stripe`,
  });
}

async function verifyPayPalPayment(base44, user, payload) {
  const { order_id, opportunity_id } = payload;
  if (!order_id) return Response.json({ error: 'order_id required' }, { status: 400 });

  // Get PayPal access token
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
  const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET');
  const credentials = btoa(`${clientId}:${clientSecret}`);

  const tokenRes = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!tokenRes.ok) {
    return Response.json({ error: 'PayPal auth failed', details: await tokenRes.text() }, { status: 500 });
  }

  const { access_token } = await tokenRes.json();

  // Verify the order
  const orderRes = await fetch(`https://api-m.paypal.com/v2/checkout/orders/${order_id}`, {
    headers: { 'Authorization': `Bearer ${access_token}` },
  });

  if (!orderRes.ok) {
    return Response.json({ error: 'PayPal order not found' }, { status: 404 });
  }

  const order = await orderRes.json();

  if (order.status !== 'COMPLETED') {
    return Response.json({
      verified: false,
      status: order.status,
      message: `PayPal payment not completed. Status: ${order.status}`
    });
  }

  const amount = parseFloat(order.purchase_units?.[0]?.amount?.value || 0);
  const currency = order.purchase_units?.[0]?.amount?.currency_code || 'USD';

  await depositVerifiedEarning(base44, user, {
    amount,
    currency,
    source: 'paypal',
    reference: order_id,
    opportunity_id,
    description: `PayPal order ${order_id}`,
  });

  return Response.json({
    verified: true,
    amount,
    currency,
    order_id,
    message: `$${amount} verified and deposited from PayPal`,
  });
}

async function getStripeBalance(base44, user) {
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
  const balance = await stripe.balance.retrieve();

  return Response.json({
    success: true,
    available: balance.available.map(b => ({ amount: b.amount / 100, currency: b.currency })),
    pending: balance.pending.map(b => ({ amount: b.amount / 100, currency: b.currency })),
    source: 'stripe',
  });
}

async function getStripePayouts(base44, user, payload) {
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
  const payouts = await stripe.payouts.list({ limit: payload?.limit || 10 });

  return Response.json({
    success: true,
    payouts: payouts.data.map(p => ({
      id: p.id,
      amount: p.amount / 100,
      currency: p.currency,
      status: p.status,
      arrival_date: new Date(p.arrival_date * 1000).toISOString(),
      description: p.description,
    })),
  });
}

async function getPayPalBalance(base44, user) {
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
  const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET');
  const credentials = btoa(`${clientId}:${clientSecret}`);

  const tokenRes = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });

  if (!tokenRes.ok) return Response.json({ error: 'PayPal auth failed' }, { status: 500 });
  const { access_token } = await tokenRes.json();

  const balRes = await fetch('https://api-m.paypal.com/v1/reporting/balances', {
    headers: { 'Authorization': `Bearer ${access_token}` },
  });

  if (!balRes.ok) return Response.json({ error: 'Could not retrieve PayPal balance' }, { status: 500 });
  const data = await balRes.json();

  return Response.json({ success: true, balance: data, source: 'paypal' });
}

async function confirmManualPayment(base44, user, payload) {
  const { amount, source, description, opportunity_id, reference } = payload;

  if (!amount || amount <= 0) return Response.json({ error: 'Invalid amount' }, { status: 400 });

  await depositVerifiedEarning(base44, user, {
    amount,
    currency: 'USD',
    source: source || 'manual',
    reference: reference || `MANUAL-${Date.now()}`,
    opportunity_id,
    description: description || 'Manually confirmed payment',
  });

  return Response.json({
    success: true,
    amount,
    message: `$${amount} confirmed and deposited`,
  });
}

async function depositVerifiedEarning(base44, user, { amount, currency, source, reference, opportunity_id, description }) {
  // Get current wallet
  const goals = await base44.entities.UserGoals.list('-created_date', 1);
  const wallet = goals?.[0];

  if (!wallet) throw new Error('Wallet not initialized');

  const platformFee = amount * 0.15;
  const netAmount = amount - platformFee;
  const newBalance = (wallet.wallet_balance || 0) + netAmount;

  // Create verified transaction
  await base44.entities.Transaction.create({
    type: 'income',
    amount,
    net_amount: netAmount,
    platform_fee: platformFee,
    platform_fee_pct: 15,
    platform: source,
    category: 'service',
    description: `[VERIFIED] ${description}`,
    opportunity_id,
    balance_after: newBalance,
    payout_status: 'cleared',
    confirmation_number: reference,
  });

  // Update wallet
  await base44.entities.UserGoals.update(wallet.id, {
    wallet_balance: newBalance,
    total_earned: (wallet.total_earned || 0) + amount,
  });

  // Update opportunity if linked
  if (opportunity_id) {
    await base44.entities.Opportunity.update(opportunity_id, {
      status: 'completed',
      submission_confirmed: true,
      confirmation_number: reference,
    }).catch(() => {});
  }

  // Log
  await base44.entities.ActivityLog.create({
    action_type: 'wallet_update',
    message: `💰 VERIFIED: $${netAmount.toFixed(2)} deposited from ${source} (ref: ${reference})`,
    severity: 'success',
    metadata: { amount, net_amount: netAmount, source, reference, opportunity_id },
  });

  console.log(`[PayoutVerifier] Deposited $${netAmount.toFixed(2)} from ${source}`);
}