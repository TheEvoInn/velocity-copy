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
  { label: 'Commerce', path: '/DigitalCommerce' },
  { label: 'Crypto', path: '/CryptoProfitSystems' }];


  return (
    <nav className="glass-nav sticky top-0 z-50 border-b border-slate-700/50">
      

























      
    </nav>);

}