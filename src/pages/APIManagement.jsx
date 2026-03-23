import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Trash2, Plus } from 'lucide-react';

export default function APIManagement() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    try {
      const response = await base44.functions.invoke('apiGateway', {
        action: 'list_keys'
      });
      setKeys(response.data?.keys || []);
    } catch (e) {
      console.error('Failed to load API keys:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    
    setCreating(true);
    try {
      const response = await base44.functions.invoke('apiGateway', {
        action: 'create_key',
        key_name: newKeyName,
        permissions: ['read:opportunities', 'read:tasks', 'execute:tasks']
      });

      if (response.data?.api_key) {
        alert(`API Key Created:\n\n${response.data.api_key}\n\nSave this securely!`);
        setNewKeyName('');
        loadKeys();
      }
    } catch (e) {
      alert('Failed to create API key: ' + e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId) => {
    if (!confirm('Revoke this API key?')) return;

    try {
      await base44.functions.invoke('apiGateway', {
        action: 'revoke_key',
        key_id: keyId
      });
      loadKeys();
    } catch (e) {
      alert('Failed to revoke key: ' + e.message);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-galaxy-deep p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-orbitron font-bold text-cyber-cyan mb-2">API Management</h1>
          <p className="text-muted-foreground">Manage API keys and integrations</p>
        </div>

        <Tabs defaultValue="keys" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="keys">API Keys</TabsTrigger>
            <TabsTrigger value="docs">Documentation</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
          </TabsList>

          <TabsContent value="keys" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Create New API Key</CardTitle>
                <CardDescription>Generate a new API key for integrations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Key name (e.g., 'My Integration')"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                />
                <Button
                  onClick={handleCreateKey}
                  disabled={!newKeyName.trim() || creating}
                  className="btn-cosmic"
                >
                  <Plus className="w-4 h-4" /> Create Key
                </Button>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Active API Keys</CardTitle>
                <CardDescription>{keys.length} key(s)</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : keys.length === 0 ? (
                  <p className="text-muted-foreground">No API keys created yet</p>
                ) : (
                  <div className="space-y-3">
                    {keys.map((key) => (
                      <div
                        key={key.prefix}
                        className="flex items-center justify-between p-3 rounded border border-slate-700 bg-slate-900/50"
                      >
                        <div>
                          <p className="font-semibold">{key.key_name}</p>
                          <p className="text-sm text-muted-foreground font-mono">{key.prefix}****</p>
                        </div>
                        <button
                          onClick={() => handleRevoke(key.prefix)}
                          className="text-destructive hover:text-destructive/80"
                          title="Revoke key"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="docs" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>API Documentation</CardTitle>
                <CardDescription>OpenAPI 3.0 specification</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <h3 className="font-semibold">Base URL</h3>
                  <div className="bg-slate-900/50 p-3 rounded font-mono text-sm break-all">
                    https://api.velocity.local
                  </div>

                  <h3 className="font-semibold mt-6">Authentication</h3>
                  <p className="text-sm text-muted-foreground">Pass API key in header:</p>
                  <div className="bg-slate-900/50 p-3 rounded font-mono text-sm">
                    X-API-Key: pk_your_api_key
                  </div>

                  <h3 className="font-semibold mt-6">Core Endpoints</h3>
                  <ul className="text-sm space-y-2">
                    <li><code className="bg-slate-900/50 px-2 py-1 rounded">GET /api/v1/status</code> - System status</li>
                    <li><code className="bg-slate-900/50 px-2 py-1 rounded">GET /api/v1/opportunities</code> - List opportunities</li>
                    <li><code className="bg-slate-900/50 px-2 py-1 rounded">GET /api/v1/tasks</code> - List tasks</li>
                    <li><code className="bg-slate-900/50 px-2 py-1 rounded">POST /api/v1/tasks/execute</code> - Execute task</li>
                    <li><code className="bg-slate-900/50 px-2 py-1 rounded">GET /api/v1/user</code> - Get user</li>
                  </ul>

                  <h3 className="font-semibold mt-6">OpenAPI Spec</h3>
                  <p className="text-sm text-muted-foreground">
                    Download full specification at <code className="bg-slate-900/50 px-2 py-1 rounded">/api/v1/openapi.json</code>
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Rate Limiting</CardTitle>
                <CardDescription>Usage quotas per tier</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded border border-slate-700">
                    <h4 className="font-semibold mb-2">Free</h4>
                    <p className="text-2xl font-bold text-cyber-cyan">1,000</p>
                    <p className="text-sm text-muted-foreground">calls/hour</p>
                  </div>
                  <div className="p-4 rounded border border-slate-700">
                    <h4 className="font-semibold mb-2">Pro</h4>
                    <p className="text-2xl font-bold text-cyber-magenta">10,000</p>
                    <p className="text-sm text-muted-foreground">calls/hour</p>
                  </div>
                  <div className="p-4 rounded border border-slate-700">
                    <h4 className="font-semibold mb-2">Enterprise</h4>
                    <p className="text-2xl font-bold text-cyber-gold">Custom</p>
                    <p className="text-sm text-muted-foreground">contact support</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Code Examples</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">cURL</h4>
                  <div className="bg-slate-900/50 p-3 rounded font-mono text-sm overflow-x-auto">
                    curl -H "X-API-Key: pk_your_key" https://api.velocity.local/api/v1/opportunities
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Python</h4>
                  <pre className="bg-slate-900/50 p-3 rounded font-mono text-sm overflow-x-auto">{`import requests
r = requests.get('https://api.velocity.local/api/v1/opportunities', headers={'X-API-Key': 'pk_your_key'})`}</pre>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">JavaScript</h4>
                  <pre className="bg-slate-900/50 p-3 rounded font-mono text-sm overflow-x-auto">{`fetch('https://api.velocity.local/api/v1/opportunities', {'headers': {'X-API-Key': 'pk_your_key'}})`}</pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}