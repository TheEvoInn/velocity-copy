import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  Zap, LayoutDashboard, Telescope, Cpu, Landmark, SlidersHorizontal, ShoppingCart, Coins,
  MessageSquare, ChevronRight, X, Menu, Shield, Settings, Target
} from 'lucide-react';
import ActiveIdentityBanner from '../identity/ActiveIdentityBanner';
import NotificationBell from '../notifications/NotificationBell';
import StarfieldCanvas from './StarfieldCanvas';
import GalaxyOrbs from './GalaxyOrbs';
import CyberpunkCommandCenter from './CyberpunkCommandCenter';
import { useAuth } from '@/lib/AuthContext';
import { useRealtimeEventBus } from '@/lib/realtimeEventBus';

const DEPARTMENTS = [
  {
    path: '/Dashboard',
    icon: LayoutDashboard,
    label: 'Command',
    subtitle: 'Mission Control',
    color: '#06b6d4',
    glow: 'rgba(6,182,212,0.5)',
    gradient: 'from-cyan-500/20 to-blue-600/10',
    activeBorder: 'border-cyan-400/60',
    textActive: 'text-cyan-300',
    planet: '🌐',
  },
  {
    path: '/Discovery',
    icon: Telescope,
    label: 'Discover',
    subtitle: 'Scan & Analyze',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.5)',
    gradient: 'from-amber-500/20 to-orange-600/10',
    activeBorder: 'border-amber-400/60',
    textActive: 'text-amber-300',
    planet: '🔭',
  },
  {
    path: '/Execution',
    icon: Cpu,
    label: 'Execute',
    subtitle: 'Tasks & Automation',
    color: '#3b82f6',
    glow: 'rgba(59,130,246,0.5)',
    gradient: 'from-blue-500/20 to-indigo-600/10',
    activeBorder: 'border-blue-400/60',
    textActive: 'text-blue-300',
    planet: '⚡',
  },
  {
    path: '/Finance',
    icon: Landmark,
    label: 'Finance',
    subtitle: 'Wallets & Earnings',
    color: '#10b981',
    glow: 'rgba(16,185,129,0.5)',
    gradient: 'from-emerald-500/20 to-teal-600/10',
    activeBorder: 'border-emerald-400/60',
    textActive: 'text-emerald-300',
    planet: '💰',
  },
  {
    path: '/Control',
    icon: SlidersHorizontal,
    label: 'Control',
    subtitle: 'Settings & Access',
    color: '#a855f7',
    glow: 'rgba(168,85,247,0.5)',
    gradient: 'from-purple-500/20 to-violet-600/10',
    activeBorder: 'border-purple-400/60',
    textActive: 'text-purple-300',
    planet: '⚙️',
  },
  {
    path: '/DigitalCommerce',
    icon: ShoppingCart,
    label: 'Commerce',
    subtitle: 'Digital Storefronts',
    color: '#ec4899',
    glow: 'rgba(236,72,153,0.5)',
    gradient: 'from-pink-500/20 to-rose-600/10',
    activeBorder: 'border-pink-400/60',
    textActive: 'text-pink-300',
    planet: '🛍️',
  },
  {
    path: '/CryptoAutomation',
    icon: Coins,
    label: 'Crypto',
    subtitle: 'Yield & Mining',
    color: '#06b6d4',
    glow: 'rgba(6,182,212,0.5)',
    gradient: 'from-cyan-500/20 to-blue-600/10',
    activeBorder: 'border-cyan-400/60',
    textActive: 'text-cyan-300',
    planet: '🚀',
  },
];

// Primary tabs shown in mobile bottom bar (most important 5)
const MOBILE_PRIMARY_TABS = ['/Dashboard', '/Discovery', '/Execution', '/Finance', '/Control'];

