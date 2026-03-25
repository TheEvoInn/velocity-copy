import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { usePersistentUserData } from '@/hooks/usePersistentUserData';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';

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
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { updateField } = usePersistentUserData();

  const saveDraft = async () => {
    if (!user?.email) return;
    setIsSavingDraft(true);
    try {
      localStorage.setItem(`onboarding_identity_${user.email}`, JSON.stringify(identityData));
      localStorage.setItem(`onboarding_kyc_${user.email}`, JSON.stringify(kycData));
      localStorage.setItem(`onboarding_pref_${user.email}`, JSON.stringify(prefData));
      localStorage.setItem(`onboarding_banking_${user.email}`, JSON.stringify(bankingData));
      localStorage.setItem(`onboarding_workflow_${user.email}`, JSON.stringify(workflowData));
      localStorage.setItem(`onboarding_step_${user.email}`, step.toString());
      toast.success('✅ Draft saved');
      console.log('[Onboarding] Draft saved to localStorage');
    } catch (err) {
      toast.error('Failed to save draft');
      console.error('[Onboarding] Save draft failed:', err);
    } finally {
      setIsSavingDraft(false);
    }
  };

  const forceSaveAndLaunch = async () => {
    saveDraft();
    await handleLaunch(true);
  };

  const handleLaunch = async (doNotShowAgain) => {
    setIsLaunching(true);
    try {
      // 1. Create or update AI Identity (dedup check)
      let identity;
      try {
        // Check for existing identity by user email
        const existingIdentities = await base44.entities.AIIdentity.filter(
          { user_email: user?.email },
          '-created_date',
          1
        );
        
        if (existingIdentities.length > 0) {
          // Update existing instead of creating duplicate
          const existingId = existingIdentities[0].id;
          await base44.entities.AIIdentity.update(existingId, {
            name: `${identityData.first_name} ${identityData.last_name}`.trim() || identityData.name,
            role_labels: identityData.role_labels || [],
            skills: Array.isArray(identityData.skills) ? identityData.skills : [],
            preferred_categories: prefData.preferred_categories || [],
            communication_tone: identityData.communication_tone,
            is_active: true,
            onboarding_complete: true,
          });
          identity = existingIdentities[0];
          console.log('[Onboarding] AIIdentity updated (dedup):', identity.id);
        } else {
          identity = await base44.entities.AIIdentity.create({
          ...identityData,
          name: `${identityData.first_name} ${identityData.last_name}`.trim() || identityData.name,
          user_email: user?.email,
          role_labels: identityData.role_labels || [],
          skills: Array.isArray(identityData.skills) ? identityData.skills : [],
          preferred_categories: prefData.preferred_categories || [],
          preferred_platforms: [],
          is_active: true,
          onboarding_complete: true,
          spending_limit_per_task: prefData.max_daily_spend || 500,
          tasks_executed: 0,
          total_earned: 0,
          });
          console.log('[Onboarding] AIIdentity created:', identity.id);
        }
      } catch (err) {
        console.error('[Onboarding] AIIdentity creation/update failed:', err);
        throw new Error(`Failed to create identity: ${err.message}`);
      }

      // 2. Submit KYC if provided
      let kycRecord;
      if (kycData.full_legal_name) {
        try {
          kycRecord = await base44.entities.KYCVerification.create({
            ...kycData,
            user_email: user?.email,
            status: 'submitted',
            verification_type: 'standard',
            identity_id: identity.id,
          });
          console.log('[Onboarding] KYC submitted:', kycRecord.id);
        } catch (err) {
          console.warn('[Onboarding] KYC submission failed (non-fatal):', err);
        }
      }

      // 3. Create or update UserGoals (required)
      try {
        const existingGoals = await base44.entities.UserGoals.filter(
          { created_by: user?.email },
          '-created_date',
          1
        );
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
          console.log('[Onboarding] UserGoals updated:', existingGoals[0].id);
        } else {
          await base44.entities.UserGoals.create(goalsData);
          console.log('[Onboarding] UserGoals created');
        }
      } catch (err) {
        console.error('[Onboarding] UserGoals save failed:', err);
        throw new Error(`Failed to save preferences: ${err.message}`);
      }

      // 4. Configure withdrawal policy if banking info provided
      if (bankingData.bank_name || bankingData.paypal_email || bankingData.wise_email) {
        try {
          const existingPolicies = await base44.entities.WithdrawalPolicy.filter(
            { created_by: user?.email },
            '-created_date',
            1
          );
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
            console.log('[Onboarding] WithdrawalPolicy updated');
          } else {
            await base44.entities.WithdrawalPolicy.create(policyData);
            console.log('[Onboarding] WithdrawalPolicy created');
          }
        } catch (err) {
          console.warn('[Onboarding] WithdrawalPolicy save failed (non-fatal):', err);
        }
      }

      // 5. Persist user preferences
      try {
        await updateField('onboarding_completed', doNotShowAgain);
        await updateField('autopilot_preferences', {
          enabled: prefData.autopilot_enabled,
          mode: 'continuous',
          max_daily_spend: prefData.max_daily_spend,
          preferred_categories: prefData.preferred_categories,
        });
        console.log('[Onboarding] User preferences persisted');
      } catch (err) {
        console.warn('[Onboarding] Preference persistence failed (non-fatal):', err);
      }

      // 6. Log completion
      try {
        await base44.entities.ActivityLog.create({
          action_type: 'system',
          message: `🚀 Onboarding complete — VELOCITY activated for ${identityData.name || user?.email}`,
          severity: 'success',
          metadata: { identity_id: identity?.id, kyc_submitted: !!kycRecord, goals_saved: true },
        });
      } catch (err) {
        console.warn('[Onboarding] Activity log failed:', err);
      }

      // 7. TRIGGER REAL MULTI-SYNC & LAUNCH SEQUENCE
      if (!identity?.id) {
        throw new Error('Identity creation failed — no ID returned');
      }
      try {
        console.log('[Onboarding] Invoking onboardingLaunchSync with:', { identity_id: identity.id, identity_name: identity.name });
        const launchResult = await base44.functions.invoke('onboardingLaunchSync', {
          identity_id: identity.id,
          identity_name: identity.name,
          kyc_id: kycRecord?.id,
          daily_target: prefData.daily_target,
          autopilot_enabled: prefData.autopilot_enabled,
          risk_tolerance: prefData.risk_tolerance,
          preferred_categories: prefData.preferred_categories,
          banking_configured: !!(bankingData.bank_name || bankingData.paypal_email),
        });
        console.log('[Onboarding] Launch sync complete:', launchResult.data);
        if (!launchResult.data?.success) {
          throw new Error(launchResult.data?.error || 'Launch sync returned false');
        }
      } catch (err) {
        console.error('[Onboarding] Launch sync failed:', err.message, err);
        throw new Error(`Failed to activate VELOCITY: ${err.message}`);
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['userGoals'] });
      queryClient.invalidateQueries({ queryKey: ['aiIdentities'] });
      queryClient.invalidateQueries({ queryKey: ['userGoals', user?.email] });
      queryClient.invalidateQueries({ queryKey: ['userDataStore'] });

      // Clear localStorage after successful launch
      if (user?.email) {
        localStorage.removeItem(`onboarding_identity_${user.email}`);
        localStorage.removeItem(`onboarding_kyc_${user.email}`);
        localStorage.removeItem(`onboarding_pref_${user.email}`);
        localStorage.removeItem(`onboarding_banking_${user.email}`);
        localStorage.removeItem(`onboarding_workflow_${user.email}`);
        localStorage.removeItem(`onboarding_step_${user.email}`);
      }

      toast.success('🚀 VELOCITY activated! Autopilot is now running.');
      setIsLaunching(false);
      setTimeout(() => {
        if (onComplete && typeof onComplete === 'function') {
          onComplete();
        }
      }, 500);
    } catch (err) {
      console.error('[Onboarding] Launch failed:', err);
      toast.error(`❌ ${err.message}`);
      setIsLaunching(false);
    }
  };

  const activeColor = STEP_COLORS[step] || '#8b5cf6';

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8">
      {step > 0 && step < 6 && (
        <div className="mb-4 flex justify-end">
          <button onClick={saveDraft} disabled={isSavingDraft} className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border transition-colors ${isSavingDraft ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300 cursor-not-allowed' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
            <Save className={`w-3 h-3 ${isSavingDraft ? 'animate-pulse' : ''}`} /> {isSavingDraft ? 'Saving...' : 'Save Draft'}
          </button>
        </div>
      )}
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
            onLaunch={handleLaunch}
            onForceSave={forceSaveAndLaunch}
            onBack={() => setStep(5)}
            isLaunching={isLaunching}
          />
        )}
      </div>
    </div>
  );
}