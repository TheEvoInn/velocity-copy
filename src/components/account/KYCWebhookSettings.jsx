import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Webhook, Save, Eye, EyeOff, Copy, RefreshCw, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

function generateSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = 'whsec_';
  for (let i = 0; i < 32; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export default function KYCWebhookSettings() {
  const qc = useQueryClient();
  const [showSecret, setShowSecret] = useState(false);
  const [url, setUrl] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [secret, setSecret] = useState('');
  const [dirty, setDirty] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: store, isLoading } = useQuery({
    queryKey: ['userDataStore_webhook'],
    queryFn: async () => {
      const me = await base44.auth.me();
      const res = await base44.entities.UserDataStore.filter({ user_email: me.email });
      return res[0] || null;
    }
  });

  useEffect(() => {
    if (store) {
      setUrl(store.kyc_webhook_url || '');
      setEnabled(store.kyc_webhook_enabled || false);
      setSecret(store.kyc_webhook_secret || '');
    }
  }, [store]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const me = await base44.auth.me();
      const updates = {
        kyc_webhook_url: url,
        kyc_webhook_enabled: enabled,
        kyc_webhook_secret: secret,
      };
      if (store) {
        return base44.entities.UserDataStore.update(store.id, updates);
      } else {
        return base44.entities.UserDataStore.create({ user_email: me.email, ...updates });
      }
    },
    onSuccess: () => {
      toast.success('Webhook settings saved');
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['userDataStore_webhook'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      if (!url) throw new Error('No URL configured');
      const headers = { 'Content-Type': 'application/json', 'User-Agent': 'ProfitEngine-KYC-Webhook/1.0' };
      if (secret) headers['X-Webhook-Secret'] = secret;
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          event: 'kyc.test',
          timestamp: new Date().toISOString(),
          message: 'This is a test webhook from Profit Engine KYC.',
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.status;
    },
    onSuccess: (status) => toast.success(`Test sent — received HTTP ${status}`),
    onError: (e) => toast.error(`Test failed: ${e.message}`),
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateSecret = () => {
    setSecret(generateSecret());
    setDirty(true);
  };

  if (isLoading) return <div className="text-xs text-slate-500">Loading webhook settings...</div>;

  return (
    <Card className="bg-slate-900/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Webhook className="w-4 h-4 text-violet-400" />
          KYC Status Webhook
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-slate-400">
          Receive a POST request to your URL whenever your KYC verification status changes. 
          Use this to integrate with your own services, Zapier, n8n, or custom backends.
        </p>

        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">Enable Webhook</p>
            <p className="text-xs text-slate-500">Send POST on every KYC status change</p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => { setEnabled(v); setDirty(true); }}
          />
        </div>

        {/* URL */}
        <div className="space-y-1.5">
          <label className="text-xs text-slate-400">Webhook URL</label>
          <Input
            value={url}
            onChange={(e) => { setUrl(e.target.value); setDirty(true); }}
            placeholder="https://your-server.com/webhook/kyc"
            className="bg-slate-800 border-slate-600 text-sm"
          />
        </div>

        {/* Secret */}
        <div className="space-y-1.5">
          <label className="text-xs text-slate-400">Signing Secret (sent in X-Webhook-Secret header)</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showSecret ? 'text' : 'password'}
                value={secret}
                onChange={(e) => { setSecret(e.target.value); setDirty(true); }}
                placeholder="whsec_..."
                className="bg-slate-800 border-slate-600 text-sm pr-16"
              />
              <div className="absolute right-1 top-1 flex gap-0.5">
                <button onClick={() => setShowSecret(!showSecret)} className="p-1 text-slate-500 hover:text-slate-300">
                  {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button onClick={handleCopy} className="p-1 text-slate-500 hover:text-slate-300">
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={handleGenerateSecret}
              className="border-slate-600 text-xs shrink-0">
              <RefreshCw className="w-3 h-3 mr-1" /> Generate
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!dirty || saveMutation.isPending}
            className="bg-violet-600 hover:bg-violet-500 text-xs"
            size="sm"
          >
            <Save className="w-3 h-3 mr-1" />
            {saveMutation.isPending ? 'Saving...' : 'Save Webhook'}
          </Button>
          <Button
            onClick={() => testMutation.mutate()}
            disabled={!url || testMutation.isPending}
            variant="outline"
            className="border-slate-600 text-xs"
            size="sm"
          >
            {testMutation.isPending ? 'Sending...' : 'Send Test'}
          </Button>
        </div>

        {/* Payload docs */}
        <div className="mt-3 p-3 rounded-lg bg-slate-800/60 border border-slate-700 space-y-2">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Payload Format</p>
          <pre className="text-[10px] text-slate-500 leading-relaxed overflow-x-auto whitespace-pre">{`{
  "event": "kyc.status_changed",
  "timestamp": "2026-03-21T...",
  "kyc_id": "abc123",
  "owner_email": "user@example.com",
  "previous_status": "submitted",
  "new_status": "approved",
  "previous_admin_status": "under_review",
  "new_admin_status": "approved",
  "verification_type": "standard",
  "user_approved_for_autopilot": true,
  "doc_approvals": { ... }
}`}</pre>
        </div>
      </CardContent>
    </Card>
  );
}