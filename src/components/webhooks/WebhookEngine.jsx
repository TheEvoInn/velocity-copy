/**
 * WEBHOOK ENGINE INTERFACE
 * Register and manage custom webhook endpoints for platform events
 * Real-time notifications for task completion, transactions, onboarding
 */

import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Plus, Zap, CheckCircle2, AlertTriangle, Copy, Trash2, Play, Eye } from 'lucide-react';
import { toast } from 'sonner';

export default function WebhookEngine() {
  const [webhooks, setWebhooks] = useState([]);
  const [availableEvents, setAvailableEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    endpoint_url: '',
    events: [],
    auth_type: 'none',
    auth_value: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [webhooksRes, eventsRes] = await Promise.all([
        base44.entities.WebhookConfig.list('-created_date', 50),
        base44.functions.invoke('webhookEventEngine', { action: 'get_available_events' })
      ]);
      setWebhooks(webhooksRes || []);
      setAvailableEvents(eventsRes.data?.events || []);
      setLoading(false);
    } catch (error) {
      console.error('Load error:', error);
      toast.error('Failed to load webhooks');
      setLoading(false);
    }
  };

  const handleCreateWebhook = async () => {
    if (!formData.name || !formData.endpoint_url || formData.events.length === 0) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      setLoading(true);
      const webhook = await base44.entities.WebhookConfig.create({
        name: formData.name,
        endpoint_url: formData.endpoint_url,
        events: formData.events,
        auth_type: formData.auth_type,
        auth_value: formData.auth_value || undefined,
        is_active: true
      });

      setWebhooks(prev => [webhook, ...prev]);
      setFormData({ name: '', endpoint_url: '', events: [], auth_type: 'none', auth_value: '' });
      setShowForm(false);
      toast.success('Webhook created successfully');
    } catch (error) {
      console.error('Create error:', error);
      toast.error('Failed to create webhook');
    } finally {
      setLoading(false);
    }
  };

  const handleTestWebhook = async (webhookId) => {
    try {
      setLoading(true);
      const webhook = webhooks.find(w => w.id === webhookId);
      const result = await base44.functions.invoke('webhookEventEngine', {
        action: 'test_webhook',
        data: {
          webhook_id: webhookId,
          event_type: webhook.events[0] || 'task.completed'
        }
      });

      if (result.data.success) {
        toast.success(`Test successful (${result.data.result.response_time_ms}ms)`);
      } else {
        toast.error(`Test failed: ${result.data.result.error}`);
      }
    } catch (error) {
      console.error('Test error:', error);
      toast.error('Failed to test webhook');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleWebhook = async (webhookId, isActive) => {
    try {
      await base44.entities.WebhookConfig.update(webhookId, { is_active: !isActive });
      setWebhooks(prev => prev.map(w => w.id === webhookId ? { ...w, is_active: !isActive } : w));
      toast.success(isActive ? 'Webhook disabled' : 'Webhook enabled');
    } catch (error) {
      console.error('Toggle error:', error);
      toast.error('Failed to update webhook');
    }
  };

  const handleDeleteWebhook = async (webhookId) => {
    if (!confirm('Delete this webhook? This cannot be undone.')) return;

    try {
      await base44.entities.WebhookConfig.delete(webhookId);
      setWebhooks(prev => prev.filter(w => w.id !== webhookId));
      toast.success('Webhook deleted');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete webhook');
    }
  };

  if (loading && webhooks.length === 0) {
    return (
      <Card className="glass-card border-slate-700">
        <CardContent className="pt-8 flex items-center justify-center gap-3">
          <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
          <span className="text-sm text-slate-400">Loading webhooks...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Zap className="w-8 h-8 text-cyan-400" />
            <div>
              <h2 className="text-2xl font-bold font-orbitron text-white">Webhook Engine</h2>
              <p className="text-sm text-slate-400">Register endpoints for real-time platform events</p>
            </div>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="gap-2 btn-cosmic">
            <Plus className="w-4 h-4" />
            Register Endpoint
          </Button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <Card className="glass-card border-cyan-500/30">
          <CardHeader>
            <CardTitle className="text-base">Register New Webhook</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              type="text"
              placeholder="Webhook Name (e.g., 'External CRM Task Sync')"
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
            <input
              type="url"
              placeholder="Endpoint URL (https://...)"
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm"
              value={formData.endpoint_url}
              onChange={(e) => setFormData(prev => ({ ...prev, endpoint_url: e.target.value }))}
            />

            <div>
              <label className="text-xs text-slate-400 mb-2 block">Subscribe to Events</label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {availableEvents.map(event => (
                  <label key={event.event_type} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.events.includes(event.event_type)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData(prev => ({ ...prev, events: [...prev.events, event.event_type] }));
                        } else {
                          setFormData(prev => ({ ...prev, events: prev.events.filter(ev => ev !== event.event_type) }));
                        }
                      }}
                    />
                    <span className="text-slate-300">{event.event_type}</span>
                  </label>
                ))}
              </div>
            </div>

            <select
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm"
              value={formData.auth_type}
              onChange={(e) => setFormData(prev => ({ ...prev, auth_type: e.target.value }))}
            >
              <option value="none">No Authentication</option>
              <option value="bearer_token">Bearer Token</option>
              <option value="api_key">API Key</option>
            </select>

            {formData.auth_type !== 'none' && (
              <input
                type="password"
                placeholder={formData.auth_type === 'bearer_token' ? 'Bearer Token' : 'API Key'}
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm"
                value={formData.auth_value}
                onChange={(e) => setFormData(prev => ({ ...prev, auth_value: e.target.value }))}
              />
            )}

            <div className="flex gap-2">
              <Button onClick={handleCreateWebhook} disabled={loading} className="flex-1 btn-cosmic">
                {loading ? 'Creating...' : 'Create Webhook'}
              </Button>
              <Button onClick={() => setShowForm(false)} variant="outline" className="flex-1">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Webhooks List */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="glass-card border-slate-700">
          <TabsTrigger value="active">Active ({webhooks.filter(w => w.is_active).length})</TabsTrigger>
          <TabsTrigger value="inactive">Inactive ({webhooks.filter(w => !w.is_active).length})</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Active Webhooks */}
        <TabsContent value="active" className="space-y-3 mt-4">
          {webhooks.filter(w => w.is_active).length === 0 ? (
            <Card className="glass-card border-slate-700 p-6 text-center text-slate-400">
              <p>No active webhooks. Create one to get started.</p>
            </Card>
          ) : (
            webhooks.filter(w => w.is_active).map(webhook => (
              <WebhookCard
                key={webhook.id}
                webhook={webhook}
                onTest={() => handleTestWebhook(webhook.id)}
                onToggle={() => handleToggleWebhook(webhook.id, webhook.is_active)}
                onDelete={() => handleDeleteWebhook(webhook.id)}
                onSelect={() => setSelectedWebhook(webhook)}
              />
            ))
          )}
        </TabsContent>

        {/* Inactive Webhooks */}
        <TabsContent value="inactive" className="space-y-3 mt-4">
          {webhooks.filter(w => !w.is_active).length === 0 ? (
            <Card className="glass-card border-slate-700 p-6 text-center text-slate-400">
              <p>No inactive webhooks.</p>
            </Card>
          ) : (
            webhooks.filter(w => !w.is_active).map(webhook => (
              <WebhookCard
                key={webhook.id}
                webhook={webhook}
                onTest={() => handleTestWebhook(webhook.id)}
                onToggle={() => handleToggleWebhook(webhook.id, webhook.is_active)}
                onDelete={() => handleDeleteWebhook(webhook.id)}
                onSelect={() => setSelectedWebhook(webhook)}
              />
            ))
          )}
        </TabsContent>

        {/* Analytics */}
        <TabsContent value="analytics" className="space-y-3 mt-4">
          {webhooks.map(webhook => (
            <Card key={webhook.id} className="glass-card border-slate-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-white">{webhook.name}</h4>
                <Badge variant={webhook.delivery_stats?.success_rate > 90 ? 'default' : 'secondary'}>
                  {Math.round(webhook.delivery_stats?.success_rate || 0)}% Success
                </Badge>
              </div>
              <div className="grid grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-slate-400">Total Deliveries</p>
                  <p className="text-xl font-bold text-white">{webhook.delivery_stats?.total_deliveries || 0}</p>
                </div>
                <div>
                  <p className="text-slate-400">Successful</p>
                  <p className="text-xl font-bold text-emerald-400">{webhook.delivery_stats?.successful_deliveries || 0}</p>
                </div>
                <div>
                  <p className="text-slate-400">Failed</p>
                  <p className="text-xl font-bold text-red-400">{webhook.delivery_stats?.failed_deliveries || 0}</p>
                </div>
                <div>
                  <p className="text-slate-400">Last Triggered</p>
                  <p className="text-xs text-slate-300">
                    {webhook.last_triggered_at ? new Date(webhook.last_triggered_at).toLocaleDateString() : 'Never'}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Webhook Details */}
      {selectedWebhook && (
        <Card className="glass-card border-cyan-500/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>{selectedWebhook.name}</span>
              <Button variant="outline" size="sm" onClick={() => setSelectedWebhook(null)}>Close</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-slate-400 mb-1">Endpoint URL</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-slate-800/50 rounded text-xs text-slate-300 break-all">
                  {selectedWebhook.endpoint_url}
                </code>
                <Button size="sm" variant="ghost" onClick={() => {
                  navigator.clipboard.writeText(selectedWebhook.endpoint_url);
                  toast.success('Copied to clipboard');
                }}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-400 mb-2">Subscribed Events</p>
              <div className="flex flex-wrap gap-2">
                {(selectedWebhook.events || []).map(event => (
                  <Badge key={event} variant="outline">{event}</Badge>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-400 mb-2">Recent Deliveries</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {(selectedWebhook.recent_deliveries || []).slice(0, 5).map((delivery, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs p-2 bg-slate-800/30 rounded">
                    <span className="text-slate-300">{new Date(delivery.timestamp).toLocaleTimeString()}</span>
                    <span className={delivery.status === 'success' ? 'text-emerald-400' : 'text-red-400'}>
                      {delivery.status} ({delivery.response_code})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documentation */}
      <Card className="glass-card border-slate-700 p-6">
        <h3 className="font-semibold text-white mb-4">Available Events</h3>
        <div className="space-y-2 text-sm">
          {availableEvents.map(event => (
            <div key={event.event_type} className="flex items-start gap-3 p-2 bg-slate-800/30 rounded">
              <span className="font-mono text-cyan-400 text-xs shrink-0">{event.event_type}</span>
              <span className="text-slate-300">{event.description}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function WebhookCard({ webhook, onTest, onToggle, onDelete, onSelect }) {
  return (
    <Card className={`glass-card border-slate-700 cursor-pointer hover:border-cyan-500/50 transition-all ${!webhook.is_active ? 'opacity-60' : ''}`}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-semibold text-white">{webhook.name}</h4>
              <Badge variant={webhook.is_active ? 'default' : 'secondary'}>
                {webhook.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 break-all mb-2">{webhook.endpoint_url}</p>
            <div className="flex flex-wrap gap-1">
              {(webhook.events || []).slice(0, 3).map(event => (
                <Badge key={event} variant="outline" className="text-xs">{event}</Badge>
              ))}
              {webhook.events && webhook.events.length > 3 && (
                <Badge variant="outline" className="text-xs">+{webhook.events.length - 3} more</Badge>
              )}
            </div>
            {webhook.last_triggered_at && (
              <p className="text-xs text-slate-500 mt-2">
                Last: {new Date(webhook.last_triggered_at).toLocaleString()}
              </p>
            )}
          </div>

          <div className="flex gap-1 shrink-0">
            <Button size="sm" variant="ghost" onClick={onTest} title="Test webhook">
              <Play className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onSelect()} title="View details">
              <Eye className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onToggle} title={webhook.is_active ? 'Disable' : 'Enable'}>
              {webhook.is_active ? '○' : '●'}
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete} title="Delete" className="text-red-400 hover:text-red-300">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}