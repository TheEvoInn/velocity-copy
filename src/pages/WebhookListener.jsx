/**
 * WEBHOOK LISTENER PAGE
 * Centralized webhook configuration, payload mapping, and entity sync management
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Copy, CheckCircle2, AlertCircle, Activity, Zap } from 'lucide-react';
import { toast } from 'sonner';
import WebhookForm from '@/components/webhooks/WebhookForm';
import PayloadMapper from '@/components/webhooks/PayloadMapper';

const ENTITY_TYPES = ['Opportunity', 'TaskExecutionQueue', 'Transaction', 'ActivityLog', 'CryptoWallet', 'StakingPosition'];

export default function WebhookListener() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedWebhook, setSelectedWebhook] = useState(null);
  const [showMapper, setShowMapper] = useState(false);

  // Fetch webhooks
  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => base44.entities.WebhookConfig.list(),
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (editingId) {
        return base44.entities.WebhookConfig.update(editingId, data);
      }
      return base44.entities.WebhookConfig.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setShowForm(false);
      setEditingId(null);
      toast.success(editingId ? 'Webhook updated' : 'Webhook created');
    },
    onError: (err) => toast.error(err.message),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WebhookConfig.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook deleted');
    },
  });

  // Test webhook
  const testMutation = useMutation({
    mutationFn: async (webhook) => {
      const res = await base44.functions.invoke('testWebhookDelivery', { webhook_id: webhook.id });
      return res?.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || 'Test sent');
    },
  });

  const handleCopyUrl = (webhook) => {
    const baseUrl = window.location.origin;
    const webhookUrl = `${baseUrl}/api/webhooks/${webhook.id}`;
    navigator.clipboard.writeText(webhookUrl);
    toast.success('Webhook URL copied');
  };

  return (
    <div className="min-h-screen galaxy-bg p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-cyan-500/10 border border-cyan-500/30">
              <Activity className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="font-orbitron text-2xl font-bold text-white">Webhook Listener</h1>
              <p className="text-xs text-slate-400">External API integration & data sync</p>
            </div>
          </div>
          <Button onClick={() => { setEditingId(null); setShowForm(!showForm); }} className="btn-cosmic gap-2">
            <Plus className="w-4 h-4" />
            New Webhook
          </Button>
        </div>

        {/* Form */}
        {showForm && (
          <Card className="glass-card-bright mb-6 p-6">
            <WebhookForm
              webhook={editingId ? webhooks.find(w => w.id === editingId) : null}
              onSubmit={(data) => saveMutation.mutate(data)}
              isLoading={saveMutation.isPending}
            />
          </Card>
        )}

        {/* Webhook List */}
        <div className="space-y-4">
          {isLoading ? (
            <Card className="glass-card p-6 text-center text-slate-400">Loading webhooks...</Card>
          ) : webhooks.length === 0 ? (
            <Card className="glass-card p-8 text-center">
              <Zap className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No webhooks yet. Create one to start receiving external data.</p>
            </Card>
          ) : (
            webhooks.map(webhook => (
              <Card key={webhook.id} className="glass-card p-4 hover:border-cyan-500/40 transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-white">{webhook.name}</h3>
                      <Badge variant={webhook.is_active ? 'default' : 'secondary'}>
                        {webhook.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      {webhook.test_mode && <Badge variant="outline">Test</Badge>}
                    </div>
                    <div className="text-sm text-slate-400 font-mono truncate mb-2">{webhook.endpoint_url}</div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {webhook.events?.slice(0, 3).map(e => (
                        <Badge key={e} variant="outline" className="text-xs">{e}</Badge>
                      ))}
                      {webhook.events?.length > 3 && (
                        <Badge variant="outline" className="text-xs">+{webhook.events.length - 3}</Badge>
                      )}
                    </div>
                    {webhook.last_triggered_at && (
                      <div className="text-xs text-slate-500">
                        Last: {new Date(webhook.last_triggered_at).toLocaleString()}
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-right min-w-fit">
                    <div>
                      <div className="text-slate-500">Delivered</div>
                      <div className="font-bold text-cyan-400">{webhook.delivery_stats?.successful_deliveries || 0}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Failed</div>
                      <div className="font-bold text-red-400">{webhook.delivery_stats?.failed_deliveries || 0}</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyUrl(webhook)}
                      title="Copy webhook URL"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedWebhook(webhook);
                        setShowMapper(true);
                      }}
                      className="gap-1"
                    >
                      <Zap className="w-3 h-3" />
                      Map
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testMutation.mutate(webhook)}
                      disabled={testMutation.isPending}
                    >
                      Test
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingId(webhook.id)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteMutation.mutate(webhook.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Payload Mapper Modal */}
        {showMapper && selectedWebhook && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="glass-card-bright w-full max-w-2xl max-h-96 overflow-y-auto">
              <CardHeader>
                <CardTitle>Map Incoming Payload → Entity</CardTitle>
              </CardHeader>
              <CardContent>
                <PayloadMapper
                  webhook={selectedWebhook}
                  entityTypes={ENTITY_TYPES}
                  onClose={() => setShowMapper(false)}
                  onSave={(mapping) => {
                    base44.entities.WebhookConfig.update(selectedWebhook.id, {
                      payload_mapping: mapping
                    }).then(() => {
                      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
                      setShowMapper(false);
                      toast.success('Mapping saved');
                    });
                  }}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}