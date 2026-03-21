/**
 * UNIFIED ONBOARDING WIZARD
 * Enhanced to support full platform data intake, validation, and immediate Autopilot activation
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, ChevronRight, AlertCircle, Lock, Zap } from 'lucide-react';
import { toast } from 'sonner';

export default function UnifiedOnboardingWizard({ onComplete }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(null);
  const [stepData, setStepData] = useState({});
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    fetchOnboardingStatus();
  }, []);

  const fetchOnboardingStatus = async () => {
    try {
      const res = await base44.functions.invoke('onboardingOrchestratorEngine', {
        action: 'get_status'
      });
      setStatus(res.data);
      const firstIncomplete = res.data.onboarding.steps.find(s => !res.data.onboarding.completed_steps.includes(s.id));
      setCurrentStep(firstIncomplete || res.data.onboarding.steps[0]);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch status:', error);
      toast.error('Failed to load onboarding status');
      setLoading(false);
    }
  };

  const handleStepChange = (e, fieldName) => {
    setStepData(prev => ({
      ...prev,
      [currentStep.id]: {
        ...prev[currentStep.id],
        [fieldName]: e.target.value
      }
    }));
  };

  const validateStep = async (step) => {
    const data = stepData[step.id] || {};
    const errors = {};

    switch (step.id) {
      case 'identity':
        if (!data.full_name) errors.full_name = 'Full name required';
        if (!data.date_of_birth) errors.date_of_birth = 'Date of birth required';
        if (!data.address) errors.address = 'Address required';
        break;
      case 'kyc':
        if (!data.government_id_type) errors.government_id_type = 'ID type required';
        if (!data.government_id_number) errors.government_id_number = 'ID number required';
        break;
      case 'wallet':
        if (!data.crypto_wallets || data.crypto_wallets.length === 0) {
          errors.wallets = 'At least one wallet required';
        }
        break;
      case 'credentials':
        if (!data.platform_credentials || data.platform_credentials.length === 0) {
          errors.credentials = 'At least one credential required';
        }
        break;
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return false;
    }

    return true;
  };

  const completeStep = async (step) => {
    try {
      // Validate step
      const isValid = await validateStep(step);
      if (!isValid) {
        toast.error('Please fill all required fields');
        return;
      }

      setLoading(true);
      const res = await base44.functions.invoke('onboardingOrchestratorEngine', {
        action: 'submit_step',
        data: {
          step_id: step.id,
          step_data: stepData[step.id] || {}
        }
      });

      // Refresh status
      await fetchOnboardingStatus();
      setValidationErrors({});
      toast.success(`✓ ${step.title} completed!`);

    } catch (error) {
      console.error('Failed to complete step:', error);
      toast.error('Failed to update step');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    try {
      setLoading(true);
      const res = await base44.functions.invoke('onboardingOrchestratorEngine', {
        action: 'complete_onboarding',
        data: stepData
      });

      toast.success('🎉 Onboarding complete! Autopilot is now active.');
      
      if (onComplete) {
        setTimeout(onComplete, 1000);
      }
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      toast.error('Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !status) {
    return (
      <Card className="glass-card border-slate-700">
        <CardContent className="pt-8">
          <div className="flex items-center justify-center gap-3">
            <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
            <span className="text-sm text-slate-400">Loading onboarding...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { onboarding, collected_data } = status;
  const { progress, steps, is_complete } = onboarding;

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <Card className="glass-card border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-orbitron text-base">Platform Activation</CardTitle>
              <CardDescription>Complete your onboarding to activate Autopilot & all departments</CardDescription>
            </div>
            <Badge variant={is_complete ? 'default' : 'secondary'}>
              {progress.percent_complete}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-violet-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${progress.percent_complete}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Step {progress.current_step || steps.length} of {progress.total_steps}</span>
            <span className="text-cyan-400 font-medium">{progress.steps_completed} completed</span>
          </div>
        </CardContent>
      </Card>

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step, idx) => {
          const isCompleted = progress.completed_steps.includes(step.id);
          const isCurrent = currentStep?.id === step.id;

          return (
            <Card
              key={step.id}
              className={`glass-card border-slate-700 cursor-pointer transition-all ${
                isCurrent ? 'ring-2 ring-cyan-500/50' : ''
              } ${isCompleted ? 'opacity-75' : ''}`}
              onClick={() => !isCompleted && setCurrentStep(step)}
            >
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : isCurrent ? (
                      <Circle className="w-5 h-5 text-cyan-400 fill-cyan-400/20" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm">{step.title}</h4>
                      {step.required && <Badge variant="outline" className="text-xs h-5">Required</Badge>}
                      {isCompleted && (
                        <Badge variant="default" className="text-xs h-5 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                          Done
                        </Badge>
                      )}
                    </div>

                    {/* Step Content */}
                    {isCurrent && !isCompleted && (
                      <div className="mt-4 space-y-3">
                        {step.id === 'identity' && (
                          <>
                            <input
                              type="text"
                              placeholder="Full Legal Name"
                              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm"
                              value={stepData[step.id]?.full_name || ''}
                              onChange={(e) => handleStepChange(e, 'full_name')}
                            />
                            {validationErrors.full_name && (
                              <div className="text-xs text-red-400 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> {validationErrors.full_name}
                              </div>
                            )}
                            <input
                              type="date"
                              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm"
                              value={stepData[step.id]?.date_of_birth || ''}
                              onChange={(e) => handleStepChange(e, 'date_of_birth')}
                            />
                            <input
                              type="text"
                              placeholder="Residential Address"
                              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm"
                              value={stepData[step.id]?.address || ''}
                              onChange={(e) => handleStepChange(e, 'address')}
                            />
                          </>
                        )}

                        {step.id === 'kyc' && (
                          <>
                            <select
                              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm"
                              value={stepData[step.id]?.government_id_type || ''}
                              onChange={(e) => handleStepChange(e, 'government_id_type')}
                            >
                              <option value="">Select ID Type</option>
                              <option value="passport">Passport</option>
                              <option value="drivers_license">Driver's License</option>
                              <option value="national_id">National ID</option>
                            </select>
                            <input
                              type="text"
                              placeholder="Government ID Number"
                              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm"
                              value={stepData[step.id]?.government_id_number || ''}
                              onChange={(e) => handleStepChange(e, 'government_id_number')}
                            />
                            <input
                              type="date"
                              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm"
                              value={stepData[step.id]?.government_id_expiry || ''}
                              onChange={(e) => handleStepChange(e, 'government_id_expiry')}
                            />
                          </>
                        )}

                        {step.id === 'wallet' && (
                          <>
                            <input
                              type="text"
                              placeholder="Wallet Address"
                              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm"
                            />
                            <div className="text-xs text-slate-400">At least one wallet is required</div>
                          </>
                        )}

                        {step.id === 'credentials' && (
                          <>
                            <select
                              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm"
                            >
                              <option value="">Select Platform</option>
                              <option value="upwork">Upwork</option>
                              <option value="fiverr">Fiverr</option>
                              <option value="grant.gov">Grant.gov</option>
                            </select>
                            <input
                              type="password"
                              placeholder="API Key or Credentials"
                              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm"
                            />
                          </>
                        )}

                        {step.id === 'departments' && (
                          <>
                            <label className="flex items-center gap-2 text-sm">
                              <input type="checkbox" defaultChecked className="rounded" />
                              <span>Enable Autopilot (autonomous task execution)</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <input type="checkbox" defaultChecked className="rounded" />
                              <span>Enable VIPZ (digital marketing)</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <input type="checkbox" defaultChecked className="rounded" />
                              <span>Enable NED (crypto automation)</span>
                            </label>
                          </>
                        )}

                        {step.id === 'review' && (
                          <div className="space-y-2 text-sm">
                            <div className="p-2 bg-slate-800/50 rounded-lg">
                              <p className="text-slate-300">✓ All data collected and validated</p>
                              <p className="text-slate-400 text-xs mt-1">Your information is encrypted and secure</p>
                            </div>
                          </div>
                        )}
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
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>Next</span>
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

      {/* Completion */}
      {is_complete ? (
        <Card className="glass-card border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="pt-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-sm text-emerald-400">Onboarding Complete!</h4>
              <p className="text-xs text-emerald-300/80 mt-1">
                Your account is activated. Autopilot & all departments are ready to operate.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : currentStep?.id === 'review' ? (
        <Button
          onClick={handleComplete}
          disabled={loading}
          className="w-full btn-cosmic gap-2"
        >
          <Zap className="w-4 h-4" />
          {loading ? 'Activating...' : '🎉 Activate Platform'}
        </Button>
      ) : null}
    </div>
  );
}