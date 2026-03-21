import React, { useState } from 'react';
import { Lightbulb, TrendingUp, AlertCircle, Target, Zap } from 'lucide-react';

export default function AIInsightsPanel() {
  const [activeTab, setActiveTab] = useState('recommendations');

  const insights = {
    recommendations: [
      {
        icon: '⚡',
        title: 'High-Value Opportunity Detected',
        description: 'Freelance project with 4x expected ROI matching your skills',
        action: 'Review Now',
        actionColor: 'text-emerald-400',
      },
      {
        icon: '📈',
        title: 'Optimize Autopilot Settings',
        description: 'Increase max concurrent tasks from 3 to 5 for 40% faster execution',
        action: 'Configure',
        actionColor: 'text-cyan-400',
      },
      {
        icon: '🎯',
        title: 'Market Intelligence Alert',
        description: 'Crypto arbitrage opportunity available on 3 exchanges',
        action: 'Explore',
        actionColor: 'text-purple-400',
      },
    ],
    risks: [
      {
        icon: '⚠️',
        title: 'Task Success Rate Below Threshold',
        description: 'Last 5 tasks had 60% success rate. Review identity credentials.',
        severity: 'high',
      },
      {
        icon: '🔒',
        title: 'Missing KYC Verification',
        description: 'Some opportunities require enhanced identity verification',
        severity: 'medium',
      },
    ],
  };

  return (
    <div className="glass-card rounded-2xl p-4 border border-purple-500/20">
      <h3 className="font-orbitron text-sm font-bold text-purple-300 tracking-widest flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
        AI INTELLIGENCE HUB
      </h3>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-slate-700/50">
        {['recommendations', 'risks'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-xs font-mono transition-colors ${
              activeTab === tab
                ? 'text-purple-400 border-b-2 border-purple-500'
                : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            {tab === 'recommendations' ? 'Recommendations' : 'Risk Alerts'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-2">
        {activeTab === 'recommendations' ? (
          insights.recommendations.map((insight, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 hover:border-purple-500/40 transition-all group cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <span className="text-lg shrink-0 group-hover:scale-110 transition-transform">{insight.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white mb-1">{insight.title}</p>
                  <p className="text-xs text-slate-400 mb-2">{insight.description}</p>
                  <button className={`text-xs font-mono ${insight.actionColor} hover:opacity-80 transition-opacity`}>
                    {insight.action} →
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          insights.risks.map((risk, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border transition-all ${
                risk.severity === 'high'
                  ? 'bg-red-500/10 border-red-500/20 hover:border-red-500/40'
                  : 'bg-amber-500/10 border-amber-500/20 hover:border-amber-500/40'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-lg shrink-0">{risk.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white mb-1">{risk.title}</p>
                  <p className="text-xs text-slate-400">{risk.description}</p>
                  <span
                    className={`inline-block mt-2 text-xs px-2 py-1 rounded font-mono ${
                      risk.severity === 'high'
                        ? 'bg-red-500/20 text-red-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {risk.severity.toUpperCase()} SEVERITY
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}