// ─── Desktop Nav Item ─────────────────────────────────────────────────────────
function NavItem({ dept, isActive }) {
  return (
    <Link
      to={dept.path}
      className={`
        planet-nav relative flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium
        border transition-all duration-300 pointer-events-auto z-30
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

// ─── Mobile Bottom Tab Bar ────────────────────────────────────────────────────
function MobileTabBar({ currentPath, onMoreClick }) {
  const primaryDepts = DEPARTMENTS.filter(d => MOBILE_PRIMARY_TABS.includes(d.path));
  const hasSecondaryActive = !MOBILE_PRIMARY_TABS.includes(currentPath) && currentPath !== '/';

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden flex items-stretch"
      style={{
        background: 'rgba(5,7,20,0.97)',
        borderTop: '1px solid rgba(124,58,237,0.25)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        minHeight: 64,
      }}
    >
      {primaryDepts.map(dept => {
        const Icon = dept.icon;
        const isActive = currentPath === dept.path ||
          (dept.path === '/Dashboard' && currentPath === '/') ||
          (dept.path !== '/Dashboard' && currentPath.startsWith(dept.path));
        return (
          <Link
            key={dept.path}
            to={dept.path}
            className="flex-1 flex flex-col items-center justify-center gap-1 transition-all duration-200 relative active:scale-95"
            style={{ minHeight: 60, paddingTop: 8, paddingBottom: 8 }}
          >
            {isActive && (
              <span
                className="absolute top-0 left-[20%] right-[20%] h-0.5 rounded-full"
                style={{ background: dept.color, boxShadow: `0 0 6px ${dept.color}` }}
              />
            )}
            <Icon
              className="w-5 h-5 transition-all duration-200"
              style={{ color: isActive ? dept.color : '#64748b', filter: isActive ? `drop-shadow(0 0 4px ${dept.color})` : 'none' }}
            />
            <span
              className="text-[10px] font-medium tracking-wide transition-all duration-200 leading-none"
              style={{ color: isActive ? dept.color : '#64748b' }}
            >
              {dept.label}
            </span>
          </Link>
        );
      })}

      {/* More button */}
      <button
        onClick={onMoreClick}
        className="flex-1 flex flex-col items-center justify-center gap-1 transition-all duration-200 active:scale-95"
        style={{ minHeight: 60, paddingTop: 8, paddingBottom: 8 }}
      >
        <Menu
          className="w-5 h-5 transition-all duration-200"
          style={{ color: hasSecondaryActive ? '#ec4899' : '#64748b' }}
        />
        <span
          className="text-[10px] font-medium tracking-wide leading-none"
          style={{ color: hasSecondaryActive ? '#ec4899' : '#64748b' }}
        >
          More
        </span>
      </button>
    </nav>
  );
}

// ─── Mobile More Drawer (for Chat / extra pages) ──────────────────────────────
function MobileDrawer({ isOpen, onClose, currentPath }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] md:hidden">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <nav className="absolute top-0 right-0 h-full w-72 glass-card-bright border-l border-violet-500/20 p-6 flex flex-col gap-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className="font-orbitron text-sm text-white tracking-widest">VELOCITY NAV</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
          <span className="text-violet-400 text-xs">✦</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
        </div>

        {DEPARTMENTS.map(dept => {
          const isActive = currentPath === dept.path || (dept.path !== '/Dashboard' && currentPath.startsWith(dept.path));
          return (
            <Link
              key={dept.path}
              to={dept.path}
              onClick={onClose}
              className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 ${
                isActive ? `bg-gradient-to-r ${dept.gradient} ${dept.activeBorder}` : 'border-slate-800/60 hover:border-slate-700 hover:bg-white/5'
              }`}
              style={isActive ? { boxShadow: `0 0 20px ${dept.glow}` } : {}}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                style={{
                  background: isActive ? `${dept.color}20` : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${isActive ? dept.color + '40' : 'rgba(255,255,255,0.08)'}`,
                  boxShadow: isActive ? `0 0 12px ${dept.glow}` : 'none',
                }}>
                {dept.planet}
              </div>
              <div>
                <p className={`font-orbitron text-xs tracking-wide ${isActive ? dept.textActive : 'text-slate-300'}`}>{dept.label}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{dept.subtitle}</p>
              </div>
              {isActive && <ChevronRight className="w-4 h-4 ml-auto" style={{ color: dept.color }} />}
            </Link>
          );
        })}

        <div className="mt-auto pt-4 border-t border-slate-800/60 space-y-1.5">
          <Link to="/Chat" onClick={onClose}
            className="flex items-center gap-3 p-3 rounded-xl border border-slate-800/60 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all">
            <MessageSquare className="w-4 h-4 text-violet-400" />
            <span className="text-sm text-slate-300">VELOCITY AI</span>
          </Link>
          <Link to="/IdentityWalletView" onClick={onClose}
            className="flex items-center gap-3 p-3 rounded-xl border border-slate-800/60 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all">
            <span className="text-base">🪪</span>
            <span className="text-sm text-slate-300">Identity Wallet</span>
          </Link>
          <Link to="/NotificationsDashboard" onClick={onClose}
            className="flex items-center gap-3 p-3 rounded-xl border border-slate-800/60 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all">
            <span className="text-base">🔔</span>
            <span className="text-sm text-slate-300">Notifications</span>
          </Link>
          <Link to="/CrossSystemAutomation" onClick={onClose}
            className="flex items-center gap-3 p-3 rounded-xl border border-slate-800/60 hover:border-pink-500/30 hover:bg-pink-500/5 transition-all">
            <span className="text-base">⚙️</span>
            <span className="text-sm text-slate-300">Multi-Dept Automation</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}

// ─── Main Layout ──────────────────────────────────────────────────────────────
export default function AppLayout() {
  // ACTUAL FIX: Global real-time event subscription (runs on all pages)
  useRealtimeEventBus();
  
  const location = useLocation();
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  const currentDept = DEPARTMENTS.find(d =>
    location.pathname === d.path ||
    (d.path !== '/Dashboard' && location.pathname.startsWith(d.path))
  );

  return (
    <CyberpunkCommandCenter>
      <div className="min-h-screen text-white relative pointer-events-none" style={{ background: 'transparent' }}>
        <StarfieldCanvas />
        <GalaxyOrbs />

      {/* ── Top Bar ── */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 h-14 glass-nav transition-all duration-300 pointer-events-auto ${scrolled ? 'shadow-lg shadow-black/40' : ''}`}
      >
        <div className="h-full flex items-center px-4 gap-3 max-w-screen-2xl mx-auto pointer-events-auto">

          {/* Logo */}
          <Link to="/Dashboard" className="flex items-center gap-2.5 shrink-0 group mr-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center relative"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', boxShadow: '0 0 16px rgba(124,58,237,0.6)' }}>
              <Zap className="w-4 h-4 text-white" />
              <span className="absolute w-1.5 h-1.5 rounded-full bg-cyan-400"
                style={{ top: 0, right: -2, boxShadow: '0 0 4px #06b6d4', animation: 'orbit-reverse 3s linear infinite' }} />
            </div>
            <div className="hidden sm:block">
              <p className="font-orbitron text-xs font-bold tracking-[0.2em] text-white leading-none">VELOCITY</p>
              <p className="text-[8px] text-violet-400/70 tracking-[0.15em] leading-none mt-0.5">PROFIT ENGINE</p>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:block w-px h-6 bg-gradient-to-b from-transparent via-violet-500/40 to-transparent mx-1" />
          <nav className="hidden md:flex items-center gap-1 flex-1 relative z-30 pointer-events-auto">
            {DEPARTMENTS.map(dept => {
              const isActive = location.pathname === dept.path ||
                (dept.path !== '/Dashboard' && location.pathname.startsWith(dept.path));
              return <NavItem key={dept.path} dept={dept} isActive={isActive} />;
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2 ml-auto">
            <NotificationBell />
            <Link to="/UserAccessPage"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-cyan-500/20 text-cyan-400 hover:text-cyan-300 hover:border-cyan-400/40 hover:bg-cyan-500/10 transition-all text-xs"
              style={{ boxShadow: '0 0 12px rgba(6,182,212,0.15)' }}>
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden lg:block font-orbitron text-[10px] tracking-wide">SETTINGS</span>
            </Link>
            <Link to="/Chat"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-violet-500/20 text-violet-400 hover:text-violet-300 hover:border-violet-400/40 hover:bg-violet-500/10 transition-all text-xs"
              style={{ boxShadow: '0 0 12px rgba(124,58,237,0.15)' }}>
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden lg:block font-orbitron text-[10px] tracking-wide">VELOCITY AI</span>
            </Link>
            {user?.role === 'admin' && (
              <Link to="/AdminControlPanel"
                className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all text-xs ${
                  location.pathname === '/AdminControlPanel'
                    ? 'border-red-500/50 text-red-300 bg-red-500/10'
                    : 'border-red-500/20 text-red-400/70 hover:text-red-300 hover:border-red-400/40 hover:bg-red-500/8'
                }`}
                style={{ boxShadow: location.pathname === '/AdminControlPanel' ? '0 0 12px rgba(239,68,68,0.2)' : 'none' }}>
                <Shield className="w-3.5 h-3.5" />
                <span className="hidden lg:block font-orbitron text-[10px] tracking-wide">ADMIN</span>
              </Link>
            )}
            <div className="hidden md:block">
              <ActiveIdentityBanner />
            </div>

            {/* Mobile: AI shortcut + menu */}
            <Link to="/Chat"
              className="md:hidden p-2 rounded-xl border border-violet-500/25 text-violet-400"
              style={{ background: 'rgba(124,58,237,0.1)' }}>
              <MessageSquare className="w-4 h-4" />
            </Link>
            <button
              onClick={() => setDrawerOpen(v => !v)}
              className="md:hidden p-2 rounded-xl border border-slate-700/60 text-slate-400 hover:text-white"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </div>

        {currentDept && (
          <div className="absolute bottom-0 left-0 right-0 h-px transition-all duration-500"
            style={{ background: `linear-gradient(90deg, transparent, ${currentDept.color}60, transparent)`, boxShadow: `0 0 12px ${currentDept.glow}` }} />
        )}
      </header>

      {/* Mobile Drawer */}
      <MobileDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} currentPath={location.pathname} />

      {/* ── Page Content ── */}
      {/* pb-20 on mobile to clear the bottom tab bar */}
      <main className="relative z-10 pt-14 min-h-screen pb-20 md:pb-0 pointer-events-auto">
        {currentDept && (
          <div className="h-0.5 w-full"
            style={{ background: `linear-gradient(90deg, transparent 0%, ${currentDept.color}50 20%, ${currentDept.color}80 50%, ${currentDept.color}50 80%, transparent 100%)` }} />
        )}
        <div className="page-enter pointer-events-auto">
          <Outlet />
        </div>
      </main>

      {/* ── Desktop: floating galaxy dot map ── */}
      <div className="fixed bottom-6 right-6 z-40 hidden md:flex flex-col gap-1.5 items-end">
        {DEPARTMENTS.map(dept => {
          const isActive = location.pathname === dept.path ||
            (dept.path !== '/Dashboard' && location.pathname.startsWith(dept.path));
          return (
            <Link key={dept.path} to={dept.path} title={dept.label}
              className={`flex items-center gap-2 transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-30 hover:opacity-70'}`}>
              {isActive && (
                <span className="text-[10px] font-orbitron tracking-wide px-2 py-0.5 rounded-full"
                  style={{ background: dept.color + '20', border: `1px solid ${dept.color}50`, color: dept.color }}>
                  {dept.label}
                </span>
              )}
              <div className={`w-2 h-2 rounded-full transition-all duration-300 ${isActive ? 'scale-150' : ''}`}
                style={{ background: dept.color, boxShadow: isActive ? `0 0 8px ${dept.color}, 0 0 16px ${dept.glow}` : 'none' }} />
            </Link>
          );
        })}
      </div>

        {/* ── Mobile Bottom Tab Bar ── */}
        <MobileTabBar currentPath={location.pathname} />
      </div>
    </CyberpunkCommandCenter>
  );
}