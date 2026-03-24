import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Clock, TrendingUp } from 'lucide-react';

export default function APICard({ api, onClick }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'verified': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'unreliable': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'deprecated': return 'bg-red-500/20 text-red-300 border-red-500/30';
      default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'verified': return <CheckCircle2 className="w-4 h-4" />;
      case 'unreliable': return <AlertCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <Card 
      onClick={onClick}
      className="bg-slate-900/50 border-slate-700 hover:border-violet-500/50 transition-all cursor-pointer group"
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white group-hover:text-violet-300 transition-colors">
              {api.api_name}
            </h3>
            <p className="text-xs text-slate-400 mt-1">{api.api_type.toUpperCase()}</p>
          </div>
          <Badge className={`flex items-center gap-1.5 ${getStatusColor(api.verification_status)}`}>
            {getStatusIcon(api.verification_status)}
            {api.verification_status}
          </Badge>
        </div>

        <p className="text-xs text-slate-400 mb-3 line-clamp-2">{api.api_url}</p>

        <div className="grid grid-cols-3 gap-2 mb-3 text-[10px]">
          <div className="bg-slate-800/50 rounded px-2 py-1.5 text-center">
            <div className="text-slate-400">Endpoints</div>
            <div className="font-bold text-violet-300">{api.endpoints?.length || 0}</div>
          </div>
          <div className="bg-slate-800/50 rounded px-2 py-1.5 text-center">
            <div className="text-slate-400">Readiness</div>
            <div className="font-bold text-emerald-300">{api.execution_readiness_score || 0}%</div>
          </div>
          <div className="bg-slate-800/50 rounded px-2 py-1.5 text-center">
            <div className="text-slate-400">Usage</div>
            <div className="font-bold text-cyan-300">{api.usage_count || 0}</div>
          </div>
        </div>

        {api.capabilities && api.capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {api.capabilities.slice(0, 3).map((cap, i) => (
              <Badge key={i} variant="outline" className="text-[9px] px-1.5 py-0.5">
                {cap}
              </Badge>
            ))}
            {api.capabilities.length > 3 && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0.5">
                +{api.capabilities.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}