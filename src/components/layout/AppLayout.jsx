import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  Zap, LayoutDashboard, Telescope, Landmark, ShoppingCart, Coins,
  MessageSquare, ChevronRight, X, Menu, Shield, Settings, AlertTriangle, Users, Activity, Mail, Rocket, Gauge
} from 'lucide-react';
import ActiveIdentityBanner from '../identity/ActiveIdentityBanner';
import NotificationBell from '../notifications/NotificationBell';
import StarfieldCanvas from './StarfieldCanvas';
import GalaxyOrbs from './GalaxyOrbs';
import CyberpunkCommandCenter from './CyberpunkCommandCenter';
import { useAuth } from '@/lib/AuthContext';
import { useRealtimeEventBus } from '@/lib/realtimeEventBus';
import { useIdentitySyncAcrossApp } from '@/hooks/useIdentitySyncAcrossApp';

// ── Six Core Departments of VELO AI ──────────────────────────────────────────
const DEPARTMENTS = [
  {
    id: 'command',
    path: '/Dashboard',
    icon: LayoutDashboard,
    label: 'Command',
    subtitle: 'Mission Control Center',
    color: '#06b6d4',
    glow: 'rgba(6,182,212,0.5)',
    gradient: 'from-cyan-500/20 to-blue-600/10',
    activeBorder: 'border-cyan-400/60',
    textActive: 'text-cyan-300',
    planet: '🌐',
    ai: 'CMD',
  },
  {
    id: 'identity',
    path: '/VeloIdentityHub',
    icon: Users,
    label: 'Identity',
    subtitle: 'Personas & Credentials',
    color: '#818cf8',
    glow: 'rgba(129,140,248,0.5)',
    gradient: 'from-indigo-500/20 to-violet-600/10',
    activeBorder: 'border-indigo-400/60',
    textActive: 'text-indigo-300',
    planet: '👤',
    ai: 'NEXUS',
  },
  {
    id: 'discovery',
    path: '/Discovery',
    icon: Telescope,
    label: 'Discovery',
    subtitle: 'Scan, Scout & Source',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.5)',
    gradient: 'from-amber-500/20 to-orange-600/10',
    activeBorder: 'border-amber-400/60',
    textActive: 'text-amber-300',
    planet: '🔭',
    ai: 'SCOUT',
  },
  {
    id: 'autopilot',
    path: '/VeloAutopilotControl',
    icon: Zap,
    label: 'Autopilot',
    subtitle: 'Execution & Workflows',
    color: '#fbbf24',
    glow: 'rgba(251,191,36,0.5)',
    gradient: 'from-amber-500/20 to-yellow-600/10',
    activeBorder: 'border-amber-400/60',
    textActive: 'text-amber-300',
    planet: '⚡',
    ai: 'APEX',
  },
  {
    id: 'commerce',
    path: '/DigitalResellers',
    icon: ShoppingCart,
    label: 'Commerce',
    subtitle: 'Products & Storefronts',
    color: '#ec4899',
    glow: 'rgba(236,72,153,0.5)',
    gradient: 'from-pink-500/20 to-rose-600/10',
    activeBorder: 'border-pink-400/60',
    textActive: 'text-pink-300',
    planet: '🛍️',
    ai: 'VIPZ',
  },
  {
    id: 'crypto',
    path: '/CryptoAutomation',
    icon: Coins,
    label: 'Crypto',
    subtitle: 'Wallets & Yield',
    color: '#00ffd9',
    glow: 'rgba(0,255,217,0.5)',
    gradient: 'from-teal-500/20 to-emerald-600/10',
    activeBorder: 'border-teal-400/60',
    textActive: 'text-teal-300',
    planet: '🚀',
    ai: 'NED',
  },
];

// Mobile: show all 6 primary departments
const MOBILE_PRIMARY_PATHS = DEPARTMENTS.map(d => d.path);

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
      <div className="hidden lg:block">
        <span className="font-orbitron tracking-wide text-[10px] block">{dept.label}</span>
        <span className="text-[8px] opacity-50 block" style={{ color: isActive ? dept.color : undefined }}>AI: {dept.ai}</span>
      </div>
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
  // Show 5 on mobile bottom, "More" for extras
  const primaryDepts = DEPARTMENTS.slice(0, 5);

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
        <Menu className="w-5 h-5" style={{ color: '#64748b' }} />
        <span className="text-[10px] font-medium tracking-wide leading-none" style={{ color: '#64748b' }}>More</span>
      </button>
    </nav>
  );
}

