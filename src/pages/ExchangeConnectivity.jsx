import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Plug, Plus, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Clock,
  Trash2, Settings, Zap, Shield, Eye, EyeOff, ChevronRight, Activity, WifiOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import PlatformCredentialForm from '../components/exchange/PlatformCredentialForm';
import IntegrationSyncManager from '../components/integrations/IntegrationSyncManager';

// ── Platform catalog ───────────────────────────────────────────────────────────
export const PLATFORMS = [
  { id: 'ebay',       label: 'eBay',            icon: '🛒', color: '#e53e3e', category: 'marketplace', auth: 'api_key_secret', fields: [{ key: 'app_id', label: 'App ID' }, { key: 'cert_id', label: 'Cert ID' }, { key: 'dev_id', label: 'Dev ID (optional)', required: false }] },
  { id: 'etsy',       label: 'Etsy',            icon: '🧶', color: '#f6a623', category: 'marketplace', auth: 'api_key',        fields: [{ key: 'api_key', label: 'API Key (Keystring)' }] },
  { id: 'amazon',     label: 'Amazon Seller',   icon: '📦', color: '#ff9900', category: 'marketplace', auth: 'api_key_secret', fields: [{ key: 'seller_id', label: 'Seller ID' }, { key: 'access_key', label: 'Access Key' }, { key: 'secret_key', label: 'Secret Key', secret: true }] },
  { id: 'shopify',    label: 'Shopify',          icon: '🏪', color: '#96bf48', category: 'ecommerce',   auth: 'oauth_token',   fields: [{ key: 'shop_domain', label: 'Shop Domain (myshop.myshopify.com)' }, { key: 'access_token', label: 'Access Token', secret: true }] },
  { id: 'upwork',     label: 'Upwork',           icon: '💼', color: '#6fda44', category: 'freelance',   auth: 'api_key_secret', fields: [{ key: 'api_key', label: 'API Key' }, { key: 'api_secret', label: 'API Secret', secret: true }, { key: 'access_token', label: 'OAuth Access Token (optional)', required: false, secret: true }] },
  { id: 'fiverr',     label: 'Fiverr',           icon: '🎯', color: '#1dbf73', category: 'freelance',   auth: 'api_key',        fields: [{ key: 'api_key', label: 'API Key', secret: true }] },
  { id: 'freelancer', label: 'Freelancer.com',   icon: '🧑‍💻', color: '#29b2fe', category: 'freelance',  auth: 'api_key',        fields: [{ key: 'api_key', label: 'API Key', secret: true }] },
  { id: 'stripe',     label: 'Stripe',           icon: '💳', color: '#635bff', category: 'payments',   auth: 'api_key',        fields: [{ key: 'secret_key', label: 'Secret Key (sk_...)', secret: true }] },
  { id: 'paypal',     label: 'PayPal',           icon: '🅿️', color: '#003087', category: 'payments',   auth: 'api_key_secret', fields: [{ key: 'client_id', label: 'Client ID' }, { key: 'client_secret', label: 'Client Secret', secret: true }] },
  { id: 'guru',       label: 'Guru',             icon: '🏆', color: '#ea7f1e', category: 'freelance',   auth: 'api_key',        fields: [{ key: 'api_key', label: 'API Key', secret: true }] },
  { id: 'coinbase',   label: 'Coinbase',        icon: '₿', color: '#0052ff', category: 'crypto',      auth: 'api_key_secret', fields: [{ key: 'api_key', label: 'API Key', secret: true }, { key: 'api_secret', label: 'API Secret', secret: true }, { key: 'passphrase', label: 'Passphrase (optional)', required: false, secret: true }] },
  { id: 'kraken',     label: 'Kraken',          icon: '🐙', color: '#623bff', category: 'crypto',      auth: 'api_key_secret', fields: [{ key: 'api_key', label: 'API Key', secret: true }, { key: 'api_secret', label: 'API Secret', secret: true }] },
  { id: 'binance',    label: 'Binance',         icon: '📊', color: '#f3ba2f', category: 'crypto',      auth: 'api_key_secret', fields: [{ key: 'api_key', label: 'API Key', secret: true }, { key: 'api_secret', label: 'API Secret', secret: true }] },
  { id: 'other',      label: 'Custom Platform', icon: '⚙️', color: '#64748b', category: 'other',       auth: 'custom',        fields: [{ key: 'platform_url', label: 'API Base URL', placeholder: 'https://api.example.com' }, { key: 'username', label: 'Username' }, { key: 'password', label: 'Password', secret: true }, { key: 'api_key', label: 'API Key (optional)', required: false, secret: true }] },
];

