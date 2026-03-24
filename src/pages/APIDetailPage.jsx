import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import EndpointExplorer from '@/components/api/EndpointExplorer';
import APIHealthIndicator from '@/components/api/APIHealthIndicator';
import { ExternalLink, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function APIDetailPage() {
  const [searchParams] = useSearchParams();
  const apiId = searchParams.get('api');
  const [copied, setCopied] = useState(false);

  const { data: api, isLoading } = useQuery({
    queryKey: ['api', apiId],
    queryFn: () => base44.entities.APIMetadata.get(apiId),
    enabled: !!apiId,
  });

  const { data: opportunities = [] } = useQuery({
    queryKey: ['api-opportunities', apiId],
    queryFn: async () => {
      if (!api?.linked_opportunities) return [];
      return api.linked_opportunities.slice(0, 5);
    },
    enabled: !!api,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['api-logs', apiId],
    queryFn: async () => {
      const list = await base44.entities.APIDiscoveryLog.filter(
        { api_id: apiId, action_type: 'used_by_autopilot' },
        '-created_date',
        20
      );
      return list || [];
    },
    enabled: !!apiId,
  });

  const handleCopyURL = (url) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard');
  };

  if (isLoading) return <div className="text-slate-400">Loading...</div>;
  if (!api) return <div className="text-slate-400">API not found</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{api.api_name}</h1>
            <p className="text-sm text-slate-400 mt-1">{api.api_type.toUpperCase()} API</p>
          </div>
          <Badge className="bg-slate-700 text-slate-200">{api.verification_status}</Badge>
        </div>

        {api.notes && (
          <p className="text-sm text-slate-300">{api.notes}</p>
        )}
      </div>

      {/* Health */}
      <Card className="bg-slate-900/50 border-slate-700 p-4">
        <APIHealthIndicator api={api} />
      </Card>

      {/* Connection Details */}
      <Card className="bg-slate-900/50 border-slate-700 p-4 space-y-3">
        <div>
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Base URL</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm font-mono text-slate-300 bg-slate-800/50 px-3 py-2 rounded">
              {api.api_url}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCopyURL(api.api_url)}
              className="border-slate-700"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {api.documentation_url && (
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Documentation</div>
            <Button
              variant="outline"
              className="border-slate-700 text-slate-300 w-full justify-between"
              onClick={() => window.open(api.documentation_url, '_blank')}
            >
              View Docs
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        )}
      </Card>

      {/* Endpoints */}
      <Card className="bg-slate-900/50 border-slate-700 p-4">
        <EndpointExplorer endpoints={api.endpoints} />
      </Card>

      {/* Execution Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-slate-900/50 border-slate-700 p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Cost Per Call</div>
          <div className="text-2xl font-bold text-emerald-300">${(api.cost_per_call || 0).toFixed(2)}</div>
        </Card>

        <Card className="bg-slate-900/50 border-slate-700 p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Total Uses</div>
          <div className="text-2xl font-bold text-violet-300">{api.usage_count || 0}</div>
        </Card>
      </div>

      {/* Recent Executions */}
      <Card className="bg-slate-900/50 border-slate-700 p-4 space-y-3">
        <div className="text-xs text-slate-400 uppercase tracking-wider">Recent Executions</div>
        {logs.length === 0 ? (
          <p className="text-sm text-slate-400">No recent executions</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-slate-800/50 rounded px-2 py-1.5">
                <span className={log.status === 'success' ? 'text-emerald-300' : 'text-red-300'}>
                  {log.status === 'success' ? '✓' : '✗'} {new Date(log.timestamp).toLocaleDateString()}
                </span>
                <span className="text-slate-400">{log.response_time_ms}ms</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Rate Limits */}
      {api.rate_limit && (
        <Card className="bg-slate-900/50 border-slate-700 p-4 space-y-2">
          <div className="text-xs text-slate-400 uppercase tracking-wider">Rate Limits</div>
          <div className="text-sm text-slate-300 space-y-1">
            {api.rate_limit.calls_per_minute && <div>Per Minute: {api.rate_limit.calls_per_minute}</div>}
            {api.rate_limit.calls_per_hour && <div>Per Hour: {api.rate_limit.calls_per_hour}</div>}
            {api.rate_limit.calls_per_day && <div>Per Day: {api.rate_limit.calls_per_day}</div>}
          </div>
        </Card>
      )}
    </div>
  );
}