// ─── Mobile More Drawer ───────────────────────────────────────────────────────
function MobileDrawer({ isOpen, onClose, currentPath }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] md:hidden">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <nav
        className="absolute bottom-0 left-0 right-0 rounded-t-2xl flex flex-col overflow-hidden"
        style={{
          background: 'rgba(8,10,28,0.98)',
          border: '1px solid rgba(124,58,237,0.3)',
          borderBottom: 'none',
          maxHeight: '85vh',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-600" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <div>
            <span className="font-orbitron text-sm text-white tracking-wider">VELO AI</span>
            <span className="text-xs text-slate-500 ml-2">Navigation</span>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 pb-4 space-y-1">
          <p className="text-[9px] font-orbitron text-slate-600 tracking-widest px-1 py-1">CORE DEPARTMENTS</p>

          {/* All 6 core departments */}
          {DEPARTMENTS.map(dept => {
            const Icon = dept.icon;
            const isActive = currentPath === dept.path ||
              (dept.path === '/Dashboard' && currentPath === '/') ||
              (dept.path !== '/Dashboard' && currentPath.startsWith(dept.path));
            return (
              <Link
                key={dept.path}
                to={dept.path}
                onClick={onClose}
                className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-200 active:scale-[0.98] ${
                  isActive
                    ? `bg-gradient-to-r ${dept.gradient} ${dept.activeBorder}`
                    : 'border-transparent hover:border-slate-700/60 hover:bg-white/5'
                }`}
                style={isActive ? { boxShadow: `0 0 16px ${dept.glow}` } : {}}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: isActive ? `${dept.color}25` : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${isActive ? dept.color + '50' : 'rgba(255,255,255,0.1)'}`,
                  }}
                >
                  <Icon className="w-4 h-4" style={{ color: isActive ? dept.color : '#94a3b8' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold ${isActive ? dept.textActive : 'text-slate-200'}`}>{dept.label}</p>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: dept.color + '15', color: dept.color, border: `1px solid ${dept.color}30` }}>
                      {dept.ai}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{dept.subtitle}</p>
                </div>
                {isActive && <ChevronRight className="w-4 h-4 shrink-0" style={{ color: dept.color }} />}
              </Link>
            );
          })}

          {/* Divider */}
          <div className="h-px bg-slate-800/80 my-2" />
          <p className="text-[9px] font-orbitron text-slate-600 tracking-widest px-1 py-1">SYSTEM ACCESS</p>

          <Link to="/VeloFinanceCommand" onClick={onClose}
            className="flex items-center gap-3 p-3.5 rounded-xl border border-transparent hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all active:scale-[0.98]">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 shrink-0">
              <Landmark className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">Finance Command</p>
              <p className="text-xs text-slate-500">Wallet, earnings & payouts</p>
            </div>
          </Link>

          <Link to="/PendingInterventions" onClick={onClose}
           className="flex items-center gap-3 p-3.5 rounded-xl border border-transparent hover:border-orange-500/30 hover:bg-orange-500/5 transition-all active:scale-[0.98]">
           <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-orange-500/10 border border-orange-500/20 shrink-0">
             <AlertTriangle className="w-4 h-4 text-orange-400" />
           </div>
           <div>
             <p className="text-sm font-semibold text-slate-200">Interventions</p>
             <p className="text-xs text-slate-500">Actions requiring your input</p>
           </div>
          </Link>

          <Link to="/SystemAuditDashboard" onClick={onClose}
           className="flex items-center gap-3 p-3.5 rounded-xl border border-transparent hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all active:scale-[0.98]">
           <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-cyan-500/10 border border-cyan-500/20 shrink-0">
             <Activity className="w-4 h-4 text-cyan-400" />
           </div>
           <div>
             <p className="text-sm font-semibold text-slate-200">System Audit</p>
             <p className="text-xs text-slate-500">System metrics & API status</p>
           </div>
          </Link>

          <Link to="/Chat" onClick={onClose}
           className="flex items-center gap-3 p-3.5 rounded-xl border border-transparent hover:border-violet-500/30 hover:bg-violet-500/5 transition-all active:scale-[0.98]">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-violet-500/10 border border-violet-500/20 shrink-0">
              <MessageSquare className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">VELO AI Chat</p>
              <p className="text-xs text-slate-500">Command console & AI assistant</p>
            </div>
          </Link>

          <Link to="/IdentityManager" onClick={onClose}
            className="flex items-center gap-3 p-3.5 rounded-xl border border-transparent hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all active:scale-[0.98]">
             <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-cyan-500/10 border border-cyan-500/20 shrink-0">
               <Mail className="w-4 h-4 text-cyan-400" />
             </div>
             <div>
               <p className="text-sm font-semibold text-slate-200">Identity Manager</p>
               <p className="text-xs text-slate-500">Profiles & credentials</p>
             </div>
           </Link>

          <Link to="/StrategySetupWizard" onClick={onClose}
            className="flex items-center gap-3 p-3.5 rounded-xl border border-transparent hover:border-violet-500/30 hover:bg-violet-500/5 transition-all active:scale-[0.98]">
             <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-violet-500/10 border border-violet-500/20 shrink-0">
               <Rocket className="w-4 h-4 text-violet-400" />
             </div>
             <div>
               <p className="text-sm font-semibold text-slate-200">Strategy Wizard</p>
               <p className="text-xs text-slate-500">Bulk setup & automation</p>
             </div>
           </Link>

          <Link to="/RealTimeTestingMonitor" onClick={onClose}
            className="flex items-center gap-3 p-3.5 rounded-xl border border-transparent hover:border-pink-500/30 hover:bg-pink-500/5 transition-all active:scale-[0.98]">
             <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-pink-500/10 border border-pink-500/20 shrink-0">
               <Gauge className="w-4 h-4 text-pink-400" />
             </div>
             <div>
               <p className="text-sm font-semibold text-slate-200">Live Testing</p>
               <p className="text-xs text-slate-500">Real-time monitoring</p>
             </div>
           </Link>

           <div className="h-px bg-slate-800/80 my-2" />

          <Link to="/UserAccessPage" onClick={onClose}
            className="flex items-center gap-3 p-3.5 rounded-xl border border-transparent hover:border-slate-600/50 hover:bg-white/5 transition-all active:scale-[0.98]">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-700/40 border border-slate-600/30 shrink-0">
              <Settings className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">Settings</p>
              <p className="text-xs text-slate-500">Account & preferences</p>
            </div>
          </Link>
        </div>
      </nav>
    </div>
  );
}

// ─── Main Layout ──────────────────────────────────────────────────────────────
export default function AppLayout() {
  useRealtimeEventBus();
  useIdentitySyncAcrossApp();
  
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
    (d.path === '/Dashboard' && location.pathname === '/') ||
    (d.path !== '/Dashboard' && location.pathname.startsWith(d.path))
  );

  return (
    <>
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
              <p className="font-orbitron text-xs font-bold tracking-[0.2em] text-white leading-none">VELO AI</p>
              <p className="text-[8px] text-violet-400/70 tracking-[0.15em] leading-none mt-0.5">PROFIT ENGINE</p>
            </div>
          </Link>

          {/* Desktop nav — all 6 departments */}
          <div className="hidden md:block w-px h-6 bg-gradient-to-b from-transparent via-violet-500/40 to-transparent mx-1" />
          <nav className="hidden md:flex items-center gap-1 flex-1 relative z-30 pointer-events-auto">
            {DEPARTMENTS.map(dept => {
              const isActive = location.pathname === dept.path ||
                (dept.path === '/Dashboard' && location.pathname === '/') ||
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
              <span className="hidden lg:block font-orbitron text-[10px] tracking-wide">VELO AI</span>
            </Link>
            {user?.role === 'admin' && (
              <Link to="/AdminPanel"
                className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all text-xs ${
                  location.pathname === '/AdminPanel'
                    ? 'border-red-500/50 text-red-300 bg-red-500/10'
                    : 'border-red-500/20 text-red-400/70 hover:text-red-300 hover:border-red-400/40 hover:bg-red-500/8'
                }`}>
                <Shield className="w-3.5 h-3.5" />
                <span className="hidden lg:block font-orbitron text-[10px] tracking-wide">ADMIN</span>
              </Link>
            )}
            <div className="hidden md:block">
              <ActiveIdentityBanner />
            </div>

            {/* Mobile: AI shortcut */}
            <Link to="/Chat"
              className="md:hidden p-2 rounded-xl border border-violet-500/25 text-violet-400 active:scale-95 transition-transform"
              style={{ background: 'rgba(124,58,237,0.1)' }}>
              <MessageSquare className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {currentDept && (
          <div className="absolute bottom-0 left-0 right-0 h-px transition-all duration-500"
            style={{ background: `linear-gradient(90deg, transparent, ${currentDept.color}60, transparent)`, boxShadow: `0 0 12px ${currentDept.glow}` }} />
        )}
      </header>

      {/* ── Page Content ── */}
      <main className="relative z-10 pt-14 min-h-screen pb-24 md:pb-0 pointer-events-auto">
        {currentDept && (
          <div className="h-0.5 w-full"
            style={{ background: `linear-gradient(90deg, transparent 0%, ${currentDept.color}50 20%, ${currentDept.color}80 50%, ${currentDept.color}50 80%, transparent 100%)` }} />
        )}
        <div className="page-enter pointer-events-auto">
          <Outlet />
        </div>
      </main>

      {/* ── Desktop: floating galaxy dot map ── */}
      <div className="fixed bottom-6 right-6 z-40 hidden md:flex flex-col gap-1.5 items-end pointer-events-auto">
        {DEPARTMENTS.map(dept => {
          const isActive = location.pathname === dept.path ||
            (dept.path === '/Dashboard' && location.pathname === '/') ||
            (dept.path !== '/Dashboard' && location.pathname.startsWith(dept.path));
          return (
            <Link key={dept.path} to={dept.path} title={`${dept.label} — AI: ${dept.ai}`}
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
      </div>
    </CyberpunkCommandCenter>
    {/* ── Mobile Bottom Tab Bar & Drawer ── */}
    <MobileTabBar currentPath={location.pathname} onMoreClick={() => setDrawerOpen(true)} />
    <MobileDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} currentPath={location.pathname} />
    </>
  );
}