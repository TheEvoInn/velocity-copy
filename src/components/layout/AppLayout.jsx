import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  Zap, LayoutDashboard, Telescope, Cpu, Landmark, SlidersHorizontal,
  Menu, X, MessageSquare, ChevronRight, Rocket
} from 'lucide-react';
import ActiveIdentityBanner from '../identity/ActiveIdentityBanner';
import StarfieldCanvas from './StarfieldCanvas';
import GalaxyOrbs from './GalaxyOrbs';

// ─── Department / Planet Config ──────────────────────────────────────────────
const DEPARTMENTS = [
  {
    path: '/Dashboard',
    icon: LayoutDashboard,
    label: 'Command Center',
    subtitle: 'Overview & Control',
    color: '#06b6d4',
    glow: 'rgba(6,182,212,0.5)',
    gradient: 'from-cyan-500/20 to-blue-600/10',
    border: 'border-cyan-500/30',
    activeBorder: 'border-cyan-400/60',
    textActive: 'text-cyan-300',
    planet: '🌐',
    dot: 'bg-cyan-400',
  },
  {
    path: '/Discovery',
    icon: Telescope,
    label: 'Observatory',
    subtitle: 'Intelligence & Scanning',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.5)',
    gradient: 'from-amber-500/20 to-orange-600/10',
    border: 'border-amber-500/30',
    activeBorder: 'border-amber-400/60',
    textActive: 'text-amber-300',
    planet: '🔭',
    dot: 'bg-amber-400',
  },
  {
    path: '/Execution',
    icon: Cpu,
    label: 'Command Deck',
    subtitle: 'Automation & Tasks',
    color: '#3b82f6',
    glow: 'rgba(59,130,246,0.5)',
    gradient: 'from-blue-500/20 to-indigo-600/10',
    border: 'border-blue-500/30',
    activeBorder: 'border-blue-400/60',
    textActive: 'text-blue-300',
    planet: '🚀',
    dot: 'bg-blue-400',
  },
  {
    path: '/Finance',
    icon: Landmark,
    label: 'Treasury Station',
    subtitle: 'Wallet & Compliance',
    color: '#10b981',
    glow: 'rgba(16,185,129,0.5)',
    gradient: 'from-emerald-500/20 to-teal-600/10',
    border: 'border-emerald-500/30',
    activeBorder: 'border-emerald-400/60',
    textActive: 'text-emerald-300',
    planet: '💎',
    dot: 'bg-emerald-400',
  },
  {
    path: '/Control',
    icon: SlidersHorizontal,
    label: 'Core Hub',
    subtitle: 'Settings & Identities',
    color: '#a855f7',
    glow: 'rgba(168,85,247,0.5)',
    gradient: 'from-purple-500/20 to-violet-600/10',
    border: 'border-purple-500/30',
    activeBorder: 'border-purple-400/60',
    textActive: 'text-purple-300',
    planet: '⚙️',
    dot: 'bg-purple-400',
  },
];

// ─── Orbit Dot Decoration ─────────────────────────────────────────────────────
function OrbitDot({ color, delay = 0, size = 4, radius = 14 }) {
  return (
    <span
      className="absolute rounded-full"
      style={{
        width: size, height: size,
        background: color,
        boxShadow: `0 0 6px ${color}`,
        top: '50%', left: '50%',
        marginTop: -size / 2, marginLeft: -size / 2,
        animation: `orbit ${3 + delay}s linear infinite`,
        animationDelay: `${delay}s`,
        transformOrigin: `${-radius}px 0`,
      }}
    />
  );
}

// ─── Desktop Nav Item ──────────────────────────────────────────────────────────
function NavItem({ dept, isActive }) {
  const Icon = dept.icon;
  return (
    <Link
      to={dept.path}
      className={`
        planet-nav relative flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium
        border transition-all duration-300
        ${isActive
          ? `bg-gradient-to-r ${dept.gradient} ${dept.activeBorder} ${dept.textActive}`
          : 'border-transparent text-slate-400 hover:text-white hover:border-white/10 hover:bg-white/5'
        }
      `}
      style={isActive ? { boxShadow: `0 0 16px ${dept.glow}, 0 0 32px ${dept.glow.replace('0.5', '0.2')}` } : {}}
    >
      <span className="text-base leading-none">{dept.planet}</span>
      <span className="hidden lg:block font-orbitron tracking-wide text-[10px]">{dept.label}</span>
      {isActive && (
        <span
          className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full"
          style={{ background: dept.color, boxShadow: `0 0 8px ${dept.color}` }}
        />
      )}
    </Link>
  );
}

