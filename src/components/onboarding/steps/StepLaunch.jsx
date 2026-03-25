import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Rocket, CheckCircle, User, Shield, Sliders, DollarSign, Zap, Loader2, Workflow, AlertCircle } from 'lucide-react';

export default function StepLaunch({ identityData, kycData, prefData, bankingData, workflowData, onLaunch, onForceSave, onBack, isLaunching }) {
  const [doNotShowAgain, setDoNotShowAgain] = useState(true);
  
  // Validate critical data for launch
  const hasIdentityName = !!(identityData.first_name && identityData.last_name);
  const hasDailyTarget = !!(prefData.daily_target && prefData.daily_target > 0);
  const canLaunch = hasIdentityName && hasDailyTarget && !isLaunching;
  
  const missingFields = [];
  if (!identityData.first_name || !identityData.last_name) missingFields.push('AI Identity name (First & Last)');
  if (!prefData.daily_target || prefData.daily_target === 0) missingFields.push('Daily profit target');

  const summaryItems = [
    {
      icon: User, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20',
      label: 'Identity Created',
      value: (identityData.first_name || identityData.last_name) ? `${identityData.first_name || ''} ${identityData.last_name || ''}`.trim() + (identityData.role_labels?.[0] ? ` — ${identityData.role_labels[0]}` : '') : '⚠️ Not configured',
      ok: hasIdentityName,
    },
    {
      icon: Shield, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20',
      label: 'KYC Status',
      value: kycData.full_legal_name ? 'Submitted — pending review' : 'Skipped (some features locked)',
      ok: !!kycData.full_legal_name,
    },
    {
      icon: Sliders, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20',
      label: 'Autopilot Config',
      value: `Target: $${prefData.daily_target || 0}/day · Risk: ${prefData.risk_tolerance || 'moderate'}`,
      ok: hasDailyTarget,
    },
    {
      icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20',
      label: 'Banking',
      value: bankingData.bank_name || bankingData.paypal_email || bankingData.wise_email ? 'Payout account configured' : 'Skipped — add later in Withdrawal Engine',
      ok: !!(bankingData.bank_name || bankingData.paypal_email),
    },
    {
      icon: Workflow, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20',
      label: 'Workflows & Strategies',
      value: (workflowData?.selected_templates?.length)
        ? `${workflowData.selected_templates.length} template${workflowData.selected_templates.length !== 1 ? 's' : ''} selected${workflowData.auto_matched ? ' (auto-matched)' : ''}`
        : 'Top 3 AI-matched templates will be auto-applied',
      ok: true,
    },
  ];

  const activationSteps = [
    'Creating your primary AI identity',
    'Saving preferences & permissions',
    'Submitting KYC for review',
    'Configuring withdrawal policy',
    'Applying workflow & strategy templates',
    'Triggering opportunity scanning',
    'Activating Autopilot engine',
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <Rocket className="w-5 h-5 text-violet-400" />
        <h2 className="text-base font-bold text-white">Review & Launch</h2>
      </div>

      {!isLaunching ? (
        <>
          {/* Summary */}
          <div className="space-y-2 mb-6">
            {summaryItems.map(({ icon: Icon, color, bg, label, value, ok }) => (
              <div key={label} className={`rounded-xl border p-3 flex items-start gap-3 ${bg}`}>
                <Icon className={`w-4 h-4 ${color} mt-0.5 flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white">{label}</div>
                  <div className="text-[10px] text-slate-400 truncate">{value}</div>
                </div>
                {ok && <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
              </div>
            ))}
          </div>

          {/* What happens next */}
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 mb-4">
            <div className="text-xs font-semibold text-violet-300 mb-2 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> What happens after you launch:
            </div>
            <ul className="space-y-1">
              {['Real-time opportunity scanning begins immediately', 'Autopilot starts applying to matched opportunities', 'AI generates proposals using your identity', 'Earnings are tracked and deposited to your wallet'].map(item => (
                <li key={item} className="flex items-center gap-2 text-[10px] text-slate-400">
                  <div className="w-1 h-1 rounded-full bg-violet-400" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Validation error if data missing */}
          {!canLaunch && missingFields.length > 0 && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-red-300 mb-1">Cannot launch — missing required data:</p>
                  <ul className="text-[11px] text-red-200 space-y-0.5 ml-1">
                    {missingFields.map(field => <li key={field}>• {field}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Do not show again */}
          <label className="flex items-center gap-2.5 cursor-pointer bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 mb-4">
            <input type="checkbox" checked={doNotShowAgain} onChange={e => setDoNotShowAgain(e.target.checked)}
              className="rounded accent-violet-500" />
            <span className="text-xs text-slate-300">Don't show this setup again after completion</span>
          </label>

          <div className="flex gap-2">
            <Button onClick={onBack} variant="outline" size="sm" className="border-slate-700 text-slate-400 h-10 px-4">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
            </Button>
            {onForceSave && (
              <Button onClick={onForceSave}
                className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs">
                💾 Force Save & Launch
              </Button>
            )}
            <Button 
              onClick={() => onLaunch(doNotShowAgain)}
              disabled={!canLaunch}
              className={`flex-1 h-10 font-bold ${
                canLaunch 
                  ? 'bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white cursor-pointer' 
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50'
              }`}
            >
              <Rocket className="w-4 h-4 mr-2" /> Launch VELOCITY
            </Button>
          </div>
        </>
      ) : (
        <div className="py-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          </div>
          <h3 className="text-sm font-bold text-white mb-4">Activating VELOCITY...</h3>
          <div className="space-y-2 text-left max-w-xs mx-auto">
            {activationSteps.map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 text-violet-400 animate-spin flex-shrink-0" style={{ animationDelay: `${i * 0.2}s` }} />
                <span className="text-[11px] text-slate-400">{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}