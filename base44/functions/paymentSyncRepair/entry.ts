import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Payment Sync Repair
 * Validates and repairs Stripe/PayPal connection for earnings sync
 * Triggered when payoutVerifier fails
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get payment processor credentials
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    const paypalClientId = Deno.env.get('PAYPAL_CLIENT_ID');
    const paypalSecret = Deno.env.get('PAYPAL_CLIENT_SECRET');

    if (!stripeKey || !paypalClientId || !paypalSecret) {
      return Response.json({
        success: false,
        error: 'Payment processor credentials not configured',
        status: 'repair_blocked',
        next_action: 'Configure STRIPE_SECRET_KEY, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET in dashboard settings'
      }, { status: 400 });
    }

    // Test Stripe connection
    let stripeStatus = 'unknown';
    try {
      const stripeTest = await fetch('https://api.stripe.com/v1/account', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${stripeKey}`
        }
      });
      stripeStatus = stripeTest.ok ? 'valid' : 'invalid';
    } catch (e) {
      stripeStatus = 'error: ' + e.message;
    }

    // Test PayPal connection
    let paypalStatus = 'unknown';
    try {
      const paypalAuth = await fetch('https://api.paypal.com/v1/oauth2/token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Language': 'en_US'
        },
        body: new URLSearchParams({
          'grant_type': 'client_credentials',
          'client_id': paypalClientId,
          'client_secret': paypalSecret
        })
      });
      paypalStatus = paypalAuth.ok ? 'valid' : 'invalid';
    } catch (e) {
      paypalStatus = 'error: ' + e.message;
    }

    // Log repair attempt
    await base44.asServiceRole.entities.EngineAuditLog.create({
      event_type: 'payment_sync_repair',
      module: 'paymentSyncRepair',
      status: stripeStatus === 'valid' && paypalStatus === 'valid' ? 'success' : 'failed',
      details: {
        stripe_status: stripeStatus,
        paypal_status: paypalStatus,
        timestamp: new Date().toISOString()
      },
      actor: user.email,
      user_id: user.id
    });

    return Response.json({
      success: stripeStatus === 'valid' && paypalStatus === 'valid',
      stripe_connection: stripeStatus,
      paypal_connection: paypalStatus,
      repair_timestamp: new Date().toISOString(),
      next_action: 'Run payoutVerifier again if all green'
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});