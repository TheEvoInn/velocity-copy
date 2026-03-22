/**
 * Admin User Management — Non-sensitive user overview
 * Shows onboarding, identity setup, autopilot status.
 * NO access to KYC docs, API keys, bank details, or private messages.
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, CheckCircle2, Clock, XCircle, Bot, Shield,
  Search, ChevronDown, ChevronUp, RefreshCw, Wrench,
  ArrowRight, Bell, AlertTriangle, Zap, Link2, CheckCircle,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

// Send a notification to the user via the Notification entity
async function sendUserNotification(userEmail, title, message, type = 'action_required') {
  try {
    await base44.entities.Notification.create({
      user_email: userEmail,
      title,
      message,
      type,
      is_read: false,
      created_by: userEmail,
    });
    toast.success(`Notification sent to ${userEmail}`);
  } catch (e) {
    toast.error(`Failed to send notification: ${e.message}`);
  }
}

// Resolution trigger button — shown when a status needs action
function TriggerButton({ label, icon: Icon, color, onClick, loading }) {
  const [busy, setBusy] = React.useState(false);
  const handle = async () => {
    setBusy(true);
    await onClick();
    setBusy(false);
  };
  return (
    <button onClick={handle} disabled={busy}
      className="mt-1.5 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all active:scale-95 disabled:opacity-50"
      style={{ background: `${color}10`, border: `1px solid ${color}30`, color }}>
      {busy ? <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" /> : <Icon className="w-2.5 h-2.5" />}
      {busy ? 'Sending…' : label}
    </button>
  );
}

const STATUS_BADGE = {
  complete:    { color: '#10b981', label: 'Complete' },
  partial:     { color: '#f59e0b', label: 'Partial' },
  not_started: { color: '#64748b', label: 'Not Started' },
};

function Badge({ status, text }) {
  const cfg = STATUS_BADGE[status] || STATUS_BADGE.not_started;
  return (
    <span className="px-2 py-0.5 rounded text-[10px] font-medium"
      style={{ background: `${cfg.color}15`, border: `1px solid ${cfg.color}30`, color: cfg.color }}>
      {text || cfg.label}
    </span>
  );
}

function UserRow({ user, identities, goals, connections, kycs, onAudit }) {
  const [expanded, setExpanded] = useState(false);
  const [approving, setApproving] = useState(null);

  const userIdentities  = identities.filter(i => (i.created_by === user.email || i.user_email === user.email));
  const userGoal        = goals.find(g => (g.created_by === user.email || g.user_email === user.email));
  const userConnections = connections.filter(c => (c.created_by === user.email || c.user_email === user.email));
  const userKyc         = kycs.find(k => (k.created_by === user.email || k.user_email === user.email));

  const identityStatus = userIdentities.length > 0 ? 'complete' : 'not_started';
  const onboardStatus  = userGoal?.onboarded ? 'complete' : userGoal ? 'partial' : 'not_started';
  const autopilotOn    = userGoal?.autopilot_enabled;
  const kycStatus      = userKyc?.status;

  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden" data-user-id={user.id}>
      <div className="flex items-center gap-3 p-3 bg-slate-800/30 hover:bg-slate-800/50 transition-colors cursor-pointer"
        onClick={() => setExpanded(p => !p)}>
        <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
          <Users className="w-4 h-4 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{user.full_name || '—'}</p>
          <p className="text-xs text-slate-500 truncate">{user.email}</p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <Badge status={onboardStatus} text={onboardStatus === 'complete' ? 'Onboarded' : 'Setup Incomplete'} />
          <Badge status={identityStatus} text={`${userIdentities.length} ID${userIdentities.length !== 1 ? 's' : ''}`} />
          {autopilotOn && (
            <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">Autopilot ON</span>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onAudit(user.email); }}
          className="text-slate-500 hover:text-cyan-400 transition-colors px-2"
          title="Audit & repair user data connections">
          <Wrench className="w-3.5 h-3.5" />
        </button>
        <div className="text-xs text-slate-500 shrink-0">
          {user.role === 'admin' ? <Shield className="w-3.5 h-3.5 text-red-400" /> : null}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
      </div>

      {expanded && (
        <div className="p-4 border-t border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-slate-900/40">

          {/* Onboarding */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Onboarding</p>
            <Badge status={onboardStatus} />
            {userGoal?.daily_target && (
              <p className="text-slate-400 mt-1">Target: ${userGoal.daily_target}/day</p>
            )}
            {onboardStatus === 'complete' && (
              <TriggerButton
                label="✓ Approve Setup"
                icon={CheckCircle2}
                color="#10b981"
                loading={approving === 'onboarding'}
                onClick={async () => {
                  setApproving('onboarding');
                  try {
                    await base44.entities.UserGoals.update(userGoal.id, { onboarded: true });
                    toast.success('Onboarding approved');
                    await onAudit?.(user.email);
                  } catch (e) {
                    toast.error(e.message);
                  }
                  setApproving(null);
                }}
              />
            )}
            {onboardStatus === 'not_started' && (
              <TriggerButton
                label="Nudge to Onboard"
                icon={ArrowRight}
                color="#f9d65c"
                onClick={() => sendUserNotification(
                  user.email,
                  '🚀 Complete Your Onboarding',
                  'Your account setup is not started yet. Visit your dashboard and complete onboarding to activate Autopilot and start earning.',
                  'action_required'
                )}
              />
            )}
            {onboardStatus === 'partial' && (
              <TriggerButton
                label="Resume Onboarding"
                icon={ArrowRight}
                color="#f97316"
                onClick={() => sendUserNotification(
                  user.email,
                  '⏳ Finish Your Setup',
                  "You're halfway through onboarding! Return to the app to complete your profile, set your earning targets, and activate Autopilot.",
                  'action_required'
                )}
              />
            )}
          </div>

          {/* Identities */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Identities</p>
            {userIdentities.length === 0
              ? <>
                  <p className="text-slate-600">None created</p>
                  <TriggerButton
                    label="Prompt to Create"
                    icon={Bell}
                    color="#a855f7"
                    onClick={() => sendUserNotification(
                      user.email,
                      '🤖 Set Up Your AI Identity',
                      'Create an AI persona so Autopilot can apply to platforms, communicate with clients, and execute tasks on your behalf. Go to Identity Vault to get started.',
                      'action_required'
                    )}
                  />
                </>
              : userIdentities.map(i => (
                <p key={i.id} className="text-violet-300">• {i.name} ({i.role_label})</p>
              ))
            }
          </div>

          {/* Platform Connections */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Platform Connections</p>
            {userConnections.length === 0
              ? <>
                  <p className="text-slate-600">None connected</p>
                  <TriggerButton
                    label="Prompt to Connect"
                    icon={Link2}
                    color="#3b82f6"
                    onClick={() => sendUserNotification(
                      user.email,
                      '🔗 Connect Your Platforms',
                      'Link your freelance and gig accounts (Upwork, Fiverr, etc.) so Autopilot can apply to real jobs and deposit earnings automatically.',
                      'action_required'
                    )}
                  />
                </>
              : userConnections.map(c => (
                <p key={c.id} className="text-blue-300">• {c.platform} ({c.status})</p>
              ))
            }
          </div>

          {/* KYC */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">KYC Status</p>
            {kycStatus
              ? <Badge status={kycStatus === 'approved' ? 'complete' : kycStatus === 'pending' ? 'partial' : 'not_started'}
                  text={kycStatus.replace('_', ' ')} />
              : <p className="text-slate-600">Not submitted</p>
            }
            {(!kycStatus || kycStatus === 'not_started') && (
              <TriggerButton
                label="Request KYC"
                icon={AlertTriangle}
                color="#ef4444"
                onClick={() => sendUserNotification(
                  user.email,
                  '🪪 Complete Identity Verification (KYC)',
                  'KYC verification is required to unlock higher-value tasks and enable payouts. Go to KYC Management in your dashboard to submit your documents.',
                  'action_required'
                )}
              />
            )}
            {kycStatus === 'pending' || kycStatus === 'submitted' ? (
              <TriggerButton
                label="Send Reminder"
                icon={Bell}
                color="#f59e0b"
                onClick={() => sendUserNotification(
                  user.email,
                  '⏳ KYC Under Review',
                  'Your KYC documents are being reviewed. You\'ll be notified once approved. Make sure all submitted documents are clear and valid.',
                  'info'
                )}
              />
            ) : null}
            {kycStatus === 'approved' && (
              <p className="text-[10px] text-emerald-500 mt-1">✓ Verified</p>
            )}
            <p className="text-[10px] text-slate-600 mt-1">⚠️ No private data shown</p>
          </div>

        </div>
      )}
    </div>
  );
}

