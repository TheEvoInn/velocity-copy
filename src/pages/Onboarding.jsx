/**
 * VELOCITY ONBOARDING PAGE
 * Primary entry point for new users to complete full platform setup:
 * Identity → KYC → Preferences → Banking → Platform Activation
 * 
 * Access points:
 *   - /Onboarding (direct route)
 *   - Dashboard banner when goals.onboarded === false
 *   - Settings page "Start/Resume Onboarding" link
 *   - Mobile drawer "Setup" link
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import OnboardingWizard from '../components/onboarding/OnboardingWizard';
import { Zap, CheckCircle, ArrowRight, Shield, Wallet, Bot, Target } from 'lucide-react';
import { Link } from 'react-router-dom';

const PLATFORM_PILLARS = [
  { icon: Bot,    color: '#00e8ff', title: 'Autopilot Engine',   desc: '24/7 autonomous profit generation' },
  { icon: Shield, color: '#a855f7', title: 'AI Identity Vault',  desc: 'Secure persona & credential management' },
  { icon: Wallet, color: '#10b981', title: 'Earnings Wallet',    desc: 'Real-time balance & payout tracking' },
  { icon: Target, color: '#f9d65c', title: 'Work Discovery',     desc: 'AI-powered opportunity scanner' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showWizard, setShowWizard] = useState(false);

  // Check if already onboarded
  const { data: goalsList = [], isLoading } = useQuery({
    queryKey: ['userGoals'],
    queryFn: () => base44.entities.UserGoals.list(),
  });
  const goals = goalsList[0] || {};
  const alreadyOnboarded = goals.onboarded === true;

  const handleComplete = () => {
    navigate('/Dashboard');
  };

  // Scroll to top when wizard opens
  useEffect(() => {
    if (showWizard) window.scrollTo(0, 0);
  }, [showWizard]);

  if (isLoading) {
    return (
      <div className="min-h-screen galaxy-bg flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If wizard open, show it in the page
  if (showWizard) {
    return (
      <div className="min-h-screen galaxy-bg flex flex-col items-center justify-center px-4 py-12">
        <OnboardingWizard onComplete={handleComplete} />
      </div>
    );
  }

  return (
    <div className="min-h-screen galaxy-bg flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', boxShadow: '0 0 40px rgba(124,58,237,0.5)' }}>
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-orbitron text-3xl font-black text-white tracking-widest text-center"
            style={{ textShadow: '0 0 30px rgba(0,232,255,0.4)' }}>
            VELOCITY
          </h1>
          <p className="text-slate-400 text-sm mt-1 font-mono tracking-widest text-center">AUTONOMOUS PROFIT ENGINE</p>
        </div>

        {/* Main Card */}
        <div className="rounded-2xl p-8 mb-6"
          style={{ background: 'rgba(10,15,42,0.85)', border: '1px solid rgba(0,232,255,0.25)', backdropFilter: 'blur(24px)', boxShadow: '0 0 60px rgba(0,232,255,0.08)' }}>

          {alreadyOnboarded ? (
            /* Already onboarded — show resume/update options */
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
              <h2 className="font-orbitron text-xl font-bold text-white mb-2 tracking-wide">
                PLATFORM ACTIVE
              </h2>
              <p className="text-slate-400 text-sm mb-6">
                Your VELOCITY platform is set up and running. You can update your settings or re-run onboarding to reconfigure.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/Dashboard">
                  <button className="btn-cosmic px-6 py-2.5 rounded-xl font-orbitron text-xs tracking-widest w-full sm:w-auto">
                    GO TO DASHBOARD
                  </button>
                </Link>
                <button
                  onClick={() => setShowWizard(true)}
                  className="px-6 py-2.5 rounded-xl font-orbitron text-xs tracking-widest border border-slate-600 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300 transition-all w-full sm:w-auto">
                  UPDATE SETUP
                </button>
              </div>
            </div>
          ) : (
            /* New user — show setup prompt */
            <div>
              <h2 className="font-orbitron text-xl font-bold text-white mb-2 tracking-wide text-center">
                {user?.full_name ? `WELCOME, ${user.full_name.toUpperCase().split(' ')[0]}` : 'WELCOME TO VELOCITY'}
              </h2>
              <p className="text-slate-400 text-sm mb-8 text-center leading-relaxed">
                Complete your setup in 6 steps to activate your autonomous profit engine.
                Takes about 5 minutes — required to enable Autopilot, AI Identities, and Earnings.
              </p>

              {/* Platform pillars */}
              <div className="grid grid-cols-2 gap-3 mb-8">
                {PLATFORM_PILLARS.map(pillar => (
                  <div key={pillar.title} className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: `${pillar.color}08`, border: `1px solid ${pillar.color}20` }}>
                    <pillar.icon className="w-5 h-5 shrink-0" style={{ color: pillar.color }} />
                    <div>
                      <div className="text-xs font-semibold text-white">{pillar.title}</div>
                      <div className="text-[10px] text-slate-500">{pillar.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Steps preview */}
              <div className="flex items-center justify-center gap-1.5 mb-8">
                {['Welcome', 'Identity', 'KYC', 'Preferences', 'Banking', 'Launch'].map((label, i) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold"
                        style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)', color: '#a78bfa' }}>
                        {i + 1}
                      </div>
                      <span className="text-[8px] text-slate-600 hidden sm:block">{label}</span>
                    </div>
                    {i < 5 && <div className="w-4 h-px bg-slate-800 mb-3" />}
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowWizard(true)}
                className="btn-cosmic w-full py-3 rounded-xl font-orbitron text-sm tracking-widest flex items-center justify-center gap-2">
                BEGIN SETUP
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="text-[10px] text-slate-600 text-center mt-3">
                All data is encrypted and stored securely. KYC is required for earnings withdrawal.
              </p>
            </div>
          )}
        </div>

        {/* Already have account? */}
        {!alreadyOnboarded && (
          <div className="text-center">
            <Link to="/Dashboard" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
              Skip for now → Go to Dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}