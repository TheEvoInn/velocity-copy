/**
 * Command History Component
 * Displays command execution history and results
 */
import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Clock, Zap } from 'lucide-react';

export default function CommandHistory({ messages = [] }) {
  const getAgentColor = (agent) => {
    const colors = {
      ned: 'text-cyan-400',
      autopilot: 'text-violet-400',
      vipz: 'text-pink-400'
    };
    return colors[agent] || 'text-slate-400';
  };

  const getAgentIcon = (agent) => {
    const icons = {
      ned: '🔷',
      autopilot: '⚡',
      vipz: '📱'
    };
    return icons[agent] || '🤖';
  };

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Zap className="w-16 h-16 text-slate-700 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Command Console Ready</h2>
        <p className="text-slate-400 max-w-md">
          Issue natural language commands to coordinate autonomous agents across departments.
          Start with a quick command suggestion or type your own instruction.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((msg, idx) => (
        <div key={idx} className={`flex gap-3 ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
          {msg.type === 'command' && (
            <div className="flex-1 max-w-2xl">
              {/* Command Input */}
              <div className="flex gap-3 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${getAgentColor(msg.agent)} bg-slate-800/50`}>
                  {getAgentIcon(msg.agent)}
                </div>
                <div className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <p className="text-white font-medium">{msg.instruction}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={`text-xs ${getAgentColor(msg.agent).replace('text-', 'bg-').replace('-400', '-500/20')}`}>
                      {msg.agent}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {msg.intent || 'general'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Execution Status */}
              {msg.action_plan && (
                <div className="ml-11 space-y-2 mb-3">
                  <p className="text-xs text-slate-400 font-semibold">Action Plan:</p>
                  {msg.action_plan.map((action, idx) => (
                    <div key={idx} className="p-2 bg-slate-900/50 rounded border border-slate-700/50 text-xs">
                      <p className="text-slate-300">• {action.action}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Results */}
              {msg.results && (
                <div className="ml-11 space-y-2">
                  {msg.results.map((result, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border flex items-start gap-2 ${
                        result.status === 'success'
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : 'bg-red-500/10 border-red-500/30'
                      }`}
                    >
                      {result.status === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${result.status === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {result.action}
                        </p>
                        {result.result && (
                          <p className="text-xs text-slate-400 mt-1">{result.result.impact}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {msg.type === 'system' && (
            <div className="flex-1 max-w-2xl">
              <div className={`p-4 rounded-lg border ${
                msg.status === 'processing'
                  ? 'bg-violet-500/10 border-violet-500/30'
                  : msg.status === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                <div className="flex items-start gap-3">
                  {msg.status === 'processing' && (
                    <Clock className="w-4 h-4 text-violet-400 flex-shrink-0 animate-spin" />
                  )}
                  {msg.status === 'success' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  )}
                  {msg.status === 'error' && (
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  )}
                  <p className="text-sm text-slate-300">{msg.message}</p>
                </div>
                {msg.details && (
                  <div className="mt-2 text-xs text-slate-400 font-mono">
                    {JSON.stringify(msg.details, null, 2)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}