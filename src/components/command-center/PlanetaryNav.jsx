import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const PLANETS = [
  {
    path: '/Discovery',
    label: 'Observatory',
    emoji: '🔭',
    color: '#f59e0b',
    textColor: 'text-amber-400',
    glow: 'rgba(245,158,11,0.5)',
    description: 'Intelligence & Scanning',
    metric: 'active opportunities',
    value: 0,
  },
  {
    path: '/Execution',
    label: 'Command Deck',
    emoji: '🚀',
    color: '#3b82f6',
    textColor: 'text-blue-400',
    glow: 'rgba(59,130,246,0.5)',
    description: 'Automation & Tasks',
    metric: 'running tasks',
    value: 0,
  },
  {
    path: '/Finance',
    label: 'Treasury Station',
    emoji: '💎',
    color: '#10b981',
    textColor: 'text-emerald-400',
    glow: 'rgba(16,185,129,0.5)',
    description: 'Wallet & Compliance',
    metric: 'wallet balance',
    value: 0,
  },
  {
    path: '/Control',
    label: 'Core Hub',
    emoji: '⚙️',
    color: '#a855f7',
    textColor: 'text-purple-400',
    glow: 'rgba(168,85,247,0.5)',
    description: 'Identities & Settings',
    metric: 'active identities',
    value: 0,
  },
];

export default function PlanetaryNav({ stats = {} }) {
  const [hoveredPlanet, setHoveredPlanet] = useState(null);

  const planetsWithStats = PLANETS.map(planet => ({
    ...planet,
    value: stats[planet.label.replace(/\s+/g, '').toLowerCase()] || 0,
  }));

  return (
    <div className="relative">
      <h3 className="font-orbitron text-sm font-bold text-cyan-300 tracking-widest mb-4 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        DEPARTMENT MATRIX
      </h3>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {planetsWithStats.map((planet, idx) => (
          <Link key={planet.path} to={planet.path}>
            <div
              className="relative group cursor-pointer transition-all duration-300"
              onMouseEnter={() => setHoveredPlanet(idx)}
              onMouseLeave={() => setHoveredPlanet(null)}
              style={{
                transform: hoveredPlanet === idx ? 'scale(1.05) translateY(-4px)' : 'scale(1)',
              }}
            >
              {/* Glowing background on hover */}
              {hoveredPlanet === idx && (
                <div
                  className="absolute inset-0 rounded-2xl blur-xl -z-10 animate-pulse"
                  style={{
                    background: planet.glow,
                  }}
                />
              )}

              {/* Planet Card */}
              <div
                className="rounded-2xl p-4 border backdrop-blur-sm transition-all duration-300 overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${planet.color}12, ${planet.color}06, rgba(5,7,20,0.8))`,
                  border: hoveredPlanet === idx ? `2px solid ${planet.color}` : `1px solid ${planet.color}25`,
                  boxShadow: hoveredPlanet === idx ? `0 0 30px ${planet.glow}, inset 0 0 20px ${planet.glow.replace('0.5', '0.1')}` : 'none',
                }}
              >
                {/* Animated grid */}
                <div
                  className="absolute inset-0 opacity-5 transition-opacity duration-300"
                  style={{
                    backgroundImage: `radial-gradient(circle, ${planet.color} 1px, transparent 1px)`,
                    backgroundSize: '20px 20px',
                  }}
                />

                {/* Content */}
                <div className="relative z-10">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-transform duration-300"
                      style={{
                        background: `${planet.color}18`,
                        border: `1px solid ${planet.color}30`,
                        transform: hoveredPlanet === idx ? 'scale(1.1) rotate(12deg)' : 'scale(1)',
                      }}
                    >
                      {planet.emoji}
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 ${planet.textColor} transition-all duration-300 ${
                        hoveredPlanet === idx ? 'translate-x-1 opacity-100' : 'opacity-0'
                      }`}
                    />
                  </div>

                  {/* Title */}
                  <p className={`font-orbitron text-sm font-bold ${planet.textColor} mb-1 transition-all duration-300`}>
                    {planet.label}
                  </p>

                  {/* Stats */}
                  {planet.value !== undefined && (
                    <p className="text-lg font-bold text-white mb-2">
                      {typeof planet.value === 'number' && planet.value.toFixed(0) || planet.value}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 mb-3">{planet.metric}</p>

                  {/* Description */}
                  <div className="pt-2.5 border-t" style={{ borderColor: planet.color + '20' }}>
                    <p className={`text-xs font-orbitron font-semibold tracking-wide ${planet.textColor}`}>
                      {planet.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}