import React, { useState } from 'react';
import { Save, X, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const PERMISSION_CONFIGS = {
  view_only: {
    label: 'View-Only Access',
    description: 'Autopilot can log in and read data only',
    allowed: ['login', 'read_data', 'scan', 'retrieve_info'],
    restricted: ['apply', 'edit', 'submit', 'communicate', 'change_settings'],
  },
  limited_automation: {
    label: 'Limited Automation',
    description: 'Autopilot can prepare work; user approves submissions',
    allowed: ['login', 'read_data', 'scan', 'select', 'prepare_content', 'fill_forms'],
    restricted: ['submit', 'communicate', 'change_settings'],
  },
  full_automation: {
    label: 'Full Automation',
    description: 'Autopilot has unrestricted execution permissions',
    allowed: ['login', 'read_data', 'scan', 'select', 'apply', 'communicate', 'submit', 'execute', 'retrieve_earnings', 'manage_workflows'],
    restricted: [],
  },
};

const PLATFORMS = [
  'upwork', 'fiverr', 'freelancer', 'toptal', 'guru', 'peopleperhour',
  '99designs', 'stripe', 'paypal', 'airtable', 'zapier', 'other'
];

export default function CredentialVaultForm({ credential, onSave, onCancel }) {
  const [form, setForm] = useState({
    platform: credential?.platform || 'upwork',
    account_label: credential?.account_label || '',
    login_url: credential?.login_url || '',
    username_email: credential?.username_email || '',
    password: credential?.password_encrypted ? '••••••••' : '',
    two_factor_method: credential?.two_factor_method || 'none',
    two_factor_backup: '',
    api_key: credential?.api_key_encrypted ? '••••••••' : '',
    api_secret: credential?.api_secret_encrypted ? '••••••••' : '',
    special_instructions: credential?.special_instructions || '',
    permission_level: credential?.permission_level || 'view_only',
    fully_auto_enabled: credential?.fully_auto_enabled || false,
    is_active: credential?.is_active !== false,
  });

  const [agreeConsent, setAgreeConsent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm(p => ({ ...p, [key]: value }));

  const permConfig = PERMISSION_CONFIGS[form.permission_level];
  const canEnableFullAuto = form.permission_level === 'full_automation' && agreeConsent;

  const handleSave = async () => {
    if (!form.account_label || !form.login_url || !form.username_email) {
      alert('Please fill in all required fields');
      return;
    }

    if (form.permission_level !== 'view_only' && !agreeConsent) {
      alert('You must acknowledge the consent agreement to enable automation');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...form,
        password: form.password === '••••••••' ? null : form.password,
        api_key: form.api_key === '••••••••' ? null : form.api_key,
        api_secret: form.api_secret === '••••••••' ? null : form.api_secret,
        user_consent_acknowledged: agreeConsent && form.permission_level !== 'view_only',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl bg-slate-800/80 border border-slate-700 p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Lock className="w-5 h-5 text-amber-400" />
          {credential ? 'Edit Credential' : 'Add New Credential'}
        </h3>
        <p className="text-sm text-slate-400 mt-1">All data will be encrypted with AES-256-GCM</p>
      </div>

      {/* Platform & Account Info */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-300">Account Information</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold block mb-1.5">Platform *</label>
            <select
              value={form.platform}
              onChange={e => set('platform', e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {PLATFORMS.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold block mb-1.5">Account Label *</label>
            <Input
              value={form.account_label}
              onChange={e => set('account_label', e.target.value)}
              placeholder="e.g., Main Writing Profile"
              className="bg-slate-900 border-slate-700 text-white text-sm h-9"
            />
          </div>
        </div>
      </div>

      {/* Login Credentials */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-300">Login Credentials</h4>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold block mb-1.5">Login URL *</label>
            <Input
              value={form.login_url}
              onChange={e => set('login_url', e.target.value)}
              placeholder="https://..."
              className="bg-slate-900 border-slate-700 text-white text-sm h-9"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold block mb-1.5">Username / Email *</label>
            <Input
              value={form.username_email}
              onChange={e => set('username_email', e.target.value)}
              placeholder="your_username@email.com"
              className="bg-slate-900 border-slate-700 text-white text-sm h-9"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold block mb-1.5">Password (encrypted) *</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder="Enter password"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white pr-10 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Optional Authentication */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-300">Optional Authentication</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold block mb-1.5">2FA Method</label>
            <select
              value={form.two_factor_method}
              onChange={e => set('two_factor_method', e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="none">None</option>
              <option value="authenticator">Authenticator App</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="backup_codes">Backup Codes</option>
            </select>
          </div>
          {form.two_factor_method !== 'none' && (
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold block mb-1.5">2FA Secret / Codes</label>
              <Input
                value={form.two_factor_backup}
                onChange={e => set('two_factor_backup', e.target.value)}
                placeholder="Secret key or backup codes"
                className="bg-slate-900 border-slate-700 text-white text-sm h-9"
              />
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold block mb-1.5">API Key (if applicable)</label>
            <Input
              type="password"
              value={form.api_key}
              onChange={e => set('api_key', e.target.value)}
              placeholder="API key"
              className="bg-slate-900 border-slate-700 text-white text-sm h-9"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold block mb-1.5">API Secret (if applicable)</label>
            <Input
              type="password"
              value={form.api_secret}
              onChange={e => set('api_secret', e.target.value)}
              placeholder="API secret"
              className="bg-slate-900 border-slate-700 text-white text-sm h-9"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider font-semibold block mb-1.5">Special Instructions</label>
          <textarea
            value={form.special_instructions}
            onChange={e => set('special_instructions', e.target.value)}
            placeholder="e.g., 'Login portal requires VPN' or 'Enter recovery code if 2FA fails'"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none h-24"
          />
        </div>
      </div>

      {/* Permission Level */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-300">Autopilot Permissions</h4>
        <div className="space-y-2">
          {Object.entries(PERMISSION_CONFIGS).map(([level, config]) => (
            <label key={level} className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all"
              style={{
                background: form.permission_level === level ? 'rgba(59,130,246,0.1)' : 'rgba(71,85,105,0.2)',
                borderColor: form.permission_level === level ? 'rgba(59,130,246,0.4)' : 'rgba(71,85,105,0.3)',
              }}>
              <input
                type="radio"
                name="permission_level"
                value={level}
                checked={form.permission_level === level}
                onChange={e => set('permission_level', e.target.value)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{config.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{config.description}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {config.allowed.map(action => (
                    <span key={action} className="text-[9px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">
                      ✓ {action}
                    </span>
                  ))}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Full Auto Toggle */}
      {form.permission_level === 'full_automation' && (
        <div className="p-3 rounded-lg bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="fully_auto"
              checked={form.fully_auto_enabled}
              onChange={e => set('fully_auto_enabled', e.target.checked)}
              disabled={!agreeConsent}
              className="rounded"
            />
            <label htmlFor="fully_auto" className="text-sm font-semibold text-white cursor-pointer">
              Enable Full Automation Mode
            </label>
          </div>
          <p className="text-[10px] text-emerald-200">
            When enabled, Autopilot has unrestricted execution permissions and can operate this account hands-off.
          </p>
        </div>
      )}

      {/* Consent Agreement */}
      {form.permission_level !== 'view_only' && (
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="space-y-2 text-xs text-amber-100/80">
              <p className="font-semibold">Authorization & Consent</p>
              <p>By enabling automation, you confirm:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>You own and have permission to access this account</li>
                <li>You grant the Profit Engine platform to access and operate this account on your behalf</li>
                <li>You understand the permission level you are enabling</li>
                <li>You authorize the Autopilot to act within the selected autonomy level</li>
              </ul>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={agreeConsent}
              onChange={e => setAgreeConsent(e.target.checked)}
              className="rounded border-slate-600"
            />
            <span className="text-xs text-white font-semibold">I confirm and authorize the above</span>
          </label>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-slate-700">
        <Button
          onClick={handleSave}
          disabled={saving || (form.permission_level !== 'view_only' && !agreeConsent)}
          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 text-sm h-9 gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Credential'}
        </Button>
        <Button
          onClick={onCancel}
          variant="outline"
          className="border-slate-700 text-slate-400 text-sm h-9"
        >
          <X className="w-4 h-4" />
          Cancel
        </Button>
      </div>
    </div>
  );
}