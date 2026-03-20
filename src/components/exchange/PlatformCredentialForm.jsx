import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { X, Eye, EyeOff, Loader2, CheckCircle2, AlertTriangle, Zap, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Modal form for adding or updating platform credentials.
 * Props:
 *   platform       — pre-selected platform object (or null to show selector)
 *   platforms      — full PLATFORMS array
 *   existingConnections — array of existing PlatformConnection records
 *   onClose        — close callback
 *   onSaved        — called after save (+ optional test)
 */
export default function PlatformCredentialForm({ platform: initialPlatform, platforms, existingConnections, onClose, onSaved }) {
  const [selectedPlatform, setSelectedPlatform] = useState(initialPlatform || null);
  const [fields, setFields] = useState({});
  const [label, setLabel] = useState('');
  const [showSecrets, setShowSecrets] = useState({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const qc = useQueryClient();

  // Find existing connection for this platform (for update)
  const existing = selectedPlatform
    ? existingConnections.find(c => c.platform === selectedPlatform.id)
    : null;

  function handleFieldChange(key, value) {
    setFields(f => ({ ...f, [key]: value }));
    setTestResult(null);
  }

  async function handleSaveAndTest() {
    if (!selectedPlatform) return;
    const allRequired = selectedPlatform.fields.filter(f => f.required !== false);
    const missing = allRequired.filter(f => !fields[f.key]?.trim());
    if (missing.length > 0) {
      setTestResult({ success: false, error: `Please fill in: ${missing.map(f => f.label).join(', ')}` });
      return;
    }

    setSaving(true);
    setTestResult(null);
    try {
      // 1. Save encrypted credentials
      const saveRes = await base44.functions.invoke('exchangeConnector', {
        action: 'save_connection',
        platform: selectedPlatform.id,
        label: label || selectedPlatform.label,
        auth_type: selectedPlatform.auth,
        credentials: fields,
        connection_id: existing?.id,
      });
      const connId = saveRes?.data?.connection?.id || existing?.id;

      qc.invalidateQueries({ queryKey: ['platformConnections'] });

      // 2. Immediately test the connection
      setTesting(true);
      const testRes = await base44.functions.invoke('exchangeConnector', {
        action: 'test_connection',
        connection_id: connId,
      });

      qc.invalidateQueries({ queryKey: ['platformConnections'] });
      setTestResult(testRes?.data || { success: false, error: 'No response' });
    } finally {
      setSaving(false);
      setTesting(false);
    }
  }

  function handleDone() {
    onSaved();
  }

  const isLoading = saving || testing;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md glass-card-bright rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
        style={{ border: '1px solid rgba(124,58,237,0.35)' }}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800/60 shrink-0">
          <div className="flex items-center gap-3">
            {selectedPlatform && (
              <span className="text-2xl">{selectedPlatform.icon}</span>
            )}
            <div>
              <h2 className="font-orbitron text-sm font-bold text-white tracking-wide">
                {selectedPlatform ? `Connect ${selectedPlatform.label}` : 'Connect Platform'}
              </h2>
              <p className="text-[10px] text-slate-500 mt-0.5">Credentials are AES-256 encrypted before storage</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* Platform selector (when none pre-selected) */}
          {!selectedPlatform && (
            <div className="grid grid-cols-3 gap-2">
              {platforms.map(p => (
                <button key={p.id} onClick={() => setSelectedPlatform(p)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all hover:border-violet-500/40"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span className="text-2xl">{p.icon}</span>
                  <span className="text-[9px] text-slate-300 text-center leading-tight">{p.label}</span>
                </button>
              ))}
            </div>
          )}

          {selectedPlatform && (
            <>
              {/* Optional label */}
              <div>
                <label className="text-[10px] font-orbitron tracking-wide text-slate-400 block mb-1.5">
                  CONNECTION LABEL (optional)
                </label>
                <Input
                  placeholder={`e.g. "My ${selectedPlatform.label} Store"`}
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  className="bg-slate-900/60 border-slate-700/60 text-white text-sm h-9"
                />
              </div>

              {/* Credential fields */}
              {selectedPlatform.fields.map(field => (
                <div key={field.key}>
                  <label className="text-[10px] font-orbitron tracking-wide text-slate-400 block mb-1.5">
                    {field.label.toUpperCase()}{field.required !== false && ' *'}
                  </label>
                  <div className="relative">
                    <Input
                      type={field.secret && !showSecrets[field.key] ? 'password' : 'text'}
                      placeholder={existing ? `Current key: ···${existing.api_key_hint || '****'}` : `Enter ${field.label}`}
                      value={fields[field.key] || ''}
                      onChange={e => handleFieldChange(field.key, e.target.value)}
                      className="bg-slate-900/60 border-slate-700/60 text-white text-sm h-9 pr-8"
                      autoComplete="off"
                    />
                    {field.secret && (
                      <button
                        type="button"
                        onClick={() => setShowSecrets(s => ({ ...s, [field.key]: !s[field.key] }))}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      >
                        {showSecrets[field.key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Platform-specific help */}
              <div className="p-3 rounded-xl text-[10px] text-slate-400"
                style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)' }}>
                <p className="font-medium text-violet-300 mb-1">Where to find your credentials:</p>
                <PlatformHelp platform={selectedPlatform.id} />
              </div>

              {/* Test result */}
              {testResult && (
                <div className={`flex items-start gap-2 p-3 rounded-xl text-xs ${testResult.success ? 'text-emerald-300' : 'text-red-300'}`}
                  style={{
                    background: testResult.success ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                    border: `1px solid ${testResult.success ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                  }}>
                  {testResult.success
                    ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
                  <div>
                    {testResult.success
                      ? <p><strong>Connection verified!</strong>{testResult.account_username ? ` Logged in as @${testResult.account_username}` : ' API key is valid.'}</p>
                      : <p><strong>Connection failed:</strong> {testResult.error}</p>}
                    {testResult.scopes?.length > 0 && (
                      <p className="text-[10px] text-emerald-400/70 mt-1">Scopes: {testResult.scopes.slice(0, 3).join(', ')}</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {selectedPlatform && (
          <div className="p-5 border-t border-slate-800/60 shrink-0 flex gap-2">
            {testResult?.success ? (
              <Button onClick={handleDone} className="flex-1 btn-cosmic text-white gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Done — Connection Active
              </Button>
            ) : (
              <Button onClick={handleSaveAndTest} disabled={isLoading} className="flex-1 btn-cosmic text-white gap-1.5">
                {isLoading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {saving ? 'Saving...' : 'Testing...'}</>
                  : <><Zap className="w-3.5 h-3.5" /> Save & Verify Connection</>
                }
              </Button>
            )}
            <Button variant="outline" onClick={onClose} className="border-slate-700/60 text-slate-400 hover:text-white px-3">
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function PlatformHelp({ platform }) {
  const tips = {
    ebay: 'Go to developer.ebay.com → My Account → Application Keys. Use Production keys.',
    etsy: 'Go to etsy.com/developers → Create App → copy the Keystring.',
    upwork: 'Go to upwork.com/services/api → create an app → copy API Key & Secret.',
    fiverr: 'Contact Fiverr support or use a third-party Fiverr API key provider.',
    amazon: 'Go to sellercentral.amazon.com → Settings → User Permissions → API Access.',
    shopify: 'Go to your Shopify admin → Apps → Develop Apps → create a custom app.',
    stripe: 'Go to dashboard.stripe.com → Developers → API Keys → Secret Key.',
    paypal: 'Go to developer.paypal.com → My Apps & Credentials → create a Live app.',
    freelancer: 'Go to developers.freelancer.com → API Console → create app.',
    guru: 'Go to guru.com → Settings → API → generate your key.',
  };
  return <span>{tips[platform] || 'Visit the platform\'s developer portal or settings to generate API credentials.'}</span>;
}