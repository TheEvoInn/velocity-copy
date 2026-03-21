/**
 * ADMIN CONTROL PANEL — Exclusive admin-only command center
 * Role-gated: only users with role === 'admin' can access this page.
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import {
  Shield, AlertTriangle, Users, FileCheck, Activity,
  Zap, Settings, ChevronRight, Lock
} from 'lucide-react';
import AdminHealthDashboard from '@/components/admin/AdminHealthDashboard';
import AdminUserManagement from '@/components/admin/AdminUserManagement';
import AdminKYCReview from '@/components/admin/AdminKYCReview';
import AdminActivityMonitor from '@/components/admin/AdminActivityMonitor';
import AdminErrorCenter from '@/components/admin/AdminErrorCenter';
import AdminNotifications from '@/components/admin/AdminNotifications';
import { Activity as ActivityIcon } from 'lucide-react';

const TABS = [
  { id: 'health',    label: 'Platform Health',  icon: Zap,         color: '#06b6d4' },
  { id: 'webhooks',  label: 'Webhooks',         icon: ActivityIcon, color: '#06b6d4' },
  { id: 'users',     label: 'User Management',  icon: Users,       color: '#8b5cf6' },
  { id: 'kyc',       label: 'KYC Review',       icon: FileCheck,   color: '#f59e0b' },
  { id: 'activity',  label: 'Activity Logs',    icon: Activity,    color: '#10b981' },
  { id: 'errors',    label: 'Error Center',     icon: AlertTriangle, color: '#ef4444' },
  { id: 'alerts',    label: 'Notifications',    icon: Settings,    color: '#a855f7' },
];

export default function AdminControlPanel() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('health');

  // Strict role gate
  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="font-orbitron text-xl font-bold text-white">Access Denied</h2>
          <p className="text-sm text-slate-400">
            This area is restricted to administrator accounts only.
            Your current role does not permit access.
          </p>
          <Link to="/Dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white hover:bg-slate-700 transition-colors">
            <ChevronRight className="w-4 h-4 rotate-180" /> Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(239,68,68,0.25), rgba(168,85,247,0.25))',
              border: '1px solid rgba(239,68,68,0.4)',
              boxShadow: '0 0 20px rgba(239,68,68,0.3)',
            }}>
            <Shield className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h1 className="font-orbitron text-xl font-bold tracking-widest text-white">ADMIN CONTROL PANEL</h1>
            <p className="text-xs text-slate-500 tracking-wide">
              Logged in as <span className="text-red-400 font-medium">{user?.email}</span> · Administrator
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/25">
          <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          <span className="text-xs text-red-300 font-medium">ADMIN MODE</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1.5 flex-wrap mb-6 p-1 rounded-2xl bg-slate-900/60 border border-slate-800">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                isActive ? 'text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
              style={isActive ? {
                background: `${tab.color}18`,
                border: `1px solid ${tab.color}40`,
                boxShadow: `0 0 12px ${tab.color}25`,
              } : {}}>
              <Icon className="w-3.5 h-3.5" style={isActive ? { color: tab.color } : {}} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'health'   && <AdminHealthDashboard />}
        {activeTab === 'webhooks' && <div className="text-slate-300"><Link to="/WebhookListener" className="text-cyan-400 hover:underline flex items-center gap-2"><ChevronRight className="w-4 h-4" />Go to Webhook Listener</Link></div>}
        {activeTab === 'users'    && <AdminUserManagement />}
        {activeTab === 'kyc'      && <AdminKYCReview />}
        {activeTab === 'activity' && <AdminActivityMonitor />}
        {activeTab === 'errors'   && <AdminErrorCenter />}
        {activeTab === 'alerts'   && <AdminNotifications />}
      </div>
    </div>
  );
}