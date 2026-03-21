/**
 * Webhook Configuration Page
 * Manage Task Reader webhooks and integrations
 */
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Zap, Settings, BarChart3 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import WebhookManager from '@/components/webhooks/WebhookManager';
import PayloadMapper from '@/components/webhooks/PayloadMapper';

export default function WebhookConfiguration() {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWebhook, setSelectedWebhook] = useState(null);

  useEffect(() => {
    loadWebhooks();
  }, []);

  const loadWebhooks = async () => {
    try {
      const res = await base44.entities.WebhookTaskTrigger.list();
      setWebhooks(res || []);
      setLoading(false);
    } catch (err) {
      console.error('Error loading webhooks:', err);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-violet-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-8 h-8 text-violet-400" />
            <h1 className="text-4xl font-bold text-white font-orbitron">Webhook Configuration</h1>
          </div>
          <p className="text-slate-300">
            Trigger Task Reader workflows from external services via secure webhooks
          </p>
        </div>

        {/* Info Banner */}
        <Card className="p-4 bg-violet-500/10 border-violet-500/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-violet-200">
            <p className="font-semibold mb-1">External Integration Ready</p>
            <p>Create webhooks to allow external services to trigger Task Reader tasks. Each webhook has a unique URL and secure token.</p>
          </div>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="webhooks" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-slate-900/50 border border-slate-800">
            <TabsTrigger value="webhooks" className="gap-2">
              <Zap className="w-4 h-4" />
              Webhooks
            </TabsTrigger>
            <TabsTrigger value="mapping" className="gap-2">
              <Settings className="w-4 h-4" />
              Payload Mapping
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Webhooks Tab */}
          <TabsContent value="webhooks" className="mt-6">
            <WebhookManager webhooks={webhooks} />
          </TabsContent>

          {/* Mapping Tab */}
          <TabsContent value="mapping" className="mt-6">
            {selectedWebhook ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">
                    Configure: {selectedWebhook.webhook_name}
                  </h3>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedWebhook(null)}
                  >
                    Back
                  </Button>
                </div>
                <PayloadMapper webhook={selectedWebhook} />
              </div>
            ) : (
              <Card className="p-6 text-center text-slate-400">
                <p className="mb-4">Select a webhook to configure payload mapping</p>
                <div className="space-y-2">
                  {webhooks.map(w => (
                    <Button
                      key={w.id}
                      variant="outline"
                      onClick={() => setSelectedWebhook(w)}
                      className="w-full justify-start"
                    >
                      {w.webhook_name}
                    </Button>
                  ))}
                </div>
              </Card>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-6">
            <div className="grid gap-4">
              {webhooks.map(webhook => (
                <Card key={webhook.id} className="p-4 bg-slate-900/50 border-slate-800">
                  <h4 className="font-semibold text-white mb-3">{webhook.webhook_name}</h4>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-slate-400">Total Requests</p>
                      <p className="text-2xl font-bold text-white">
                        {webhook.statistics?.total_requests || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Tasks Created</p>
                      <p className="text-2xl font-bold text-emerald-400">
                        {webhook.statistics?.successful_tasks || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Failed</p>
                      <p className="text-2xl font-bold text-red-400">
                        {webhook.statistics?.failed_requests || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Success Rate</p>
                      <p className="text-2xl font-bold text-white">
                        {Math.round((webhook.statistics?.success_rate || 0) * 100)}%
                      </p>
                    </div>
                  </div>
                  {webhook.statistics?.last_request_at && (
                    <p className="text-xs text-slate-500 mt-3">
                      Last request: {new Date(webhook.statistics.last_request_at).toLocaleString()}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Documentation */}
        <Card className="p-6 bg-slate-900/50 border-slate-800">
          <h3 className="font-semibold text-white mb-4">Quick Start</h3>
          <div className="space-y-4 text-sm text-slate-300">
            <div>
              <p className="font-semibold text-white mb-2">1. Create a Webhook</p>
              <p>Click "Create Webhook" to generate a new webhook with a unique URL and secure token.</p>
            </div>
            <div>
              <p className="font-semibold text-white mb-2">2. Configure Payload Mapping</p>
              <p>Map fields from your webhook payload to Task Reader parameters (URL, email, name, etc.).</p>
            </div>
            <div>
              <p className="font-semibold text-white mb-2">3. Send Requests</p>
              <p>POST JSON data to your webhook URL with the required fields. Task Reader will automatically create and execute tasks.</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-3 mt-4">
              <p className="text-xs text-slate-400 mb-2">Example Request:</p>
              <pre className="text-xs text-slate-300 overflow-x-auto">
{`curl -X POST https://api.velocity.app/webhooks/task-reader/YOUR_TOKEN \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-signature: SHA256_SIGNATURE" \\
  -d '{
    "url": "https://example.com/apply",
    "email": "user@example.com",
    "name": "John Doe"
  }'`}
              </pre>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}