import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import OnboardingFieldGroup from './OnboardingFieldGroup';

/**
 * OnboardingStepForm — Multi-step form with auto-save per identity
 * Manages form state, validation, and field-level persistence
 */
export default function OnboardingStepForm({
  identityId,
  stepNumber,
  stepTitle,
  stepDescription,
  fields = [],
  onComplete,
  onPrevious,
  isLoading = false,
  onSkip = null,
  skipLabel = 'Create Later',
}) {
  const [formData, setFormData] = useState({});
  const [isValid, setIsValid] = useState(false);
  const [validFields, setValidFields] = useState({});

  // Load saved progress from localStorage and re-validate
  useEffect(() => {
    const saved = {};
    const validated = {};
    fields.forEach((field) => {
      const key = `onboarding_${identityId}_${field.id}`;
      const val = localStorage.getItem(key);
      if (val) {
        saved[field.id] = val;
        // Re-validate loaded value
        const valid = field.validate?.(val) ?? true;
        validated[field.id] = valid === true;
      }
    });
    setFormData(saved);
    setValidFields(validated);
  }, [identityId, fields]);

  // Update validation state
  useEffect(() => {
    const allValid = fields.every((f) => {
      if (f.required) return validFields[f.id] === true;
      return true;
    });
    setIsValid(allValid);
  }, [validFields, fields]);

  const handleFieldChange = (fieldId, value) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleFieldValidation = (fieldId, isValid) => {
    setValidFields((prev) => ({ ...prev, [fieldId]: isValid }));
  };

  const handleComplete = async () => {
    if (!isValid) return;
    onComplete?.(formData);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="text-xs font-orbitron tracking-widest text-cyan-400 mb-2">
          STEP {stepNumber}
        </div>
        <h2 className="text-2xl font-orbitron font-bold text-white mb-1">{stepTitle}</h2>
        <p className="text-sm text-slate-400">{stepDescription}</p>
      </div>

      {/* Form Fields */}
      <div className="space-y-4 bg-slate-950/50 p-6 rounded-2xl border border-slate-800">
        {fields.map((fieldConfig) => (
          <OnboardingFieldGroup
            key={fieldConfig.id}
            fieldId={fieldConfig.id}
            label={fieldConfig.label}
            type={fieldConfig.type || 'text'}
            value={formData[fieldConfig.id] || ''}
            onChange={(val) => handleFieldChange(fieldConfig.id, val)}
            placeholder={fieldConfig.placeholder}
            required={fieldConfig.required}
            validation={(val) => {
              const valid = fieldConfig.validate?.(val) ?? true;
              handleFieldValidation(fieldConfig.id, valid);
              return {
                valid: valid === true,
                error:
                  typeof valid === 'string' ? valid : undefined,
              };
            }}
            helpText={fieldConfig.helpText}
            options={fieldConfig.options}
            identityId={identityId}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        {onPrevious && (
          <button
            onClick={onPrevious}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-orbitron tracking-wide text-slate-400 hover:text-slate-300 border border-slate-700 hover:border-slate-600 transition-all disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
        )}
        {onSkip && (
          <button
            onClick={onSkip}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-orbitron tracking-wide text-amber-400 hover:text-amber-300 border border-amber-500/30 hover:border-amber-400/50 bg-amber-500/5 hover:bg-amber-500/10 transition-all disabled:opacity-50"
            title="Skip now — Autopilot will prompt you to create platform accounts when needed"
          >
            ⏱ {skipLabel}
          </button>
        )}
        <button
          onClick={handleComplete}
          disabled={!isValid || isLoading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-orbitron tracking-wide text-black bg-cyan-500 hover:bg-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              Next <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}