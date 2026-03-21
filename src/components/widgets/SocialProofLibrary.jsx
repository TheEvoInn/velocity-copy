import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ShoppingBag, Clock, AlertTriangle, Star, Users,
  Plus, Settings, Eye, Copy, Trash2
} from 'lucide-react';
import RecentPurchaseWidget from './RecentPurchaseWidget';
import ScarcityTimerWidget from './ScarcityTimerWidget';
import InventoryLevelWidget from './InventoryLevelWidget';
import ReviewStarWidget from './ReviewStarWidget';
import VisitorCountWidget from './VisitorCountWidget';

const WIDGET_TEMPLATES = [
  {
    id: 'recent-purchase',
    name: 'Recent Purchase Notification',
    icon: ShoppingBag,
    description: 'Show recent buyer notifications',
    component: RecentPurchaseWidget,
    defaultConfig: {
      enabled: true,
      title: 'Someone just bought!',
      position: 'bottom-right',
      displayDuration: 5000,
      bgColor: '#06b6d4',
      textColor: '#ffffff',
      maxNotifications: 2,
    },
    triggers: ['purchase_completed', 'on_page_load'],
  },
  {
    id: 'scarcity-timer',
    name: 'Scarcity Timer',
    icon: Clock,
    description: 'Countdown to offer expiration',
    component: ScarcityTimerWidget,
    defaultConfig: {
      enabled: true,
      title: 'Limited Time Offer',
      position: 'top-right',
      bgColor: '#f59e0b',
      textColor: '#ffffff',
      message: 'Get it before it\'s gone!',
      endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    triggers: ['page_load', 'user_idle_for_30s'],
  },
  {
    id: 'inventory-level',
    name: 'Inventory Level Indicator',
    icon: AlertTriangle,
    description: 'Display low stock warnings',
    component: InventoryLevelWidget,
    defaultConfig: {
      enabled: true,
      title: 'Only a few left!',
      position: 'top-right',
      bgColor: '#ef4444',
      textColor: '#ffffff',
      remaining: 5,
      total: 20,
      showThreshold: 30,
      message: 'Act fast before they\'re gone',
    },
    triggers: ['inventory_drops_below_threshold'],
  },
  {
    id: 'review-stars',
    name: 'Review Star Rating',
    icon: Star,
    description: 'Display product rating & reviews',
    component: ReviewStarWidget,
    defaultConfig: {
      enabled: true,
      position: 'top-left',
      bgColor: '#10b981',
      textColor: '#ffffff',
      rating: 4.8,
      reviewCount: 1240,
      message: 'Customers love this product',
    },
    triggers: ['page_load', 'scroll_to_middle'],
  },
  {
    id: 'visitor-count',
    name: 'Live Visitor Counter',
    icon: Users,
    description: 'Show active visitors count',
    component: VisitorCountWidget,
    defaultConfig: {
      enabled: true,
      position: 'bottom-left',
      bgColor: '#8b5cf6',
      textColor: '#ffffff',
      startCount: 1240,
      updateFrequency: 'every-5-min',
      maxIncrement: 10,
      label: 'people',
      message: 'visiting now',
    },
    triggers: ['page_load'],
  },
];

export default function SocialProofLibrary({ storefrontId, onAddWidget }) {
  const [activeWidgets, setActiveWidgets] = useState([]);
  const [selectedWidget, setSelectedWidget] = useState(null);

  const handleAddWidget = (template) => {
    const newWidget = {
      id: `${template.id}-${Date.now()}`,
      templateId: template.id,
      config: { ...template.defaultConfig },
      triggers: [...template.triggers],
    };
    setActiveWidgets([...activeWidgets, newWidget]);
    if (onAddWidget) onAddWidget(newWidget);
  };

  const handleRemoveWidget = (widgetId) => {
    setActiveWidgets(activeWidgets.filter(w => w.id !== widgetId));
  };

  const handleConfigUpdate = (widgetId, newConfig) => {
    setActiveWidgets(activeWidgets.map(w =>
      w.id === widgetId ? { ...w, config: newConfig } : w
    ));
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="available" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-slate-800/50">
          <TabsTrigger value="available">Available Widgets</TabsTrigger>
          <TabsTrigger value="active">
            Active Widgets ({activeWidgets.length})
          </TabsTrigger>
        </TabsList>

        {/* Available Widgets */}
        <TabsContent value="available" className="space-y-3">
          {WIDGET_TEMPLATES.map(template => {
            const Icon = template.icon;
            return (
              <Card key={template.id} className="glass-card border-slate-700">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <Icon className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-1" />
                      <div>
                        <h3 className="font-semibold text-foreground mb-1">{template.name}</h3>
                        <p className="text-xs text-muted-foreground mb-2">{template.description}</p>
                        <div className="flex gap-2 flex-wrap">
                          {template.triggers.map(trigger => (
                            <span
                              key={trigger}
                              className="px-2 py-1 rounded text-xs bg-slate-700/50 text-slate-300"
                            >
                              {trigger}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleAddWidget(template)}
                      size="sm"
                      variant="outline"
                      className="ml-2 gap-1 flex-shrink-0"
                    >
                      <Plus className="w-3 h-3" />
                      Add
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Active Widgets */}
        <TabsContent value="active" className="space-y-3">
          {activeWidgets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No widgets added yet. Add one from the Available Widgets tab.</p>
            </div>
          ) : (
            activeWidgets.map(widget => {
              const template = WIDGET_TEMPLATES.find(t => t.templateId === widget.templateId);
              const Icon = template?.icon || ShoppingBag;
              return (
                <Card key={widget.id} className="glass-card border-slate-700">
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="w-5 h-5 text-cyan-400" />
                          <span className="font-semibold text-foreground">{template?.name}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => setSelectedWidget(selectedWidget === widget.id ? null : widget.id)}
                            size="sm"
                            variant="outline"
                            className="gap-1"
                          >
                            <Settings className="w-3 h-3" />
                            Config
                          </Button>
                          <Button
                            onClick={() => handleRemoveWidget(widget.id)}
                            size="sm"
                            variant="outline"
                            className="gap-1 text-red-400 hover:text-red-500"
                          >
                            <Trash2 className="w-3 h-3" />
                            Remove
                          </Button>
                        </div>
                      </div>

                      {/* Preview */}
                      <div className="relative bg-slate-900/50 rounded border border-slate-700 h-32 overflow-hidden">
                        {template && (
                          <template.component config={widget.config} />
                        )}
                      </div>

                      {/* Configuration */}
                      {selectedWidget === widget.id && (
                        <WidgetConfigPanel
                          widget={widget}
                          template={template}
                          onUpdate={(newConfig) => handleConfigUpdate(widget.id, newConfig)}
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function WidgetConfigPanel({ widget, template, onUpdate }) {
  if (!template) return null;

  const configFields = {
    'recent-purchase': ['title', 'position', 'displayDuration', 'bgColor', 'textColor', 'maxNotifications'],
    'scarcity-timer': ['title', 'position', 'bgColor', 'textColor', 'message', 'endTime'],
    'inventory-level': ['title', 'position', 'bgColor', 'textColor', 'remaining', 'total', 'showThreshold', 'message'],
    'review-stars': ['position', 'bgColor', 'textColor', 'rating', 'reviewCount', 'message'],
    'visitor-count': ['position', 'bgColor', 'textColor', 'startCount', 'updateFrequency', 'maxIncrement', 'label', 'message'],
  };

  const fields = configFields[template.templateId] || [];

  return (
    <div className="bg-slate-900/50 rounded border border-slate-700 p-4 space-y-3">
      <h4 className="text-xs font-semibold text-slate-300 uppercase">Configuration</h4>
      {fields.map(field => (
        <div key={field} className="flex items-center justify-between">
          <label className="text-xs text-slate-400">{field}</label>
          <input
            type={field.includes('Color') ? 'color' : field === 'position' ? 'text' : 'text'}
            value={widget.config[field] || ''}
            onChange={(e) => onUpdate({ ...widget.config, [field]: e.target.value })}
            className="w-32 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white"
          />
        </div>
      ))}
    </div>
  );
}