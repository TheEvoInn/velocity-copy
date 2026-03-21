import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, payload } = await req.json();

    if (action === 'trigger_widget_display') {
      return handleWidgetTrigger(base44, payload, user);
    } else if (action === 'update_metrics') {
      return handleMetricsUpdate(base44, payload, user);
    } else if (action === 'refresh_widget_data') {
      return handleWidgetRefresh(base44, payload, user);
    } else if (action === 'trigger_automation') {
      return handleAutomationTrigger(base44, payload, user);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Social proof workflow error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function handleWidgetTrigger(base44, payload, user) {
  const { widgetId, triggerEvent } = payload;

  // Fetch widget
  const widget = await base44.entities.SocialProofWidget.read(widgetId);
  if (!widget || widget.created_by !== user.email) {
    return Response.json({ error: 'Widget not found' }, { status: 404 });
  }

  // Check if trigger matches
  if (!widget.triggers.includes(triggerEvent)) {
    return Response.json({
      displayed: false,
      reason: 'Trigger not configured for this widget'
    });
  }

  // Check trigger conditions
  const conditionsMet = await evaluateTriggerConditions(widget, triggerEvent);
  if (!conditionsMet) {
    return Response.json({
      displayed: false,
      reason: 'Conditions not met'
    });
  }

  // Record impression
  await base44.entities.SocialProofWidget.update(widgetId, {
    'performance_metrics.total_impressions': (widget.performance_metrics?.total_impressions || 0) + 1,
    'performance_metrics.last_updated': new Date().toISOString()
  });

  return Response.json({
    displayed: true,
    widget: widget,
    timestamp: new Date().toISOString()
  });
}

async function handleMetricsUpdate(base44, payload, user) {
  const { widgetId, eventType, data } = payload;

  const widget = await base44.entities.SocialProofWidget.read(widgetId);
  if (!widget || widget.created_by !== user.email) {
    return Response.json({ error: 'Widget not found' }, { status: 404 });
  }

  const updates = {
    'performance_metrics.last_updated': new Date().toISOString()
  };

  if (eventType === 'click') {
    updates['performance_metrics.total_clicks'] = (widget.performance_metrics?.total_clicks || 0) + 1;
  }

  // Calculate CTR
  if (widget.performance_metrics?.total_impressions) {
    const totalClicks = updates['performance_metrics.total_clicks'] || widget.performance_metrics?.total_clicks || 0;
    updates['performance_metrics.click_through_rate'] = (totalClicks / widget.performance_metrics.total_impressions) * 100;
  }

  await base44.entities.SocialProofWidget.update(widgetId, updates);

  return Response.json({
    success: true,
    metrics: updates
  });
}

async function handleWidgetRefresh(base44, payload, user) {
  const { storefrontId } = payload;

  // Fetch all widgets for storefront
  const widgets = await base44.entities.SocialProofWidget.filter(
    { storefront_id: storefrontId, created_by: user.email },
    null,
    100
  );

  // Prepare fresh data for each widget
  const refreshedData = widgets.map(widget => {
    const config = widget.display_config || {};

    // Simulate or fetch real data based on widget type
    let data = {};
    switch (widget.widget_type) {
      case 'recent_purchase':
        data = generateRecentPurchases(config);
        break;
      case 'visitor_count':
        data = generateVisitorData(config);
        break;
      case 'scarcity_timer':
        data = calculateTimeRemaining(config);
        break;
      default:
        data = config;
    }

    return {
      widgetId: widget.id,
      type: widget.widget_type,
      data: data,
      timestamp: new Date().toISOString()
    };
  });

  return Response.json({
    success: true,
    widgets: refreshedData
  });
}

async function handleAutomationTrigger(base44, payload, user) {
  const { storefrontId, triggerEvent } = payload;

  // Get all widgets with matching trigger
  const widgets = await base44.entities.SocialProofWidget.filter(
    { storefront_id: storefrontId, created_by: user.email },
    null,
    100
  );

  const matchingWidgets = widgets.filter(w => 
    w.enabled && w.triggers.includes(triggerEvent)
  );

  // Update each matching widget's metrics
  for (const widget of matchingWidgets) {
    const conditionsMet = await evaluateTriggerConditions(widget, triggerEvent);
    if (conditionsMet) {
      await base44.entities.SocialProofWidget.update(widget.id, {
        'performance_metrics.total_impressions': (widget.performance_metrics?.total_impressions || 0) + 1,
        'performance_metrics.last_updated': new Date().toISOString()
      });
    }
  }

  return Response.json({
    success: true,
    triggeredCount: matchingWidgets.length
  });
}

function evaluateTriggerConditions(widget, triggerEvent) {
  const conditions = widget.trigger_conditions || {};

  if (triggerEvent === 'user_idle_30s' || triggerEvent === 'user_idle_60s') {
    const displayCount = widget.performance_metrics?.total_impressions || 0;
    const maxDisplays = conditions.max_displays_per_session || 3;
    return displayCount < maxDisplays;
  }

  if (triggerEvent === 'scroll_to_middle') {
    return conditions.show_after_scroll_percent !== false;
  }

  if (triggerEvent === 'time_based') {
    const minTime = conditions.min_page_time_seconds || 5;
    return true; // In production, track actual page time
  }

  return true;
}

function generateRecentPurchases(config) {
  const names = ['John', 'Sarah', 'Mike', 'Emma', 'David'];
  const cities = ['California', 'Texas', 'New York', 'Florida', 'Illinois'];
  const purchases = [];

  for (let i = 0; i < (config.max_notifications || 2); i++) {
    const minutesAgo = Math.floor(Math.random() * 30) + 1;
    purchases.push({
      buyer: names[Math.floor(Math.random() * names.length)] + ' ' + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + '.',
      location: cities[Math.floor(Math.random() * cities.length)],
      timeAgo: minutesAgo === 1 ? '1 minute ago' : `${minutesAgo} minutes ago`
    });
  }

  return purchases;
}

function generateVisitorData(config) {
  const currentCount = parseInt(config.start_count || 1240);
  const increment = Math.floor(Math.random() * (config.max_increment || 10)) + 1;
  return {
    count: currentCount + increment,
    timestamp: new Date().toISOString()
  };
}

function calculateTimeRemaining(config) {
  const endTime = new Date(config.end_time);
  const now = new Date();
  const diff = endTime - now;

  if (diff <= 0) {
    return { expired: true };
  }

  return {
    hours: Math.floor(diff / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
    expired: false
  };
}