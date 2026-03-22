import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import CockpitScene from '@/components/bridge/CockpitScene';
import CockpitHUD from '@/components/bridge/CockpitHUD';

export default function StarshipBridge() {
  const navigate = useNavigate();
  const [hoveredModule, setHoveredModule] = useState(null);
  const [warpActive, setWarpActive] = useState(false);
  const [warpTarget, setWarpTarget] = useState('');

  const handleModuleSelect = useCallback((route, name) => {
    if (warpActive) return;
    setWarpTarget(name || route);
    setWarpActive(true);
    setTimeout(() => {
      navigate(route);
    }, 600);
  }, [navigate, warpActive]);

  const handleHover = useCallback((name) => {
    setHoveredModule(name);
  }, []);

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative select-none">
      {/* 3D Scene layer */}
      <CockpitScene
        onModuleSelect={handleModuleSelect}
        onHover={handleHover}
      />

      {/* HUD overlay */}
      <CockpitHUD hoveredModule={hoveredModule} onNavigate={handleModuleSelect} />

      {/* Warp speed transition overlay */}
      {warpActive && (
        <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 animate-pulse" style={{
            background: 'radial-gradient(ellipse at center, rgba(0,232,255,0.15) 0%, transparent 70%)',
          }} />
          {/* Warp lines */}
          <svg className="absolute inset-0 w-full h-full opacity-60" style={{ animation: 'warp-jump 0.6s ease-in forwards' }}>
            {Array.from({ length: 40 }).map((_, i) => {
              const angle = (i / 40) * Math.PI * 2;
              const cx = 50, cy = 50;
              const r1 = 2 + Math.random() * 3, r2 = 80 + Math.random() * 20;
              const x1 = cx + Math.cos(angle) * r1, y1 = cy + Math.sin(angle) * r1;
              const x2 = cx + Math.cos(angle) * r2, y2 = cy + Math.sin(angle) * r2;
              const colors = ['#00e8ff','#ff2ec4','#f9d65c','#a855f7'];
              return (
                <line key={i}
                  x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}
                  stroke={colors[i % colors.length]} strokeWidth="1.5"
                  strokeOpacity={0.4 + Math.random() * 0.5}
                />
              );
            })}
          </svg>
          <div className="text-center z-10">
            <div className="font-orbitron text-lg text-cyan-400 tracking-[0.3em] mb-2 animate-pulse">
              WARPING TO
            </div>
            <div className="font-orbitron text-2xl text-white tracking-widest">
              {warpTarget.toUpperCase()}
            </div>
          </div>
          <div className="absolute inset-0 bg-white/5" style={{ animation: 'warp-jump 0.6s ease-in forwards' }} />
        </div>
      )}

      {/* Targeting reticle (center of screen, subtle) */}
      {!warpActive && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none opacity-30">
          <svg width="40" height="40" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="18" fill="none" stroke="#00e8ff" strokeWidth="0.5" strokeDasharray="4 4" />
            <line x1="20" y1="2" x2="20" y2="8" stroke="#00e8ff" strokeWidth="1" />
            <line x1="20" y1="32" x2="20" y2="38" stroke="#00e8ff" strokeWidth="1" />
            <line x1="2" y1="20" x2="8" y2="20" stroke="#00e8ff" strokeWidth="1" />
            <line x1="32" y1="20" x2="38" y2="20" stroke="#00e8ff" strokeWidth="1" />
            <circle cx="20" cy="20" r="2" fill="#00e8ff" opacity="0.5" />
          </svg>
        </div>
      )}

      {/* Corner decorations */}
      <div className="absolute top-0 left-0 w-24 h-24 z-10 pointer-events-none">
        <svg width="96" height="96" viewBox="0 0 96 96" fill="none">
          <path d="M0 0 L48 0 L48 4 L4 4 L4 48 L0 48 Z" fill="#00e8ff" opacity="0.3" />
          <path d="M8 8 L32 8 L32 10 L10 10 L10 32 L8 32 Z" fill="#00e8ff" opacity="0.2" />
        </svg>
      </div>
      <div className="absolute top-0 right-0 w-24 h-24 z-10 pointer-events-none" style={{ transform: 'scaleX(-1)' }}>
        <svg width="96" height="96" viewBox="0 0 96 96" fill="none">
          <path d="M0 0 L48 0 L48 4 L4 4 L4 48 L0 48 Z" fill="#ff2ec4" opacity="0.3" />
          <path d="M8 8 L32 8 L32 10 L10 10 L10 32 L8 32 Z" fill="#ff2ec4" opacity="0.2" />
        </svg>
      </div>
      <div className="absolute bottom-12 left-0 w-24 h-24 z-10 pointer-events-none" style={{ transform: 'scaleY(-1)' }}>
        <svg width="96" height="96" viewBox="0 0 96 96" fill="none">
          <path d="M0 0 L48 0 L48 4 L4 4 L4 48 L0 48 Z" fill="#f9d65c" opacity="0.25" />
        </svg>
      </div>
      <div className="absolute bottom-12 right-0 w-24 h-24 z-10 pointer-events-none" style={{ transform: 'scale(-1,-1)' }}>
        <svg width="96" height="96" viewBox="0 0 96 96" fill="none">
          <path d="M0 0 L48 0 L48 4 L4 4 L4 48 L0 48 Z" fill="#a855f7" opacity="0.25" />
        </svg>
      </div>
    </div>
  );
}