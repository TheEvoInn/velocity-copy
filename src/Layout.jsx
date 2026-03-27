import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  LayoutDashboard, Rocket, Settings, Bot, Cpu, Search, Briefcase,
  Play, DollarSign, Wallet, Bitcoin, Store, Brain, Gem,
  UserCircle, Shield, MessageSquare, Activity, ChevronLeft, LogOut, Menu
} from 'lucide-react';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

const NAV_GROUPS = [
  {
    label: 'Command Center',
    items: [
      { name: 'Dashboard', icon: LayoutDashboard },
      { name: 'StarshipBridge', icon: Rocket, label: 'Starship Bridge' },
      { name: 'Control', icon: Settings },
    ],
  },
  {
    label: 'Automation',
    items: [
      { name: 'AutoPilot', icon: Bot, label: 'Auto Pilot' },
      { name: 'AutoPilotEngine', icon: Cpu, label: 'AutoPilot Engine' },
      { name: 'Discovery', icon: Search },
      { name: 'WorkDiscovery', icon: Briefcase, label: 'Work Discovery' },
      { name: 'Execution', icon: Play },
    ],
  },
  {
    label: 'Finance',
    items: [
      { name: 'Finance', icon: DollarSign },
      { name: 'WalletDashboard', icon: Wallet, label: 'Wallet' },
      { name: 'CryptoAutomation', icon: Bitcoin, label: 'Crypto' },
      { name: 'DigitalResellers', icon: Store, label: 'Resellers' },
    ],
  },
  {
    label: 'AI Agents',
    items: [
      { name: 'NED', icon: Brain },
      { name: 'VIPZ', icon: Gem },
      { name: 'Chat', icon: MessageSquare },
    ],
  },
  {
    label: 'System',
    items: [
      { name: 'IdentityManager', icon: UserCircle, label: 'Identity' },
      { name: 'AdminControlPanel', icon: Shield, label: 'Admin Panel' },
      { name: 'SystemAuditDashboard', icon: Activity, label: 'Audit' },
    ],
  },
];

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const currentPage = location.pathname.replace('/', '') || 'Dashboard';

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        setAuthLoading(true);
        setAuthError(null);
        const authed = await base44.auth.isAuthenticated();
        if (!authed) {
          base44.auth.redirectToLogin(window.location.pathname);
          return;
        }
        const me = await base44.auth.me();
        if (!cancelled) setUser(me);
      } catch (err) {
        console.error('[Layout] auth error', err);
        if (!cancelled) setAuthError(err.message || 'Authentication failed');
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }
    bootstrap();
    return () => { cancelled = true; };
  }, []);

  async function refreshUser() {
    try {
      const me = await base44.auth.me();
      setUser(me);
      return me;
    } catch (err) {
      console.error('[Layout] refresh error', err);
      return null;
    }
  }

  async function logout() {
    await base44.auth.logout();
    setUser(null);
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground font-inter">Initializing Velocity…</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        <div className="text-center space-y-4 max-w-md">
          <p className="text-red-400 font-inter">{authError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded bg-violet-600 hover:bg-violet-500 text-white text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, setUser, refreshUser, logout }}>
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        <aside
          className={`${sidebarOpen ? 'w-56' : 'w-14'} transition-all duration-200 flex flex-col border-r border-border bg-card/60 backdrop-blur-sm`}
        >
          <div className="flex items-center justify-between px-3 h-14 border-b border-border shrink-0">
            {sidebarOpen && (
              <span className="font-orbitron text-sm tracking-widest text-violet-400">VELOCITY</span>
            )}
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 rounded hover:bg-accent">
              {sidebarOpen ? <ChevronLeft size={16} /> : <Menu size={16} />}
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-2 space-y-4">
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                {sidebarOpen && (
                  <p className="px-3 mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </p>
                )}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = currentPage === item.name;
                  return (
                    <button
                      key={item.name}
                      onClick={() => navigate('/' + item.name)}
                      title={item.label || item.name}
                      className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm rounded-md transition-colors
                        ${active
                          ? 'bg-violet-600/20 text-violet-300 font-medium'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        }`}
                    >
                      <Icon size={16} className="shrink-0" />
                      {sidebarOpen && <span className="truncate">{item.label || item.name}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="border-t border-border p-2 shrink-0">
            {sidebarOpen && user && (
              <p className="text-xs text-muted-foreground truncate mb-1 px-1">
                {user.email || user.name || 'User'}
              </p>
            )}
            <button
              onClick={logout}
              title="Log out"
              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-red-400 hover:bg-red-500/10 rounded-md"
            >
              <LogOut size={16} />
              {sidebarOpen && <span>Log out</span>}
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </AuthContext.Provider>
  );
}
