import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown } from 'lucide-react';

export default function EndpointExplorer({ endpoints }) {
  const [expandedId, setExpandedId] = useState(null);

  const methodColor = {
    GET: 'bg-blue-500/20 text-blue-300',
    POST: 'bg-emerald-500/20 text-emerald-300',
    PUT: 'bg-amber-500/20 text-amber-300',
    DELETE: 'bg-red-500/20 text-red-300',
    PATCH: 'bg-violet-500/20 text-violet-300',
  };

  if (!endpoints || endpoints.length === 0) {
    return <div className="text-slate-400 text-sm">No endpoints available</div>;
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-slate-400 uppercase tracking-wider">Endpoints</div>
      {endpoints.map((endpoint, idx) => (
        <Card key={idx} className="bg-slate-800/50 border-slate-700 p-0 overflow-hidden">
          <button
            onClick={() => setExpandedId(expandedId === idx ? null : idx)}
            className="w-full text-left p-3 hover:bg-slate-800/80 transition-colors flex items-center gap-2"
          >
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expandedId === idx ? 'rotate-180' : ''}`} />
            <Badge className={methodColor[endpoint.method] || 'bg-slate-500/20 text-slate-300'}>
              {endpoint.method || 'GET'}
            </Badge>
            <code className="text-xs text-slate-300 font-mono">{endpoint.path}</code>
          </button>

          {expandedId === idx && (
            <div className="border-t border-slate-700 px-3 py-3 bg-slate-900/50 space-y-2">
              {endpoint.description && (
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Description</div>
                  <p className="text-sm text-slate-300 mt-1">{endpoint.description}</p>
                </div>
              )}

              {endpoint.auth_type && (
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Auth</div>
                  <Badge variant="outline" className="text-[10px] mt-1">{endpoint.auth_type}</Badge>
                </div>
              )}

              {endpoint.parameters && endpoint.parameters.length > 0 && (
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Parameters</div>
                  <div className="space-y-1 mt-1">
                    {endpoint.parameters.map((param, pi) => (
                      <div key={pi} className="text-xs text-slate-300 bg-slate-800/50 rounded px-2 py-1">
                        <span className="font-mono text-violet-300">{param.name}</span>
                        <span className="text-slate-500 ml-2">({param.type})</span>
                        {param.required && <Badge variant="outline" className="text-[9px] ml-2">required</Badge>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}