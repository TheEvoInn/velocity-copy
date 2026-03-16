import React from 'react';
import { Card } from '@/components/ui/card';
import { CheckCircle2, AlertCircle, Lock, Key, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CredentialSystemGuide() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Lock className="w-8 h-8 text-emerald-400" />
          Centralized Credential Management System
        </h1>
        <p className="text-slate-400">Complete guide to secure, automatic credential handling across all modules</p>
      </div>

      {/* System Architecture */}
      <Card className="bg-gradient-to-r from-emerald-950/40 to-slate-900/40 border-emerald-900/30 p-6">
        <h2 className="text-xl font-semibold text-white mb-4">System Architecture</h2>
        <div className="space-y-4">
          <div className="flex gap-4">
            <Lock className="w-5 h-5 text-emerald-400 mt-1 shrink-0" />
            <div>
              <h3 className="font-semibold text-white">credentialInterceptor.js</h3>
              <p className="text-sm text-slate-400 mt-1">
                Intercepts all credential creation events from modules (account creation, OAuth, password generation, API key generation, etc.) and routes them to secretManager for storage.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <Key className="w-5 h-5 text-blue-400 mt-1 shrink-0" />
            <div>
              <h3 className="font-semibold text-white">secretManager.js</h3>
              <p className="text-sm text-slate-400 mt-1">
                Core credential management engine. Handles encryption, storage in Apps Secrets, audit logging, rotation, and replacement of all credentials with full metadata and identity linking.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <RefreshCw className="w-5 h-5 text-purple-400 mt-1 shrink-0" />
            <div>
              <h3 className="font-semibold text-white">moduleCredentialAdapter.js</h3>
              <p className="text-sm text-slate-400 mt-1">
                Provides seamless credential retrieval to Autopilot, Agent Worker, and other modules. Modules request credentials at runtime instead of storing them, ensuring freshness and security.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Credential Lifecycle */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Credential Lifecycle</h2>
        <div className="space-y-3">
          {[
            {
              phase: 'Detection',
              desc: 'Credential created by account creation engine, OAuth flow, Identity Manager, or user input',
              icon: '📍'
            },
            {
              phase: 'Interception',
              desc: 'credentialInterceptor catches the credential event before it can leak into memory',
              icon: '🔍'
            },
            {
              phase: 'Encryption',
              desc: 'Credential encrypted with AES-256-GCM encryption algorithm',
              icon: '🔐'
            },
            {
              phase: 'Storage',
              desc: 'Encrypted credential stored in Apps Secrets tab with full metadata (identity, platform, expiration, rotation frequency)',
              icon: '💾'
            },
            {
              phase: 'Metadata Link',
              desc: 'SecretAuditLog entry created with searchable metadata for identity, module, task context',
              icon: '📝'
            },
            {
              phase: 'Retrieval',
              desc: 'When module needs credential, it calls moduleCredentialAdapter with identity + platform',
              icon: '📤'
            },
            {
              phase: 'Usage',
              desc: 'Credential used only for task duration, never stored in module memory',
              icon: '⚡'
            },
            {
              phase: 'Discard',
              desc: 'After use, credential reference is discarded. Access logged in audit trail',
              icon: '🗑️'
            },
            {
              phase: 'Rotation',
              desc: 'On schedule, failure, or expiration, credential is rotated and new version stored',
              icon: '🔄'
            }
          ].map((step, idx) => (
            <Card key={idx} className="bg-slate-900/50 border-slate-800 p-4 flex gap-4">
              <div className="text-2xl shrink-0">{step.icon}</div>
              <div className="flex-1">
                <p className="font-semibold text-white">{step.phase}</p>
                <p className="text-sm text-slate-400 mt-1">{step.desc}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Supported Credential Types */}
      <Card className="bg-slate-900/50 border-slate-800 p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Supported Credential Types</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {[
            'password',
            'api_key',
            'oauth_token',
            'access_token',
            'refresh_token',
            'bearer_token',
            'jwt_token',
            'session_cookie',
            'email_password',
            'verification_code',
            'backup_codes',
            'webhook_secret'
          ].map((type, idx) => (
            <div key={idx} className="bg-slate-800/50 rounded-lg px-3 py-2 text-xs text-slate-300 border border-slate-700">
              {type}
            </div>
          ))}
        </div>
      </Card>

      {/* Module Integration Points */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Module Integration Points</h2>
        <div className="space-y-4">
          {[
            {
              module: 'Identity Manager',
              action: 'Creates AI persona emails and recovery codes',
              interception: 'credentialInterceptor.onEmailCreated',
              stores: ['email_password', 'recovery_email', 'backup_codes']
            },
            {
              module: 'Account Creation Engine',
              action: 'Auto-creates platform accounts',
              interception: 'credentialInterceptor.onAccountCreated',
              stores: ['username', 'password']
            },
            {
              module: 'OAuth Flow Handler',
              action: 'Receives OAuth tokens from services',
              interception: 'credentialInterceptor.onOAuthTokenReceived',
              stores: ['access_token', 'refresh_token']
            },
            {
              module: 'Agent Worker',
              action: 'Requests credentials for form filling',
              adapter: 'moduleCredentialAdapter.getCredentialForIdentityAndPlatform',
              retrieves: 'Credentials for executing task, discards after'
            },
            {
              module: 'Autopilot Orchestrator',
              action: 'Initiates workflows requiring credentials',
              adapter: 'moduleCredentialAdapter.requestWithAutoRotation',
              retrieves: 'Auto-rotates if expired, retries task'
            },
            {
              module: 'Prize Module',
              action: 'Registers for contests, raffles, giveaways',
              interception: 'credentialInterceptor.onSessionEstablished',
              stores: ['session_cookie', 'session_token', 'verification_code']
            }
          ].map((integration, idx) => (
            <Card key={idx} className="bg-slate-900/50 border-slate-800 p-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                {integration.module}
                <span className="text-xs text-emerald-400 bg-emerald-950/30 px-2 py-1 rounded">Auto</span>
              </h3>
              <p className="text-sm text-slate-400 mt-2">{integration.action}</p>
              
              {integration.interception && (
                <div className="mt-3 bg-emerald-950/20 border border-emerald-900/30 rounded p-2">
                  <p className="text-xs text-emerald-400 font-mono">{integration.interception}</p>
                  <p className="text-xs text-slate-400 mt-1">Stores: {integration.stores?.join(', ')}</p>
                </div>
              )}

              {integration.adapter && (
                <div className="mt-3 bg-blue-950/20 border border-blue-900/30 rounded p-2">
                  <p className="text-xs text-blue-400 font-mono">{integration.adapter}</p>
                  <p className="text-xs text-slate-400 mt-1">{integration.retrieves}</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Key Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-emerald-950/20 border-emerald-900/30 p-4">
          <h3 className="font-semibold text-emerald-400 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            Security Features
          </h3>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>✓ AES-256-GCM encryption</li>
            <li>✓ Zero plaintext in memory</li>
            <li>✓ Identity-based isolation</li>
            <li>✓ Automatic key rotation</li>
            <li>✓ Failure detection & recovery</li>
            <li>✓ Immutable audit logs</li>
          </ul>
        </Card>

        <Card className="bg-blue-950/20 border-blue-900/30 p-4">
          <h3 className="font-semibold text-blue-400 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            Operational Features
          </h3>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>✓ Central credential source</li>
            <li>✓ Real-time availability</li>
            <li>✓ Instant identity switching</li>
            <li>✓ Auto-rotation on schedule</li>
            <li>✓ Zero-downtime credential swap</li>
            <li>✓ Comprehensive audit trail</li>
          </ul>
        </Card>
      </div>

      {/* Admin Tasks */}
      <Card className="bg-slate-900/50 border-slate-800 p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Administrator Tasks</h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-emerald-400 font-semibold mt-1">→</span>
            <div>
              <p className="font-semibold text-white">Add User Credential</p>
              <p className="text-sm text-slate-400">
                Go to Security Dashboard → Select Identity → Click "Add New Credential" → 
                Enter platform, type, and credential value. System encrypts and stores automatically.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-emerald-400 font-semibold mt-1">→</span>
            <div>
              <p className="font-semibold text-white">Replace Expired/Failed Credential</p>
              <p className="text-sm text-slate-400">
                Go to Security Dashboard → Active Credentials list → Click Refresh icon on credential → 
                System marks old as revoked, creates new audit log entry.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-emerald-400 font-semibold mt-1">→</span>
            <div>
              <p className="font-semibold text-white">Review Audit Logs</p>
              <p className="text-sm text-slate-400">
                Go to Security Dashboard → Credential Audit Log → View all credential events 
                (creation, access, rotation, failure) with full context.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-emerald-400 font-semibold mt-1">→</span>
            <div>
              <p className="font-semibold text-white">Monitor Expiring Credentials</p>
              <p className="text-sm text-slate-400">
                Security Dashboard shows "Expiring Soon" metric. System automatically alerts before expiration 
                and triggers rotation workflow.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Best Practices */}
      <Card className="bg-amber-950/20 border-amber-900/30 p-6">
        <h2 className="text-xl font-semibold text-amber-400 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Best Practices
        </h2>
        <ul className="space-y-2 text-sm text-slate-300">
          <li>• <span className="font-semibold">Never paste credentials outside the dashboard</span> - use the credential form</li>
          <li>• <span className="font-semibold">Enable rotation on critical platforms</span> - quarterly minimum for API keys</li>
          <li>• <span className="font-semibold">Monitor failed authentications</span> - indicates compromised credentials</li>
          <li>• <span className="font-semibold">Review audit logs weekly</span> - check for unauthorized access</li>
          <li>• <span className="font-semibold">Rotate after security incidents</span> - all credentials immediately replaced</li>
          <li>• <span className="font-semibold">Never share credential IDs</span> - audit logs have access context</li>
        </ul>
      </Card>

      {/* Troubleshooting */}
      <Card className="bg-slate-900/50 border-slate-800 p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Troubleshooting</h2>
        <div className="space-y-4">
          {[
            {
              issue: 'Agent Worker says "No credential found"',
              cause: 'Credential not stored for this identity+platform combination',
              solution: 'Add credential via Security Dashboard for the identity'
            },
            {
              issue: 'Autopilot auto-rotation failing',
              cause: 'New credential generation failed or invalid format',
              solution: 'Check module logs, manually provide new credential via dashboard'
            },
            {
              issue: 'Task fails with "401 Unauthorized"',
              cause: 'Credential expired or marked as failed',
              solution: 'Replace credential immediately via Security Dashboard'
            },
            {
              issue: 'Credential access taking too long',
              cause: 'Apps Secrets tab performance issue',
              solution: 'Check Apps Secrets tab, clean up old expired credentials'
            }
          ].map((item, idx) => (
            <div key={idx} className="border border-slate-700 rounded-lg p-3">
              <p className="font-semibold text-white">❌ {item.issue}</p>
              <p className="text-sm text-slate-400 mt-1">Cause: {item.cause}</p>
              <p className="text-sm text-emerald-400 mt-2">✓ Solution: {item.solution}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Quick Links */}
      <div className="flex justify-center gap-3">
        <Link
          to="/SecurityDashboard"
          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors"
        >
          Go to Security Dashboard
        </Link>
        <Link
          to="/IdentityManagerExpanded"
          className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold transition-colors border border-slate-700"
        >
          Identity Manager
        </Link>
      </div>
    </div>
  );
}