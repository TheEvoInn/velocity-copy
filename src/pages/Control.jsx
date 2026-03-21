/**
 * DEPARTMENT 4: Control Center (User Experience & Settings)
 * Manages identities, personas, KYC, preferences, and system settings.
 * Communicates with: all departments via DeptBus.
 */
import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDepartmentSync } from '@/hooks/useDepartmentSync';
import { SlidersHorizontal, User, Shield, Wrench, Bot, Link2, Lock, Target, Settings, ToggleLeft, ToggleRight, Edit3, PlusCircle, CheckCircle2, Star, ChevronRight, Webhook } from 'lucide-react';
import WebhookDiagnostics from '@/components/diagnostics/WebhookDiagnostics';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

const SECTION_TABS = ['Identities', 'Autopilot', 'Accounts', 'Security', 'Goals'];

export default function Control() {
  const { identities, userGoals, DeptBus, DEPT_EVENTS } = useDepartmentSync();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('Identities');

  const handleSetActive = async (identity) => {
    // Deactivate all, then activate selected
    await Promise.all(identities.map(i =>
      base44.entities.AIIdentity.update(i.id, { is_active: i.id === identity.id })
    ));
    DeptBus.emit(DEPT_EVENTS.IDENTITY_SWITCHED, { identity });
    queryClient.invalidateQueries({ queryKey: ['aiIdentities'] });
  };

  const handleToggleAutopilot = async () => {
    if (!userGoals.id) return;
    await base44.entities.UserGoals.update(userGoals.id, {
      autopilot_enabled: !userGoals.autopilot_enabled,
    });
    DeptBus.emit(DEPT_EVENTS.AUTOPILOT_TOGGLED, { enabled: !userGoals.autopilot_enabled });
    queryClient.invalidateQueries({ queryKey: ['userGoals'] });
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
            <SlidersHorizontal className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Control Center</h1>
            <p className="text-xs text-slate-500">Identities · Autopilot · Accounts · Security · Goals</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900/60 border border-slate-800 rounded-xl p-1 mb-5 overflow-x-auto">
        {SECTION_TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === tab ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}>{tab}</button>
        ))}
      </div>

      {/* IDENTITIES TAB */}
      {activeTab === 'Identities' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-purple-400" />
              AI Personas
            </h2>
            <Link to="/AIIdentityStudio">
              <Button size="sm" className="bg-purple-600/80 hover:bg-purple-500 text-white text-xs h-8 gap-1.5">
                <PlusCircle className="w-3.5 h-3.5" /> New Identity
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
            {identities.map(identity => (
              <div key={identity.id}
                className={`bg-slate-900/60 border rounded-xl p-4 transition-all ${
                  identity.is_active ? 'border-purple-500/50 bg-purple-950/20' : 'border-slate-800 hover:border-slate-700'
                }`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                      style={{ backgroundColor: identity.color ? `${identity.color}22` : '#1e293b', border: `1px solid ${identity.color || '#334155'}44` }}>
                      {identity.avatar_url ? (
                        <img src={identity.avatar_url} className="w-8 h-8 rounded-lg object-cover" alt={identity.name} />
                      ) : (
                        <Bot className="w-4 h-4" style={{ color: identity.color || '#94a3b8' }} />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{identity.name}</p>
                      <p className="text-xs text-slate-500">{identity.role_label || 'AI Agent'}</p>
                    </div>
                  </div>
                  {identity.is_active && (
                    <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">Active</Badge>
                  )}
                </div>
                {identity.tagline && <p className="text-xs text-slate-400 mb-3 line-clamp-2">{identity.tagline}</p>}
                {identity.skills?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {identity.skills.slice(0, 3).map(s => (
                      <span key={s} className="text-xs px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded-md">{s}</span>
                    ))}
                  </div>
                )}
                <div className="flex gap-1.5">
                  {!identity.is_active && (
                    <button onClick={() => handleSetActive(identity)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-purple-600/80 hover:bg-purple-500 text-white text-xs rounded-lg transition-colors">
                      <Star className="w-3 h-3" /> Set Active
                    </button>
                  )}
                  <Link to="/IdentityManager" className={identity.is_active ? 'flex-1' : ''}>
                    <button className="w-full flex items-center justify-center gap-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg transition-colors">
                      <Edit3 className="w-3 h-3" /> Edit
                    </button>
                  </Link>
                </div>
              </div>
            ))}
            {identities.length === 0 && (
              <div className="col-span-3 bg-slate-900/40 border border-slate-800 rounded-xl p-10 text-center">
                <Bot className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-500 mb-3">No AI identities created yet.</p>
                <Link to="/AIIdentityStudio">
                  <Button size="sm" className="bg-purple-600 hover:bg-purple-500 text-white text-xs gap-1.5">
                    <PlusCircle className="w-3.5 h-3.5" /> Create First Identity
                  </Button>
                </Link>
              </div>
            )}
          </div>
          <Link to="/IdentityManager">
            <Button variant="outline" size="sm" className="border-slate-700 text-slate-400 text-xs hover:bg-slate-800">
              Open Full Identity Manager →
            </Button>
          </Link>
        </div>
      )}

      {/* AUTOPILOT TAB */}
      {activeTab === 'Autopilot' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-white">Autopilot Engine</h2>
                <p className="text-xs text-slate-500 mt-0.5">Master switch for autonomous execution</p>
              </div>
              <button onClick={handleToggleAutopilot}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  userGoals.autopilot_enabled
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}>
                {userGoals.autopilot_enabled
                  ? <><ToggleRight className="w-4 h-4" /> Enabled</>
                  : <><ToggleLeft className="w-4 h-4" /> Disabled</>
                }
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Daily AI Target', value: `$${userGoals.ai_daily_target || 500}`, icon: Target },
                { label: 'Daily User Target', value: `$${userGoals.user_daily_target || 500}`, icon: Target },
                { label: 'Risk Tolerance', value: userGoals.risk_tolerance || 'moderate', icon: Shield },
                { label: 'Hours/Day', value: userGoals.hours_per_day || 8, icon: Settings },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-slate-800/60 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">{label}</p>
                  <p className="text-sm font-semibold text-white capitalize">{value}</p>
                </div>
              ))}
            </div>
          </div>
          <Link to="/AutoPilot">
            <Button variant="outline" size="sm" className="border-slate-700 text-slate-400 text-xs hover:bg-slate-800">
              Open Full Autopilot Dashboard →
            </Button>
          </Link>
        </div>
      )}

      {/* ACCOUNTS TAB */}
      {activeTab === 'Accounts' && (
        <div className="space-y-4">
          <Link to="/ExchangeConnectivity" className="block">
            <div className="rounded-xl p-5 transition-all"
              style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(6,182,212,0.08))', border: '1px solid rgba(124,58,237,0.35)', boxShadow: '0 0 24px rgba(124,58,237,0.15)' }}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🔌</span>
                <div>
                  <h3 className="text-sm font-semibold text-white font-orbitron tracking-wide">Exchange Connectivity Hub</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Connect eBay, Etsy, Upwork, Fiverr, Shopify, Amazon & more</p>
                </div>
                <ChevronRight className="w-4 h-4 text-violet-400 ml-auto shrink-0" />
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {['eBay', 'Etsy', 'Upwork', 'Fiverr', 'Amazon', 'Shopify', 'Stripe'].map(p => (
                  <span key={p} className="text-[9px] px-2 py-0.5 bg-violet-500/15 text-violet-300 border border-violet-500/25 rounded-full">{p}</span>
                ))}
              </div>
            </div>
          </Link>
          <Link to="/AccountManager">
            <Button variant="outline" size="sm" className="border-slate-700 text-slate-400 text-xs hover:bg-slate-800">
              Open Account Manager →
            </Button>
          </Link>
        </div>
      )}

      {/* SECURITY TAB */}
      {activeTab === 'Security' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link to="/SecurityDashboard" className="block">
              <div className="bg-slate-900/60 border border-slate-800 hover:border-purple-500/40 rounded-xl p-5 transition-colors">
                <Shield className="w-6 h-6 text-purple-400 mb-2" />
                <h3 className="text-sm font-semibold text-white mb-1">Security Dashboard</h3>
                <p className="text-xs text-slate-500">System security status, secret audit logs, and access control.</p>
              </div>
            </Link>
            <Link to="/KYCManagement" className="block">
              <div className="bg-slate-900/60 border border-slate-800 hover:border-purple-500/40 rounded-xl p-5 transition-colors">
                <Lock className="w-6 h-6 text-purple-400 mb-2" />
                <h3 className="text-sm font-semibold text-white mb-1">Legal Identity / KYC</h3>
                <p className="text-xs text-slate-500">KYC verification, legal identity management, compliance status.</p>
              </div>
            </Link>
            <Link to="/DataPersistenceAudit" className="block">
              <div className="bg-slate-900/60 border border-slate-800 hover:border-purple-500/40 rounded-xl p-5 transition-colors">
                <Wrench className="w-6 h-6 text-purple-400 mb-2" />
                <h3 className="text-sm font-semibold text-white mb-1">Data Audit</h3>
                <p className="text-xs text-slate-500">Data persistence, integrity checks, and audit logs.</p>
              </div>
            </Link>
            <Link to="/PlatformAuditDashboard" className="block">
              <div className="bg-slate-900/60 border border-slate-800 hover:border-purple-500/40 rounded-xl p-5 transition-colors">
                <CheckCircle2 className="w-6 h-6 text-purple-400 mb-2" />
                <h3 className="text-sm font-semibold text-white mb-1">Platform Audit</h3>
                <p className="text-xs text-slate-500">Full platform audit trail and system health overview.</p>
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* GOALS TAB */}
      {activeTab === 'Goals' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-purple-400" />
              Goals & Preferences
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: 'Daily Target', value: `$${userGoals.daily_target || 1000}` },
                { label: 'AI Daily Target', value: `$${userGoals.ai_daily_target || 500}` },
                { label: 'User Daily Target', value: `$${userGoals.user_daily_target || 500}` },
                { label: 'Available Capital', value: `$${userGoals.available_capital || 0}` },
                { label: 'Hours/Day', value: userGoals.hours_per_day || 8 },
                { label: 'Risk Tolerance', value: userGoals.risk_tolerance || 'moderate' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-800/60 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">{label}</p>
                  <p className="text-sm font-bold text-white capitalize">{value}</p>
                </div>
              ))}
            </div>
            {userGoals.preferred_categories?.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-slate-500 mb-2">Preferred Categories</p>
                <div className="flex flex-wrap gap-1.5">
                  {userGoals.preferred_categories.map(c => (
                    <span key={c} className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/25 rounded-md">{c}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <Link to="/Chat">
            <Button size="sm" className="bg-purple-600/80 hover:bg-purple-500 text-white text-xs gap-1.5">
              <Bot className="w-3.5 h-3.5" /> Update Goals with AI →
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}