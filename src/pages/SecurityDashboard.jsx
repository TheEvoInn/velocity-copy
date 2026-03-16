import React from 'react';
import { Card } from '@/components/ui/card';
import { Lock, Shield, Key, AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import CredentialManager from '@/components/security/CredentialManager';

export default function SecurityDashboard() {
  // Fetch security overview stats
  const { data: securityStats } = useQuery({
    queryKey: ['security_overview'],
    queryFn: async () => {
      const identities = await base44.entities.AIIdentity.list('-created_date', 100);
      const auditLogs = await base44.entities.SecretAuditLog.list('-created_date', 50);

      const totalSecrets = auditLogs?.filter(log => log.is_active)?.length || 0;
      const recentEvents = auditLogs?.slice(0, 10) || [];
      const failureCount = auditLogs?.filter(log => log.status === 'failed' || log.status === 'failed_auth')?.length || 0;
      const expiringCount = auditLogs?.filter(log => 
        log.expiration_date && 
        new Date(log.expiration_date) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      )?.length || 0;

      return {
        total_identities: identities?.length || 0,
        total_active_secrets: totalSecrets,
        recent_events: recentEvents,
        failed_authentications: failureCount,
        expiring_soon: expiringCount,
        security_score: calculateSecurityScore(totalSecrets, failureCount)
      };
    },
    refetchInterval: 30000
  });

  const calculateSecurityScore = (totalSecrets, failures) => {
    let score = 100;
    if (failures > 0) score -= failures * 5;
    if (totalSecrets === 0) score -= 10;
    return Math.max(0, Math.min(100, score));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Shield className="w-8 h-8 text-emerald-400" />
          Security & Credential Management
        </h1>
        <p className="text-slate-400">Centralized, encrypted credential storage with full audit logging</p>
      </div>

      {/* Security Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-950/40 to-slate-900/40 border-emerald-900/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-500">Security Score</p>
            <Shield className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-3xl font-bold text-emerald-400">
            {securityStats?.security_score || 0}%
          </p>
          <p className="text-xs text-slate-400 mt-2">
            {securityStats?.failed_authentications === 0 ? '✓ No failures' : `⚠ ${securityStats?.failed_authentications} failures`}
          </p>
        </Card>

        <Card className="bg-blue-950/20 border-blue-900/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-500">Active Credentials</p>
            <Key className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-blue-400">
            {securityStats?.total_active_secrets || 0}
          </p>
          <p className="text-xs text-slate-400 mt-2">Across {securityStats?.total_identities} identities</p>
        </Card>

        <Card className="bg-purple-950/20 border-purple-900/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-500">Expiring Soon</p>
            <AlertTriangle className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-3xl font-bold text-purple-400">
            {securityStats?.expiring_soon || 0}
          </p>
          <p className="text-xs text-slate-400 mt-2">Within 7 days</p>
        </Card>

        <Card className="bg-amber-950/20 border-amber-900/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-500">Audit Events</p>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-3xl font-bold text-amber-400">
            {securityStats?.recent_events?.length || 0}
          </p>
          <p className="text-xs text-slate-400 mt-2">Last 10 events</p>
        </Card>
      </div>

      {/* Key Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-900/50 border-slate-800 p-4">
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            Automatic Capture
          </h3>
          <ul className="space-y-1.5 text-xs text-slate-400">
            <li>✓ All credentials auto-detected</li>
            <li>✓ Instantly encrypted & stored</li>
            <li>✓ Zero plaintext exposure</li>
            <li>✓ Identity-linked tagging</li>
          </ul>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800 p-4">
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            Central Access
          </h3>
          <ul className="space-y-1.5 text-xs text-slate-400">
            <li>✓ Single source of truth</li>
            <li>✓ Real-time availability</li>
            <li>✓ Instant identity switching</li>
            <li>✓ No stale credentials</li>
          </ul>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800 p-4">
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            Auto Rotation
          </h3>
          <ul className="space-y-1.5 text-xs text-slate-400">
            <li>✓ Schedule-based rotation</li>
            <li>✓ Failure-triggered refresh</li>
            <li>✓ Expiration tracking</li>
            <li>✓ Zero downtime replacement</li>
          </ul>
        </Card>
      </div>

      {/* Credential Manager Section */}
      <Card className="bg-slate-900/50 border-slate-800 p-6">
        <CredentialManager />
      </Card>

      {/* How It Works */}
      <Card className="bg-slate-900/50 border-slate-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">How Credential Management Works</h3>
        
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-xs font-semibold text-emerald-400 shrink-0">1</div>
            <div>
              <h4 className="font-semibold text-white">Automatic Capture</h4>
              <p className="text-sm text-slate-400 mt-1">
                When Agent Worker creates accounts, Identity Manager generates credentials, or users provide secrets, 
                the system automatically detects and intercepts them.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-xs font-semibold text-emerald-400 shrink-0">2</div>
            <div>
              <h4 className="font-semibold text-white">Encryption & Storage</h4>
              <p className="text-sm text-slate-400 mt-1">
                Credentials are encrypted with AES-256-GCM and stored in the Apps Secrets tab with metadata 
                (identity, platform, expiration, rotation frequency).
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-xs font-semibold text-emerald-400 shrink-0">3</div>
            <div>
              <h4 className="font-semibold text-white">Central Retrieval</h4>
              <p className="text-sm text-slate-400 mt-1">
                Autopilot and Agent Worker request credentials from the module adapter instead of storing locally. 
                Credentials are used only for task duration, then discarded.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-xs font-semibold text-emerald-400 shrink-0">4</div>
            <div>
              <h4 className="font-semibold text-white">Automatic Rotation</h4>
              <p className="text-sm text-slate-400 mt-1">
                On expiration, failure, or user request, the system automatically rotates credentials and updates 
                all references. Autopilot continues without interruption.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-xs font-semibold text-emerald-400 shrink-0">5</div>
            <div>
              <h4 className="font-semibold text-white">Full Audit Logging</h4>
              <p className="text-sm text-slate-400 mt-1">
                Every credential event (creation, access, rotation, deletion) is logged immutably with context 
                (identity, module, task, timestamp, status).
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Integration Points */}
      <Card className="bg-slate-900/50 border-slate-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Module Integrations</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              name: 'Identity Manager',
              desc: 'Auto-stores generated emails, passwords, recovery codes',
              function: 'credentialInterceptor → onEmailCreated'
            },
            {
              name: 'Account Creation Engine',
              desc: 'Captures created usernames, passwords for each identity',
              function: 'credentialInterceptor → onAccountCreated'
            },
            {
              name: 'Agent Worker',
              desc: 'Retrieves credentials at runtime, discards after use',
              function: 'moduleCredentialAdapter → getCredentialForIdentityAndPlatform'
            },
            {
              name: 'Autopilot Orchestrator',
              desc: 'Requests credentials for task execution',
              function: 'moduleCredentialAdapter → requestWithAutoRotation'
            }
          ].map((integration, idx) => (
            <Card key={idx} className="bg-slate-800/50 border-slate-700 p-3">
              <p className="font-semibold text-white text-sm">{integration.name}</p>
              <p className="text-xs text-slate-400 mt-1">{integration.desc}</p>
              <p className="text-xs text-emerald-400 font-mono mt-2 bg-slate-900/50 px-2 py-1 rounded">
                {integration.function}
              </p>
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );
}