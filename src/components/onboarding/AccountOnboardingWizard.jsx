import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, ChevronRight, AlertCircle, Lock } from 'lucide-react';
import { toast } from 'sonner';

export default function AccountOnboardingWizard({ accountId, platform, onComplete }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(null);
  const [stepData, setStepData] = useState({});

  useEffect(() => {
    fetchOnboardingStatus();
  }, [accountId]);

  const fetchOnboardingStatus = async () => {
    try {
      const res = await base44.functions.invoke('accountCreationEngine', {
        action: 'get_onboarding_status',
        account_id: accountId
      });
      setStatus(res.data);
      setCurrentStep(res.data.steps?.[res.data.progress?.steps_completed] || res.data.steps?.[0]);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch status:', error);
      toast.error('Failed to load onboarding status');
      setLoading(false);
    }
  };

  const completeStep = async (step) => {
    try {
      setLoading(true);
      const res = await base44.functions.invoke('accountCreationEngine', {
        action: 'multi_step_onboarding',
        account_id: accountId,
        step: step.step_id,
        step_data: stepData[step.step_id] || {}
      });

      setStatus(res.data);
      const nextStep = res.data.steps?.find(s => s.status !== 'completed');
      setCurrentStep(nextStep || null);
      setStepData({});

      toast.success(`✓ ${step.title} completed!`);

      if (res.data.is_complete && onComplete) {
        setTimeout(onComplete, 500);
      }
    } catch (error) {
      console.error('Failed to complete step:', error);
      toast.error('Failed to update step');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !status) {
    return (
      <Card className="bg-slate-900/50 border-slate-700">
        <CardContent className="pt-8">
          <div className="flex items-center justify-center gap-3">
            <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
            <span className="text-sm text-slate-400">Loading onboarding progress...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { progress, steps, is_complete } = status;

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Account Activation Progress</CardTitle>
              <CardDescription>{platform || 'Platform'} onboarding</CardDescription>
            </div>
            <Badge variant={is_complete ? 'default' : 'secondary'}>
              {progress.percent_complete}% Complete
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Visual Progress Bar */}
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500"
              style={{ width: `${progress.percent_complete}%` }}
            />
          </div>

          {/* Step Counter */}
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">
              Step {progress.current_step} of {progress.total_steps}
            </span>
            <span className="text-emerald-400 font-medium">
              {progress.steps_completed} completed
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Steps List */}
      <div className="space-y-2">
        {steps?.map((step, idx) => {
          const isCompleted = step.status === 'completed';
          const isCurrent = currentStep?.step_id === step.step_id;

          return (
            <Card
              key={step.step_id}
              className={`bg-slate-900/50 border-slate-700 cursor-pointer transition-all ${
                isCurrent ? 'ring-2 ring-emerald-500/50' : ''
              } ${isCompleted ? 'opacity-75' : ''}`}
              onClick={() => !isCompleted && setCurrentStep(step)}
            >
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="mt-1">
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : isCurrent ? (
                      <Circle className="w-5 h-5 text-emerald-400 fill-emerald-400/20" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-600" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm">{step.title}</h4>
                      {step.required && (
                        <Badge variant="outline" className="text-xs h-5">Required</Badge>
                      )}
                      {isCompleted && (
                        <Badge variant="default" className="text-xs h-5 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                          Done
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{step.description}</p>

                    {/* Checklist */}
                    {isCurrent && (
                      <div className="mt-3 space-y-1.5">
                        {step.checklist?.map((item, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
                            <div className="w-3 h-3 rounded-full bg-slate-700" />
                            {item}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action */}
                  {isCurrent && !isCompleted && (
                    <Button
                      onClick={() => completeStep(step)}
                      disabled={loading}
                      size="sm"
                      className="shrink-0 gap-1 h-8"
                    >
                      {loading ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <span>Mark Complete</span>
                          <ChevronRight className="w-3 h-3" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Completion Message */}
      {is_complete && (
        <Card className="bg-emerald-500/10 border-emerald-500/30">
          <CardContent className="pt-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm text-emerald-400">Account Fully Activated!</h4>
              <p className="text-xs text-emerald-300/80 mt-1">
                Your {platform} account is now ready for use. All setup steps have been completed.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}