import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePersistentUserData } from '@/hooks/usePersistentUserData';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

import StepWelcome from './steps/StepWelcome';
import StepIdentity from './steps/StepIdentity';
import StepKYC from './steps/StepKYC';
import StepPreferences from './steps/StepPreferences';
import StepBanking from './steps/StepBanking';
import StepLaunch from './steps/StepLaunch';

const STEP_LABELS = ['Welcome', 'Identity', 'KYC', 'Preferences', 'Banking', 'Launch'];

const STEP_COLORS = ['#8b5cf6', '#7c3aed', '#f59e0b', '#06b6d4', '#10b981', '#7c3aed'];

const DEFAULT_IDENTITY = {
  name: '', role_label: 'Freelancer', skills: [], communication_tone: 'professional',
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

export default function OnboardingModal({ onComplete }) {
  const [step, setStep] = useState(0);
  const [identityData, setIdentityData] = useState(DEFAULT_IDENTITY);
  const [kycData, setKycData] = useState(DEFAULT_KYC);
  const [prefData, setPrefData] = useState(DEFAULT_PREFS);
  const [bankingData, setBankingData] = useState(DEFAULT_BANKING);
  const [isLaunching, setIsLaunching] = useState(false);

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { updateField } = usePersistentUserData();

  const handleLaunch = async (doNotShowAgain) => {
    setIsLaunching(true);
    try {
      // 1. Create AI Identity
      const identity = await base44.entities.AIIdentity.create({
        ...identityData,
        skills: Array.isArray(identityData.skills) ? identityData.skills : (identityData.skills || '').split(',').map(s => s.trim()).filter(Boolean),
        preferred_categories: prefData.preferred_categories || [],
        preferred_platforms: [],
        is_active: true,
        spending_limit_per_task: prefData.max_daily_spend || 500,
        tasks_executed: 0,
        total_earned: 0,
      });

      // 2. Submit KYC if filled
      if (kycData.full_legal_name) {
        await base44.entities.KYCVerification.create({
          ...kycData,
          status: 'submitted',
          admin_status: 'submitted',
        });
      }

      // 3. Save user goals / preferences
      const existingGoals = await base44.entities.UserGoals.list('-created_date', 1);
      const goalsData = {
        daily_target: prefData.daily_target,
        available_capital: prefData.available_capital,
        risk_tolerance: prefData.risk_tolerance,
        preferred_categories: prefData.preferred_categories,
        skills: identityData.skills || [],
        hours_per_day: prefData.hours_per_day,
        autopilot_enabled: prefData.autopilot_enabled,
        ai_daily_target: Math.round((prefData.daily_target || 1000) * 0.6),
        user_daily_target: Math.round((prefData.daily_target || 1000) * 0.4),
        ai_preferred_categories: prefData.preferred_categories,
        ai_instructions: prefData.ai_instructions || '',
        onboarded: true,
        wallet_balance: 0, total_earned: 0,
      };
      if (existingGoals.length > 0) {
        await base44.entities.UserGoals.update(existingGoals[0].id, goalsData);
      } else {
        await base44.entities.UserGoals.create(goalsData);
      }

      // 4. Save banking / withdrawal policy
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

      // 5. Save onboarding completion + user preferences to persistent store
      await updateField('onboarding_completed', doNotShowAgain);
      await updateField('autopilot_preferences', {
        enabled: prefData.autopilot_enabled,
        mode: 'continuous',
        max_daily_spend: prefData.max_daily_spend,
        preferred_categories: prefData.preferred_categories,
        notification_preferences: {
          email_on_task_completion: prefData.notify_email_completion,
          email_on_error: prefData.notify_email_errors,
          daily_summary: prefData.notify_daily_summary,
          weekly_summary: prefData.notify_weekly_report,
        },
      });

      // 6. Trigger Autopilot scan immediately
      if (prefData.autopilot_enabled) {
        base44.functions.invoke('unifiedOrchestrator', {
          action: 'run_cycle',
          identity_id: identity?.id,
        }).catch(() => {});
      }

      // 7. Activity log
      await base44.entities.ActivityLog.create({
        action_type: 'system',
        message: `🚀 Onboarding complete — MISSION activated for ${identityData.name || user?.email}`,
        severity: 'success',
        metadata: { identity_id: identity?.id, kyc_submitted: !!kycData.full_legal_name },
      });

      queryClient.invalidateQueries({ queryKey: ['aiIdentities'] });
      queryClient.invalidateQueries({ queryKey: ['userGoals'] });

      toast.success('🚀 MISSION activated! Autopilot is now running.');
      onComplete();
    } catch (err) {
      toast.error(`Launch failed: ${err.message}`);
      setIsLaunching(false);
    }
  };

  const totalSteps = STEP_LABELS.length;
  const activeColor = STEP_COLORS[step] || '#8b5cf6';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl"
        style={{ boxShadow: `0 0 60px ${activeColor}22, 0 25px 60px rgba(0,0,0,0.5)` }}>

        {/* Progress header */}
        {step > 0 && (
          <div className="px-6 pt-5 pb-4 border-b border-slate-800">
            <div className="flex items-center justify-between mb-2">
              {STEP_LABELS.slice(1).map((label, i) => {
                const idx = i + 1;
                const isActive = idx === step;
                const isDone = idx < step;
                return (
                  <div key={label} className="flex items-center gap-1 flex-1">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all ${
                      isActive ? 'text-white' : isDone ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-600'
                    }`} style={isActive ? { background: activeColor } : {}}>
                      {isDone ? '✓' : idx}
                    </div>
                    <span className={`text-[9px] hidden sm:block ${isActive ? 'text-white' : isDone ? 'text-emerald-400' : 'text-slate-600'}`}>
                      {label}
                    </span>
                    {i < STEP_LABELS.length - 2 && (
                      <div className={`flex-1 h-0.5 mx-1 rounded-full ${isDone ? 'bg-emerald-500' : 'bg-slate-800'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="p-6">
          {step === 0 && <StepWelcome onNext={() => setStep(1)} />}
          {step === 1 && <StepIdentity data={identityData} onChange={setIdentityData} onNext={() => setStep(2)} onBack={() => setStep(0)} />}
          {step === 2 && <StepKYC data={kycData} onChange={setKycData} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
          {step === 3 && <StepPreferences data={prefData} onChange={setPrefData} onNext={() => setStep(4)} onBack={() => setStep(2)} />}
          {step === 4 && <StepBanking data={bankingData} onChange={setBankingData} onNext={() => setStep(5)} onBack={() => setStep(3)} />}
          {step === 5 && (
            <StepLaunch
              identityData={identityData} kycData={kycData}
              prefData={prefData} bankingData={bankingData}
              onLaunch={handleLaunch} onBack={() => setStep(4)}
              isLaunching={isLaunching}
            />
          )}
        </div>
      </div>
    </div>
  );
}