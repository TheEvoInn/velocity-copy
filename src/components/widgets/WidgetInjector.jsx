import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import RecentPurchaseWidget from './RecentPurchaseWidget';
import ScarcityTimerWidget from './ScarcityTimerWidget';
import InventoryLevelWidget from './InventoryLevelWidget';
import ReviewStarWidget from './ReviewStarWidget';
import VisitorCountWidget from './VisitorCountWidget';

const WIDGET_COMPONENTS = {
  recent_purchase: RecentPurchaseWidget,
  scarcity_timer: ScarcityTimerWidget,
  inventory_level: InventoryLevelWidget,
  review_stars: ReviewStarWidget,
  visitor_count: VisitorCountWidget,
};

export default function WidgetInjector({ storefrontId, triggerEvent = 'page_load' }) {
  const [widgets, setWidgets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWidgets();
  }, [storefrontId]);

  useEffect(() => {
    if (triggerEvent && widgets.length > 0) {
      triggerWidgetDisplay(triggerEvent);
    }
  }, [triggerEvent, widgets]);

  const loadWidgets = async () => {
    try {
      const data = await base44.entities.SocialProofWidget.filter(
        { storefront_id: storefrontId, enabled: true },
        '-created_at',
        100
      );
      setWidgets(data);
    } catch (error) {
      console.error('Failed to load widgets:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerWidgetDisplay = async (event) => {
    for (const widget of widgets) {
      if (widget.triggers?.includes(event)) {
        try {
          const response = await base44.functions.invoke('socialProofWorkflow', {
            action: 'trigger_widget_display',
            payload: {
              widgetId: widget.id,
              triggerEvent: event
            }
          });

          if (response.data?.displayed) {
            recordMetric(widget.id, 'impression');
          }
        } catch (error) {
          console.error('Failed to trigger widget:', error);
        }
      }
    }
  };

  const recordMetric = async (widgetId, eventType) => {
    try {
      await base44.functions.invoke('socialProofWorkflow', {
        action: 'update_metrics',
        payload: {
          widgetId,
          eventType,
          data: { timestamp: new Date().toISOString() }
        }
      });
    } catch (error) {
      console.error('Failed to record metric:', error);
    }
  };

  if (loading) return null;

  return (
    <>
      {widgets.map(widget => {
        const Component = WIDGET_COMPONENTS[widget.widget_type];
        if (!Component) return null;

        const config = {
          ...widget.display_config,
          enabled: widget.enabled,
          position: widget.position,
          triggers: widget.triggers,
        };

        return (
          <div
            key={widget.id}
            onClick={() => recordMetric(widget.id, 'click')}
          >
            <Component config={config} />
          </div>
        );
      })}
    </>
  );
}