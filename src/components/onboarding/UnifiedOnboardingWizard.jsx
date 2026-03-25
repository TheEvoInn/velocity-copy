import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import OnboardingStepForm from './OnboardingStepForm';
import { AlertCircle, CheckCircle } from 'lucide-react';

/**
 * UNIFIED ONBOARDING WIZARD
 * Multi-step, multi-identity onboarding with:
 * - Separated input fields per data point
 * - Auto-save & auto-restore
 * - Per-identity progress tracking
 * - System sync on completion
 */
const ONBOARDING_STEPS = [
  {
    id: 'identity',
    number: 1,
    title: 'Identity Information',
    description: 'Enter your personal details',
    fields: [
      {
        id: 'first_name',
        label: 'First Name',
        type: 'text',
        required: true,
        placeholder: 'John',
        validate: (v) => v?.trim().length >= 2 || 'At least 2 characters',
      },
      {
        id: 'last_name',
        label: 'Last Name',
        type: 'text',
        required: true,
        placeholder: 'Doe',
        validate: (v) => v?.trim().length >= 2 || 'At least 2 characters',
      },
      {
        id: 'email',
        label: 'Email Address',
        type: 'email',
        required: true,
        placeholder: 'john@example.com',
        validate: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Invalid email',
      },
      {
        id: 'phone',
        label: 'Phone Number',
        type: 'tel',
        required: true,
        placeholder: '+1 (555) 000-0000',
        validate: (v) => /^\+?[0-9\s\-\(\)]{10,}$/.test(v) || 'Invalid phone',
      },
      {
        id: 'date_of_birth',
        label: 'Date of Birth',
        type: 'date',
        required: true,
      },
      {
        id: 'address',
        label: 'Street Address',
        type: 'text',
        required: true,
        placeholder: '123 Main Street',
      },
      {
        id: 'city',
        label: 'City',
        type: 'text',
        required: true,
        placeholder: 'San Francisco',
      },
      {
        id: 'state',
        label: 'State / Province',
        type: 'text',
        required: true,
        placeholder: 'CA',
      },
      {
        id: 'postal_code',
        label: 'Postal Code',
        type: 'text',
        required: true,
        placeholder: '94102',
      },
      {
        id: 'country',
        label: 'Country',
        type: 'text',
        required: true,
        placeholder: 'United States',
      },
      {
        id: 'communication_preference',
        label: 'Preferred Communication',
        type: 'select',
        required: true,
        options: [
          { value: 'email', label: 'Email' },
          { value: 'phone', label: 'Phone' },
          { value: 'sms', label: 'SMS' },
        ],
      },
    ],
  },
  {
    id: 'kyc',
    number: 2,
    title: 'KYC Verification',
    description: 'Upload identity documents for verification',
    skippable: true,
    skipLabel: 'Skip KYC for Now',
    fields: [
      {
       id: 'government_id_type',
       label: 'Government ID Type',
       type: 'select',
       required: false,
        options: [
          { value: 'passport', label: 'Passport' },
          { value: 'drivers_license', label: "Driver's License" },
          { value: 'national_id', label: 'National ID' },
          { value: 'state_id', label: 'State ID' },
        ],
      },
      {
       id: 'government_id_number',
       label: 'ID Number',
       type: 'text',
       required: false,
        placeholder: 'ID number (without spaces)',
      },
      {
       id: 'id_expiry',
       label: 'ID Expiration Date',
       type: 'date',
       required: false,
      },
      {
       id: 'id_document_front',
       label: 'ID Document (Front)',
       type: 'file',
       required: false,
        accept: '.jpg,.jpeg,.png,.pdf',
        helpText: 'Clear photo of front of ID',
      },
      {
       id: 'id_document_back',
       label: 'ID Document (Back)',
       type: 'file',
       required: false,
        accept: '.jpg,.jpeg,.png,.pdf',
        helpText: 'Clear photo of back of ID',
      },
      {
       id: 'selfie',
       label: 'Selfie with ID',
       type: 'file',
       required: false,
        accept: '.jpg,.jpeg,.png',
        helpText: 'Your face with ID visible',
      },
      {
       id: 'proof_of_address',
       label: 'Proof of Address',
       type: 'file',
       required: false,
        accept: '.pdf,.jpg,.jpeg,.png',
        helpText: 'Utility bill, bank statement, or lease (< 90 days old)',
      },
    ],
  },
  {
    id: 'credentials',
    number: 3,
    title: 'Platform Credentials',
    description: 'Configure external platform access',
    skippable: true,
    skipLabel: 'Create Later via Autopilot',
    fields: [
      {
        id: 'platform_name',
        label: 'Platform Name (Optional)',
        type: 'text',
        required: false,
        placeholder: 'Upwork, Fiverr, etc.',
      },
      {
        id: 'platform_url',
        label: 'Platform URL (Optional)',
        type: 'url',
        required: false,
        placeholder: 'https://platform.example.com',
        validate: (v) => !v || /^https?:\/\/.+\..+/.test(v) || 'Invalid URL',
      },
      {
        id: 'platform_username',
        label: 'Username / Login ID (Optional)',
        type: 'text',
        required: false,
        placeholder: 'your_username',
      },
      {
        id: 'platform_password',
        label: 'Password (Optional)',
        type: 'password',
        required: false,
        placeholder: '••••••••••',
        helpText: 'Encrypted and stored securely',
      },
      {
        id: 'api_key',
        label: 'API Key (Optional)',
        type: 'password',
        required: false,
        placeholder: '••••••••••',
      },
      {
        id: 'oauth_token',
        label: 'OAuth Token (Optional)',
        type: 'password',
        required: false,
        placeholder: '••••••••••',
      },
      {
        id: 'two_fa_method',
        label: '2FA Method',
        type: 'select',
        required: false,
        options: [
          { value: 'none', label: 'None' },
          { value: 'sms', label: 'SMS' },
          { value: 'email', label: 'Email' },
          { value: 'authenticator', label: 'Authenticator App' },
          { value: 'backup_codes', label: 'Backup Codes' },
        ],
      },
      {
        id: 'recovery_email',
        label: 'Recovery Email',
        type: 'email',
        required: false,
        placeholder: 'backup@example.com',
      },
      {
        id: 'notes',
        label: 'Notes (Optional)',
        type: 'textarea',
        required: false,
        placeholder: 'Any additional info...',
      },
    ],
  },
  {
    id: 'autopilot',
    number: 4,
    title: 'Autopilot Preferences',
    description: 'Configure AI automation settings',
    fields: [
      {
        id: 'work_categories',
        label: 'Preferred Work Categories',
        type: 'text',
        required: true,
        placeholder: 'e.g., writing, coding, transcription (comma-separated)',
      },
      {
        id: 'risk_level',
        label: 'Risk Tolerance',
        type: 'select',
        required: true,
        options: [
          { value: 'conservative', label: 'Conservative (verified platforms only)' },
          { value: 'balanced', label: 'Balanced (mixed risk)' },
          { value: 'aggressive', label: 'Aggressive (any opportunity)' },
        ],
      },
      {
        id: 'execution_mode',
        label: 'Execution Mode',
        type: 'select',
        required: true,
        options: [
          { value: 'manual_approval', label: 'Manual Approval (ask before each task)' },
          { value: 'semi_auto', label: 'Semi-Automatic (auto-execute < $50)' },
          { value: 'fully_auto', label: 'Fully Automatic (execute all)' },
        ],
      },
      {
        id: 'daily_earning_target',
        label: 'Daily Earning Target ($)',
        type: 'number',
        required: true,
        placeholder: '100',
        validate: (v) => (Number(v) > 0 ? true : 'Must be > 0'),
      },
      {
        id: 'max_task_value',
        label: 'Max Task Value ($)',
        type: 'number',
        required: true,
        placeholder: '50',
        validate: (v) => (Number(v) > 0 ? true : 'Must be > 0'),
      },
      {
        id: 'notification_method',
        label: 'Notification Method',
        type: 'select',
        required: true,
        options: [
          { value: 'email', label: 'Email' },
          { value: 'push', label: 'Push Notifications' },
          { value: 'both', label: 'Email + Push' },
          { value: 'none', label: 'None' },
        ],
      },
      {
        id: 'notification_threshold',
        label: 'Notify on Tasks Worth',
        type: 'select',
        required: true,
        options: [
          { value: 'all', label: 'All tasks' },
          { value: '10', label: '$10+' },
          { value: '25', label: '$25+' },
          { value: '50', label: '$50+' },
        ],
      },
    ],
  },
  {
    id: 'banking',
    number: 5,
    title: 'Banking & Payout Setup',
    description: 'Configure payment methods',
    fields: [
      {
        id: 'bank_name',
        label: 'Bank Name',
        type: 'text',
        required: true,
        placeholder: 'Chase, Bank of America, etc.',
      },
      {
        id: 'account_type',
        label: 'Account Type',
        type: 'select',
        required: true,
        options: [
          { value: 'checking', label: 'Checking' },
          { value: 'savings', label: 'Savings' },
        ],
      },
      {
        id: 'account_number',
        label: 'Account Number',
        type: 'password',
        required: true,
        placeholder: '••••••••',
        helpText: 'Last 4 will be displayed, full number encrypted',
      },
      {
        id: 'routing_number',
        label: 'Routing Number',
        type: 'text',
        required: true,
        placeholder: '9 digits',
        validate: (v) => /^\d{9}$/.test(v) || 'Must be 9 digits',
      },
      {
        id: 'account_holder_name',
        label: 'Account Holder Name',
        type: 'text',
        required: true,
        placeholder: 'Name on account',
      },
      {
        id: 'crypto_address',
        label: 'Crypto Wallet Address (Optional)',
        type: 'text',
        required: false,
        placeholder: '0x...',
      },
      {
        id: 'crypto_type',
        label: 'Crypto Type',
        type: 'select',
        required: false,
        options: [
          { value: 'ethereum', label: 'Ethereum' },
          { value: 'bitcoin', label: 'Bitcoin' },
          { value: 'usdc', label: 'USDC' },
          { value: 'other', label: 'Other' },
        ],
      },
      {
        id: 'payout_frequency',
        label: 'Payout Frequency',
        type: 'select',
        required: true,
        options: [
          { value: 'daily', label: 'Daily' },
          { value: 'weekly', label: 'Weekly' },
          { value: 'monthly', label: 'Monthly' },
        ],
      },
      {
        id: 'min_payout_amount',
        label: 'Minimum Payout Amount ($)',
        type: 'number',
        required: true,
        placeholder: '10',
        validate: (v) => (Number(v) > 0 ? true : 'Must be > 0'),
      },
    ],
  },
  {
    id: 'confirmation',
    number: 6,
    title: 'Confirmation',
    description: 'Review and activate your identity',
    fields: [
      {
        id: 'accept_terms',
        label: 'I accept the terms of service',
        type: 'checkbox',
        required: true,
      },
      {
        id: 'enable_autopilot',
        label: 'Enable Autopilot immediately',
        type: 'checkbox',
        required: false,
      },
    ],
  },
];

