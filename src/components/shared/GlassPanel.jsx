import React from 'react';

export default function GlassPanel({ children, className = '', accentColor = '#00e8ff', title, titleIcon: Icon }) {
  return (
    <div
      className={`relative rounded-2xl overflow-hidden ${className}`}
      style={{
        background: 'rgba(10,15,42,0.65)',
        border: `1px solid ${accentColor}25`,
        backdropFilter: 'blur(24px)',
        boxShadow: `0 0 40px rgba(0,0,0,0.4), inset 0 0 40px rgba(0,0,0,0.1)`,
      }}
    >
      {/* Top line accent */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{
        background: `linear-gradient(90deg, transparent, ${accentColor}60, transparent)`,
      }} />

      {title && (
        <div className="px-5 py-3 border-b" style={{ borderColor: `${accentColor}15` }}>
          <div className="flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4" style={{ color: accentColor }} />}
            <span className="text-xs font-orbitron tracking-widest" style={{ color: `${accentColor}cc` }}>
              {title}
            </span>
          </div>
        </div>
      )}

      <div className="p-5">{children}</div>
    </div>
  );
}