import React from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  X, DollarSign, Zap, AlertTriangle, Clock, 
  CheckCircle2, Circle, Play, Archive 
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const categoryLabels = {
  arbitrage: "Arbitrage", service: "Service", lead_gen: "Lead Gen",
  digital_flip: "Digital Flip", auction: "Auction", market_inefficiency: "Market Gap",
  trend_surge: "Trend Surge", freelance: "Freelance", resale: "Resale"
};

export default function OpportunityDetail({ opportunity, onClose }) {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Opportunity.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['opportunities'] })
  });

  const toggleStep = (stepIndex) => {
    const steps = [...(opportunity.execution_steps || [])];
    steps[stepIndex] = { ...steps[stepIndex], completed: !steps[stepIndex].completed };
    updateMutation.mutate({ id: opportunity.id, data: { execution_steps: steps } });
  };

  const updateStatus = (status) => {
    updateMutation.mutate({ id: opportunity.id, data: { status } });
  };

  if (!opportunity) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-800">
          <div>
            <Badge variant="outline" className="mb-2 text-[10px] border-slate-600 text-slate-400">
              {categoryLabels[opportunity.category] || opportunity.category}
            </Badge>
            <h2 className="text-lg font-bold text-white">{opportunity.title}</h2>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} className="text-slate-500 hover:text-white -mt-1 -mr-1">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          <p className="text-sm text-slate-300 leading-relaxed">{opportunity.description}</p>

          {/* Scores */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-800/60 p-3 text-center">
              <DollarSign className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
              <div className="text-xs text-slate-500 mb-0.5">Profit Est.</div>
              <div className="text-sm font-bold text-emerald-400">
                ${opportunity.profit_estimate_low?.toLocaleString()}-${opportunity.profit_estimate_high?.toLocaleString()}
              </div>
            </div>
            <div className="rounded-xl bg-slate-800/60 p-3 text-center">
              <Zap className="w-4 h-4 text-amber-400 mx-auto mb-1" />
              <div className="text-xs text-slate-500 mb-0.5">Velocity</div>
              <div className="text-sm font-bold text-amber-400">{opportunity.velocity_score}/100</div>
            </div>
            <div className="rounded-xl bg-slate-800/60 p-3 text-center">
              <AlertTriangle className="w-4 h-4 text-rose-400 mx-auto mb-1" />
              <div className="text-xs text-slate-500 mb-0.5">Risk</div>
              <div className="text-sm font-bold text-rose-400">{opportunity.risk_score}/100</div>
            </div>
          </div>

          {/* Capital */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
            <span className="text-xs text-slate-400">Capital Required</span>
            <span className={`text-sm font-bold ${opportunity.capital_required === 0 ? 'text-emerald-400' : 'text-white'}`}>
              {opportunity.capital_required === 0 ? '$0 — No capital needed' : `$${opportunity.capital_required?.toLocaleString()}`}
            </span>
          </div>

          {/* Execution Steps */}
          {opportunity.execution_steps && opportunity.execution_steps.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Execution Steps</h3>
              <div className="space-y-2">
                {opportunity.execution_steps.map((step, i) => (
                  <button
                    key={i}
                    onClick={() => toggleStep(i)}
                    className="w-full flex items-start gap-3 p-3 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 transition-colors text-left"
                  >
                    {step.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-600 mt-0.5 shrink-0" />
                    )}
                    <div>
                      <span className="text-[10px] text-slate-600 font-medium">Step {step.step}</span>
                      <p className={`text-sm ${step.completed ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                        {step.action}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            {opportunity.status === 'new' && (
              <div className="grid grid-cols-3 gap-2">
                <Button 
                  onClick={() => {
                    onClose();
                    window.dispatchEvent(new CustomEvent('openExecutionHub', { detail: opportunity }));
                  }} 
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-8"
                >
                  <FileText className="w-3 h-3" />
                </Button>
                <Button 
                  onClick={() => {
                    onClose();
                    window.dispatchEvent(new CustomEvent('openExecutionHub', { detail: opportunity }));
                  }} 
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-8"
                >
                  <Clock className="w-3 h-3" />
                </Button>
                <Button 
                  onClick={() => {
                    onClose();
                    window.dispatchEvent(new CustomEvent('openExecutionHub', { detail: opportunity }));
                  }} 
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8"
                >
                  <Zap className="w-3 h-3" />
                </Button>
              </div>
            )}
            <Button 
              onClick={() => {
                onClose();
                window.dispatchEvent(new CustomEvent('openExecutionHub', { detail: opportunity }));
              }} 
              className="w-full bg-slate-700 hover:bg-slate-600 text-white h-9"
            >
              <Play className="w-4 h-4 mr-2" /> Execute Hub
            </Button>
            <Button onClick={() => updateStatus('dismissed')} variant="outline" className="w-full border-slate-700 text-slate-400 hover:text-white h-9">
              <Archive className="w-4 h-4 mr-2" /> Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}