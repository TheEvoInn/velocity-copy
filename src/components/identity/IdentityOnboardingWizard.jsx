/**
 * IdentityOnboardingWizard — Unified Onboarding with Separated Fields
 * - Separated input fields for every data point
 * - Auto-save progress per identity
 * - Multi-identity support (isolated progress per identity)
 * - Field-level validation
 * - System-wide sync on completion
 */
import React, { useState } from 'react';
import { X } from 'lucide-react';
import UnifiedOnboardingWizard from '@/components/onboarding/UnifiedOnboardingWizard';

export default function IdentityOnboardingWizard({ identity, onComplete, onSkip }) {
  const [isOpen, setIsOpen] = useState(!!identity);

  if (!isOpen || !identity) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(5,7,20,0.92)', backdropFilter: 'blur(12px)' }}>
      <div className="w-full max-w-3xl rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
        style={{ background: 'rgba(10,15,42,0.97)', border: `1.5px solid ${identity.color || '#a855f7'}30`, boxShadow: `0 0 60px ${identity.color || '#a855f7'}10` }}>

        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between shrink-0"
          style={{ borderColor: `${identity.color || '#a855f7'}15` }}>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-lg">{identity.icon || '🤖'}</span>
              <h2 className="font-orbitron text-sm font-bold text-white tracking-widest">
                IDENTITY ONBOARDING
              </h2>
              <span className="text-[9px] px-2 py-0.5 rounded-full font-orbitron"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
                REQUIRED
              </span>
            </div>
            <p className="text-xs text-slate-500">{identity.name} · Full setup required before activation</p>
          </div>
          <button
            onClick={() => {
              setIsOpen(false);
              onSkip?.();
            }}
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-orbitron flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Close
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <UnifiedOnboardingWizard
            identityId={identity.id}
            onComplete={() => {
              setIsOpen(false);
              onComplete?.();
            }}
          />
        </div>
      </div>
    </div>
  );
}