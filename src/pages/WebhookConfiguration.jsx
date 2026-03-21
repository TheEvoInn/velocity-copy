import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertCircle, CheckCircle2, Plus, Trash2, Edit2 } from 'lucide-react';
import WebhookForm from '@/components/webhooks/WebhookForm';

export default function WebhookConfiguration() {
  const [editingWebhook, setEditingWebhook] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => base44.entities.WebhookConfig.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.WebhookConfig.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setDialogOpen(false);
      setEditingWebhook(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.WebhookConfig.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setDialogOpen(false);
      setEditingWebhook(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WebhookConfig.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    }
  });

  const handleSubmit = (formData) => {
    if (editingWebhook) {
      updateMutation.mutate({ id: editingWebhook.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (webhook) => {
    setEditingWebhook(webhook);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setEditingWebhook(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-orbitron text-cyan-400">External Webhooks</h1>
          <p className="text-slate-400 mt-1">Send events to external endpoints when notifications trigger or rules execute</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleNew} className="gap-2 bg-cyan-600 hover:bg-cyan-700">
              <Plus size={18} /> New Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto glass-card border-cyan-500/20">
            <DialogHeader>
              <DialogTitle>{editingWebhook ? 'Edit Webhook' : 'Create New Webhook'}</DialogTitle>
            </DialogHeader>
            <WebhookForm
              webhook={editingWebhook}
              onSubmit={handleSubmit}
              isLoading={createMutation.isPending || updateMutation.isPending}
              lastDelivery={editingWebhook?.recent_deliveries?.[0]}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Webhooks List */}
      {isLoading ? (
        <div className="text-center py-8 text-slate-400">Loading webhooks...</div>
      ) : webhooks.length === 0 ? (
        <Card className="glass-card border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-slate-400 mb-4">No webhooks configured yet</p>
            <Button onClick={handleNew} variant="outline" className="gap-2">
              <Plus size={18} /> Create your first webhook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {webhooks.map((webhook) => (
            <Card key={webhook.id} className={`glass-card transition-all ${!webhook.is_active ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">{webhook.name}</CardTitle>
                      {webhook.is_active ? (
                        <Badge className="bg-emerald-500/20 text-emerald-300">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-slate-700">Inactive</Badge>
                      )}
                      {webhook.test_mode && (
                        <Badge className="bg-amber-500/20 text-amber-300">Test Mode</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 font-mono break-all">{webhook.endpoint_url}</p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      onClick={() => handleEdit(webhook)}
                      variant="ghost"
                      size="icon"
                      className="text-slate-400 hover:text-cyan-400"
                    >
                      <Edit2 size={18} />
                    </Button>
                    <Button
                      onClick={() => deleteMutation.mutate(webhook.id)}
                      variant="ghost"
                      size="icon"
                      className="text-slate-400 hover:text-red-400"
                    >
                      <Trash2 size={18} />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Events */}
                <div>
                  <p className="text-xs font-medium text-slate-300 mb-2">Events:</p>
                  <div className="flex flex-wrap gap-2">
                    {webhook.events?.map((event) => (
                      <Badge key={event} variant="outline" className="text-xs">
                        {event}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-4 gap-4 py-3 border-t border-slate-700/50">
                  <div>
                    <p className="text-xs text-slate-400">Total Deliveries</p>
                    <p className="text-lg font-bold text-cyan-400">{webhook.delivery_stats?.total_deliveries || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Success Rate</p>
                    <p className="text-lg font-bold text-emerald-400">{webhook.delivery_stats?.success_rate || 0}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Failed</p>
                    <p className="text-lg font-bold text-red-400">{webhook.delivery_stats?.failed_deliveries || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Last Status</p>
                    {webhook.last_status === 'success' ? (
                      <div className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 size={16} /> Success
                      </div>
                    ) : webhook.last_status === 'failed' ? (
                      <div className="flex items-center gap-1 text-red-400">
                        <AlertCircle size={16} /> Failed
                      </div>
                    ) : (
                      <span className="text-slate-400 text-sm">—</span>
                    )}
                  </div>
                </div>

                {/* Recent Activity */}
                {webhook.recent_deliveries && webhook.recent_deliveries.length > 0 && (
                  <div className="pt-3 border-t border-slate-700/50">
                    <p className="text-xs font-medium text-slate-300 mb-2">Recent Deliveries:</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {webhook.recent_deliveries.slice(0, 5).map((delivery, idx) => (
                        <div key={idx} className="text-xs text-slate-400 flex items-center justify-between">
                          <span>{new Date(delivery.timestamp).toLocaleString()}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500">{delivery.event}</span>
                            {delivery.status === 'success' ? (
                              <CheckCircle2 size={12} className="text-emerald-500" />
                            ) : (
                              <AlertCircle size={12} className="text-red-500" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}