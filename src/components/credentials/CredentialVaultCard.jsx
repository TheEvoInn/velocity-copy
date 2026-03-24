import React, { useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, Pencil, Trash2, Copy, RefreshCw, ShieldCheck, ShieldAlert, Clock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

const PERMISSION_LEVELS = {
  view_only: { label: 'View Only', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: '👁️' },
  limited_automation: { label: 'Limited Automation', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: '⚡' },
  full_automation: { label: 'Full Automation', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: '🤖' },
};

export default function CredentialVaultCard({ credential, onEdit, onDelete, onToggleFullAuto, onRefresh }) {
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [health, setHealth] = useState(null);
  const [checking, setChecking] = useState(false);

  const lastUsed = credential.last_used_at ? new Date(credential.last_used_at).toLocaleDateString() : 'Never';

  const rotationOverdue = credential.next_rotation_due && new Date(credential.next_rotation_due) < new Date();
  const daysSinceRotation = credential.last_rotated_at
    ? Math.floor((Date.now() - new Date(credential.last_rotated_at)) / 86400000)
    : null;

  async function runHealthCheck() {
    setChecking(true);
    try {
      const res = await base44.functions.invoke('credentialVaultManager', {
        action: 'health_check', credentialId: credential.id, payload: {}
      });
      setHealth(res.data);
    } catch (e) { toast.error(e.message); }
    setChecking(false);
  }

  return (
    <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold text-white">{credential.account_label}</span>
            <span className="text-[9px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-full capitalize">
              {credential.platform}
            </span>
          </div>
          <p className="text-[10px] text-slate-500">
            {credential.is_active ? '✓ Active' : '✗ Inactive'} · Last used: {lastUsed}
          </p>
        </div>
        <div className={`px-2 py-1 rounded-lg border text-[10px] font-medium ${perm.bg} ${perm.color}`}>
          {perm.icon} {perm.label}
        </div>
      </div>

      {/* Consent Status */}
      {credential.user_consent_acknowledged && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-[10px] text-emerald-300">
            Authorized {new Date(credential.user_consent_timestamp).toLocaleDateString()}
          </span>
        </div>
      )}

      {!credential.is_active && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <span className="text-[10px] text-red-300">This credential is disabled</span>
        </div>
      )}

      {/* Login URL */}
      <div className="space-y-1.5">
        <label className="text-[9px] text-slate-600 uppercase tracking-wider font-semibold">Login URL</label>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 border border-slate-700">
          <span className="text-[11px] text-slate-300 truncate flex-1">{credential.login_url}</span>
          <button
            onClick={() => copyToClipboard(credential.login_url, 'url')}
            className="p-1 text-slate-500 hover:text-white transition-colors"
            title="Copy URL"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Username */}
      <div className="space-y-1.5">
        <label className="text-[9px] text-slate-600 uppercase tracking-wider font-semibold">Username / Email</label>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 border border-slate-700">
          <span className="text-[11px] text-slate-300 truncate flex-1">{credential.username_email}</span>
          <button
            onClick={() => copyToClipboard(credential.username_email, 'username')}
            className="p-1 text-slate-500 hover:text-white transition-colors"
            title="Copy username"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Password (masked) */}
      <div className="space-y-1.5">
        <label className="text-[9px] text-slate-600 uppercase tracking-wider font-semibold">Password</label>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 border border-slate-700">
          <input
            type={showPassword ? 'text' : 'password'}
            value="••••••••••••"
            readOnly
            className="text-[11px] text-slate-400 flex-1 bg-transparent outline-none"
          />
          <button
            onClick={() => setShowPassword(!showPassword)}
            className="p-1 text-slate-500 hover:text-white transition-colors"
            title={showPassword ? 'Hide' : 'Show'}
          >
            {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* 2FA Status */}
      {credential.two_factor_method !== 'none' && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-[10px] text-amber-300">
            2FA enabled: {credential.two_factor_method}
          </span>
        </div>
      )}

      {/* Special Instructions */}
      {credential.special_instructions && (
        <div className="p-2 rounded-lg bg-slate-800/30 border border-slate-700">
          <p className="text-[10px] text-slate-400 italic">
            ℹ️ {credential.special_instructions}
          </p>
        </div>
      )}

      {/* Permission Details */}
      <div className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-700 space-y-1.5">
        <p className="text-[10px] font-semibold text-slate-300">Allowed Actions</p>
        <div className="flex flex-wrap gap-1">
          {credential.allowed_actions?.map(action => (
            <span key={action} className="text-[9px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">
              {action}
            </span>
          ))}
        </div>
        {credential.restricted_actions?.length > 0 && (
          <>
            <p className="text-[10px] font-semibold text-slate-300 mt-2">Restricted Actions</p>
            <div className="flex flex-wrap gap-1">
              {credential.restricted_actions.map(action => (
                <span key={action} className="text-[9px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">
                  {action}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Full Auto Toggle */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
        <div>
          <p className="text-[10px] font-semibold text-white">Full Automation</p>
          <p className="text-[9px] text-slate-400 mt-0.5">Grant unrestricted execution permissions</p>
        </div>
        <button
          onClick={() => onToggleFullAuto(credential)}
          className={`relative w-10 h-6 rounded-full border transition-all ${
            credential.fully_auto_enabled
              ? 'bg-emerald-500/20 border-emerald-400'
              : 'bg-slate-800 border-slate-700'
          }`}
        >
          <span
            className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-all ${
              credential.fully_auto_enabled ? 'translate-x-4' : ''
            }`}
          />
        </button>
      </div>

      {/* Rotation Status */}
      <div className={`flex items-center justify-between p-2.5 rounded-lg border ${
        rotationOverdue ? 'bg-red-500/10 border-red-500/25' : 'bg-slate-800/30 border-slate-700'
      }`}>
        <div className="flex items-center gap-2">
          <Clock className={`w-3.5 h-3.5 ${rotationOverdue ? 'text-red-400' : 'text-slate-500'}`} />
          <div>
            <p className="text-[9px] text-slate-500 uppercase tracking-wider">Credential Rotation</p>
            {rotationOverdue ? (
              <p className="text-[10px] text-red-400 font-semibold">Overdue — rotate now</p>
            ) : credential.next_rotation_due ? (
              <p className="text-[10px] text-slate-400">Due {new Date(credential.next_rotation_due).toLocaleDateString()}</p>
            ) : daysSinceRotation !== null ? (
              <p className="text-[10px] text-slate-400">Last rotated {daysSinceRotation}d ago</p>
            ) : (
              <p className="text-[10px] text-slate-500">Never rotated</p>
            )}
          </div>
        </div>
        <div className="text-[9px] text-slate-600">{credential.rotation_count || 0} rotations</div>
      </div>

      {/* Health Check Result */}
      {health && (
        <div className={`p-2.5 rounded-lg border space-y-1 ${
          health.health === 'healthy' ? 'bg-emerald-500/10 border-emerald-500/25' :
          health.health === 'critical' ? 'bg-red-500/10 border-red-500/25' : 'bg-amber-500/10 border-amber-500/25'
        }`}>
          <div className="flex items-center gap-1.5">
            {health.health === 'healthy' ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> : <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />}
            <span className={`text-[10px] font-bold capitalize ${
              health.health === 'healthy' ? 'text-emerald-400' : health.health === 'critical' ? 'text-red-400' : 'text-amber-400'
            }`}>{health.health} {health.autopilot_ready ? '· Autopilot Ready' : '· Not Autopilot Ready'}</span>
          </div>
          {(health.issues || []).map((iss, i) => (
            <p key={i} className="text-[10px] text-slate-400">• {iss.msg}</p>
          ))}
        </div>
      )}

      {/* Access Stats */}
      <div className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-slate-800/30">
        <div className="text-center">
          <p className="text-[9px] text-slate-600">Total Accesses</p>
          <p className="text-sm font-bold text-white">{credential.access_count || 0}</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] text-slate-600">Status</p>
          <p className={`text-sm font-bold ${credential.is_active ? 'text-emerald-400' : 'text-red-400'}`}>
            {credential.is_active ? 'Active' : 'Inactive'}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-slate-800 flex-wrap">
        <Button
          onClick={() => onEdit(credential)}
          size="sm" variant="outline"
          className="flex-1 border-slate-700 text-slate-400 text-xs h-8 gap-1">
          <Pencil className="w-3 h-3" /> Edit
        </Button>
        <Button
          onClick={runHealthCheck}
          disabled={checking}
          size="sm" variant="outline"
          className="flex-1 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 text-xs h-8 gap-1">
          {checking ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
          {checking ? 'Checking…' : 'Health'}
        </Button>
        <Button
          onClick={() => onDelete(credential.id)}
          size="sm" variant="outline"
          className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs h-8 gap-1">
          <Trash2 className="w-3 h-3" /> Delete
        </Button>
      </div>
    </div>
  );
}