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
      const { widgetId, triggerEvent } = payload;

      const widget = await base44.entities.SocialProofWidget.read(widgetId);
      if (!widget || widget.created_by !== user.email) {
        return Response.json({ error: 'Widget not found' }, { status: 404 });
      }

      if (!widget.triggers.includes(triggerEvent)) {
        return Response.json({
          displayed: false,
          reason: 'Trigger not configured'
        });
      }

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

    if (action === 'update_metrics') {
      const { widgetId, eventType } = payload;

      const widget = await base44.entities.SocialProofWidget.read(widgetId);
      if (!widget || widget.created_by !== user.email) {
        return Response.json({ error: 'Widget not found' }, { status: 404 });
      }

      const updates = {
        'performance_metrics.last_updated': new Date().toISOString()
      };

      if (eventType === 'click') {
        const currentClicks = widget.performance_metrics?.total_clicks || 0;
        updates['performance_metrics.total_clicks'] = currentClicks + 1;
      }

      await base44.entities.SocialProofWidget.update(widgetId, updates);

      return Response.json({
        success: true,
        metrics: updates
      });
    }

    if (action === 'refresh_widget_data') {
      const { storefrontId } = payload;

      const widgets = await base44.entities.SocialProofWidget.filter(
        { storefront_id: storefrontId, created_by: user.email },
        null,
        100
      );

      const refreshedData = widgets.map(widget => ({
        widgetId: widget.id,
        type: widget.widget_type,
        timestamp: new Date().toISOString()
      }));

      return Response.json({
        success: true,
        widgets: refreshedData
      });
    }

    if (action === 'trigger_automation') {
      const { storefrontId, triggerEvent } = payload;

      const widgets = await base44.entities.SocialProofWidget.filter(
        { storefront_id: storefrontId, created_by: user.email },
        null,
        100
      );

      let count = 0;
      for (const widget of widgets) {
        if (widget.enabled && widget.triggers?.includes(triggerEvent)) {
          await base44.entities.SocialProofWidget.update(widget.id, {
            'performance_metrics.total_impressions': (widget.performance_metrics?.total_impressions || 0) + 1,
            'performance_metrics.last_updated': new Date().toISOString()
          });
          count++;
        }
      }

      return Response.json({
        success: true,
        triggeredCount: count
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Social proof workflow error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});