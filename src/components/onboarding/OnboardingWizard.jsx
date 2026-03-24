import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { usePersistentUserData } from '@/hooks/usePersistentUserData';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import StepWelcome from './steps/StepWelcome';
import StepIdentity from './steps/StepIdentity';
import StepKYC from './steps/StepKYC';
import StepPreferences from './steps/StepPreferences';
import StepBanking from './steps/StepBanking';
import StepWorkflows from './steps/StepWorkflows';
import StepLaunch from './steps/StepLaunch';

const STEP_LABELS = ['Welcome', 'Identity', 'KYC', 'Preferences', 'Banking', 'Workflows', 'Launch'];
const STEP_COLORS = ['#8b5cf6', '#7c3aed', '#f59e0b', '#06b6d4', '#10b981', '#8b5cf6', '#7c3aed'];

const DEFAULT_IDENTITY = {
  name: '', first_name: '', last_name: '', role_labels: [], skills: [], communication_tone: 'professional',
  tagline: '', bio: '', proposal_style: '', email: '', portfolio_url: '',
  linkedin: '', social_other: '', auto_select_for_task_types: [],
  can_create_accounts: true, can_communicate: true, color: '#10b981', is_active: true,
};

const DEFAULT_KYC = {
  full_legal_name: '', date_of_birth: '', residential_address: '', city: '',
  state: '', postal_code: '', country: '', government_id_type: 'passport',
  id_document_front_url: '', id_document_back_url: '', selfie_url: '',
};

const DEFAULT_PREFS = {
  daily_target: 1000, available_capital: 0, hours_per_day: 8, max_daily_spend: 500,
  risk_tolerance: 'moderate', preferred_categories: [], autopilot_enabled: true,
  timezone: 'America/Los_Angeles', region: '', ai_instructions: '',
  notify_email_completion: true, notify_email_errors: true,
  notify_daily_summary: true, notify_weekly_report: true,
  consent_account_creation: true, consent_client_communication: true, consent_analytics: true,
};

const DEFAULT_BANKING = {
  payout_method: 'bank_transfer', bank_name: '', account_number: '',
  routing_number: '', account_type: 'checking', paypal_email: '',
  wise_email: '', tax_classification: 'individual', min_payout: 100,
  payout_frequency: 'weekly', backup_email: '',
};

