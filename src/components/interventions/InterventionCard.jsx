import React from 'react';
import { AlertCircle, Clock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function InterventionCard({ intervention, onResolve, onReject }) {
  const expiresIn = new Date(intervention.expires_at) - new Date();
  const hoursLeft = Math.floor(expiresIn / 3600000);

  const requirementLabels = {
    captcha: 'Captcha Verification',
    credential: 'Credential Update',
    two_factor: '2FA Code',
    email_confirmation: 'Email Confirmation',
    form_validation: 'Form Data',
    manual_review: 'Manual Review',
    missing_data: 'Missing Data',
    decision_required: 'Decision Required',
    payment_confirmation: 'Payment Confirmation'
  };

  return (
    <Card className="bg-slate-900/50 border-slate-700 hover:border-cyan-500/30 transition-colors">
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-white">{requirementLabels[intervention.requirement_type] || intervention.requirement_type}</h3>
            <p className="text-xs text-slate-400 mt-1">{intervention.required_data}</p>
          </div>
          {intervention.priority > 80 && (
            <span className="px-2 py-1 bg-red-500/20 border border-red-500/30 rounded text-xs text-red-400 font-medium">
              Urgent
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400 mb-4">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {hoursLeft}h left
          </div>
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            Priority: {intervention.priority}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 bg-cyan-600/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-600/30 text-xs"
            onClick={() => onResolve(intervention.id)}
          >
            Provide Data
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 text-slate-400 hover:text-slate-300 text-xs"
            onClick={() => onReject(intervention.id)}
          >
            Reject
          </Button>
        </div>
      </div>
    </Card>
  );
}