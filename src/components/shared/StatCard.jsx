import React from 'react';

export default function StatCard({ label, value, subtext, color = '#00e8ff', icon: Icon, pulse }) {
  return (
    <div
      className="relative rounded-2xl p-4 overflow-hidden"
      style={{
        background: `rgba(10,15,42,0.7)`,
        border: `1px solid ${color}30`,
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Glow background */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
        background: `radial-gradient(ellipse at top left, ${color}, transparent 70%)`,
      }} />

      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-orbitron tracking-widest" style={{ color: `${color}99` }}>
            {label}
          </span>
          {Icon && (
            <Icon className="w-4 h-4" style={{ color }} />
          )}
        </div>
        <div
          className="text-2xl font-orbitron font-bold"
          style={{
            color,
            textShadow: `0 0 12px ${color}60`,
          }}
        >
          {value}
          {pulse && (
            <span className="inline-block w-2 h-2 rounded-full ml-2 animate-pulse" style={{ background: color }} />
          )}
        </div>
        {subtext && (
          <div className="text-xs mt-1" style={{ color: '#64748b' }}>{subtext}</div>
        )}
      </div>
    </div>
  );
}