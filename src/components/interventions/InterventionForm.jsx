import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Zap } from 'lucide-react';

export default function InterventionForm({ intervention, onSubmit, onClose }) {
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [useExisting, setUseExisting] = useState(true);
  const [creatingAccount, setCreatingAccount] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await base44.functions.invoke('userInterventionManager', {
        action: 'provide_missing_data',
        intervention_id: intervention.id,
        data: formData
      });

      if (!res.data?.data_received) {
        setError(res.data?.error || 'Submission failed');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        onSubmit?.();
        onClose?.();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to submit data');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoCreateAccount = async () => {
    setCreatingAccount(true);
    setError(null);

    try {
      const res = await base44.functions.invoke('accountCreationEngine', {
        action: 'check_and_create_account',
        platform: intervention.requirement_type === 'missing_data' ? 'generic' : 'upwork',
        identity_id: intervention.opportunity_id || 'autopilot-default',
        on_demand: true
      });

      if (res.data?.success) {
        setSuccess(true);
        setTimeout(() => {
          onSubmit?.();
          onClose?.();
        }, 1500);
      } else {
        setError(res.data?.error || 'Account creation failed');
      }
    } catch (err) {
      setError(err.message || 'Failed to create account');
    } finally {
      setCreatingAccount(false);
    }
  };

  const renderFormField = (fieldName, fieldDef) => {
    const type = fieldDef.type || 'text';
    const label = fieldName.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());

    return (
      <div key={fieldName} className="space-y-1">
        <label className="block text-xs font-medium text-slate-300">
          {label} {fieldDef.description && `(${fieldDef.description})`}
        </label>
        {type === 'password' ? (
          <Input
            type="password"
            value={formData[fieldName] || ''}
            onChange={(e) => setFormData({ ...formData, [fieldName]: e.target.value })}
            required={intervention.data_schema?.required?.includes(fieldName)}
            className="bg-slate-800 border-slate-700 text-white"
          />
        ) : (
          <Input
            type={type}
            value={formData[fieldName] || ''}
            onChange={(e) => setFormData({ ...formData, [fieldName]: e.target.value })}
            required={intervention.data_schema?.required?.includes(fieldName)}
            className="bg-slate-800 border-slate-700 text-white"
          />
        )}
      </div>
    );
  };

  if (success) {
    return (
      <Card className="bg-slate-900/50 border-slate-700 p-6 text-center">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
        <p className="text-white font-semibold">Data submitted successfully</p>
        <p className="text-xs text-slate-400 mt-2">Task resuming...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toggle: Existing vs Auto-Create (only for credential-related interventions) */}
      {intervention.requirement_type === 'missing_data' && (
        <div className="p-3 rounded-lg border border-slate-700 bg-slate-800/40 space-y-3">
          <p className="text-xs font-orbitron tracking-widest text-slate-400">ACCOUNT SETUP METHOD</p>
          <div className="flex gap-2">
            <button
              onClick={() => setUseExisting(true)}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-mono transition-all ${
                useExisting
                  ? 'bg-cyan-500/20 border border-cyan-500/60 text-cyan-300'
                  : 'bg-slate-700/20 border border-slate-600 text-slate-400 hover:border-slate-500'
              }`}
            >
              I have an account
            </button>
            <button
              onClick={() => setUseExisting(false)}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-mono transition-all flex items-center justify-center gap-1 ${
                !useExisting
                  ? 'bg-amber-500/20 border border-amber-500/60 text-amber-300'
                  : 'bg-slate-700/20 border border-slate-600 text-slate-400 hover:border-slate-500'
              }`}
            >
              <Zap className="w-3 h-3" />
              Create new
            </button>
          </div>
        </div>
      )}

      {/* Existing account form */}
      {useExisting && (
        <Card className="bg-slate-900/50 border-slate-700 p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {intervention.data_schema?.properties && (
              <div className="space-y-4">
                {Object.entries(intervention.data_schema.properties).map(([fieldName, fieldDef]) =>
                  renderFormField(fieldName, fieldDef)
                )}
              </div>
            )}

            {intervention.template_responses?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-300">Quick responses:</p>
                <div className="grid grid-cols-2 gap-2">
                  {intervention.template_responses.map((template, idx) => (
                    <Button
                      key={idx}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData(template.value)}
                      className="text-xs"
                    >
                      {template.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-cyan-600 hover:bg-cyan-700"
              >
                {loading ? 'Submitting...' : 'Submit'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Auto-create account mode */}
      {!useExisting && (
        <Card className="bg-slate-900/50 border-slate-700 p-6 space-y-4">
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              Autopilot will create a new account on the platform, verify it via email, and add it to your credential vault.
            </p>
            <p className="text-xs text-slate-500 flex items-start gap-2">
              <span className="text-amber-400 shrink-0 mt-0.5">⚡</span>
              <span>Full workflow: account creation → email verification → credential storage → task resume</span>
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleAutoCreateAccount}
              disabled={creatingAccount}
              className="flex-1 bg-amber-600 hover:bg-amber-700"
            >
              {creatingAccount ? 'Creating account...' : 'Let Autopilot Create Account'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={creatingAccount}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}