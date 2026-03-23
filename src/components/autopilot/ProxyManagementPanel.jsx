import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Wifi, Globe, CheckCircle2, AlertCircle, Zap } from 'lucide-react';
import { toast } from 'sonner';

export default function ProxyManagementPanel() {
  const [isAddingProvider, setIsAddingProvider] = useState(false);
  const [providerName, setProviderName] = useState('');
  const [credentials, setCredentials] = useState('');
  const queryClient = useQueryClient();

  // Fetch user goals to check proxy provider
  const { data: userGoals } = useQuery({
    queryKey: ['userGoals'],
    queryFn: async () => {
      const result = await base44.entities.UserGoals.filter({}, null, 1);
      return result[0] || {};
    }
  });

  // Initialize proxy provider
  const initProviderMutation = useMutation({
    mutationFn: async ({ name, creds }) => {
      const response = await base44.functions.invoke('proxyManagementEngine', {
        action: 'initialize_provider',
        providerName: name,
        credentials: JSON.parse(creds)
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Proxy provider initialized');
        queryClient.invalidateQueries({ queryKey: ['userGoals'] });
        setIsAddingProvider(false);
        setProviderName('');
        setCredentials('');
      } else {
        toast.error(`Error: ${data.error}`);
      }
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    }
  });

  // Get proxy config for platform
  const getProxyConfigMutation = useMutation({
    mutationFn: async (platform) => {
      const response = await base44.functions.invoke('proxyManagementEngine', {
        action: 'get_proxy_config',
        platform
      });
      return response.data;
    }
  });

  // Check proxy health
  const checkHealthMutation = useMutation({
    mutationFn: async (proxyId) => {
      const response = await base44.functions.invoke('proxyManagementEngine', {
        action: 'check_health',
        proxyId
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.healthy) {
        toast.success('Proxy health check passed');
      } else {
        toast.warning(`Proxy unhealthy: ${data.error}`);
      }
    }
  });

  const platforms = ['upwork', 'fiverr', 'freelancer', 'ebay', 'etsy'];
  const hasProxyProvider = !!userGoals?.proxy_provider;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-semibold text-foreground">Proxy Management</h3>
            <p className="text-xs text-muted-foreground">
              {hasProxyProvider
                ? `Provider: ${userGoals.proxy_provider}`
                : 'No proxy provider configured'}
            </p>
          </div>
        </div>
      </div>

      {!hasProxyProvider ? (
        <>
          {/* Setup Required */}
          <Card className="glass-card border border-amber-500/30 bg-amber-500/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-amber-600 mb-2">Setup Proxy Provider</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Configure a proxy provider to enable automatic IP rotation for better session stability and rate-limit avoidance.
                  </p>
                  <Button
                    onClick={() => setIsAddingProvider(!isAddingProvider)}
                    className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <Globe className="w-4 h-4" />
                    Add Proxy Provider
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Add Provider Form */}
          {isAddingProvider && (
            <Card className="glass-card border border-primary/30">
              <CardHeader>
                <CardTitle className="text-lg">Add Proxy Provider</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1">
                    Provider Name
                  </label>
                  <Input
                    placeholder="e.g., brightdata, smartproxy, residential"
                    value={providerName}
                    onChange={(e) => setProviderName(e.target.value)}
                    className="bg-input border-border"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground block mb-1">
                    Credentials (JSON)
                  </label>
                  <textarea
                    placeholder='{"api_key": "...", "auth_token": "..."}'
                    value={credentials}
                    onChange={(e) => setCredentials(e.target.value)}
                    rows="4"
                    className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground text-sm font-mono"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Paste your proxy provider credentials as JSON. Will be encrypted.
                  </p>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAddingProvider(false);
                      setProviderName('');
                      setCredentials('');
                    }}
                    disabled={initProviderMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (!providerName || !credentials) {
                        toast.error('Provider name and credentials required');
                        return;
                      }
                      try {
                        JSON.parse(credentials);
                        initProviderMutation.mutate({ name: providerName, creds: credentials });
                      } catch {
                        toast.error('Invalid JSON credentials');
                      }
                    }}
                    disabled={initProviderMutation.isPending}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {initProviderMutation.isPending ? 'Setting up...' : 'Set Up Provider'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <>
          {/* Platform Configuration */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Platform-Specific Strategies</p>
            {platforms.map((platform) => (
              <Card key={platform} className="glass-card border border-border/50">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium text-foreground capitalize">{platform}</p>
                      <p className="text-xs text-muted-foreground">
                        Auto IP rotation configured
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => getProxyConfigMutation.mutate(platform)}
                        disabled={getProxyConfigMutation.isPending}
                        className="text-xs gap-1.5"
                      >
                        <Wifi className="w-3 h-3" />
                        Config
                      </Button>
                      <Badge variant="secondary" className="gap-1.5">
                        <Zap className="w-3 h-3" />
                        Active
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Active Configuration Details */}
          {getProxyConfigMutation.data && (
            <Card className="glass-card border border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-sm">Current Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-muted-foreground">Rotation Interval</p>
                    <p className="font-medium text-foreground">
                      {getProxyConfigMutation.data.rotation_strategy?.rotation_interval} tasks
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Session Lifetime</p>
                    <p className="font-medium text-foreground">
                      {(getProxyConfigMutation.data.rotation_strategy?.session_lifetime / 60).toFixed(0)} min
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Request Delay</p>
                    <p className="font-medium text-foreground">
                      {getProxyConfigMutation.data.rotation_strategy?.delay_between_requests / 1000}s
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Max Retries</p>
                    <p className="font-medium text-foreground">
                      {getProxyConfigMutation.data.rotation_strategy?.max_retries}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info Box */}
          <Card className="glass-card border border-border/50 bg-card/50">
            <CardContent className="pt-4 text-xs text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">🌍 How Proxy Rotation Works</p>
              <ul className="list-disc list-inside space-y-1 ml-1">
                <li>IPs automatically rotate every N tasks per platform</li>
                <li>Healthiest proxies selected based on access history</li>
                <li>Sessions last 30-60 min before forced rotation</li>
                <li>Smart delays (1-2.5s) prevent rate limiting</li>
                <li>Rate-limited proxies auto-disable with cooldown</li>
                <li>Different strategies per platform (upwork, fiverr, etc.)</li>
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}