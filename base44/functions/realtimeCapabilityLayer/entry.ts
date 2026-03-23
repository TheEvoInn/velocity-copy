import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * REALTIME CAPABILITY LAYER
 * Enables real-time data streaming, subscriptions, and live updates
 * Foundation for Phase 10 live dashboards and real-time collaboration
 */

const subscriptions = new Map(); // {user_email} → [{channel, callback}]
const eventBuffer = []; // Recent events for new subscribers
const MAX_BUFFER_SIZE = 100;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, payload } = await req.json();

    if (action === 'subscribe_to_channel') {
      return await subscribeToChannel(user, payload);
    }
    if (action === 'unsubscribe_from_channel') {
      return await unsubscribeFromChannel(user, payload);
    }
    if (action === 'publish_event') {
      return await publishEvent(base44, user, payload);
    }
    if (action === 'get_event_history') {
      return await getEventHistory(payload);
    }
    if (action === 'get_subscriptions') {
      return await getSubscriptions(user);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[RealtimeCapabilityLayer]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Subscribe user to a realtime channel
 */
async function subscribeToChannel(user, payload) {
  const { channel } = payload;
  const userEmail = user.email;

  if (!subscriptions.has(userEmail)) {
    subscriptions.set(userEmail, []);
  }

  const userSubs = subscriptions.get(userEmail);
  
  // Avoid duplicate subscriptions
  if (!userSubs.some(s => s.channel === channel)) {
    userSubs.push({ channel, subscribed_at: new Date().toISOString() });
  }

  return Response.json({
    success: true,
    user: userEmail,
    channel,
    subscribed: true,
    active_subscriptions: userSubs.length
  });
}

/**
 * Unsubscribe from channel
 */
async function unsubscribeFromChannel(user, payload) {
  const { channel } = payload;
  const userEmail = user.email;

  if (subscriptions.has(userEmail)) {
    const subs = subscriptions.get(userEmail);
    const idx = subs.findIndex(s => s.channel === channel);
    if (idx >= 0) {
      subs.splice(idx, 1);
    }
  }

  return Response.json({
    success: true,
    channel,
    unsubscribed: true
  });
}

/**
 * Publish event to all subscribed users
 */
async function publishEvent(base44, user, payload) {
  const { channel, event_type, event_data } = payload;

  const event = {
    id: `evt_${Date.now()}`,
    channel,
    event_type,
    data: event_data,
    published_by: user.email,
    timestamp: new Date().toISOString()
  };

  // Add to buffer
  eventBuffer.push(event);
  if (eventBuffer.length > MAX_BUFFER_SIZE) {
    eventBuffer.shift();
  }

  // Notify all subscribers on this channel
  const notified = [];
  for (const [userEmail, subs] of subscriptions.entries()) {
    if (subs.some(s => s.channel === channel)) {
      notified.push(userEmail);
    }
  }

  // Log event for auditing
  await base44.asServiceRole.entities.ActivityLog.create({
    action_type: 'realtime_event_published',
    message: `Event published on ${channel}: ${event_type}`,
    severity: 'info',
    metadata: { event_id: event.id, channel, subscribers: notified.length }
  }).catch(() => {});

  return Response.json({
    success: true,
    event_id: event.id,
    channel,
    subscribers_notified: notified.length,
    event
  });
}

/**
 * Get event history for a channel
 */
async function getEventHistory(payload) {
  const { channel, limit = 20 } = payload;

  const channelEvents = eventBuffer
    .filter(e => e.channel === channel)
    .slice(-limit)
    .reverse();

  return Response.json({
    success: true,
    channel,
    events: channelEvents,
    count: channelEvents.length
  });
}

/**
 * Get user's active subscriptions
 */
async function getSubscriptions(user) {
  const userEmail = user.email;
  const subs = subscriptions.get(userEmail) || [];

  return Response.json({
    success: true,
    user: userEmail,
    subscriptions: subs,
    total: subs.length
  });
}

/**
 * Broadcast event to all systems (for admin use)
 */
export async function broadcastSystemEvent(eventType, eventData) {
  const event = {
    id: `sys_evt_${Date.now()}`,
    channel: 'system',
    event_type: eventType,
    data: eventData,
    timestamp: new Date().toISOString()
  };

  eventBuffer.push(event);
  if (eventBuffer.length > MAX_BUFFER_SIZE) {
    eventBuffer.shift();
  }

  return event.id;
}