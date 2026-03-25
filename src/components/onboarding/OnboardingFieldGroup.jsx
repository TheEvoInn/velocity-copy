import React, { useState, useEffect } from 'react';
import { AlertCircle, Check, Eye, EyeOff, Upload, CheckCircle2, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

/**
 * OnboardingFieldGroup — Reusable field component with validation & auto-save
 * Handles individual data fields with real-time validation and auto-persistence
 */
export default function OnboardingFieldGroup({
  fieldId,
  label,
  type = 'text',
  value = '',
  onChange,
  onBlur,
  placeholder = '',
  required = false,
  validation = null, // func: (val) => { valid: bool, error?: string }
  helpText = '',
  options = [], // For select/radio
  accept = '*', // For file inputs
  identityId, // For auto-save to entity
  tabIndex = 0, // Tab navigation
}) {
  const fieldConfig = { helpText, accept };
  const [isValid, setIsValid] = useState(true);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Validate on change
  const handleChange = (e) => {
    const newValue = e.target.value;
    onChange?.(newValue);

    // Run custom validation
    if (validation) {
      const result = validation(newValue);
      setIsValid(result.valid);
      setError(result.error || '');
    } else if (required && !newValue.trim()) {
      setIsValid(false);
      setError('This field is required');
    } else {
      setIsValid(true);
      setError('');
    }

    // Auto-save to localStorage first (immediately)
    if (identityId) {
      const key = `onboarding_${identityId}_${fieldId}`;
      localStorage.setItem(key, newValue);
    }
  };

  // Restore from localStorage on mount
  useEffect(() => {
    if (identityId && !value) {
      const key = `onboarding_${identityId}_${fieldId}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        onChange?.(saved);
      }
    }
  }, [identityId, fieldId, value, onChange]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onChange?.(file_url);
      
      // Save file URL to localStorage
      if (identityId) {
        const key = `onboarding_${identityId}_${fieldId}`;
        localStorage.setItem(key, file_url);
      }
      
      setIsValid(true);
      setError('');
    } catch (err) {
      setError(`Upload failed: ${err.message}`);
      setIsValid(false);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveFile = () => {
    onChange?.('');
    if (identityId) {
      const key = `onboarding_${identityId}_${fieldId}`;
      localStorage.removeItem(key);
    }
  };

  const baseInputClasses = `w-full px-3 py-2 rounded-lg text-sm font-mono transition-all
    ${isValid
      ? 'bg-slate-950 border border-slate-800 text-white placeholder-slate-600'
      : 'bg-red-950/20 border border-red-800 text-white placeholder-red-600'
    }
    focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50`;

  return (
    <div className="space-y-1.5">
      {/* Label */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-orbitron tracking-widest text-slate-400">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {isValid && value && !error && (
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            <Check className="w-3 h-3" /> Valid
          </span>
        )}
      </div>

      {/* Input */}
      {type === 'file' ? (
        <div className="space-y-2">
          {value ? (
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-950/20 border border-emerald-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-xs text-emerald-400 truncate">{value.split('/').pop()}</span>
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="text-emerald-600 hover:text-emerald-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <label className={`${baseInputClasses} flex items-center justify-center cursor-pointer hover:border-cyan-400 transition-colors`}>
              <input
                type="file"
                accept={fieldConfig?.accept || '*'}
                onChange={(e) => {
                  try {
                    handleFileUpload(e);
                  } catch (err) {
                    console.error('File upload failed:', err);
                    alert(`Upload error: ${err.message}. Try again.`);
                  }
                }}
                disabled={isUploading}
                className="hidden"
                tabIndex={tabIndex}
              />
              <div className="flex items-center gap-2 text-slate-400">
                {isUploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs">Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span className="text-xs">Click to upload or drag & drop</span>
                  </>
                )}
              </div>
            </label>
          )}
          {fieldConfig?.helpText && (
            <p className="text-xs text-slate-500">{fieldConfig.helpText}</p>
          )}
        </div>
      ) : type === 'textarea' ? (
       <textarea
         value={value}
         onChange={handleChange}
         onBlur={onBlur}
         placeholder={placeholder}
         className={`${baseInputClasses} resize-none h-24`}
         tabIndex={tabIndex}
       />
      ) : type === 'select' ? (
       <select
         value={value}
         onChange={handleChange}
         onBlur={onBlur}
         className={baseInputClasses}
         tabIndex={tabIndex}
       >
          <option value="">{placeholder || 'Select an option'}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : type === 'checkbox' ? (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={fieldId}
            checked={value === 'on' || value === true}
            onChange={(e) => {
              const newVal = e.target.checked ? 'on' : '';
              onChange?.(newVal);
              if (validation) {
                const result = validation(newVal);
                // Validation will be handled by parent
              }
            }}
            className="w-4 h-4 rounded accent-cyan-500 cursor-pointer"
            tabIndex={tabIndex}
          />
          <label htmlFor={fieldId} className="text-sm text-slate-300 cursor-pointer flex-1">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        </div>
      ) : type === 'password' ? (
       <div className="relative">
         <input
           type={showPassword ? 'text' : 'password'}
           value={value}
           onChange={handleChange}
           onBlur={onBlur}
           placeholder={placeholder}
           className={baseInputClasses}
           tabIndex={tabIndex}
         />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-400 transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      ) : (
       <input
         type={type}
         value={value}
         onChange={handleChange}
         onBlur={onBlur}
         placeholder={placeholder}
         className={baseInputClasses}
         tabIndex={tabIndex}
       />
      )}

      {/* Error */}
      {error && !isValid && (
        <div className="flex items-start gap-2 text-xs text-red-400">
          <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Help text */}
      {helpText && !error && (
        <p className="text-xs text-slate-600">{helpText}</p>
      )}

      {/* Save indicator */}
      {isSaving && (
        <div className="text-xs text-slate-500 flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
          Saving...
        </div>
      )}
    </div>
  );
}