export default function AdminUserManagement() {
  const [search, setSearch] = useState('');
  const [auditUser, setAuditUser] = useState(null);
  const [auditResult, setAuditResult] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [userDataProfile, setUserDataProfile] = useState(null);
  const qc = useQueryClient();

  // User search mutation
  const searchMutation = useMutation({
    mutationFn: async (searchTerm) => {
      const res = await base44.functions.invoke('userIdentificationLinker', {
        action: 'search_users',
        search_term: searchTerm
      });
      return res.data?.results || [];
    },
    onSuccess: (results) => {
      setSearchResults(results);
      setShowSearchResults(true);
    },
    onError: (err) => toast.error(err.message)
  });

  // User data identification mutation
  const identifyMutation = useMutation({
    mutationFn: async (userEmail) => {
      const res = await base44.functions.invoke('userIdentificationLinker', {
        action: 'identify_user_data',
        user_email: userEmail
      });
      return res.data?.profile;
    },
    onSuccess: (profile) => {
      setUserDataProfile(profile);
      toast.success(`Found ${profile.data_summary.total_records} records for user`);
    },
    onError: (err) => toast.error(err.message)
  });

  // Repair user links mutation
  const repairLinksMutation = useMutation({
    mutationFn: async (userEmail) => {
      const res = await base44.functions.invoke('userIdentificationLinker', {
        action: 'repair_user_links',
        user_email: userEmail
      });
      return res.data?.repairs;
    },
    onSuccess: (repairs) => {
      toast.success(`Repaired ${repairs.summary.successful} data links`);
      refetch();
    },
    onError: (err) => toast.error(err.message)
  });

  // ─────────────────────────────────────────────────────────────────────────
  // REAL-TIME SUBSCRIPTIONS — Auto-update when user data changes
  // ─────────────────────────────────────────────────────────────────────────
  React.useEffect(() => {
    const unsubscribes = [];

    // Subscribe to UserGoals changes (onboarding completion)
    const unsubUserGoals = base44.entities.UserGoals.subscribe((event) => {
      if (['create', 'update'].includes(event.type)) {
        qc.invalidateQueries({ queryKey: ['admin_all_goals'] });
      }
    });

    // Subscribe to AIIdentity changes (identity creation/updates)
    const unsubIdentities = base44.entities.AIIdentity.subscribe((event) => {
      if (['create', 'update'].includes(event.type)) {
        qc.invalidateQueries({ queryKey: ['admin_all_identities'] });
      }
    });

    // Subscribe to PlatformConnection changes (platform linking)
    const unsubConnections = base44.entities.PlatformConnection.subscribe((event) => {
      if (['create', 'update'].includes(event.type)) {
        qc.invalidateQueries({ queryKey: ['admin_all_connections'] });
      }
    });

    // Subscribe to KYCVerification changes (KYC submissions)
    const unsubKyc = base44.entities.KYCVerification.subscribe((event) => {
      if (['create', 'update'].includes(event.type)) {
        qc.invalidateQueries({ queryKey: ['admin_all_kycs'] });
      }
    });

    unsubscribes.push(unsubUserGoals, unsubIdentities, unsubConnections, unsubKyc);

    return () => {
      unsubscribes.forEach(unsub => unsub?.());
    };
  }, [qc]);

  const auditMutation = useMutation({
    mutationFn: async (user_email) => {
      const res = await base44.functions.invoke('userDataConnectionAudit', { user_email });
      return res.data?.audit;
    },
    onSuccess: (result) => {
      setAuditResult(result);
      toast.success(`Audit complete: ${result.repairs_made} issues repaired`);
      // Refresh all data after audit
      setTimeout(() => {
        refetch();
        refetchIdentities();
        refetchGoals();
        refetchConnections();
        refetchKycs();
      }, 500);
    },
    onError: (err) => toast.error(err.message)
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SECURE QUERIES: Fetch all admin-visible data in parallel with enriched profiles
  // ─────────────────────────────────────────────────────────────────────────
  const { data: adminData = { users: [], goals: [], identities: [], connections: [], kycs: [], metadata: {} }, 
          isLoading: loadingUsers, 
          refetch } = useQuery({
    queryKey: ['admin_user_management_secure'],
    queryFn: async () => {
      const res = await base44.functions.invoke('adminPanelSecureQuery', {
        filter_email: search.length > 2 ? search : null
      });
      return res.data;
    },
    refetchInterval: 10000,  // Real-time: update every 10 seconds
  });

  // Destructure enriched profiles
  const users = adminData.users || [];
  const goals = adminData.goals || [];
  const identities = adminData.identities || [];
  const connections = adminData.connections || [];
  const kycs = adminData.kycs || [];
  const metadata = adminData.metadata || {};

  // Dummy refetch functions for backward compatibility
  const refetchIdentities = () => refetch();
  const refetchGoals = () => refetch();
  const refetchConnections = () => refetch();
  const refetchKycs = () => refetch();

  const filtered = users.filter(u =>
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  // ─────────────────────────────────────────────────────────────────────────
  // COMPUTE DASHBOARD METRICS (from all fetched data)
  // ─────────────────────────────────────────────────────────────────────────
  const onboarded   = goals.filter(g => g.onboarded === true).length;
  const autopilotOn = goals.filter(g => g.autopilot_enabled === true).length;
  const pendingKyc  = kycs.filter(k => !['approved', 'verified'].includes(k?.status)).length;
  const withIdentities = identities.filter(id => id.user_email).length;
  const withConnections = connections.filter(c => c.user_email).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-orbitron text-base font-bold text-violet-400 tracking-wide flex items-center gap-2">
          <Users className="w-4 h-4" /> User Management
        </h2>
        <Button size="sm" variant="outline" onClick={() => {
          refetch();
          refetchIdentities();
          refetchGoals();
          refetchConnections();
          refetchKycs();
        }}
          className="border-slate-700 text-slate-400 text-xs h-7 gap-1.5">
          <RefreshCw className="w-3 h-3" /> Refresh
        </Button>
      </div>

      {/* Privacy Notice */}
      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
        <Shield className="w-4 h-4 text-amber-400 shrink-0" />
        <p className="text-xs text-amber-300/70">
          Privacy protected — No KYC documents, API keys, banking details, or credentials are displayed.
        </p>
      </div>

      {/* Audit Modal */}
      {auditUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full max-h-96 overflow-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-orbitron text-lg font-bold text-white">Data Connection Audit</h3>
              <button onClick={() => { setAuditUser(null); setAuditResult(null); }} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {auditResult ? (
              <div className="space-y-3 text-sm">
                <div className={`p-3 rounded-lg ${auditResult.status === 'fully_connected' ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-amber-500/10 border border-amber-500/30'}`}>
                  <p className="font-semibold">{auditResult.status.replace(/_/g, ' ').toUpperCase()}</p>
                  <p className="text-xs text-slate-400 mt-1">Issues: {auditResult.issues_found} → Repaired: {auditResult.repairs_made}</p>
                </div>

                {Object.entries(auditResult.connections).map(([key, val]) => (
                  <div key={key} className="p-3 bg-slate-800/50 rounded border border-slate-700">
                    <p className="font-mono text-xs font-bold text-violet-400 uppercase">{key.replace(/_/g, ' ')}</p>
                    {typeof val === 'object' ? (
                      <pre className="text-xs text-slate-300 mt-1 overflow-auto max-h-32">
                        {JSON.stringify(val, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-xs text-slate-400 mt-1">{val}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="inline-block mb-3">
                  <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                </div>
                <p className="text-slate-400 text-sm">Auditing user data connections...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Users',    value: users.length,      color: '#a855f7', icon: Users },
          { label: 'Onboarded',      value: onboarded,         color: '#10b981', icon: CheckCircle2 },
          { label: 'With Identities', value: withIdentities,   color: '#06b6d4', icon: Bot },
          { label: 'Connected Accounts', value: withConnections, color: '#f59e0b', icon: Link2 },
          { label: 'Pending KYC',    value: pendingKyc,        color: '#ef4444', icon: Clock },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="rounded-xl p-3" style={{ background: `${color}10`, border: `1px solid ${color}25` }}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className="w-3.5 h-3.5" style={{ color }} />
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
            </div>
            <p className="text-xl font-orbitron font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Advanced Search */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input 
            value={search} 
            onChange={e => {
              setSearch(e.target.value);
              if (e.target.value.length > 2) {
                searchMutation.mutate(e.target.value);
              } else {
                setShowSearchResults(false);
              }
            }}
            placeholder="Search users by email, name, or ID..."
            className="pl-9 bg-slate-800/60 border-slate-700 text-white text-sm h-9" />
          {searchMutation.isPending && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 animate-spin" />
          )}
        </div>

        {/* Search Results Modal */}
        {showSearchResults && searchResults.length > 0 && (
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3 space-y-2 max-h-64 overflow-y-auto">
            <p className="text-xs text-slate-400">Found {searchResults.length} user(s):</p>
            {searchResults.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-2 bg-slate-900/50 rounded border border-slate-700">
                <div className="flex-1">
                  <p className="text-sm text-white font-medium">{u.full_name || '—'}</p>
                  <p className="text-xs text-slate-400">{u.email}</p>
                </div>
                <div className="flex gap-1">
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => {
                      identifyMutation.mutate(u.email);
                      setShowSearchResults(false);
                    }}
                  >
                    Profile
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => {
                      setSearch('');
                      setShowSearchResults(false);
                      // Scroll to user in main list
                      const userRow = document.querySelector(`[data-user-id="${u.id}"]`);
                      userRow?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                  >
                    Go
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* User Data Profile Modal */}
        {userDataProfile && (
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">User Data Profile</h3>
              <button 
                onClick={() => setUserDataProfile(null)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              {Object.entries(userDataProfile.data_summary).map(([key, val]) => (
                <div key={key} className="bg-slate-800/50 p-2 rounded border border-slate-700">
                  <p className="text-slate-400 capitalize">{key.replace(/_/g, ' ')}</p>
                  <p className="text-base font-bold text-cyan-400">{val}</p>
                </div>
              ))}
            </div>

            <div className="text-xs">
              <p className="text-slate-400 mb-2">Identified by: {userDataProfile.identified_by.join(', ') || 'unknown'}</p>
              <div className="flex gap-2">
                <Button 
                  size="sm"
                  onClick={() => repairLinksMutation.mutate(userDataProfile.user_email)}
                  disabled={repairLinksMutation.isPending}
                  className="text-xs h-7"
                >
                  {repairLinksMutation.isPending ? 'Repairing...' : 'Repair Data Links'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* User List */}
      <div className="space-y-2">
        {loadingUsers ? (
          <div className="text-center py-8 text-slate-500 text-sm">Loading users...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">No users found.</div>
        ) : (
          filtered.map(u => (
            <UserRow key={u.id} user={u}
              identities={identities} goals={goals}
              connections={connections} kycs={kycs}
              onAudit={(email) => {
                setAuditUser(email);
                auditMutation.mutate(email);
              }} />
          ))
        )}
      </div>
    </div>
  );
}