import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const DEPARTMENTS = [
  {
    path: '/Discovery',
    icon: '🔭',
    label: 'Observatory',
    subtitle: 'Intelligence & Scanning',
    color: '#f59e0b',
    textColor: 'text-amber-400',
    glow: 'rgba(245,158,11,0.4)',
    name: 'discovery'
  },
  {
    path: '/Execution',
    icon: '🚀',
    label: 'Command Deck',
    subtitle: 'Automation & Tasks',
    color: '#3b82f6',
    textColor: 'text-blue-400',
    glow: 'rgba(59,130,246,0.4)',
    name: 'execution'
  },
  {
    path: '/Finance',
    icon: '💎',
    label: 'Treasury Station',
    subtitle: 'Wallet & Compliance',
    color: '#10b981',
    textColor: 'text-emerald-400',
    glow: 'rgba(16,185,129,0.4)',
    name: 'finance'
  },
  {
    path: '/Control',
    icon: '⚙️',
    label: 'Core Hub',
    subtitle: 'Identities & Settings',
    color: '#a855f7',
    textColor: 'text-purple-400',
    glow: 'rgba(168,85,247,0.4)',
    name: 'control'
  }
];

export default function PlanetaryNavWithDeepSpace({ stats = {} }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {DEPARTMENTS.map((dept) => (
        <div
          key={dept.name}
          className="group"
        >
          <Link to={dept.path}>
            <div
              className="tilt-card relative rounded-2xl p-4 transition-all overflow-hidden h-full cursor-pointer"
              style={{
                background: `linear-gradient(135deg, ${dept.color}12, ${dept.color}06, rgba(5,7,20,0.8))`,
                border: `1px solid ${dept.color}25`,
              }}
              onMouseEnter={e => { 
                e.currentTarget.style.boxShadow = `0 0 30px ${dept.glow}, 0 0 60px ${dept.glow.replace('0.4','0.15')}`; 
                e.currentTarget.style.borderColor = dept.color + '50'; 
              }}
              onMouseLeave={e => { 
                e.currentTarget.style.boxShadow = 'none'; 
                e.currentTarget.style.borderColor = dept.color + '25'; 
              }}
            >
              {/* Subtle background grid */}
              <div className="absolute inset-0 opacity-5"
                style={{ backgroundImage: `radial-gradient(circle, ${dept.color} 1px, transparent 1px)`, backgroundSize: '20px 20px' }} />

              <div className="relative">
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-transform group-hover:scale-110"
                    style={{ background: `${dept.color}18`, border: `1px solid ${dept.color}30` }}
                  >
                    {dept.icon}
                  </div>
                  <ChevronRight className={`${dept.textColor} opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1`} />
                </div>
                <p className={`text-2xl font-orbitron font-bold ${dept.textColor} mb-0.5`}
                  style={{ textShadow: `0 0 20px ${dept.color}` }}>
                  {stats?.[dept.name]?.main ?? '—'}
                </p>
                <p className="text-xs text-slate-300 font-medium">{stats?.[dept.name]?.label ?? 'Loading'}</p>
                <p className="text-xs text-slate-500 mt-0.5">{stats?.[dept.name]?.sub ?? ''}</p>
                <div className="mt-3 pt-2.5 border-t" style={{ borderColor: dept.color + '20' }}>
                  <p className={`text-xs font-orbitron font-semibold tracking-wide ${dept.textColor}`}>{dept.label}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{dept.subtitle}</p>
                </div>
              </div>
            </div>
          </Link>
        </div>
      ))}
    </div>
  );
}