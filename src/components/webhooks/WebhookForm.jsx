import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';

const EVENT_TYPES = [
  'notification.created',
  'notification.read',
  'rule.triggered',
  'rule.completed',
  'rule.failed',
  'account.verified',
  'account.failed'
];

export default function WebhookForm({ webhook, onSubmit, isLoading, lastDelivery }) {
  const [formData, setFormData] = useState(webhook || {
    name: '',
    endpoint_url: '',
    events: [],
    payload_format: 'default',
    custom_payload_template: '',
    auth_type: 'none',
    auth_value: '',
    timeout_seconds: 30,
    is_active: true,
    test_mode: false,
    headers: {}
  });

  const [showAuth, setShowAuth] = useState(false);
  const [headerKey, setHeaderKey] = useState('');
  const [headerValue, setHeaderValue] = useState('');

  const toggleEvent = (event) => {
    setFormData({
      ...formData,
      events: formData.events.includes(event)
        ? formData.events.filter(e => e !== event)
        : [...formData.events, event]
    });
  };

  const addHeader = () => {
    if (headerKey && headerValue) {
      setFormData({
        ...formData,
        headers: {
          ...formData.headers,
          [headerKey]: headerValue
        }
      });
      setHeaderKey('');
      setHeaderValue('');
    }
  };

  const removeHeader = (key) => {
    const newHeaders = { ...formData.headers };
    delete newHeaders[key];
    setFormData({ ...formData, headers: newHeaders });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Webhook Configuration</CardTitle>
          <CardDescription>Configure where and when events are sent</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Webhook Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Analytics Dashboard"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Endpoint URL</label>
              <Input
                type="url"
                value={formData.endpoint_url}
                onChange={(e) => setFormData({ ...formData, endpoint_url: e.target.value })}
                placeholder="https://your-domain.com/webhook"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Timeout (seconds)</label>
                <Input
                  type="number"
                  value={formData.timeout_seconds}
                  onChange={(e) => setFormData({ ...formData, timeout_seconds: Number(e.target.value) })}
                  min="5"
                  max="120"
                />
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Active</label>
                  <div className="text-xs text-slate-400">
                    {formData.is_active ? 'Enabled' : 'Disabled'}
                  </div>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.test_mode}
                onCheckedChange={(checked) => setFormData({ ...formData, test_mode: checked })}
              />
              <label className="text-sm">Test Mode (webhooks logged, not sent)</label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Events */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Events to Subscribe</CardTitle>
          <CardDescription>Select which events trigger this webhook</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {EVENT_TYPES.map((event) => (
              <button
                key={event}
                onClick={() => toggleEvent(event)}
                className={`px-3 py-2 rounded-lg border transition-all text-sm ${
                  formData.events.includes(event)
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-100'
                    : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-cyan-400'
                }`}
              >
                {event}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Payload Format */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Payload Configuration</CardTitle>
          <CardDescription>Customize the JSON payload sent to your endpoint</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Payload Format</label>
            <Select value={formData.payload_format} onValueChange={(value) => 
              setFormData({ ...formData, payload_format: value })
            }>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default Format</SelectItem>
                <SelectItem value="custom">Custom Template</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.payload_format === 'custom' && (
            <div>
              <label className="text-sm font-medium mb-2 block">Custom Payload Template</label>
              <Textarea
                value={formData.custom_payload_template}
                onChange={(e) => setFormData({ ...formData, custom_payload_template: e.target.value })}
                placeholder={`{
  "webhook_event": "{{event_type}}",
  "timestamp": "{{timestamp}}",
  "payload": {{data}}
}`}
                className="font-mono text-xs h-40"
              />
              <p className="text-xs text-slate-400 mt-2">
                Available variables: {"{'{'}event_type{'}'}, {'{'}timestamp{'}'}, and any fields from event data"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Authentication */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Authentication</CardTitle>
          <CardDescription>Add auth headers to secure your webhook</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Auth Type</label>
            <Select value={formData.auth_type} onValueChange={(value) =>
              setFormData({ ...formData, auth_type: value })
            }>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="bearer_token">Bearer Token</SelectItem>
                <SelectItem value="api_key">API Key</SelectItem>
                <SelectItem value="basic">Basic Auth</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.auth_type !== 'none' && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                {formData.auth_type === 'bearer_token' ? 'Token' : 
                 formData.auth_type === 'api_key' ? 'API Key' : 'Credentials'}
              </label>
              <div className="relative">
                <Input
                  type={showAuth ? 'text' : 'password'}
                  value={formData.auth_value}
                  onChange={(e) => setFormData({ ...formData, auth_value: e.target.value })}
                  placeholder="Enter your secret"
                />
                <button
                  type="button"
                  onClick={() => setShowAuth(!showAuth)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                >
                  {showAuth ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          {/* Custom Headers */}
          <div className="space-y-3">
            <label className="text-sm font-medium block">Custom Headers</label>
            <div className="flex gap-2">
              <Input
                placeholder="Header name"
                value={headerKey}
                onChange={(e) => setHeaderKey(e.target.value)}
              />
              <Input
                placeholder="Header value"
                value={headerValue}
                onChange={(e) => setHeaderValue(e.target.value)}
              />
              <Button onClick={addHeader} variant="outline" size="sm">Add</Button>
            </div>

            {Object.entries(formData.headers).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between bg-slate-800/50 p-2 rounded text-sm">
                <span className="text-slate-300">{key}: {value}</span>
                <button
                  onClick={() => removeHeader(key)}
                  className="text-red-400 hover:text-red-300 text-xs"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Last Delivery Status */}
      {lastDelivery && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {lastDelivery.status === 'success' ? (
                <CheckCircle2 className="text-emerald-500" size={20} />
              ) : (
                <AlertCircle className="text-amber-500" size={20} />
              )}
              Last Delivery
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Status:</span>
              <Badge variant={lastDelivery.status === 'success' ? 'default' : 'destructive'}>
                {lastDelivery.status}
              </Badge>
            </div>
            {lastDelivery.response_code && (
              <div className="flex justify-between">
                <span className="text-slate-400">Response Code:</span>
                <span>{lastDelivery.response_code}</span>
              </div>
            )}
            {lastDelivery.response_time_ms && (
              <div className="flex justify-between">
                <span className="text-slate-400">Response Time:</span>
                <span>{lastDelivery.response_time_ms}ms</span>
              </div>
            )}
            {lastDelivery.error_message && (
              <div className="flex justify-between">
                <span className="text-slate-400">Error:</span>
                <span className="text-red-400 text-xs">{lastDelivery.error_message}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={isLoading || !formData.name || !formData.endpoint_url}
        className="w-full bg-cyan-600 hover:bg-cyan-700"
      >
        {isLoading ? 'Saving...' : webhook ? 'Update Webhook' : 'Create Webhook'}
      </Button>
    </div>
  );
}