/**
 * IdentityOnboardingWizard
 * Full 6-step onboarding cycle for every new (or incomplete) identity.
 * Identity remains inactive until ALL steps are complete.
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  X, CheckCircle2, Circle, AlertTriangle, ArrowRight, ArrowLeft,
  User, Shield, Link2, Lock, Cpu, Zap, Upload, Sparkles, Eye, EyeOff
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Step definitions ──────────────────────────────────────────────────────────
const STEPS = [
  { id: 'profile',     label: 'Profile Setup',           icon: User,    color: '#a855f7' },
  { id: 'kyc',         label: 'KYC Verification',        icon: Shield,  color: '#ef4444' },
  { id: 'credentials', label: 'Account & Credentials',   icon: Link2,   color: '#3b82f6' },
  { id: 'permissions', label: 'Permissions & Access',    icon: Lock,    color: '#f9d65c' },
  { id: 'autopilot',   label: 'Autopilot Config',        icon: Cpu,     color: '#00e8ff' },
  { id: 'readiness',   label: 'Execution Readiness',     icon: Zap,     color: '#10b981' },
];

function StepIndicator({ steps, currentIdx, completedSteps }) {
  return (
    <div className="flex items-center gap-0 mb-8 overflow-x-auto pb-1">
      {steps.map((step, idx) => {
        const done = completedSteps.has(step.id);
        const active = idx === currentIdx;
        const Icon = step.icon;
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center shrink-0">
              <div className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: done ? `${step.color}20` : active ? `${step.color}15` : 'rgba(255,255,255,0.04)',
                  border: `2px solid ${done ? step.color : active ? `${step.color}80` : 'rgba(255,255,255,0.1)'}`,
                }}>
                {done
                  ? <CheckCircle2 className="w-4 h-4" style={{ color: step.color }} />
                  : <Icon className="w-3.5 h-3.5" style={{ color: active ? step.color : '#475569' }} />
                }
              </div>
              <span className="text-[9px] font-orbitron mt-1 text-center max-w-[60px] leading-tight hidden sm:block"
                style={{ color: done ? step.color : active ? '#e2e8f0' : '#475569' }}>
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className="flex-1 h-px mx-1 min-w-[12px]"
                style={{ background: completedSteps.has(steps[idx].id) ? `${steps[idx].color}60` : 'rgba(255,255,255,0.06)' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Individual step forms ─────────────────────────────────────────────────────

function ProfileStep({ data, onChange }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 mb-4">Complete your identity's public profile. This is what clients and platforms will see.</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-orbitron text-slate-500 tracking-widest block mb-1.5">LEGAL NAME *</label>
          <input value={data.legal_name || ''} onChange={e => onChange('legal_name', e.target.value)}
            placeholder="Full legal name"
            className="w-full px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none focus:border-violet-500" />
        </div>
        <div>
          <label className="text-[10px] font-orbitron text-slate-500 tracking-widest block mb-1.5">CONTACT EMAIL *</label>
          <input value={data.contact_email || ''} onChange={e => onChange('contact_email', e.target.value)}
            placeholder="contact@example.com" type="email"
            className="w-full px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none focus:border-violet-500" />
        </div>
        <div>
          <label className="text-[10px] font-orbitron text-slate-500 tracking-widest block mb-1.5">PHONE NUMBER</label>
          <input value={data.phone || ''} onChange={e => onChange('phone', e.target.value)}
            placeholder="+1 (555) 000-0000"
            className="w-full px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none focus:border-violet-500" />
        </div>
        <div>
          <label className="text-[10px] font-orbitron text-slate-500 tracking-widest block mb-1.5">TIMEZONE</label>
          <select value={data.timezone || 'UTC'} onChange={e => onChange('timezone', e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none focus:border-violet-500">
            {['UTC','America/Los_Angeles','America/New_York','America/Chicago','Europe/London','Europe/Berlin','Asia/Tokyo','Asia/Singapore'].map(tz => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="text-[10px] font-orbitron text-slate-500 tracking-widest block mb-1.5">PRIMARY COMMUNICATION CHANNEL</label>
        <div className="flex gap-2 flex-wrap">
          {['Email', 'Platform Messaging', 'SMS', 'Telegram', 'Discord'].map(ch => (
            <button key={ch} type="button"
              onClick={() => onChange('comm_channel', ch)}
              className="px-3 py-1.5 rounded-lg text-xs transition-all"
              style={{
                background: data.comm_channel === ch ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${data.comm_channel === ch ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.08)'}`,
                color: data.comm_channel === ch ? '#a855f7' : '#64748b',
              }}>
              {ch}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-[10px] font-orbitron text-slate-500 tracking-widest block mb-1.5">PROFILE SUMMARY</label>
        <textarea value={data.profile_summary || ''} onChange={e => onChange('profile_summary', e.target.value)}
          placeholder="Brief description of this identity's purpose and specialty…" rows={3}
          className="w-full px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none focus:border-violet-500 resize-none" />
      </div>
    </div>
  );
}

function KYCStep({ data, onChange }) {
  const [uploadingKey, setUploadingKey] = useState(null);
  return (
    <div className="space-y-4">
      <div className="p-3 rounded-xl flex items-start gap-2.5" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
        <Shield className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
        <p className="text-xs text-red-300/80">KYC is required before this identity can access payouts and high-value tasks. All data is encrypted.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-orbitron text-slate-500 tracking-widest block mb-1.5">GOVERNMENT ID TYPE *</label>
          <select value={data.gov_id_type || ''} onChange={e => onChange('gov_id_type', e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none focus:border-red-500">
            <option value="">Select type</option>
            {['Passport','Driver\'s License','National ID','State ID','Residence Permit'].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-orbitron text-slate-500 tracking-widest block mb-1.5">ID NUMBER *</label>
          <input value={data.gov_id_number || ''} onChange={e => onChange('gov_id_number', e.target.value)}
            placeholder="ID number"
            className="w-full px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none focus:border-red-500" />
        </div>
        <div>
          <label className="text-[10px] font-orbitron text-slate-500 tracking-widest block mb-1.5">DATE OF BIRTH *</label>
          <input type="date" value={data.dob || ''} onChange={e => onChange('dob', e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none focus:border-red-500" />
        </div>
        <div>
          <label className="text-[10px] font-orbitron text-slate-500 tracking-widest block mb-1.5">COUNTRY *</label>
          <select value={data.kyc_country || ''} onChange={e => onChange('kyc_country', e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none focus:border-red-500">
            <option value="">Select country</option>
            {['United States','United Kingdom','Canada','Australia','Germany','France','Netherlands','Singapore','Japan','India','Brazil','Mexico'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="text-[10px] font-orbitron text-slate-500 tracking-widest block mb-1.5">RESIDENTIAL ADDRESS *</label>
        <input value={data.address || ''} onChange={e => onChange('address', e.target.value)}
          placeholder="Full residential address"
          className="w-full px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none focus:border-red-500" />
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-orbitron text-slate-500 tracking-widest block">DOCUMENT UPLOADS</label>
        {[
          { key: 'id_front_uploaded', urlKey: 'id_front_url', label: 'Government ID (Front)' },
          { key: 'id_back_uploaded', urlKey: 'id_back_url', label: 'Government ID (Back)' },
          { key: 'selfie_uploaded', urlKey: 'selfie_url', label: 'Selfie / Biometric Check' },
          { key: 'address_proof_uploaded', urlKey: 'address_proof_url', label: 'Proof of Address (utility bill / bank statement)' },
        ].map(doc => (
          <div key={doc.key} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${data[doc.key] ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
            <div className="flex items-center gap-2 text-xs">
              {data[doc.key]
                ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                : <Upload className="w-3.5 h-3.5 text-slate-500" />
              }
              <span style={{ color: data[doc.key] ? '#10b981' : '#94a3b8' }}>{doc.label}</span>
              {uploadingKey === doc.key && (
                <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin text-slate-400" />
              )}
            </div>
            <label className="cursor-pointer">
              <input type="file" accept="image/*,.pdf" className="hidden"
                disabled={uploadingKey === doc.key}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadingKey(doc.key);
                  try {
                    const { file_url } = await base44.integrations.Core.UploadFile({ file });
                    onChange(doc.urlKey, file_url);
                    onChange(doc.key, true);
                  } catch (err) {
                    toast.error(`Upload failed: ${err.message}`);
                  } finally {
                    setUploadingKey(null);
                    e.target.value = '';
                  }
                }}
              />
              <span className="text-[10px] px-2.5 py-1 rounded-lg transition-all font-orbitron"
                style={{
                  background: data[doc.key] ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)',
                  border: `1px solid ${data[doc.key] ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.25)'}`,
                  color: data[doc.key] ? '#10b981' : '#3b82f6',
                  display: 'inline-block',
                }}>
                {uploadingKey === doc.key ? 'Uploading…' : data[doc.key] ? '✓ Uploaded' : 'Upload File'}
              </span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

function CredentialsStep({ data, onChange }) {
  const [showPass, setShowPass] = useState({});
  const platforms = ['upwork', 'fiverr', 'freelancer', 'toptal', 'guru', 'peopleperhour'];
  const toggleShow = key => setShowPass(p => ({ ...p, [key]: !p[key] }));

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 mb-2">Connect accounts and store credentials for this identity. Used by Autopilot for external task execution.</p>

      {/* Email */}
      <div className="p-4 rounded-xl space-y-3" style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
        <p className="text-[10px] font-orbitron text-blue-400 tracking-widest">EMAIL ACCOUNT</p>
        <div className="grid grid-cols-2 gap-3">
          <input value={data.email_account || ''} onChange={e => onChange('email_account', e.target.value)}
            placeholder="identity@gmail.com"
            className="w-full px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none focus:border-blue-500" />
          <div className="relative">
            <input type={showPass.email ? 'text' : 'password'} value={data.email_password || ''} onChange={e => onChange('email_password', e.target.value)}
              placeholder="App password"
              className="w-full px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none focus:border-blue-500 pr-9" />
            <button type="button" onClick={() => toggleShow('email')} className="absolute right-2.5 top-2.5 text-slate-500">
              {showPass.email ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Payout */}
      <div className="p-4 rounded-xl space-y-3" style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)' }}>
        <p className="text-[10px] font-orbitron text-emerald-400 tracking-widest">PAYOUT METHOD</p>
        <div className="flex gap-2 mb-3">
          {['PayPal','Bank Transfer','Crypto Wallet','Payoneer'].map(method => (
            <button key={method} type="button" onClick={() => onChange('payout_method', method)}
              className="px-3 py-1.5 rounded-lg text-xs transition-all"
              style={{
                background: data.payout_method === method ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${data.payout_method === method ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.08)'}`,
                color: data.payout_method === method ? '#10b981' : '#64748b',
              }}>
              {method}
            </button>
          ))}
        </div>
        <input value={data.payout_address || ''} onChange={e => onChange('payout_address', e.target.value)}
          placeholder="Payout address / account number / wallet address"
          className="w-full px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none focus:border-emerald-500" />
      </div>

      {/* Platform Credentials */}
      <div>
        <p className="text-[10px] font-orbitron text-slate-500 tracking-widest mb-3">PLATFORM CREDENTIALS</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {platforms.map(platform => {
            const connected = !!data[`cred_${platform}`];
            return (
              <div key={platform} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${connected ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.06)'}` }}>
                <div className="flex items-center gap-2">
                  {connected ? <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" /> : <Circle className="w-3.5 h-3.5 text-slate-600" />}
                  <span className="text-xs capitalize" style={{ color: connected ? '#93c5fd' : '#64748b' }}>{platform}</span>
                </div>
                <button type="button" onClick={() => onChange(`cred_${platform}`, connected ? '' : 'connected')}
                  className="text-[10px] px-2.5 py-1 rounded-lg font-orbitron transition-all"
                  style={{
                    background: connected ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${connected ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    color: connected ? '#3b82f6' : '#64748b',
                  }}>
                  {connected ? '✓ Linked' : 'Link'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* API Keys */}
      <div>
        <label className="text-[10px] font-orbitron text-slate-500 tracking-widest block mb-1.5">API KEYS (optional — JSON format)</label>
        <textarea value={data.api_keys_json || ''} onChange={e => onChange('api_keys_json', e.target.value)}
          placeholder='{"openai": "sk-...", "stripe": "sk_..."}' rows={2}
          className="w-full px-3 py-2 rounded-xl text-xs text-white bg-slate-800 border border-slate-700 focus:outline-none focus:border-blue-500 resize-none font-mono" />
      </div>
    </div>
  );
}

function PermissionsStep({ data, onChange }) {
  const perms = [
    { key: 'autopilot_permission', label: 'Autopilot Execution', desc: 'Allow Autopilot to act as this identity', color: '#00e8ff' },
    { key: 'workflow_permission', label: 'Workflow Architect', desc: 'Allow automated workflow execution', color: '#a855f7' },
    { key: 'task_execution_permission', label: 'External Task Execution', desc: 'Browser automation & form filling', color: '#3b82f6' },
    { key: 'email_permission', label: 'Email Communication', desc: 'Send and receive emails as this identity', color: '#10b981' },
    { key: 'financial_permission', label: 'Financial Transactions', desc: 'Collect payments and initiate payouts', color: '#f9d65c' },
    { key: 'credential_access_permission', label: 'Credential Vault Access', desc: 'Read stored credentials for task execution', color: '#ef4444' },
  ];

  const levels = ['read_only', 'standard', 'full_access'];

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 mb-2">Define exactly what this identity is allowed to do across all modules.</p>
      <div className="space-y-2.5">
        {perms.map(perm => (
          <div key={perm.key} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-medium text-white">{perm.label}</p>
                <p className="text-[10px] text-slate-500">{perm.desc}</p>
              </div>
              <button type="button"
                onClick={() => onChange(perm.key, !data[perm.key])}
                className="w-11 h-6 rounded-full transition-all relative shrink-0"
                style={{ background: data[perm.key] ? `${perm.color}30` : 'rgba(255,255,255,0.08)', border: `1px solid ${data[perm.key] ? `${perm.color}60` : 'rgba(255,255,255,0.12)'}` }}>
                <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
                  style={{ background: data[perm.key] ? perm.color : '#475569', left: data[perm.key] ? 'calc(100% - 22px)' : '2px' }} />
              </button>
            </div>
            {data[perm.key] && (
              <div className="flex gap-1.5 mt-1">
                {levels.map(lvl => (
                  <button key={lvl} type="button"
                    onClick={() => onChange(`${perm.key}_level`, lvl)}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-orbitron transition-all"
                    style={{
                      background: data[`${perm.key}_level`] === lvl ? `${perm.color}15` : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${data[`${perm.key}_level`] === lvl ? `${perm.color}40` : 'rgba(255,255,255,0.06)'}`,
                      color: data[`${perm.key}_level`] === lvl ? perm.color : '#64748b',
                    }}>
                    {lvl.replace('_', ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div>
        <label className="text-[10px] font-orbitron text-slate-500 tracking-widest block mb-2">DATA ACCESS LEVEL</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: 'minimal', label: 'Minimal', desc: 'Own data only', color: '#10b981' },
            { key: 'standard', label: 'Standard', desc: 'Own + system data', color: '#f9d65c' },
            { key: 'elevated', label: 'Elevated', desc: 'Cross-system access', color: '#ef4444' },
          ].map(lvl => (
            <button key={lvl.key} type="button" onClick={() => onChange('data_access_level', lvl.key)}
              className="p-3 rounded-xl text-left transition-all"
              style={{
                background: data.data_access_level === lvl.key ? `${lvl.color}10` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${data.data_access_level === lvl.key ? `${lvl.color}40` : 'rgba(255,255,255,0.06)'}`,
              }}>
              <p className="text-xs font-medium" style={{ color: lvl.color }}>{lvl.label}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{lvl.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AutopilotStep({ data, onChange }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 mb-2">Configure how Autopilot operates when using this identity.</p>

      <div>
        <label className="text-[10px] font-orbitron text-slate-500 tracking-widest block mb-2">WORK CATEGORIES</label>
        <div className="flex flex-wrap gap-1.5">
          {['writing','data_entry','transcription','coding','design','research','ai_training','microtasks','customer_support','virtual_assistant','surveys','translation'].map(cat => {
            const cats = data.ap_categories || [];
            const selected = cats.includes(cat);
            return (
              <button key={cat} type="button"
                onClick={() => onChange('ap_categories', selected ? cats.filter(c => c !== cat) : [...cats, cat])}
                className="px-3 py-1 rounded-lg text-xs transition-all capitalize"
                style={{
                  background: selected ? 'rgba(0,232,255,0.1)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${selected ? 'rgba(0,232,255,0.35)' : 'rgba(255,255,255,0.08)'}`,
                  color: selected ? '#00e8ff' : '#64748b',
                }}>
                {cat.replace('_', ' ')}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-orbitron text-slate-500 tracking-widest block mb-2">RISK TOLERANCE</label>
          <div className="space-y-1.5">
            {[
              { key: 'low', label: 'Conservative', color: '#10b981' },
              { key: 'medium', label: 'Balanced', color: '#f9d65c' },
              { key: 'high', label: 'Aggressive', color: '#ef4444' },
            ].map(r => (
              <button key={r.key} type="button" onClick={() => onChange('risk_tolerance', r.key)}
                className="w-full px-3 py-2 rounded-xl text-xs text-left transition-all"
                style={{
                  background: data.risk_tolerance === r.key ? `${r.color}10` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${data.risk_tolerance === r.key ? `${r.color}35` : 'rgba(255,255,255,0.06)'}`,
                  color: data.risk_tolerance === r.key ? r.color : '#64748b',
                }}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[10px] font-orbitron text-slate-500 tracking-widest block mb-2">EXECUTION MODE</label>
          <div className="space-y-1.5">
            {[
              { key: 'supervised', label: 'Supervised', color: '#a855f7' },
              { key: 'semi_auto', label: 'Semi-Auto', color: '#00e8ff' },
              { key: 'fully_autonomous', label: 'Full Autopilot', color: '#10b981' },
            ].map(m => (
              <button key={m.key} type="button" onClick={() => onChange('execution_mode', m.key)}
                className="w-full px-3 py-2 rounded-xl text-xs text-left transition-all"
                style={{
                  background: data.execution_mode === m.key ? `${m.color}10` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${data.execution_mode === m.key ? `${m.color}35` : 'rgba(255,255,255,0.06)'}`,
                  color: data.execution_mode === m.key ? m.color : '#64748b',
                }}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-orbitron text-slate-500 tracking-widest block mb-1.5">
            DAILY EARNING TARGET: <span className="text-cyan-400">${data.daily_target || 100}</span>
          </label>
          <input type="range" min="10" max="2000" step="10" value={data.daily_target || 100}
            onChange={e => onChange('daily_target', Number(e.target.value))}
            className="w-full h-1 rounded-full appearance-none cursor-pointer"
            style={{ background: `linear-gradient(90deg, #00e8ff ${(data.daily_target || 100) / 20}%, #1e293b ${(data.daily_target || 100) / 20}%)` }} />
        </div>
        <div>
          <label className="text-[10px] font-orbitron text-slate-500 tracking-widest block mb-1.5">
            MAX SPENDING / TASK: <span className="text-amber-400">${data.max_spend || 50}</span>
          </label>
          <input type="range" min="0" max="500" step="5" value={data.max_spend || 50}
            onChange={e => onChange('max_spend', Number(e.target.value))}
            className="w-full h-1 rounded-full appearance-none cursor-pointer"
            style={{ background: `linear-gradient(90deg, #f9d65c ${(data.max_spend || 50) / 5}%, #1e293b ${(data.max_spend || 50) / 5}%)` }} />
        </div>
      </div>

      <div>
        <label className="text-[10px] font-orbitron text-slate-500 tracking-widest block mb-1.5">AI ESCALATION RULE</label>
        <select value={data.escalation_rule || 'manual_review'} onChange={e => onChange('escalation_rule', e.target.value)}
          className="w-full px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none focus:border-cyan-500">
          <option value="manual_review">Always escalate unusual tasks for manual review</option>
          <option value="auto_skip">Auto-skip unusual tasks</option>
          <option value="auto_attempt">Auto-attempt with lower priority</option>
          <option value="notify_only">Notify user, continue with best effort</option>
        </select>
      </div>
    </div>
  );
}

function ReadinessStep({ data, onChange }) {
  const checks = [
    { key: 'browser_automation', label: 'Browser Automation Compatible', desc: 'Identity can execute tasks via headless browser' },
    { key: 'credentials_valid', label: 'Credentials Valid & Tested', desc: 'All stored credentials have been validated' },
    { key: 'task_reader_ready', label: 'Task Reader Ready', desc: 'Task Reader can analyze and execute for this identity' },
    { key: 'workflow_integrated', label: 'Workflow Architect Integrated', desc: 'Workflows configured for this identity' },
    { key: 'discovery_prefs_set', label: 'Discovery Engine Preferences Set', desc: 'Work categories and filters configured' },
    { key: 'payout_configured', label: 'Payout Method Confirmed', desc: 'Earnings can be routed to confirmed account' },
  ];

  const allChecked = checks.every(c => data[c.key]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 mb-2">Confirm that this identity is ready for full autonomous operation. All checks must pass to activate.</p>
      <div className="space-y-2">
        {checks.map(check => (
          <div key={check.key}
            className="flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all"
            style={{
              background: data[check.key] ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${data[check.key] ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.06)'}`,
            }}
            onClick={() => onChange(check.key, !data[check.key])}>
            <div className="flex items-center gap-3">
              {data[check.key]
                ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                : <Circle className="w-4 h-4 text-slate-600 shrink-0" />
              }
              <div>
                <p className="text-xs font-medium" style={{ color: data[check.key] ? '#10b981' : '#94a3b8' }}>{check.label}</p>
                <p className="text-[10px] text-slate-600">{check.desc}</p>
              </div>
            </div>
            <span className="text-[10px] font-orbitron shrink-0"
              style={{ color: data[check.key] ? '#10b981' : '#ef4444' }}>
              {data[check.key] ? 'READY' : 'PENDING'}
            </span>
          </div>
        ))}
      </div>

      {allChecked && (
        <div className="p-4 rounded-xl text-center"
          style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}>
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="font-orbitron text-sm text-emerald-400 tracking-widest">ALL SYSTEMS READY</p>
          <p className="text-xs text-emerald-300/60 mt-1">This identity will be activated upon completing onboarding.</p>
        </div>
      )}
    </div>
  );
}

// ─── Validation per step ──────────────────────────────────────────────────────
function validateStep(stepId, data) {
  switch (stepId) {
    case 'profile':
      return !!(data.legal_name && data.contact_email && data.comm_channel);
    case 'kyc':
      return !!(data.gov_id_type && data.gov_id_number && data.dob && data.kyc_country && data.address
        && data.id_front_uploaded && data.selfie_uploaded);
    case 'credentials':
      return !!(data.email_account && data.payout_method && data.payout_address);
    case 'permissions':
      return !!(data.autopilot_permission !== undefined && data.data_access_level);
    case 'autopilot':
      return !!(data.ap_categories?.length > 0 && data.risk_tolerance && data.execution_mode);
    case 'readiness':
      return !!(data.browser_automation && data.credentials_valid && data.task_reader_ready
        && data.discovery_prefs_set && data.payout_configured);
    default:
      return false;
  }
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────
export default function IdentityOnboardingWizard({ identity, onComplete, onSkip }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [stepData, setStepData] = useState({});
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [saving, setSaving] = useState(false);

  const step = STEPS[currentStep];
  const isValid = validateStep(step.id, stepData);
  const isLastStep = currentStep === STEPS.length - 1;

  function handleChange(key, value) {
    setStepData(prev => ({ ...prev, [key]: value }));
  }

  function handleNext() {
    if (isValid) {
      setCompletedSteps(prev => new Set([...prev, step.id]));
      if (!isLastStep) setCurrentStep(c => c + 1);
    }
  }

  function handleBack() {
    if (currentStep > 0) setCurrentStep(c => c - 1);
  }

  async function handleComplete() {
    if (!isValid) return;
    setSaving(true);
    try {
      // Build the onboarding_data payload
      const onboardingData = {
        onboarding_complete: true,
        onboarding_status: 'complete',
        is_active: false, // admin/KYC approval needed before activation
        // Profile
        phone: stepData.phone,
        email: stepData.contact_email || identity?.email,
        // KYC data stored in kyc_verified_data
        kyc_verified_data: {
          kyc_tier: 'basic',
          full_legal_name: stepData.legal_name,
          date_of_birth: stepData.dob,
          residential_address: stepData.address,
          country: stepData.kyc_country,
          phone_number: stepData.phone,
          email: stepData.contact_email,
          government_id_type: stepData.gov_id_type,
          government_id_number: stepData.gov_id_number,
          id_document_front_url: stepData.id_front_uploaded ? 'pending_upload' : null,
          selfie_url: stepData.selfie_uploaded ? 'pending_upload' : null,
          autopilot_clearance: {
            can_submit_w9: false,
            can_submit_grant_applications: false,
            can_submit_financial_onboarding: true,
            can_attach_id_documents: true,
          },
          synced_at: new Date().toISOString(),
        },
        // Autopilot config
        preferred_categories: stepData.ap_categories || [],
        spending_limit_per_task: stepData.max_spend || 100,
        // Config embedded in notes as JSON
        onboarding_config: JSON.stringify({
          comm_channel: stepData.comm_channel,
          profile_summary: stepData.profile_summary,
          payout_method: stepData.payout_method,
          payout_address: stepData.payout_address,
          email_account: stepData.email_account,
          permissions: {
            autopilot: stepData.autopilot_permission,
            workflow: stepData.workflow_permission,
            task_execution: stepData.task_execution_permission,
            email: stepData.email_permission,
            financial: stepData.financial_permission,
            credential_access: stepData.credential_access_permission,
          },
          data_access_level: stepData.data_access_level,
          risk_tolerance: stepData.risk_tolerance,
          execution_mode: stepData.execution_mode,
          daily_target: stepData.daily_target,
          escalation_rule: stepData.escalation_rule,
          readiness: {
            browser_automation: stepData.browser_automation,
            credentials_valid: stepData.credentials_valid,
            task_reader_ready: stepData.task_reader_ready,
            workflow_integrated: stepData.workflow_integrated,
            discovery_prefs_set: stepData.discovery_prefs_set,
            payout_configured: stepData.payout_configured,
          },
          completed_at: new Date().toISOString(),
        }),
      };

      await base44.entities.AIIdentity.update(identity.id, onboardingData);

      // Create a notification for the user
      try {
        await base44.entities.Notification.create({
          user_email: identity.created_by,
          title: `✅ Identity "${identity.name}" Onboarding Complete`,
          message: `All onboarding steps completed. Your identity is now pending KYC approval before full activation.`,
          type: 'success',
          is_read: false,
        });
      } catch {}

      toast.success(`Onboarding complete for "${identity.name}" — pending activation`);
      onComplete(onboardingData);
    } catch (e) {
      toast.error(`Failed to save: ${e.message}`);
    }
    setSaving(false);
  }

  const stepComponents = {
    profile: <ProfileStep data={stepData} onChange={handleChange} />,
    kyc: <KYCStep data={stepData} onChange={handleChange} />,
    credentials: <CredentialsStep data={stepData} onChange={handleChange} />,
    permissions: <PermissionsStep data={stepData} onChange={handleChange} />,
    autopilot: <AutopilotStep data={stepData} onChange={handleChange} />,
    readiness: <ReadinessStep data={stepData} onChange={handleChange} />,
  };

  const color = identity?.color || '#a855f7';
  const progress = Math.round(((completedSteps.size) / STEPS.length) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(5,7,20,0.92)', backdropFilter: 'blur(12px)' }}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
        style={{ background: 'rgba(10,15,42,0.97)', border: `1.5px solid ${color}30`, boxShadow: `0 0 60px ${color}10` }}>

        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between shrink-0"
          style={{ borderColor: `${color}15` }}>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-lg">{identity?.icon || '🤖'}</span>
              <h2 className="font-orbitron text-sm font-bold text-white tracking-widest">
                IDENTITY ONBOARDING
              </h2>
              <span className="text-[9px] px-2 py-0.5 rounded-full font-orbitron"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
                REQUIRED
              </span>
            </div>
            <p className="text-xs text-slate-500">{identity?.name} · Step {currentStep + 1} of {STEPS.length} · {progress}% complete</p>
          </div>
          {onSkip && (
            <button onClick={onSkip}
              className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-orbitron flex items-center gap-1">
              <X className="w-3 h-3" /> Skip for now
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1 shrink-0" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <div className="h-full transition-all duration-500"
            style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${color}, ${color}80)` }} />
        </div>

        {/* Step indicator */}
        <div className="px-6 pt-5 shrink-0">
          <StepIndicator steps={STEPS} currentIdx={currentStep} completedSteps={completedSteps} />
        </div>

        {/* Current step title */}
        <div className="px-6 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            {React.createElement(step.icon, { className: 'w-4 h-4', style: { color: step.color } })}
            <h3 className="font-orbitron text-sm font-bold tracking-widest" style={{ color: step.color }}>
              {step.label.toUpperCase()}
            </h3>
          </div>
        </div>

        {/* Step content */}
        <div className="px-6 overflow-y-auto flex-1 pb-4">
          {stepComponents[step.id]}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between shrink-0"
          style={{ borderColor: `${color}15` }}>
          <button onClick={handleBack} disabled={currentStep === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-orbitron transition-all disabled:opacity-30"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}>
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>

          <div className="flex items-center gap-2">
            {!isValid && (
              <span className="text-[10px] text-amber-400/70 font-orbitron">Complete required fields</span>
            )}
            {isLastStep ? (
              <button onClick={handleComplete} disabled={!isValid || saving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-orbitron tracking-wide transition-all disabled:opacity-40"
                style={{ background: `${color}15`, border: `1px solid ${color}40`, color }}>
                {saving
                  ? <><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Saving…</>
                  : <><CheckCircle2 className="w-3.5 h-3.5" /> Complete Onboarding</>
                }
              </button>
            ) : (
              <button onClick={handleNext} disabled={!isValid}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-orbitron tracking-wide transition-all disabled:opacity-40"
                style={{ background: `${color}15`, border: `1px solid ${color}40`, color }}>
                Next <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}