// ─── Mobile Nav Drawer ────────────────────────────────────────────────────────
function MobileNavDrawer({ isOpen, onClose, currentPath }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] md:hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      {/* Drawer */}
      <nav className="absolute top-0 right-0 h-full w-72 glass-card-bright border-l border-violet-500/20 p-6 flex flex-col gap-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className="font-orbitron text-sm text-white tracking-widest">GALAXY MAP</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Star divider */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
          <span className="text-violet-400 text-xs">✦</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
        </div>

        {DEPARTMENTS.map(dept => {
          const Icon = dept.icon;
          const isActive = currentPath === dept.path || (dept.path !== '/Dashboard' && currentPath.startsWith(dept.path));
          return (
            <Link
              key={dept.path}
              to={dept.path}
              onClick={onClose}
              className={`
                flex items-center gap-4 p-4 rounded-xl border transition-all duration-300
                ${isActive
                  ? `bg-gradient-to-r ${dept.gradient} ${dept.activeBorder}`
                  : 'border-slate-800/60 hover:border-slate-700 hover:bg-white/5'
                }
              `}
              style={isActive ? { boxShadow: `0 0 20px ${dept.glow}` } : {}}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                style={{
                  background: isActive ? `${dept.color}20` : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${isActive ? dept.color + '40' : 'rgba(255,255,255,0.08)'}`,
                  boxShadow: isActive ? `0 0 12px ${dept.glow}` : 'none',
                }}
              >
                {dept.planet}
              </div>
              <div>
                <p className={`font-orbitron text-xs tracking-wide ${isActive ? dept.textActive : 'text-slate-300'}`}>
                  {dept.label}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">{dept.subtitle}</p>
              </div>
              {isActive && <ChevronRight className="w-4 h-4 ml-auto" style={{ color: dept.color }} />}
            </Link>
          );
        })}

        <div className="mt-auto pt-4 border-t border-slate-800/60">
          <Link
            to="/Chat"
            onClick={onClose}
            className="flex items-center gap-3 p-3 rounded-xl border border-slate-800/60 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all"
          >
            <MessageSquare className="w-4 h-4 text-violet-400" />
            <span className="text-sm text-slate-300">AI Mission Control</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}

// ─── Main Layout ──────────────────────────────────────────────────────────────
export default function AppLayout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile nav on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const currentDept = DEPARTMENTS.find(d =>
    location.pathname === d.path ||
    (d.path !== '/Dashboard' && location.pathname.startsWith(d.path))
  );

  return (
    <div className="min-h-screen text-white relative" style={{ background: 'var(--galaxy-deep)' }}>
      {/* Fixed cosmic backgrounds */}
      <StarfieldCanvas />
      <GalaxyOrbs />

      {/* ── Top Navigation Bar ── */}
      <header
        className={`
          fixed top-0 left-0 right-0 z-50 h-14
          glass-nav transition-all duration-300
          ${scrolled ? 'shadow-lg shadow-black/40' : ''}
        `}
      >
        <div className="h-full flex items-center px-4 gap-3 max-w-screen-2xl mx-auto">

          {/* Logo */}
          <Link to="/Dashboard" className="flex items-center gap-2.5 shrink-0 group mr-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center relative"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
                boxShadow: '0 0 16px rgba(124,58,237,0.6), 0 0 32px rgba(6,182,212,0.3)',
              }}
            >
              <Zap className="w-4 h-4 text-white" />
              {/* Orbit dot on logo */}
              <span
                className="absolute w-1.5 h-1.5 rounded-full bg-cyan-400"
                style={{
                  top: 0, right: -2,
                  boxShadow: '0 0 4px #06b6d4',
                  animation: 'orbit-reverse 3s linear infinite',
                }}
              />
            </div>
            <div className="hidden sm:block">
              <p className="font-orbitron text-xs font-bold tracking-[0.2em] text-white leading-none">PROFIT ENGINE</p>
              <p className="text-[8px] text-violet-400/70 tracking-[0.15em] leading-none mt-0.5">COSMIC COMMAND SYSTEM</p>
            </div>
          </Link>

          {/* Star separator */}
          <div className="hidden md:block w-px h-6 bg-gradient-to-b from-transparent via-violet-500/40 to-transparent mx-1" />

          {/* Desktop Department Nav */}
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {DEPARTMENTS.map(dept => {
              const isActive = location.pathname === dept.path ||
                (dept.path !== '/Dashboard' && location.pathname.startsWith(dept.path));
              return <NavItem key={dept.path} dept={dept} isActive={isActive} />;
            })}
          </nav>

          {/* Right side controls */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Chat button */}
            <Link
              to="/Chat"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-violet-500/20 text-violet-400 hover:text-violet-300 hover:border-violet-400/40 hover:bg-violet-500/10 transition-all text-xs"
              style={{ boxShadow: '0 0 12px rgba(124,58,237,0.15)' }}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden lg:block font-orbitron text-[10px] tracking-wide">MISSION AI</span>
            </Link>

            {/* Active Identity */}
            <div className="hidden md:block">
              <ActiveIdentityBanner />
            </div>

            {/* Current department indicator (mobile) */}
            {currentDept && (
              <div
                className="md:hidden flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs"
                style={{
                  borderColor: currentDept.color + '40',
                  background: currentDept.color + '10',
                  color: currentDept.color,
                }}
              >
                <span className="text-sm">{currentDept.planet}</span>
                <span className="font-orbitron text-[9px] tracking-wide">{currentDept.label}</span>
              </div>
            )}

            {/* Hamburger */}
            <button
              onClick={() => setMobileOpen(v => !v)}
              className="md:hidden p-2 rounded-xl border border-slate-700/60 text-slate-400 hover:text-white hover:border-violet-500/40 transition-all"
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Animated bottom border glow */}
        {currentDept && (
          <div
            className="absolute bottom-0 left-0 right-0 h-px transition-all duration-500"
            style={{
              background: `linear-gradient(90deg, transparent, ${currentDept.color}60, transparent)`,
              boxShadow: `0 0 12px ${currentDept.glow}`,
            }}
          />
        )}
      </header>

      {/* Mobile Nav Drawer */}
      <MobileNavDrawer
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        currentPath={location.pathname}
      />

      {/* ── Page Content ── */}
      <main className="relative z-10 pt-14 min-h-screen">
        {/* Department context banner */}
        {currentDept && (
          <div
            className="h-0.5 w-full"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${currentDept.color}50 20%, ${currentDept.color}80 50%, ${currentDept.color}50 80%, transparent 100%)`,
            }}
          />
        )}
        <div className="page-enter">
          <Outlet />
        </div>
      </main>

      {/* ── Floating Galaxy Map Indicator (bottom-right corner) ── */}
      <div className="fixed bottom-6 right-6 z-40 hidden md:flex flex-col gap-1.5 items-end">
        {DEPARTMENTS.map(dept => {
          const isActive = location.pathname === dept.path ||
            (dept.path !== '/Dashboard' && location.pathname.startsWith(dept.path));
          return (
            <Link
              key={dept.path}
              to={dept.path}
              title={dept.label}
              className={`
                flex items-center gap-2 transition-all duration-300
                ${isActive ? 'opacity-100' : 'opacity-30 hover:opacity-70'}
              `}
            >
              {isActive && (
                <span
                  className="text-[10px] font-orbitron tracking-wide px-2 py-0.5 rounded-full"
                  style={{
                    background: dept.color + '20',
                    border: `1px solid ${dept.color}50`,
                    color: dept.color,
                  }}
                >
                  {dept.label}
                </span>
              )}
              <div
                className={`w-2 h-2 rounded-full transition-all duration-300 ${isActive ? 'scale-150' : ''}`}
                style={{
                  background: dept.color,
                  boxShadow: isActive ? `0 0 8px ${dept.color}, 0 0 16px ${dept.glow}` : 'none',
                }}
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}