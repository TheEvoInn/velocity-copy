/**
 * PlatformLayout — Galaxy-Cyberpunk nav + page wrapper
 * All pages (except Dashboard & StarshipBridge) render inside this
 */
import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useCurrentUser, useUserProfile, useUserTasks } from '@/hooks/useUserData';
import {
  Bot, Search, Play, Wallet, Shield, Settings, Rocket,
  LayoutDashboard, ChevronRight, Menu, X, Radio
} from 'lucide-react';
import NotificationBell from '@/components/notifications/NotificationBell';

const NAV_ITEMS = [
  { to: '/', label: 'COMMAND', icon: LayoutDashboard, color: '#00e8ff' },
  { to: '/AutoPilot', label: 'AUTOPILOT', icon: Bot, color: '#00e8ff' },
  { to: '/Discovery', label: 'DISCOVERY', icon: Search, color: '#f9d65c' },
  { to: '/Execution', label: 'EXECUTION', icon: Play, color: '#3b82f6' },
  { to: '/Finance', label: 'FINANCE', icon: Wallet, color: '#10b981' },
  { to: '/IdentityManager', label: 'IDENTITIES', icon: Shield, color: '#a855f7' },
  { to: '/StarshipBridge', label: 'BRIDGE', icon: Rocket, color: '#b537f2' },
  { to: '/AdminControlPanel', label: 'SYSTEM', icon: Settings, color: '#64748b' },
];

export default function PlatformLayout() {
  const location = useLocation();
  const { data: user } = useCurrentUser();
  const { data: profile } = useUserProfile();
  const { data: tasks = [] } = useUserTasks();
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeTasks = tasks.filter(t => t.status === 'running').length;
  const isAutopilotOn = profile?.autopilot_enabled;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--galaxy-deep)' }}>
      {/* ── TOP NAV ── */}
      <nav className="glass-nav sticky top-0 z-40 h-14 flex items-center justify-between px-4 md:px-6">
        {/* Logo + status */}
        <Link to="/" className="flex items-center gap-3 shrink-0">
          <div className="w-1.5 h-7 rounded-full" style={{ background: 'linear-gradient(to bottom, #00e8ff, #ff2ec4)' }} />
          <span className="font-orbitron text-base font-black text-white tracking-widest"
            style={{ textShadow: '0 0 20px rgba(0,232,255,0.3)' }}>
            VELOCITY
          </span>
          {isAutopilotOn && (
            <span className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-orbitron"
              style={{ background: 'rgba(0,232,255,0.08)', border: '1px solid rgba(0,232,255,0.25)', color: '#00e8ff' }}>
              <Radio className="w-2.5 h-2.5 animate-pulse" /> LIVE
            </span>
          )}
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-0.5">
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
            return (
              <Link key={item.to} to={item.to}>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-orbitron tracking-wide transition-all duration-200 relative"
                  style={{
                    background: isActive ? `${item.color}12` : 'transparent',
                    color: isActive ? item.color : '#64748b',
                    borderBottom: isActive ? `2px solid ${item.color}` : '2px solid transparent',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = '#94a3b8'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = '#64748b'; }}>
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                  {item.to === '/Execution' && activeTasks > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#00e8ff', animation: 'pulse-glow 1.5s ease-in-out infinite' }} />
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Right side: user + mobile toggle */}
        <div className="flex items-center gap-3">
          {user && (
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-xl"
              style={{ background: 'rgba(10,15,42,0.6)', border: '1px solid rgba(0,232,255,0.1)' }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: 'rgba(0,232,255,0.15)', color: '#00e8ff' }}>
                {(user.full_name || user.email || 'U')[0].toUpperCase()}
              </div>
              <span className="text-xs text-slate-400 font-mono max-w-[100px] truncate">
                {user.full_name || user.email?.split('@')[0]}
              </span>
            </div>
          )}
          <button className="md:hidden p-2 rounded-xl" style={{ color: '#64748b' }}
            onClick={() => setMobileOpen(o => !o)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* ── MOBILE DRAWER ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 top-14"
          style={{ background: 'rgba(5,7,20,0.97)', backdropFilter: 'blur(20px)' }}>
          <div className="p-4 space-y-1">
            {NAV_ITEMS.map(item => {
              const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
              return (
                <Link key={item.to} to={item.to} onClick={() => setMobileOpen(false)}>
                  <div className="flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all"
                    style={{
                      background: isActive ? `${item.color}10` : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isActive ? `${item.color}30` : 'rgba(255,255,255,0.05)'}`,
                    }}>
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5" style={{ color: item.color }} />
                      <span className="font-orbitron text-sm tracking-wide" style={{ color: isActive ? item.color : '#94a3b8' }}>
                        {item.label}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── PAGE CONTENT ── */}
      <main className="flex-1 overflow-auto galaxy-bg">
        <Outlet />
      </main>

      {/* ── BOTTOM STATUS BAR ── */}
      <div className="hidden md:flex items-center justify-between px-6 py-1.5"
        style={{ background: 'rgba(5,7,20,0.9)', borderTop: '1px solid rgba(0,232,255,0.08)' }}>
        <div className="flex items-center gap-4 text-xs font-mono text-slate-700">
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-emerald-500" />
            VELOCITY ENGINE ONLINE
          </span>
          {activeTasks > 0 && (
            <span className="flex items-center gap-1.5 text-cyan-700">
              <span className="w-1 h-1 rounded-full bg-cyan-500 animate-pulse" />
              {activeTasks} task{activeTasks > 1 ? 's' : ''} running
            </span>
          )}
        </div>
        {user && (
          <span className="text-xs font-mono text-slate-700">{user.email}</span>
        )}
      </div>
    </div>
  );
}