import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Zap, Target, ChevronRight, AlertCircle } from 'lucide-react';

export default function RealtimeOpportunitiesViewer({ opportunities = [] }) {
  const [expandedId, setExpandedId] = useState(null);

  const topOpps = opportunities
    .sort((a, b) => (b.profit_estimate_high || 0) - (a.profit_estimate_high || 0))
    .slice(0, 8);

  const getCategoryColor = (category) => {
    const colors = {
      freelance: 'text-blue-400 bg-blue-500/10',
      arbitrage: 'text-emerald-400 bg-emerald-500/10',
      lead_gen: 'text-purple-400 bg-purple-500/10',
      digital_flip: 'text-pink-400 bg-pink-500/10',
      auction: 'text-amber-400 bg-amber-500/10',
      default: 'text-slate-400 bg-slate-500/10',
    };
    return colors[category] || colors.default;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'new': return '⭐';
      case 'executing': return '🔥';
      case 'completed': return '✅';
      case 'failed': return '⚠️';
      default: return '◆';
    }
  };

  return (
    <div className="glass-card rounded-2xl p-4 border border-cyan-500/20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-orbitron text-sm font-bold text-cyan-300 tracking-widest flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          REALTIME OPPORTUNITIES
        </h3>
        <Link to="/Discovery" className="text-xs text-amber-400/70 hover:text-amber-400 transition-colors flex items-center gap-1">
          Full Scanner <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {topOpps.length === 0 ? (
        <div className="text-center py-8">
          <Target className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
          <p className="text-xs text-slate-500 mb-3">No opportunities detected</p>
          <Link to="/Discovery">
            <button className="text-xs text-amber-400 hover:text-amber-300 font-mono">
              INITIATE SCAN
            </button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {topOpps.map((opp) => (
            <div
              key={opp.id}
              className="relative group"
              onMouseEnter={() => setExpandedId(opp.id)}
              onMouseLeave={() => setExpandedId(null)}
            >
              {/* Glowing hover effect */}
              {expandedId === opp.id && (
                <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-amber-500/20 to-cyan-500/20 blur-sm -z-10" />
              )}

              {/* Main card */}
              <div className="p-3 rounded-lg border border-slate-700/50 bg-slate-800/40 transition-all duration-300 hover:border-slate-600 cursor-pointer">
                <div className="flex items-start gap-3">
                  {/* Status icon */}
                  <div className="text-lg shrink-0 pt-0.5">{getStatusIcon(opp.status)}</div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-xs font-semibold text-white truncate">{opp.title}</p>
                      <span className="text-xs text-emerald-400 font-bold shrink-0">
                        ${opp.profit_estimate_high || 0}
                      </span>
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${getCategoryColor(opp.category)}`}>
                        {opp.category}
                      </span>
                      {opp.platform && (
                        <span className="text-xs text-slate-500">{opp.platform}</span>
                      )}
                      {opp.time_sensitivity && (
                        <span className="text-xs text-amber-400 flex items-center gap-1">
                          <Zap className="w-2.5 h-2.5" />
                          {opp.time_sensitivity}
                        </span>
                      )}
                    </div>

                    {/* Expanded view */}
                    {expandedId === opp.id && (
                      <div className="pt-2 border-t border-slate-700/30 space-y-1 text-xs text-slate-400">
                        {opp.description && (
                          <p className="line-clamp-2">{opp.description}</p>
                        )}
                        {opp.profit_estimate_low && (
                          <p>Est. Range: ${opp.profit_estimate_low} - ${opp.profit_estimate_high}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Activity pulse */}
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    opp.status === 'executing' ? 'bg-blue-500 animate-pulse' :
                    opp.status === 'completed' ? 'bg-emerald-500' :
                    opp.status === 'failed' ? 'bg-red-500' :
                    'bg-amber-500'
                  }`} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}