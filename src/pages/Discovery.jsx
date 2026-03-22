/**
 * DISCOVERY — Per-user isolated opportunity scanning + AI discovery
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser, useUserOpportunities } from '@/hooks/useUserData';
import { useQueryClient } from '@tanstack/react-query';
import { Search, TrendingUp, Target, Globe, Sparkles, RefreshCw, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const CAT_COLORS = {
  arbitrage: '#f9d65c', service: '#00e8ff', lead_gen: '#a855f7',
  digital_flip: '#ff2ec4', freelance: '#10b981', other: '#64748b',
  writing: '#f9d65c', design: '#ff2ec4', coding: '#00e8ff',
  research: '#a855f7', microtask: '#10b981', survey: '#f97316',
};

function OppCard({ opp }) {
  const color = CAT_COLORS[opp.category] || '#64748b';
  const pay = opp.estimated_pay || opp.profit_estimate_high || 0;
  return (
    <div className="rounded-2xl p-4 transition-all duration-200"
      style={{ background: 'rgba(10,15,42,0.7)', border: `1px solid ${color}20` }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}50`; e.currentTarget.style.boxShadow = `0 0 16px ${color}10`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = `${color}20`; e.currentTarget.style.boxShadow = 'none'; }}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs px-2 py-0.5 rounded-full font-orbitron capitalize"
          style={{ background: `${color}12`, color, border: `1px solid ${color}25` }}>
          {opp.category || 'other'}
        </span>
        <span className="font-orbitron font-bold text-sm" style={{ color: '#10b981' }}>
          ${pay > 0 ? pay.toFixed(0) : '?'}
        </span>
      </div>
      <div className="text-sm font-semibold text-white mb-1 leading-tight line-clamp-2">{opp.title}</div>
      {opp.platform && <div className="text-xs text-slate-500 mb-2">{opp.platform}</div>}
      <div className="flex items-center justify-between mt-2">
        {opp.score && (
          <div className="flex items-center gap-1.5">
            <div className="w-10 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full" style={{ width: `${opp.score}%`, background: color }} />
            </div>
            <span className="text-xs" style={{ color: `${color}90` }}>{opp.score}</span>
          </div>
        )}
        <span className="text-xs capitalize px-2 py-0.5 rounded-full"
          style={{
            background: opp.status === 'completed' ? 'rgba(16,185,129,0.1)' : opp.status === 'active' ? 'rgba(0,232,255,0.1)' : 'rgba(255,255,255,0.04)',
            color: opp.status === 'completed' ? '#10b981' : opp.status === 'active' ? '#00e8ff' : '#64748b',
          }}>
          {opp.status}
        </span>
      </div>
    </div>
  );
}

export default function Discovery() {
  const { data: user } = useCurrentUser();
  const { data: opportunities = [], refetch, isLoading } = useUserOpportunities();
  const qc = useQueryClient();
  const [isScanning, setIsScanning] = useState(false);
  const [scanLog, setScanLog] = useState([]);
  const [catFilter, setCatFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('opportunities');

  const allCats = ['all', ...new Set(opportunities.map(o => o.category).filter(Boolean))];
  const filtered = catFilter === 'all' ? opportunities : opportunities.filter(o => o.category === catFilter);
  const topScored = [...opportunities].sort((a, b) => (b.score || b.overall_score || 0) - (a.score || a.overall_score || 0));
  const totalPotential = opportunities.reduce((s, o) => s + (o.estimated_pay || o.profit_estimate_high || 0), 0);
  const highQuality = opportunities.filter(o => (o.score || o.overall_score || 0) >= 60).length;

  async function handleScan() {
    setIsScanning(true);
    setScanLog([]);
    const steps = [
      '🔍 Expanding search across platforms...',
      '🌐 Scanning Fiverr, Upwork, freelance boards...',
      '🤖 AI scoring all opportunities...',
      '🎯 Filtering highest yield tasks...',
      '✅ Loaded to your feed!',
    ];
    for (const step of steps) {
      setScanLog(p => [...p, step]);
      await new Promise(r => setTimeout(r, 400));
    }
    try {
      await base44.functions.invoke('scanOpportunities', { action: 'scan', user_email: user?.email });
    } catch {}
    qc.invalidateQueries({ queryKey: ['opportunities'] });
    refetch();
    setIsScanning(false);
  }

  async function handleAIDiscover() {
    setIsScanning(true);
    setScanLog([]);
    const steps = [
      '🤖 AI Discovery Engine activating...',
      '📡 Scanning digital resale niches...',
      '💎 Identifying high-yield opportunities...',
      '📊 Ranking by profit potential...',
      '✅ AI discoveries loaded!',
    ];
    for (const step of steps) {
      setScanLog(p => [...p, step]);
      await new Promise(r => setTimeout(r, 500));
    }
    try {
      await base44.functions.invoke('aiDiscoveryEngine', { action: 'get_all_discoveries', user_email: user?.email });
    } catch {}
    qc.invalidateQueries({ queryKey: ['opportunities'] });
    refetch();
    setIsScanning(false);
  }

  const TABS = [
    { key: 'opportunities', label: 'All Opportunities' },
    { key: 'top', label: 'Top Ranked' },
  ];

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
            <h1 className="font-orbitron text-xl font-bold text-white tracking-widest">DISCOVERY</h1>
            <p className="text-xs text-slate-500 font-mono">AI-powered scanner · Per-user results</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleAIDiscover} disabled={isScanning}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-orbitron transition-all"
            style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7' }}>
            <Sparkles className="w-3.5 h-3.5" />
            AI Discover
          </button>
          <button onClick={handleScan} disabled={isScanning}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-orbitron transition-all"
            style={{ background: 'rgba(249,214,92,0.08)', border: '1px solid rgba(249,214,92,0.3)', color: '#f9d65c' }}>
            {isScanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            {isScanning ? 'Scanning...' : 'Scan Now'}
          </button>
        </div>
      </div>

      {/* Scan log */}
      {isScanning && scanLog.length > 0 && (
        <div className="mb-4 p-4 rounded-2xl" style={{ background: 'rgba(249,214,92,0.04)', border: '1px solid rgba(249,214,92,0.15)' }}>
          {scanLog.map((l, i) => <div key={i} className="text-xs font-mono text-amber-400/70 mb-0.5">{l}</div>)}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'FOUND', value: opportunities.length, color: '#f9d65c' },
          { label: 'HIGH QUALITY', value: highQuality, color: '#10b981' },
          { label: 'POTENTIAL', value: `$${totalPotential.toFixed(0)}`, color: '#00e8ff' },
          { label: 'CATEGORIES', value: allCats.length - 1, color: '#a855f7' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4"
            style={{ background: 'rgba(10,15,42,0.7)', border: `1px solid ${s.color}18` }}>
            <div className="text-xs font-orbitron tracking-widest mb-1" style={{ color: `${s.color}70` }}>{s.label}</div>
            <div className="text-2xl font-orbitron font-bold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-4">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 rounded-xl text-xs font-orbitron tracking-wide transition-all"
            style={{
              background: activeTab === tab.key ? 'rgba(249,214,92,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${activeTab === tab.key ? 'rgba(249,214,92,0.35)' : 'rgba(255,255,255,0.06)'}`,
              color: activeTab === tab.key ? '#f9d65c' : '#64748b',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Category filter */}
      {activeTab === 'opportunities' && (
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4">
          {allCats.map(cat => (
            <button key={cat} onClick={() => setCatFilter(cat)}
              className="px-3 py-1 rounded-xl text-xs font-orbitron capitalize whitespace-nowrap transition-all"
              style={{
                background: catFilter === cat ? `${CAT_COLORS[cat] || '#94a3b8'}15` : 'rgba(255,255,255,0.02)',
                border: `1px solid ${catFilter === cat ? `${CAT_COLORS[cat] || '#94a3b8'}40` : 'rgba(255,255,255,0.06)'}`,
                color: catFilter === cat ? (CAT_COLORS[cat] || '#94a3b8') : '#64748b',
              }}>
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeTab === 'opportunities' ? (
        filtered.length === 0 ? (
          <div className="text-center py-16">
            <Globe className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <p className="font-orbitron text-sm text-slate-600">No opportunities yet</p>
            <p className="text-xs text-slate-700 mt-2">Click Scan Now or AI Discover to begin</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map(opp => <OppCard key={opp.id} opp={opp} />)}
          </div>
        )
      ) : (
        topScored.length === 0 ? (
          <div className="text-center py-16">
            <TrendingUp className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <p className="font-orbitron text-sm text-slate-600">No ranked opportunities yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {topScored.slice(0, 20).map((opp, i) => {
              const color = CAT_COLORS[opp.category] || '#64748b';
              const score = opp.score || opp.overall_score || 0;
              const pay = opp.estimated_pay || opp.profit_estimate_high || 0;
              return (
                <div key={opp.id} className="flex items-center gap-4 p-3 rounded-2xl"
                  style={{ background: 'rgba(10,15,42,0.7)', border: `1px solid ${color}15` }}>
                  <div className="font-orbitron text-xl font-black w-8 text-center" style={{ color, opacity: 0.4 }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-semibold truncate">{opp.title}</div>
                    <div className="text-xs text-slate-500 capitalize">{opp.category} · {opp.platform || 'unknown'}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-orbitron font-bold text-sm" style={{ color: '#10b981' }}>${pay > 0 ? pay.toFixed(0) : '?'}</div>
                    <div className="text-xs" style={{ color: `${color}80` }}>score: {score}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}