export default function OnboardingWizard({ onComplete }) {
  const [step, setStep] = useState(0);
  const [identityData, setIdentityData] = useState(DEFAULT_IDENTITY);
  const [kycData, setKycData] = useState(DEFAULT_KYC);
  const [prefData, setPrefData] = useState(DEFAULT_PREFS);
  const [bankingData, setBankingData] = useState(DEFAULT_BANKING);
  const [workflowData, setWorkflowData] = useState({ selected_templates: [], auto_matched: false });
  const [isLaunching, setIsLaunching] = useState(false);

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { updateField } = usePersistentUserData();

  const handleLaunch = async (doNotShowAgain) => {
    setIsLaunching(true);
    try {
      const identity = await base44.entities.AIIdentity.create({
        ...identityData,
        skills: Array.isArray(identityData.skills) ? identityData.skills : [],
        preferred_categories: prefData.preferred_categories || [],
        preferred_platforms: [],
        is_active: true,
        spending_limit_per_task: prefData.max_daily_spend || 500,
        tasks_executed: 0,
        total_earned: 0,
      });

      if (kycData.full_legal_name) {
        await base44.entities.KYCVerification.create({
          ...kycData,
          status: 'submitted',
          admin_status: 'submitted',
        });
      }

      const existingGoals = await base44.entities.UserGoals.list('-created_date', 1);
      const goalsData = {
        daily_target: prefData.daily_target,
        available_capital: prefData.available_capital,
        risk_tolerance: prefData.risk_tolerance,
        preferred_categories: prefData.preferred_categories,
        skills: Array.isArray(identityData.skills) ? identityData.skills : [],
        hours_per_day: prefData.hours_per_day,
        autopilot_enabled: prefData.autopilot_enabled,
        ai_daily_target: Math.round((prefData.daily_target || 1000) * 0.6),
        user_daily_target: Math.round((prefData.daily_target || 1000) * 0.4),
        ai_preferred_categories: prefData.preferred_categories,
        ai_instructions: prefData.ai_instructions || '',
        onboarded: true,
        wallet_balance: 0,
        total_earned: 0,
      };
      if (existingGoals.length > 0) {
        await base44.entities.UserGoals.update(existingGoals[0].id, goalsData);
      } else {
        await base44.entities.UserGoals.create(goalsData);
      }

      const hasBanking = bankingData.bank_name || bankingData.paypal_email || bankingData.wise_email;
      if (hasBanking) {
        const existingPolicies = await base44.entities.WithdrawalPolicy.list('-created_date', 1);
        const policyData = {
          label: 'Primary',
          engine_enabled: true,
          min_withdrawal_threshold: bankingData.min_payout || 100,
          auto_transfer_frequency: bankingData.payout_frequency || 'weekly',
          bank_accounts: [{
            bank_name: bankingData.bank_name || bankingData.paypal_email || bankingData.wise_email,
            account_type: bankingData.account_type || 'checking',
            label: bankingData.payout_method === 'paypal' ? 'PayPal' : 'Primary Bank',
            allocation_pct: 100,
            is_primary: true,
          }],
        };
        if (existingPolicies.length > 0) {
          await base44.entities.WithdrawalPolicy.update(existingPolicies[0].id, policyData);
        } else {
          await base44.entities.WithdrawalPolicy.create(policyData);
        }
      }

      await updateField('onboarding_completed', doNotShowAgain);
      await updateField('autopilot_preferences', {
        enabled: prefData.autopilot_enabled,
        mode: 'continuous',
        max_daily_spend: prefData.max_daily_spend,
        preferred_categories: prefData.preferred_categories,
      });

      await base44.entities.ActivityLog.create({
        action_type: 'system',
        message: `🚀 Onboarding complete — VELOCITY activated for ${identityData.name || user?.email}`,
        severity: 'success',
        metadata: { identity_id: identity?.id, kyc_submitted: !!kycData.full_legal_name },
      }).catch(() => {});

      queryClient.invalidateQueries({ queryKey: ['aiIdentities'] });
      queryClient.invalidateQueries({ queryKey: ['userGoals'] });

      toast.success('🚀 VELOCITY activated! Autopilot is now running.');
      onComplete();
    } catch (err) {
      toast.error(`Launch failed: ${err.message}`);
      setIsLaunching(false);
    }
  };

  const activeColor = STEP_COLORS[step] || '#8b5cf6';

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8">
      {/* Progress bar */}
      {step > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between gap-2 mb-3">
            {STEP_LABELS.map((label, i) => {
              const isActive = i === step;
              const isDone = i < step;
              return (
                <div key={label} className="flex items-center gap-2 flex-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0 ${
                    isDone ? 'bg-emerald-500 text-white' : isActive ? 'text-white' : 'text-slate-500'
                  }`} style={isActive ? { background: activeColor } : isDone ? {} : { background: '#1e293b' }}>
                    {isDone ? '✓' : i + 1}
                  </div>
                  <span className={`text-xs hidden sm:block ${isActive ? 'text-white font-semibold' : isDone ? 'text-emerald-400' : 'text-slate-600'}`}>
                    {label}
                  </span>
                  {i < STEP_LABELS.length - 1 && (
                    <div className={`flex-1 h-0.5 rounded-full ${isDone ? 'bg-emerald-500' : 'bg-slate-800'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Step content - always visible in page flow */}
      <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 sm:p-8 mb-8" style={{
        boxShadow: `0 0 40px ${activeColor}15`,
      }}>
        {step === 0 && <StepWelcome onNext={() => setStep(1)} />}
        {step === 1 && <StepIdentity data={identityData} onChange={setIdentityData} onNext={() => setStep(2)} onBack={() => setStep(0)} />}
        {step === 2 && <StepKYC data={kycData} onChange={setKycData} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
        {step === 3 && <StepPreferences data={prefData} onChange={setPrefData} onNext={() => setStep(4)} onBack={() => setStep(2)} />}
        {step === 4 && <StepBanking data={bankingData} onChange={setBankingData} onNext={() => setStep(5)} onBack={() => setStep(3)} />}
        {step === 5 && (
          <StepWorkflows
            data={workflowData} onChange={setWorkflowData}
            identityData={identityData} prefData={prefData}
            onNext={() => setStep(6)} onBack={() => setStep(4)}
          />
        )}
        {step === 6 && (
          <StepLaunch
            identityData={identityData} kycData={kycData}
            prefData={prefData} bankingData={bankingData}
            workflowData={workflowData}
            onLaunch={handleLaunch} onBack={() => setStep(5)}
            isLaunching={isLaunching}
          />
        )}
      </div>
    </div>
  );
}