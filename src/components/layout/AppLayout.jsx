import React, { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import ActiveIdentityBanner from '../identity/ActiveIdentityBanner';
import { LayoutDashboard, Target, Wallet, BookOpen, MessageSquare, Activity, Menu, X, Zap, Bot, Link2, FileText, User, MoreHorizontal, BarChart2, Trophy, TrendingUp } from 'lucide-react';

const primaryNav = [
  { path: '/Dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/AutoPilot', icon: Bot, label: 'Autopilot', highlight: true },
  { path: '/Opportunities', icon: Target, label: 'Opportunities' },
  { path: '/PrizeDashboard', icon: Trophy, label: 'Prizes', highlight: true },
  { path: '/AnalyticsDashboard', icon: BarChart2, label: 'Analytics' },
];

const moreNav = [
  { path: '/NegotiationCenter', icon: MessageSquare, label: 'Negotiate' },
  { path: '/PrizePayoutsTracker', icon: TrendingUp, label: 'Payouts' },
  { path: '/WithdrawalEngine', icon: Zap, label: 'Money Engine' },
  { path: '/IdentityManager', icon: User, label: 'Identities' },
  { path: '/GoalCenter', icon: Zap, label: 'Goals' },
  { path: '/AccountManager', icon: Link2, label: 'Accounts' },
  { path: '/AIWorkLogPage', icon: FileText, label: 'Work Log' },
  { path: '/Strategies', icon: BookOpen, label: 'Strategies' },
  { path: '/WalletPage', icon: Wallet, label: 'Wallet' },
  { path: '/ActivityPage', icon: Activity, label: 'Activity' },
  { path: '/Chat', icon: MessageSquare, label: 'AI Chat' },
];

export default function AppLayout() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const allNav = [...primaryNav, ...moreNav];
  const isMoreActive = moreNav.some(n => n.path === location.pathname);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="fixed top-0 left-0 right-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/50">
        <div className="flex items-center justify-between px-4 h-14">
          {/* Logo */}
          <Link to="/Dashboard" className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm hidden sm:block">Profit Engine</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-0.5">
            {primaryNav.map(({ path, icon: Icon, label, highlight }) => {
              const isActive = location.pathname === path;
              return (
                <Link key={path} to={path}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive ? 'bg-slate-800 text-emerald-400'
                    : highlight ? 'text-emerald-500 hover:text-emerald-300 hover:bg-emerald-950/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}>
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                  {highlight && !isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                </Link>
              );
            })}

            {/* More dropdown */}
            <div ref={moreRef} className="relative">
              <button onClick={() => setMoreOpen(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isMoreActive ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}>
                <MoreHorizontal className="w-3.5 h-3.5" />
                More
              </button>
              {moreOpen && (
                <div className="absolute top-full right-0 mt-1 w-44 bg-slate-900 border border-slate-700 rounded-xl shadow-xl py-1.5 z-50">
                  {moreNav.map(({ path, icon: Icon, label }) => {
                    const isActive = location.pathname === path;
                    return (
                      <Link key={path} to={path} onClick={() => setMoreOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors ${
                          isActive ? 'text-emerald-400 bg-slate-800' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}>
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          <div className="flex items-center gap-2">
            {/* Identity banner */}
            <div className="hidden md:block">
              <ActiveIdentityBanner />
            </div>
            {/* Mobile toggle */}
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white">
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-slate-800 bg-slate-950 px-4 py-3 grid grid-cols-2 gap-1">
            {allNav.map(({ path, icon: Icon, label }) => {
              const isActive = location.pathname === path;
              return (
                <Link key={path} to={path} onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-slate-800 text-emerald-400' : 'text-slate-500 hover:text-white hover:bg-slate-900'
                  }`}>
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      <main className="pt-14 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}