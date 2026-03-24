/**
 * ACCOUNT CREATION DASHBOARD
 * Central hub for viewing, managing, and monitoring all Autopilot-created accounts.
 * Shows: Master credential status, in-platform emails, created accounts, intervention queue.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  User, Shield, Mail, Plus, RefreshCw, CheckCircle2, AlertTriangle,
  Zap, Key, Eye, ExternalLink, Loader2, Info
} from 'lucide-react';
import { toast } from 'sonner';

const PLATFORM_ICONS = {
  upwork: '💼', fiverr: '🎯', freelancer: '🔧', guru: '🧠',
  peopleperhour: '⏰', github: '🐙', ebay: '🛒', etsy: '🎨', default: '🌐'
};

function StatusBadge({ status }) {
  const map = {
    active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    activating: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    onboarding: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    healthy: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    verified: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    code_received: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    link_received: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    failed: 'bg-red-500/15 text-red-400 border-red-500/30',
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${map[status] || 'bg-slate-700/50 text-slate-400 border-slate-600'}`}>
      {status?.toUpperCase() || 'UNKNOWN'}
    </span>
  );
}

export default function AccountCreationDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');

  // Master credential status
  const { data: masterStatus, isLoading: masterLoading } = useQuery({
    queryKey: ['masterCredentialStatus'],
    queryFn: async () => {
      const res = await base44.functions.invoke('masterAccountCredentialEngine', { action: 'get_status' });
      return res.data || {};
    }
  });

  // Created accounts
  const { data: createdAccounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['createdAccounts'],
    queryFn: async () => base44.entities.LinkedAccountCreation.filter({ is_ai_created: true }, '-created_date', 50)
  });

  // In-platform emails
  const { data: platformEmails = [], isLoading: emailsLoading } = useQuery({
    queryKey: ['platformEmails'],
    queryFn: async () => base44.entities.InPlatformEmail.filter({}, '-created_date', 50)
  });

  // Active AI identities
  const { data: identities = [] } = useQuery({
    queryKey: ['aiIdentities'],
    queryFn: async () => base44.entities.AIIdentity.filter({ is_active: true }, '-created_date', 10)
  });

  // Create in-platform email
  const createEmailMutation = useMutation({
    mutationFn: async ({ identity_id, platform }) => {
      const res = await base44.functions.invoke('platformEmailEngine', {
        action: 'create_email', identity_id, platform
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`📧 Email created: ${data.email_address}`);
      queryClient.invalidateQueries({ queryKey: ['platformEmails'] });
    }
  });

  // Prepare account (check + auto-create)
  const prepareAccountMutation = useMutation({
    mutationFn: async ({ identity_id, platform }) => {
      const identity = identities.find(i => i.id === identity_id);
      const res = await base44.functions.invoke('autopilotAccountPreparation', {
        action: 'prepare_account',
        identityId: identity_id,
        opportunity: { platform, url: `https://${platform}.com`, id: `manual_${Date.now()}` }
      });
      return res.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`✅ Account prepared for ${data.result?.platform}`);
      } else if (data.intervention_triggered) {
        toast.warning('⚠️ Account creation failed — intervention requested. Check Pending Interventions.');
      } else {
        toast.error(`Failed: ${data.result?.steps?.slice(-1)[0] || 'Unknown error'}`);
      }
      queryClient.invalidateQueries({ queryKey: ['createdAccounts'] });
    }
  });

  const PLATFORMS = ['upwork', 'fiverr', 'freelancer', 'guru', 'peopleperhour', 'github', 'ebay', 'etsy'];
  const createdPlatforms = new Set(createdAccounts.map(a => a.platform));

  const tabs = ['overview', 'accounts', 'emails', 'master_credentials'];

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
            <Zap className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="font-orbitron text-lg font-bold text-white">Account Creation Engine</h1>
            <p className="text-xs text-slate-500">Autopilot account management & tracking</p>
          </div>
        </div>

        {/* Master credential alert */}
        {!masterLoading && !masterStatus?.is_ready && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/8 p-3 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-300">Master Credentials Incomplete</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {masterStatus?.has_identity ? 'Add your email to your AI Identity profile to enable automatic account creation.' : 'Complete your AI Identity onboarding to enable account creation.'}
              </p>
            </div>
            <a href="/IdentityManager" className="ml-auto shrink-0 text-[11px] text-amber-400 hover:text-amber-300 border border-amber-500/30 rounded px-2 py-1">Fix →</a>
          </div>
        )}
        {!masterLoading && masterStatus?.is_ready && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-3 flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-300 font-semibold">Master credentials ready — Autopilot can create accounts autonomously</p>
            {masterStatus.kyc_verified && <Badge className="ml-auto text-[9px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30">KYC VERIFIED</Badge>}
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Created Accounts', value: createdAccounts.length, icon: Key, color: 'text-violet-400' },
          { label: 'Active Accounts', value: createdAccounts.filter(a => a.account_status === 'active' || a.is_user_override).length, icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'Platform Emails', value: platformEmails.length, icon: Mail, color: 'text-cyan-400' },
          { label: 'Verified Emails', value: platformEmails.filter(e => e.verification_status === 'verified').length, icon: Shield, color: 'text-amber-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-card rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-[10px] text-slate-500 font-medium">{label}</span>
            </div>
            <div className={`text-2xl font-bold font-orbitron ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-slate-800 pb-0">
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-medium capitalize rounded-t-lg transition-all ${
              activeTab === tab ? 'bg-violet-500/15 text-violet-300 border-b-2 border-violet-500' : 'text-slate-500 hover:text-slate-300'
            }`}>
            {tab.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PLATFORMS.map(platform => {
              const hasAccount = createdPlatforms.has(platform);
              const account = createdAccounts.find(a => a.platform === platform);
              const icon = PLATFORM_ICONS[platform] || PLATFORM_ICONS.default;

              return (
                <div key={platform} className={`rounded-xl border p-4 transition-all ${
                  hasAccount ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-700/50 bg-slate-800/30'
                }`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white capitalize">{platform}</span>
                        {hasAccount && <StatusBadge status={account.account_status} />}
                      </div>
                      {hasAccount ? (
                        <p className="text-[11px] text-slate-400">@{account.username} · {account.email}</p>
                      ) : (
                        <p className="text-[11px] text-slate-500">No account yet</p>
                      )}
                    </div>
                    {hasAccount ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <Button
                        size="sm"
                        disabled={prepareAccountMutation.isPending || !masterStatus?.is_ready || !identities.length}
                        onClick={() => prepareAccountMutation.mutate({ identity_id: identities[0]?.id, platform })}
                        className="h-8 text-[11px] bg-violet-600/80 hover:bg-violet-500 text-white"
                      >
                        {prepareAccountMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Plus className="w-3 h-3 mr-1" />Create</>}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ACCOUNTS TAB */}
      {activeTab === 'accounts' && (
        <div className="space-y-2">
          {accountsLoading && <div className="text-slate-500 text-sm">Loading accounts...</div>}
          {!accountsLoading && !createdAccounts.length && (
            <div className="text-center py-10 text-slate-500 text-sm">No accounts created yet. Autopilot will create them as opportunities are processed.</div>
          )}
          {createdAccounts.map(account => (
            <div key={account.id} className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 flex items-start gap-4">
              <span className="text-2xl mt-0.5">{PLATFORM_ICONS[account.platform] || PLATFORM_ICONS.default}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-sm font-semibold text-white capitalize">{account.platform}</span>
                  <StatusBadge status={account.account_status} />
                  {account.is_ai_created && <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400 border border-violet-500/30">AI-CREATED</span>}
                  {account.is_user_override && <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">USER-LINKED</span>}
                </div>
                <div className="text-[11px] text-slate-400 space-y-0.5">
                  <p>Username: <span className="text-slate-300">{account.username || '—'}</span></p>
                  <p>Email: <span className="text-slate-300">{account.email || '—'}</span></p>
                  <p>Profile: {account.profile_completeness || 0}% complete</p>
                </div>
              </div>
              {account.profile_url && (
                <a href={account.profile_url} target="_blank" rel="noopener noreferrer"
                  className="text-violet-400 hover:text-violet-300 shrink-0 mt-1">
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* EMAILS TAB */}
      {activeTab === 'emails' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <p className="text-xs text-slate-400 flex-1">
              In-platform emails are virtual addresses used by Autopilot to receive verification emails from 3rd-party platforms.
            </p>
            {identities.length > 0 && (
              <Button size="sm" variant="outline"
                onClick={() => createEmailMutation.mutate({ identity_id: identities[0].id, platform: 'general' })}
                disabled={createEmailMutation.isPending}
                className="border-violet-500/30 text-violet-400 h-8 text-xs shrink-0">
                <Plus className="w-3 h-3 mr-1" /> New Email
              </Button>
            )}
          </div>

          {emailsLoading && <div className="text-slate-500 text-sm">Loading emails...</div>}
          {!emailsLoading && !platformEmails.length && (
            <div className="text-center py-8 text-slate-500 text-sm">No platform emails yet. They are created automatically when Autopilot needs to register on a platform.</div>
          )}
          {platformEmails.map(email => (
            <div key={email.id} className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
              <div className="flex items-start gap-3 mb-3">
                <Mail className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-mono text-cyan-300">{email.email_address}</span>
                    <StatusBadge status={email.verification_status} />
                    {email.unread_count > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                        {email.unread_count} unread
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Identity: {email.identity_name} · Platform: {email.linked_platform || 'general'}
                  </p>
                </div>
              </div>

              {(email.extracted_verification_code || email.extracted_confirmation_link) && (
                <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-2.5 space-y-1">
                  {email.extracted_verification_code && (
                    <p className="text-xs text-slate-300">
                      🔑 Verification Code: <span className="font-mono text-cyan-300 font-bold">{email.extracted_verification_code}</span>
                    </p>
                  )}
                  {email.extracted_confirmation_link && (
                    <p className="text-xs text-slate-300 truncate">
                      🔗 Confirm Link: <a href={email.extracted_confirmation_link} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">{email.extracted_confirmation_link.substring(0, 60)}...</a>
                    </p>
                  )}
                </div>
              )}

              {email.messages?.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-[10px] text-slate-600 font-medium mb-1">INBOX ({email.messages.length} messages)</p>
                  {email.messages.slice(-3).reverse().map(msg => (
                    <div key={msg.message_id} className="text-[11px] text-slate-400 bg-slate-800/50 rounded px-2.5 py-1.5">
                      <span className="text-slate-300">{msg.subject}</span>
                      <span className="text-slate-600 ml-2">from {msg.from}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* MASTER CREDENTIALS TAB */}
      {activeTab === 'master_credentials' && (
        <div className="space-y-4">
          {masterLoading && <div className="text-slate-500 text-sm">Loading master credential status...</div>}
          {!masterLoading && masterStatus && (
            <>
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-violet-400" />
                  <h3 className="text-sm font-bold text-white">Master Account Credentials Status</h3>
                </div>

                {[
                  { label: 'AI Identity Created', value: masterStatus.has_identity, icon: User },
                  { label: 'Email on File', value: masterStatus.has_email, icon: Mail },
                  { label: 'KYC Verified', value: masterStatus.has_kyc, icon: Shield },
                  { label: 'Ready for Auto-Creation', value: masterStatus.ready_for_auto_creation, icon: Zap },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${value ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <span className="text-xs text-slate-300 flex-1">{label}</span>
                    {value
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      : <AlertTriangle className="w-4 h-4 text-amber-400" />
                    }
                  </div>
                ))}

                {masterStatus.identity_name && (
                  <div className="pt-2 border-t border-slate-700/50">
                    <p className="text-xs text-slate-400">Active Identity: <span className="text-white font-semibold">{masterStatus.identity_name}</span></p>
                    <p className="text-xs text-slate-500 mt-0.5">KYC Tier: <span className="text-slate-300 capitalize">{masterStatus.kyc_tier || 'none'}</span></p>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-400 space-y-1">
                    <p className="text-violet-300 font-semibold">How Master Credentials Work</p>
                    <p>Master credentials are sourced exclusively from your KYC-verified AI Identity. No data is ever fabricated. Autopilot uses your real name, email, and profile data to fill in signup forms on 3rd-party platforms.</p>
                    <p className="mt-1">To update: go to <a href="/IdentityManager" className="text-violet-400 hover:underline">Identity Manager</a> → edit your active identity → fill in email + bio fields.</p>
                  </div>
                </div>
              </div>

              {!masterStatus.ready_for_auto_creation && (
                <a href="/Onboarding">
                  <Button className="w-full bg-violet-600 hover:bg-violet-500 text-white h-10">
                    <Zap className="w-4 h-4 mr-2" /> Complete Onboarding to Enable Auto-Creation
                  </Button>
                </a>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}