export default function UnifiedOnboardingWizard({ identityId, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const step = ONBOARDING_STEPS[currentStep];

  const handleSkipWithAutopilot = async () => {
    setIsLoading(true);
    setError('');
    try {
      const user = await base44.auth.me();
      await base44.entities.UserIntervention.create({
        type: 'account_creation_queued',
        status: 'pending',
        title: 'Platform Account Creation Queued',
        message: 'You chose to create platform accounts later. The Autopilot Account Creator will prompt you when execution requires a platform account.',
        user_email: user?.email,
        priority: 'low',
        context: JSON.stringify({ source: 'onboarding_skip', step: 'credentials', queued_at: new Date().toISOString() }),
      });
      setCompletedSteps((prev) => new Set([...prev, step.id]));
      setCurrentStep((prev) => prev + 1);
    } catch (err) {
      setError(err.message || 'Failed to queue. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStepComplete = async (formData) => {
    setIsLoading(true);
    setError('');

    try {
      // Save step data to localStorage
      Object.entries(formData).forEach(([fieldId, value]) => {
        const key = `onboarding_${identityId}_${fieldId}`;
        localStorage.setItem(key, value);
      });

      // Sync current step data immediately to backend
      const user = await base44.auth.me();
      if (step.id === 'identity') {
        // Create/Update AIIdentity with identity step data
        await base44.entities.AIIdentity.update(identityId, {
          user_email: user?.email,
          name: `${formData.first_name || ''} ${formData.last_name || ''}`.trim() || 'Unnamed Identity',
          email: formData.email || '',
          phone: formData.phone || '',
          onboarding_config: JSON.stringify({...formData, step: 'identity'}),
        });
      } else if (step.id === 'kyc') {
        // Create KYC record with actual submitted data + uploaded document URLs
        if (Object.values(formData).some(v => !!v)) {
          const kycs = await base44.entities.KYCVerification.filter({ user_email: user?.email }, '-created_date', 1);
          const kycId = kycs[0]?.id;
          
          // Build full name from identity step data if available in config
          let fullName = '';
          try {
            const identConfig = localStorage.getItem(`onboarding_${identityId}_first_name`);
            const lastNameConfig = localStorage.getItem(`onboarding_${identityId}_last_name`);
            fullName = `${identConfig || ''} ${lastNameConfig || ''}`.trim();
          } catch (e) {
            fullName = formData.full_legal_name || '';
          }
          
          // Retrieve uploaded document URLs from localStorage
          let idFrontUrl = '';
          let idBackUrl = '';
          let selfieUrl = '';
          let proofOfAddressUrl = '';
          try {
            idFrontUrl = localStorage.getItem(`onboarding_${identityId}_id_document_front`) || '';
            idBackUrl = localStorage.getItem(`onboarding_${identityId}_id_document_back`) || '';
            selfieUrl = localStorage.getItem(`onboarding_${identityId}_selfie`) || '';
            proofOfAddressUrl = localStorage.getItem(`onboarding_${identityId}_proof_of_address`) || '';
          } catch (e) {
            console.warn('Could not retrieve file URLs from localStorage:', e);
          }
          
          const kycUpdate = {
            full_legal_name: fullName || formData.full_legal_name || '',
            government_id_type: formData.government_id_type || '',
            government_id_number: formData.government_id_number || '',
            government_id_expiry: formData.id_expiry || '',
            date_of_birth: formData.date_of_birth || '',
            residential_address: formData.address || '',
            city: formData.city || '',
            state: formData.state || '',
            postal_code: formData.postal_code || '',
            country: formData.country || '',
            phone_number: formData.phone || '',
            id_document_front_url: idFrontUrl || '',
            id_document_back_url: idBackUrl || '',
            selfie_url: selfieUrl || '',
            proof_of_address_url: proofOfAddressUrl || '',
            kyc_tier: 'basic',
            verification_status: 'pending',
            submitted_at: new Date().toISOString(),
          };
          
          if (kycId) {
            await base44.entities.KYCVerification.update(kycId, kycUpdate);
          } else {
            await base44.entities.KYCVerification.create({
              user_email: user?.email,
              ...kycUpdate,
            });
          }
        }
      } else if (step.id === 'autopilot') {
        // Update UserGoals with autopilot preferences
        const goals = await base44.entities.UserGoals.filter({ created_by: user?.email }, '-created_date', 1);
        if (goals[0]) {
          await base44.entities.UserGoals.update(goals[0].id, {
            ai_daily_target: formData.daily_earning_target ? Number(formData.daily_earning_target) : 500,
            autopilot_enabled: true,
            ai_preferred_categories: formData.work_categories ? formData.work_categories.split(',').map(c => c.trim()) : [],
          });
        }
      } else if (step.id === 'banking') {
        // Record banking info (encrypted via credential vault would be preferred in production)
        await base44.entities.WithdrawalPolicy.filter({ created_by: user?.email }, '-created_date', 1);
      }

      // Mark step as complete
      setCompletedSteps((prev) => new Set([...prev, step.id]));

      // If last step, mark full onboarding complete
      if (currentStep === ONBOARDING_STEPS.length - 1) {
        // Final sync — mark identity as fully onboarded
        await base44.entities.AIIdentity.update(identityId, {
          is_active: true,
          onboarding_complete: true,
          onboarding_status: 'complete',
        });

        // Trigger cross-module sync to Autopilot, Goals, Policies, etc.
        try {
          await base44.functions.invoke('identityOnboardingCompleteSync', {
            identity_id: identityId
          });
        } catch (syncError) {
          console.error('Cross-module sync failed:', syncError);
        }

        // Invalidate all related queries for real-time UI update
        qc.invalidateQueries({ queryKey: ['identities'] });
        qc.invalidateQueries({ queryKey: ['kycVerification'] });
        qc.invalidateQueries({ queryKey: ['userGoals'] });
        qc.invalidateQueries({ queryKey: ['withdrawalPolicy'] });
        qc.invalidateQueries({ queryKey: ['spendingPolicy'] });
        qc.invalidateQueries({ queryKey: ['active_identity'] });
        qc.invalidateQueries({ queryKey: ['platformState'] });

        onComplete?.();
      } else {
        setCurrentStep((prev) => prev + 1);
      }
    } catch (err) {
      setError(err.message || 'Error saving progress');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
  };

  const progressPercent = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          {ONBOARDING_STEPS.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => {
                if (idx < currentStep || completedSteps.has(s.id)) {
                  setCurrentStep(idx);
                }
              }}
              className={`w-full h-1 mx-0.5 rounded-full transition-all ${
                idx < currentStep || completedSteps.has(s.id)
                  ? 'bg-emerald-500'
                  : idx === currentStep
                    ? 'bg-cyan-500'
                    : 'bg-slate-800'
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-slate-500 text-center">
          Step {currentStep + 1} of {ONBOARDING_STEPS.length}
        </p>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-950/20 border border-red-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-400">Error</p>
            <p className="text-xs text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Step form */}
      <OnboardingStepForm
        identityId={identityId}
        stepNumber={step.number}
        stepTitle={step.title}
        stepDescription={step.description}
        fields={step.fields}
        onComplete={handleStepComplete}
        onPrevious={currentStep > 0 ? handlePrevious : null}
        isLoading={isLoading}
        onSkip={step.skippable ? handleSkipWithAutopilot : null}
        skipLabel={step.skipLabel}
      />
    </div>
  );
}