const CATEGORIES = ['all', 'marketplace', 'freelance', 'ecommerce', 'payments'];

// ── Status UI helpers ─────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  connected:           { icon: CheckCircle2, color: 'text-emerald-400', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', label: 'Connected' },
  pending:             { icon: Clock,        color: 'text-amber-400',   bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', label: 'Pending' },
  invalid_credentials: { icon: XCircle,      color: 'text-red-400',     bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',  label: 'Invalid Creds' },
  expired_token:       { icon: AlertTriangle, color: 'text-orange-400', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)', label: 'Expired Token' },
  error:               { icon: AlertTriangle, color: 'text-red-400',    bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',  label: 'Error' },
  disconnected:        { icon: WifiOff,       color: 'text-slate-500',  bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.2)', label: 'Disconnected' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-orbitron tracking-wide ${cfg.color}`}
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}

// ── Connection Card ────────────────────────────────────────────────────────────
function ConnectionCard({ conn, platformMeta, onTest, onDelete, onToggleWorkflow, testing }) {
  const [expanded, setExpanded] = useState(false);
  const isConnected = conn.status === 'connected';

  return (
    <div className="glass-card rounded-2xl overflow-hidden transition-all duration-300"
      style={{ border: isConnected ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(124,58,237,0.15)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
          style={{ background: `${platformMeta?.color || '#7c3aed'}15`, border: `1px solid ${platformMeta?.color || '#7c3aed'}30` }}>
          {platformMeta?.icon || '🔌'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-orbitron text-xs font-bold text-white tracking-wide">{platformMeta?.label || conn.platform}</p>
            <StatusBadge status={conn.status} />
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {conn.account_username && <span className="text-[10px] text-slate-400">@{conn.account_username}</span>}
            {conn.api_key_hint && <span className="text-[10px] text-slate-600">key: ···{conn.api_key_hint}</span>}
            {conn.last_verified_at && (
              <span className="text-[10px] text-slate-600">
                verified {new Date(conn.last_verified_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="sm" variant="outline" disabled={testing}
            onClick={() => onTest(conn.id)}
            className="h-7 px-2.5 text-[10px] border-slate-700/60 text-slate-400 hover:text-white gap-1">
            {testing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            {testing ? '' : 'Test'}
          </Button>
          <button onClick={() => setExpanded(v => !v)}
            className="p-1.5 rounded-lg border border-slate-700/40 text-slate-500 hover:text-white transition-colors">
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(conn.id)}
            className="p-1.5 rounded-lg border border-red-500/20 text-red-500/60 hover:text-red-400 hover:border-red-500/40 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Error message */}
      {conn.verification_error && (
        <div className="mx-4 mb-3 px-3 py-2 rounded-lg text-[11px] text-red-300"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          ⚠ {conn.verification_error}
        </div>
      )}

      {/* Expanded: workflow toggles + scopes */}
      {expanded && (
        <div className="border-t border-slate-800/60 p-4 space-y-3">
          <p className="text-[10px] font-orbitron tracking-widest text-slate-500 mb-2">WORKFLOW SETTINGS</p>
          {[
            { key: 'autopilot_enabled', label: 'Autopilot Active', desc: 'AI uses this connection autonomously' },
            { key: 'opportunity_ingestion_enabled', label: 'Opportunity Ingestion', desc: 'Pull live opportunities from this platform' },
            { key: 'auto_apply_enabled', label: 'Auto-Apply', desc: 'Automatically submit applications/listings' },
          ].map(wf => (
            <div key={wf.key} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-slate-300">{wf.label}</p>
                <p className="text-[10px] text-slate-500">{wf.desc}</p>
              </div>
              <Switch
                checked={!!conn[wf.key]}
                disabled={!isConnected}
                onCheckedChange={v => onToggleWorkflow(conn.id, wf.key, v)}
              />
            </div>
          ))}
          {conn.scopes?.length > 0 && (
            <div className="pt-2 border-t border-slate-800/40">
              <p className="text-[10px] text-slate-500 mb-1.5">Verified Scopes</p>
              <div className="flex flex-wrap gap-1">
                {conn.scopes.map(s => (
                  <span key={s} className="text-[9px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ExchangeConnectivity() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editPlatform, setEditPlatform] = useState(null);
  const [testingIds, setTestingIds] = useState(new Set());
  const qc = useQueryClient();

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['platformConnections'],
    queryFn: () => base44.entities.PlatformConnection.list('-created_date', 100),
    initialData: [],
  });

  const connectedCount = connections.filter(c => c.status === 'connected').length;
  const errorCount = connections.filter(c => ['invalid_credentials', 'expired_token', 'error'].includes(c.status)).length;

  const filteredPlatforms = activeCategory === 'all'
    ? PLATFORMS
    : PLATFORMS.filter(p => p.category === activeCategory);

  const connectedPlatformIds = new Set(connections.map(c => c.platform));

  async function handleTest(connectionId) {
    setTestingIds(s => new Set(s).add(connectionId));
    try {
      await base44.functions.invoke('exchangeConnector', { action: 'test_connection', connection_id: connectionId });
      qc.invalidateQueries({ queryKey: ['platformConnections'] });
    } finally {
      setTestingIds(s => { const n = new Set(s); n.delete(connectionId); return n; });
    }
  }

  async function handleDelete(connectionId) {
    if (!confirm('Remove this connection? Credentials will be permanently deleted.')) return;
    await base44.functions.invoke('exchangeConnector', { action: 'delete_connection', connection_id: connectionId });
    qc.invalidateQueries({ queryKey: ['platformConnections'] });
  }

  async function handleToggleWorkflow(connectionId, field, value) {
    await base44.functions.invoke('exchangeConnector', { action: 'toggle_workflow', connection_id: connectionId, field, value });
    qc.invalidateQueries({ queryKey: ['platformConnections'] });
  }

  async function handleTestAll() {
    const pending = connections.filter(c => c.status !== 'connected');
    for (const c of pending) await handleTest(c.id);
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)', boxShadow: '0 0 20px rgba(124,58,237,0.3)' }}>
            <Plug className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="font-orbitron text-lg font-bold tracking-widest text-white">EXCHANGE CONNECTIVITY</h1>
            <p className="text-xs text-slate-500 tracking-wide mt-0.5">Secure multi-platform API hub · Real-time validation</p>
          </div>
        </div>
        <Button onClick={() => { setEditPlatform(null); setShowAddForm(true); }}
          className="btn-cosmic text-white text-xs h-9 gap-1.5 shrink-0">
          <Plus className="w-3.5 h-3.5" /> Connect Platform
        </Button>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Connected', value: connectedCount, color: '#10b981', icon: '✅' },
          { label: 'Configured', value: connections.length, color: '#7c3aed', icon: '🔗' },
          { label: 'Errors', value: errorCount, color: errorCount > 0 ? '#ef4444' : '#64748b', icon: '⚠️' },
        ].map(s => (
          <div key={s.label} className="glass-card rounded-2xl p-4 text-center"
            style={{ border: `1px solid ${s.color}25` }}>
            <p className="text-xl mb-1">{s.icon}</p>
            <p className="font-orbitron text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] text-slate-500 mt-0.5 tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Active connections ── */}
      {connections.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-orbitron text-xs tracking-widest text-slate-400">YOUR CONNECTIONS</h2>
            {connections.length > 1 && (
              <Button size="sm" variant="outline" onClick={handleTestAll}
                className="h-7 px-2.5 text-[10px] border-slate-700/60 text-slate-400 hover:text-white gap-1">
                <Activity className="w-3 h-3" /> Test All
              </Button>
            )}
          </div>
          <div className="space-y-3">
            {connections.map(conn => {
              const meta = PLATFORMS.find(p => p.id === conn.platform);
              return (
                <ConnectionCard
                  key={conn.id}
                  conn={conn}
                  platformMeta={meta}
                  onTest={handleTest}
                  onDelete={handleDelete}
                  onToggleWorkflow={handleToggleWorkflow}
                  testing={testingIds.has(conn.id)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Platform catalog ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-orbitron text-xs tracking-widest text-slate-400">AVAILABLE PLATFORMS</h2>
        </div>
        {/* Category filter */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className="px-3 py-1.5 rounded-xl text-[10px] font-orbitron tracking-wide whitespace-nowrap capitalize transition-all"
              style={{
                background: activeCategory === cat ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${activeCategory === cat ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.08)'}`,
                color: activeCategory === cat ? '#a78bfa' : '#64748b',
              }}>
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {filteredPlatforms.map(platform => {
            const isConnected = connectedPlatformIds.has(platform.id);
            const existingConn = connections.find(c => c.platform === platform.id);
            return (
              <button
                key={platform.id}
                onClick={() => {
                  setEditPlatform(platform);
                  setShowAddForm(true);
                }}
                className="relative flex flex-col items-center gap-2 p-3 rounded-xl transition-all text-center group"
                style={{
                  background: isConnected ? `${platform.color}10` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isConnected ? platform.color + '35' : 'rgba(255,255,255,0.08)'}`,
                  boxShadow: isConnected ? `0 0 16px ${platform.color}20` : 'none',
                }}
              >
                {isConnected && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400"
                    style={{ boxShadow: '0 0 6px #10b981' }} />
                )}
                <span className="text-2xl">{platform.icon}</span>
                <span className="text-[10px] font-medium text-slate-300 leading-tight">{platform.label}</span>
                {isConnected && existingConn && (
                  <StatusBadge status={existingConn.status} />
                )}
                {!isConnected && (
                  <span className="text-[9px] text-slate-600 group-hover:text-violet-400 transition-colors">+ Connect</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Security notice ── */}
      <div className="mt-6 p-4 rounded-2xl flex items-start gap-3"
        style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)' }}>
        <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-400 leading-relaxed">
          All credentials are <strong className="text-emerald-400">AES-256-GCM encrypted</strong> at rest and in transit.
          API keys are never displayed in full — only the last 4 characters are stored for reference.
          Each user's credentials are fully isolated with strict row-level security.
        </p>
      </div>

      {/* ── Sync Manager ── */}
      <div className="mt-8 pt-8 border-t border-slate-800/60">
        <h2 className="font-orbitron text-sm font-bold tracking-widest text-white mb-4">AUTOMATIC DATA SYNC</h2>
        <IntegrationSyncManager />
      </div>

      {/* ── Add / Edit modal ── */}
      {showAddForm && (
        <PlatformCredentialForm
          platform={editPlatform}
          platforms={PLATFORMS}
          existingConnections={connections}
          onClose={() => setShowAddForm(false)}
          onSaved={() => {
            setShowAddForm(false);
            qc.invalidateQueries({ queryKey: ['platformConnections'] });
          }}
        />
      )}
    </div>
  );
}