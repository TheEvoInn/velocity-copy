import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  Zap, LayoutDashboard, Telescope, Cpu, Landmark, SlidersHorizontal,
  Menu, X, ChevronRight, MessageSquare
} from 'lucide-react';
import ActiveIdentityBanner from '../identity/ActiveIdentityBanner';

const DEPARTMENTS = [
  {
    path: '/Dashboard',
    icon: LayoutDashboard,
    label: 'Command Center',
    color: 'text-slate-300',
    activeColor: 'text-white',
    activeBg: 'bg-slate-800',
    desc: 'Overview & control',
  },
  {
    path: '/Discovery',
    icon: Telescope,
    label: 'Discovery',
    color: 'text-amber-400/70',
    activeColor: 'text-amber-400',
    activeBg: 'bg-amber-950/40',
    badge: 'bg-amber-500',
    desc: 'Intelligence & scanning',
  },
  {
    path: '/Execution',
    icon: Cpu,
    label: 'Execution',
    color: 'text-blue-400/70',
    activeColor: 'text-blue-400',
    activeBg: 'bg-blue-950/40',
    badge: 'bg-blue-500',
    desc: 'Automation & tasks',
  },
  {
    path: '/Finance',
    icon: Landmark,
    label: 'Finance',
    color: 'text-emerald-400/70',
    activeColor: 'text-emerald-400',
    activeBg: 'bg-emerald-950/40',
    badge: 'bg-emerald-500',
    desc: 'Wallet & compliance',
  },
  {
    path: '/Control',
    icon: SlidersHorizontal,
    label: 'Control',
    color: 'text-purple-400/70',
    activeColor: 'text-purple-400',
    activeBg: 'bg-purple-950/40',
    badge: 'bg-purple-500',
    desc: 'Settings & identities',
  },
];

const QUICK_LINKS = [
  { path: '/Chat', icon: MessageSquare, label: 'AI Assistant' },
];

export default function AppLayout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-slate-950/95 backdrop-blur-xl border-b border-slate-800/60 flex items-center px-4 gap-3">
        <Link to="/Dashboard" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-sm hidden sm:block tracking-tight">Profit Engine</span>
        </Link>

        {/* Desktop Dept Nav */}
        <nav className="hidden md:flex items-center gap-0.5 ml-4 flex-1">
          {DEPARTMENTS.map(({ path, icon: Icon, label, color, activeColor, activeBg, badge }) => {
            const isActive = location.pathname === path || (path !== '/Dashboard' && location.pathname.startsWith(path));
            return (
              <Link key={path} to={path}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive ? `${activeBg} ${activeColor}` : `${color} hover:text-white hover:bg-slate-900`
                }`}>
                <Icon className="w-3.5 h-3.5" />
                {label}
                {badge && !isActive && <span className={`w-1.5 h-1.5 rounded-full ${badge} animate-pulse opacity-70`} />}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 ml-auto">
          <div className="hidden md:block">
            <ActiveIdentityBanner />
          </div>
          {QUICK_LINKS.map(({ path, icon: Icon, label }) => (
            <Link key={path} to={path}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-900 transition-colors">
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          ))}
          <button onClick={() => setMobileOpen(v => !v)} className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Nav */}
      {mobileOpen && (
        <nav className="fixed top-14 left-0 right-0 z-40 bg-slate-950 border-b border-slate-800 px-4 py-3 grid grid-cols-2 gap-1.5 md:hidden">
          {DEPARTMENTS.map(({ path, icon: Icon, label, color, activeColor, activeBg }) => {
            const isActive = location.pathname === path;
            return (
              <Link key={path} to={path} onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? `${activeBg} ${activeColor}` : `${color} hover:text-white hover:bg-slate-900`
                }`}>
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
          {QUICK_LINKS.map(({ path, icon: Icon, label }) => (
            <Link key={path} to={path} onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-900">
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>
      )}

      <main className="pt-14 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}