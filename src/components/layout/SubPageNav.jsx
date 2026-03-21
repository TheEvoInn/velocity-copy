import React from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import GlobalSearch from '@/components/search/GlobalSearch';
import NotificationBell from '@/components/notifications/NotificationBell';

export default function SubPageNav() {
  const navItems = [
    { label: 'Bridge', path: '/StarshipBridge' },
    { label: 'Control', path: '/Control' },
    { label: 'AutoPilot', path: '/AutoPilot' },
    { label: 'Discovery', path: '/Discovery' },
    { label: 'Execution', path: '/Execution' },
    { label: 'Finance', path: '/Finance' },
    { label: 'Crypto', path: '/CryptoAutomation' },
    { label: 'Resellers', path: '/DigitalResellers' },
    { label: 'NED', path: '/NED' },
    { label: 'VIPZ', path: '/VIPZ' },
  ];

  return (
    <nav className="glass-nav sticky top-0 z-50 border-b border-slate-700/50">
      <div className="max-w-full px-4 md:px-6 py-3">
        <div className="flex items-center gap-3">
          {/* Home Button */}
          <Link to="/" className="flex-shrink-0">
            <button className="p-2 hover:bg-slate-800/50 rounded-lg transition-colors">
              <Home className="w-4 h-4 text-cyan-400" />
            </button>
          </Link>

          {/* Global Search */}
          <GlobalSearch />

          {/* Notification Bell */}
          <NotificationBell />

          {/* Navigation Items */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {navItems.map((item) => (
              <Link key={item.path} to={item.path}>
                <button className="px-3 py-1.5 text-xs font-orbitron text-slate-300 hover:text-cyan-400 hover:bg-slate-800/50 rounded transition-all whitespace-nowrap">
                  {item.label}
                </button>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}