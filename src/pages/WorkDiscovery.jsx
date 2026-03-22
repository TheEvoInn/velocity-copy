/**
 * WORK DISCOVERY ENGINE
 * AI-powered internet scanner — finds gigs, tasks, micro-tasks, and hidden opportunities
 * Per-user isolated
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser, useUserOpportunities } from '@/hooks/useUserData';
import { useQueryClient } from '@tanstack/react-query';
import { Search, Globe, TrendingUp, Target, Zap, Filter, ExternalLink, RefreshCw, Sparkles } from 'lucide-react';

const CATEGORIES = ['all', 'writing', 'design', 'data_entry', 'research', 'coding', 'microtask', 'survey', 'testing', 'translation', 'other'];

const CATEGORY_COLORS = {
  writing: '#f9d65c', design: '#ff2ec4', data_entry: '#3b82f6', research: '#a855f7',
  coding: '#00e8ff', microtask: '#10b981', survey: '#f97316', testing: '#06b6d4',
  translation: '#8b5cf6', other: '#64748b', all: '#94a3b8',
};

function OppCard({ opp, onActivate }) {
  const color = CATEGORY_COLORS[opp.category] || '#64748b';
  return (
    <div className="rounded-2xl p-4 transition-all duration-200 group cursor-pointer"
      style={{ background: 'rgba(10,15,42,0.7)', border: `1px solid ${color}20`, backdropFilter: 'blur(12px)' }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = `${color}50`;
        e.currentTarget.style.boxShadow = `0 0 20px ${color}10`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = `${color}20`;
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full font-orbitron capitalize"
            style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>
            {opp.category}
          </span>
          {opp.online_only && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
              100% Online
            </span>
          )}
        </div>
        <div className="text-right">
          <div className="font-orbitron font-bold" style={{ color: '#10b981', textShadow: '0 0 8px rgba(16,185,129,0.4)' }}>
            ${opp.estimated_pay || '?'}
          </div>
          {opp.time_estimate_minutes && (
            <div className="text-xs text-slate-600">{opp.time_estimate_minutes}min</div>
          )}
        </div>
      </div>

      <h3 className="text-sm font-semibold text-white mb-1 leading-tight">{opp.title}</h3>
      {opp.platform && <p className="text-xs text-slate-500 mb-2">{opp.platform}</p>}
      {opp.description && <p className="text-xs text-slate-500 mb-3 line-clamp-2 leading-relaxed">{opp.description}</p>}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {opp.score && (
            <div className="text-xs flex items-center gap-1">
              <div className="w-12 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full" style={{ width: `${opp.score}%`, background: color }} />
              </div>
              <span style={{ color: `${color}99` }}>{opp.score}</span>
            </div>
          )}
          <span className="text-xs capitalize px-2 py-0.5 rounded-full"
            style={{
              background: opp.status === 'completed' ? 'rgba(16,185,129,0.1)' : opp.status === 'active' ? 'rgba(0,232,255,0.1)' : 'rgba(255,255,255,0.05)',
              color: opp.status === 'completed' ? '#10b981' : opp.status === 'active' ? '#00e8ff' : '#64748b',
            }}>
            {opp.status}
          </span>
        </div>
        {opp.status === 'discovered' && (
          <button onClick={() => onActivate(opp)}
            className="text-xs px-3 py-1 rounded-lg font-orbitron tracking-wide transition-all"
            style={{ background: `${color}15`, border: `1px solid ${color}30`, color }}>
            APPLY →
          </button>
        )}
      </div>
    </div>
  );
}

export default function WorkDiscovery() {
  const { data: user } = useCurrentUser();
  const { data: opportunities = [], refetch, isLoading } = useUserOpportunities();
  const qc = useQueryClient();

  const [isScanning, setIsScanning] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [scanLog, setScanLog] = useState([]);
  const [showLog, setShowLog] = useState(false);

  const filtered = categoryFilter === 'all'
    ? opportunities
    : opportunities.filter(o => o.category === categoryFilter);

  const stats = {
    total: opportunities.length,
    highScore: opportunities.filter(o => (o.score || 0) >= 70).length,
    potential: opportunities.reduce((s, o) => s + (o.estimated_pay || 0), 0),
    categories: [...new Set(opportunities.map(o => o.category).filter(Boolean))].length,
  };

  async function handleScan() {
    setIsScanning(true);
    setScanLog([]);
    const steps = [
      '🔍 Expanding search keywords...',
      '🌐 Searching Fiverr, Upwork, Freelancer...',
      '🤖 Scraping micro-task platforms...',
      '📊 Analyzing opportunity scores...',
      '🎯 Filtering online-only tasks...',
      '✅ Loading results to your feed...',
    ];
    for (const step of steps) {
      setScanLog(prev => [...prev, step]);
      await new Promise(r => setTimeout(r, 500));
    }
    try {
      await base44.functions.invoke('scanOpportunities', { action: 'scan', user_email: user?.email });
    } catch {}
    qc.invalidateQueries({ queryKey: ['opportunities'] });
    refetch();
    setIsScanning(false);
  }

  async function handleActivate(opp) {
    await base44.entities.WorkOpportunity.update(opp.id, { status: 'applying' });
    qc.invalidateQueries({ queryKey: ['opportunities'] });
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(249,214,92,0.1)', border: '1px solid rgba(249,214,92,0.3)' }}>
            <Search className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="font-orbitron text-xl font-bold text-white tracking-widest">WORK DISCOVERY</h1>
            <p className="text-xs text-slate-500 font-mono">AI-powered internet scanner — gigs, micro-tasks, and freelance opportunities</p>
          </div>
        </div>
        <button onClick={handleScan} disabled={isScanning}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-orbitron text-xs tracking-wide transition-all"
          style={{ background: 'linear-gradient(135deg, rgba(249,214,92,0.15), rgba(249,214,92,0.05))', border: '1px solid rgba(249,214,92,0.35)', color: '#f9d65c' }}>
          {isScanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {isScanning ? 'Scanning...' : 'AI Scan Now'}
        </button>
      </div>

      {/* Scan log */}
      {isScanning && scanLog.length > 0 && (
        <div className="mb-5 p-4 rounded-2xl" style={{ background: 'rgba(249,214,92,0.05)', border: '1px solid rgba(249,214,92,0.2)' }}>
          {scanLog.map((l, i) => (
            <div key={i} className="text-xs font-mono text-amber-400/80 mb-1">{l}</div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'FOUND', value: stats.total, color: '#f9d65c', icon: Search },
          { label: 'HIGH QUALITY', value: stats.highScore, color: '#10b981', icon: Target },
          { label: 'POTENTIAL ($)', value: `$${stats.potential.toFixed(0)}`, color: '#00e8ff', icon: TrendingUp },
          { label: 'CATEGORIES', value: stats.categories, color: '#a855f7', icon: Globe },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4" style={{ background: 'rgba(10,15,42,0.7)', border: `1px solid ${s.color}20` }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-orbitron tracking-widest" style={{ color: `${s.color}80` }}>{s.label}</span>
              <s.icon className="w-3.5 h-3.5" style={{ color: s.color }} />
            </div>
            <div className="text-2xl font-orbitron font-bold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5">
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setCategoryFilter(cat)}
            className="px-3 py-1.5 rounded-xl text-xs font-orbitron tracking-wide whitespace-nowrap transition-all capitalize"
            style={{
              background: categoryFilter === cat ? `${CATEGORY_COLORS[cat]}15` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${categoryFilter === cat ? `${CATEGORY_COLORS[cat]}40` : 'rgba(255,255,255,0.07)'}`,
              color: categoryFilter === cat ? CATEGORY_COLORS[cat] : '#64748b',
            }}>
            {cat}
          </button>
        ))}
      </div>

      {/* Opportunities Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Globe className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <p className="font-orbitron text-sm text-slate-600">No opportunities discovered yet</p>
          <p className="text-xs text-slate-700 mt-2">Click "AI Scan Now" to start scanning the internet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(opp => (
            <OppCard key={opp.id} opp={opp} onActivate={handleActivate} />
          ))}
        </div>
      )}
    </div>
  );
}