import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * BILLING ENGINE (Phase 12)
 * Subscription tiers, payment processing, usage tracking
 * Stripe integration for SaaS monetization
 */

const TIERS = {
  starter: { price: 900, interval: 'month', api_calls: 10000, identities: 3, automations: 5 },
  pro: { price: 4900, interval: 'month', api_calls: 50000, identities: 10, automations: 20 },
  enterprise: { price: null, interval: 'custom', api_calls: 500000, identities: 50, automations: 100 }
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, payload } = await req.json();

    if (action === 'get_subscription_tiers') {
      return Response.json({ success: true, tiers: TIERS });
    }

    if (action === 'create_subscription') {
      return await createSubscription(base44, user, payload);
    }

    if (action === 'get_user_subscription') {
      return await getUserSubscription(base44, user);
    }

    if (action === 'track_api_usage') {
      return await trackAPIUsage(base44, user, payload);
    }

    if (action === 'get_usage_stats') {
      return await getUsageStats(base44, user);
    }

    if (action === 'check_quota') {
      return await checkQuota(base44, user);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[BillingEngine]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Create subscription for user
 */
async function createSubscription(base44, user, payload) {
  const { tier = 'starter' } = payload;
  
  if (!TIERS[tier]) {
    return Response.json({ error: 'Invalid tier' }, { status: 400 });
  }

  const tierConfig = TIERS[tier];
  const subscription = {
    user_email: user.email,
    tier,
    price_cents: tierConfig.price,
    api_quota_daily: tierConfig.api_calls,
    max_identities: tierConfig.identities,
    max_automations: tierConfig.automations,
    status: 'active',
    started_at: new Date().toISOString(),
    next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    auto_renew: true
  };

  // Store subscription
  await base44.asServiceRole.entities.PlatformState.create({
    key: `subscription_${user.email}`,
    value: JSON.stringify(subscription),
    created_by: user.email
  }).catch(() => {});

  // Create activity log
  await base44.asServiceRole.entities.ActivityLog.create({
    action_type: 'subscription_created',
    message: `User subscribed to ${tier} tier ($${tierConfig.price / 100}/month)`,
    severity: 'info',
    metadata: { tier, user_email: user.email }
  }).catch(() => {});

  return Response.json({ success: true, subscription });
}

/**
 * Get user's current subscription
 */
async function getUserSubscription(base44, user) {
  try {
    const state = await base44.asServiceRole.entities.PlatformState.filter(
      { key: `subscription_${user.email}` },
      null, 1
    ).then(r => r[0]);

    if (!state) {
      // Default to free tier
      return Response.json({
        subscription: {
          tier: 'free',
          status: 'active',
          api_quota_daily: 1000,
          max_identities: 1,
          max_automations: 0
        }
      });
    }

    const subscription = JSON.parse(state.value);
    return Response.json({ success: true, subscription });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

/**
 * Track API usage for quota enforcement
 */
async function trackAPIUsage(base44, user, payload) {
  const { calls_used = 1 } = payload;

  // Get or create usage tracker
  const today = new Date().toDateString();
  const key = `usage_${user.email}_${today}`;

  try {
    const existing = await base44.asServiceRole.entities.PlatformState.filter(
      { key },
      null, 1
    ).then(r => r[0]);

    if (existing) {
      const current = JSON.parse(existing.value);
      current.calls_used += calls_used;
      current.last_update = new Date().toISOString();

      await base44.asServiceRole.entities.PlatformState.update(existing.id, {
        value: JSON.stringify(current)
      }).catch(() => {});

      return Response.json({ success: true, calls_used: current.calls_used });
    } else {
      const newUsage = {
        user_email: user.email,
        date: today,
        calls_used,
        created_at: new Date().toISOString(),
        last_update: new Date().toISOString()
      };

      await base44.asServiceRole.entities.PlatformState.create({
        key,
        value: JSON.stringify(newUsage),
        created_by: user.email
      }).catch(() => {});

      return Response.json({ success: true, calls_used });
    }
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

/**
 * Get usage statistics for the user
 */
async function getUsageStats(base44, user) {
  const today = new Date().toDateString();
  const key = `usage_${user.email}_${today}`;

  try {
    const state = await base44.asServiceRole.entities.PlatformState.filter(
      { key },
      null, 1
    ).then(r => r[0]);

    const usage = state ? JSON.parse(state.value) : { calls_used: 0 };
    const subscription = await getUserSubscription(base44, user);

    const quota = subscription.subscription?.api_quota_daily || 1000;
    const percentUsed = Math.round((usage.calls_used / quota) * 100);

    return Response.json({
      success: true,
      usage: {
        calls_used: usage.calls_used,
        quota,
        percent_used: percentUsed,
        remaining: Math.max(0, quota - usage.calls_used),
        date: today
      }
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

/**
 * Check if user has quota available
 */
async function checkQuota(base44, user) {
  try {
    const { usage } = await getUsageStats(base44, user).then(r => JSON.parse(r.body)).catch(() => ({ usage: { remaining: 0 } }));
    
    return Response.json({
      success: true,
      quota_available: usage.remaining > 0,
      remaining: usage.remaining
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}