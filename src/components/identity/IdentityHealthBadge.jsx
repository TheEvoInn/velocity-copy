/**
 * IdentityHealthBadge
 * Shows onboarding status, health issues, and readiness for Autopilot.
 * Compact — designed to embed in identity cards and lists.
 */
import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, XCircle, Zap, ShieldOff } from 'lucide-react';

const HEALTH_CONFIGS = {
  active: {
    label: 'ACTIVE',
    icon: CheckCircle2,
    color: '#10b981',
    desc: 'Fully onboarded & verified',
  },
  pending_onboarding: {
    label: 'ONBOARDING',
    icon: Clock,
    color: '#f9d65c',
    desc: 'Complete onboarding to activate',
  },
  incomplete: {
    label: 'INCOMPLETE',
    icon: AlertTriangle,
    color: '#f97316',
    desc: 'Missing required setup steps',
  },
  kyc_required: {
    label: 'KYC NEEDED',
    icon: ShieldOff,
    color: '#ef4444',
    desc: 'Identity verification required',
  },
  credentials_expired: {
    label: 'CREDS EXPIRED',
    icon: XCircle,
    color: '#ef4444',
    desc: 'Credentials need renewal',
  },
  ready: {
    label: 'READY',
    icon: Zap,
    color: '#00e8ff',
    desc: 'Onboarded, awaiting activation',
  },
};

export function getIdentityHealthStatus(identity) {
  if (!identity) return 'incomplete';

  // Not onboarded at all
  if (!identity.onboarding_complete && !identity.onboarding_status) {
    return 'pending_onboarding';
  }

  // Onboarded but not yet active (pending KYC approval)
  if (identity.onboarding_complete && !identity.is_active) {
    return 'ready';
  }

  // Active and onboarded
  if (identity.is_active && identity.onboarding_complete) {
    return 'active';
  }

  // Partial onboarding
  if (identity.onboarding_status === 'partial' || identity.onboarding_status === 'in_progress') {
    return 'pending_onboarding';
  }

  // No KYC data
  if (!identity.kyc_verified_data?.full_legal_name) {
    return 'kyc_required';
  }

  return 'incomplete';
}

export function getHealthIssues(identity) {
  const issues = [];
  if (!identity.onboarding_complete) issues.push('Onboarding not completed');
  if (!identity.kyc_verified_data?.full_legal_name) issues.push('KYC not submitted');
  if (!identity.email) issues.push('No contact email set');
  if (!(identity.preferred_categories?.length)) issues.push('No work categories selected');
  if (!identity.skills?.length) issues.push('No skills defined');
  return issues;
}

export default function IdentityHealthBadge({ identity, size = 'md', showIssues = false, onResumeOnboarding }) {
  const status = getIdentityHealthStatus(identity);
  const cfg = HEALTH_CONFIGS[status] || HEALTH_CONFIGS.incomplete;
  const Icon = cfg.icon;
  const issues = showIssues ? getHealthIssues(identity) : [];

  if (size === 'xs') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-orbitron font-bold"
        style={{ background: `${cfg.color}12`, border: `1px solid ${cfg.color}30`, color: cfg.color }}>
        <Icon className="w-2.5 h-2.5" />
        {cfg.label}
      </span>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
          style={{ background: `${cfg.color}10`, border: `1px solid ${cfg.color}25` }}>
          <Icon className="w-3 h-3" style={{ color: cfg.color }} />
          <span className="text-[10px] font-orbitron font-bold tracking-widest" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
        </div>
        {(status === 'pending_onboarding' || status === 'incomplete') && onResumeOnboarding && (
          <button onClick={onResumeOnboarding}
            className="text-[10px] font-orbitron px-2 py-1 rounded-lg transition-all"
            style={{ background: 'rgba(249,214,92,0.1)', border: '1px solid rgba(249,214,92,0.3)', color: '#f9d65c' }}>
            Resume →
          </button>
        )}
      </div>
      {showIssues && issues.length > 0 && (
        <div className="space-y-0.5 pl-1">
          {issues.map(issue => (
            <div key={issue} className="flex items-center gap-1.5 text-[10px] text-amber-400/70">
              <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
              {issue}
            </div>
          ))}
        </div>
      )}
      {status === 'ready' && (
        <p className="text-[10px] text-emerald-400/60 pl-1">Awaiting admin activation</p>
      )}
    </div>
  );
}