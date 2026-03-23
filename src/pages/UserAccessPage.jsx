import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Settings, Shield, Zap, Globe, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import UserAccountSettings from '../components/account/UserAccountSettings';
import IdentitySettings from '../components/account/IdentitySettings';
import AutopilotSettings from '../components/account/AutopilotSettings';
import ConnectedAccountsSettings from '../components/account/ConnectedAccountsSettings';
import ComplianceSettings from '../components/account/ComplianceSettings';
import NotificationsHub from '../components/notifications/NotificationsHub';
import KYCConsolidationStatus from '../components/account/KYCConsolidationStatus';

export default function UserAccessPage() {
  const [activeTab, setActiveTab] = useState('account');

  const { data: kycList = [], refetch: refetchKYC } = useQuery({
    queryKey: ['kycStatus_sidebar'],
    queryFn: async () => {
      const result = await base44.functions.invoke('kycAdminService', { action: 'get_my_kyc' });
      return result.data.record ? [result.data.record] : [];
    },
    refetchInterval: 3000
  });
  const { data: goalsList = [] } = useQuery({
    queryKey: ['userGoals'],
    queryFn: () => base44.entities.UserGoals.list(),
  });
  const kyc = kycList[0];
  const goals = goalsList[0] || {};

  const tabs = [
    {
      id: 'account',
      label: 'Account',
      icon: User,
      component: UserAccountSettings
    },
    {
      id: 'identity',
      label: 'Identity',
      icon: Settings,
      component: IdentitySettings
    },
    {
      id: 'autopilot',
      label: 'Autopilot',
      icon: Zap,
      component: AutopilotSettings
    },
    {
      id: 'connections',
      label: 'Connected Accounts',
      icon: Globe,
      component: ConnectedAccountsSettings
    },
    {
      id: 'compliance',
      label: 'Compliance',
      icon: Shield,
      component: ComplianceSettings
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      component: () => import('@/components/notifications/NotificationPreferences').then(m => m.default)
    },
    {
      id: 'notification_history',
      label: 'Notification History',
      icon: Bell,
      component: NotificationsHub
    }
  ];

  const activeTabData = tabs.find(t => t.id === activeTab);
  const ActiveComponent = activeTabData?.component;

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
            <Settings className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="font-orbitron text-lg font-bold text-white tracking-wide">USER ACCESS CENTER</h1>
            <p className="text-xs text-slate-500">Account · Settings · Preferences · Compliance</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="overflow-x-auto">
          <div className="flex gap-2 min-w-max pb-2">
            {tabs.map((tab) => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <IconComponent className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3">
            {ActiveComponent && <ActiveComponent />}
          </div>

          {/* Sidebar Info */}
          <div className="space-y-4">
            {/* KYC Consolidation Status - Kristopher Tibbetts */}
            <KYCConsolidationStatus 
              targetEmail="kristopherwork90@gmail.com" 
              fullName="Kristopher Tibbetts"
            />

            {/* Live Status */}
            <Card className="bg-slate-900/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-sm">Live Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Account</span>
                  <span className="text-emerald-400 font-medium">Active</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-700 pt-3">
                  <span className="text-slate-500">KYC Status</span>
                  <span className={`font-medium ${
                    kyc?.status === 'approved' ? 'text-emerald-400' :
                    kyc?.status === 'rejected' ? 'text-red-400' :
                    kyc?.status === 'under_review' ? 'text-blue-400' :
                    kyc ? 'text-amber-400' : 'text-slate-500'
                  }`}>{kyc?.status ? kyc.status.replace(/_/g, ' ') : 'Not Started'}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-700 pt-3">
                  <span className="text-slate-500">Autopilot</span>
                  <span className={`font-medium ${goals.autopilot_enabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {goals.autopilot_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-700 pt-3">
                  <span className="text-slate-500">Daily Target</span>
                  <span className="text-cyan-400 font-medium">${goals.daily_target || 1000}</span>
                </div>
              </CardContent>
            </Card>

            {/* Help & Support */}
            <Card className="bg-slate-900/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-sm">Quick Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <Link to="/SystemDocumentation" className="block text-blue-400 hover:text-blue-300">→ Documentation</Link>
                <Link to="/Chat" className="block text-blue-400 hover:text-blue-300">→ Mission AI</Link>
                <Link to="/AutoPilot" className="block text-blue-400 hover:text-blue-300">→ Autopilot Dashboard</Link>
                <Link to="/KYCManagement" className="block text-blue-400 hover:text-blue-300">→ KYC Verification</Link>
                <Link to="/TemplatesLibrary" className="block text-blue-400 hover:text-blue-300">→ Templates Library</Link>
              </CardContent>
            </Card>

            {/* Security Tips */}
            <Card className="bg-emerald-950/30 border-emerald-500/30">
              <CardHeader>
                <CardTitle className="text-sm text-emerald-400">Security Tips</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-emerald-200">
                <div>✓ Change password regularly</div>
                <div>✓ Review connected accounts</div>
                <div>✓ Keep KYC updated</div>
                <div>✓ Use unique passwords</div>
              </CardContent>
            </Card>
          </div>
        </div>


      </div>
    </div>
  );
}