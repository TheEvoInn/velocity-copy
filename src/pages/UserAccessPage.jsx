import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Settings, Shield, Zap, Globe, Bell } from 'lucide-react';
import UserAccountSettings from '../components/account/UserAccountSettings';
import IdentitySettings from '../components/account/IdentitySettings';
import AutopilotSettings from '../components/account/AutopilotSettings';
import ConnectedAccountsSettings from '../components/account/ConnectedAccountsSettings';
import ComplianceSettings from '../components/account/ComplianceSettings';
import NotificationsHub from '../components/notifications/NotificationsHub';

export default function UserAccessPage() {
  const [activeTab, setActiveTab] = useState('account');

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
      component: NotificationsHub
    }
  ];

  const activeTabData = tabs.find(t => t.id === activeTab);
  const ActiveComponent = activeTabData?.component;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white font-orbitron">User Access Center</h1>
              <p className="text-slate-400">Manage your account, settings, and preferences</p>
            </div>
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
            {/* Quick Stats */}
            <Card className="bg-slate-900/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-sm">Quick Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Account Status</span>
                  <span className="text-emerald-400 font-medium">Active</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-700 pt-3">
                  <span className="text-slate-500">KYC Status</span>
                  <span className="text-blue-400 font-medium">Pending</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-700 pt-3">
                  <span className="text-slate-500">Autopilot</span>
                  <span className="text-amber-400 font-medium">Enabled</span>
                </div>
              </CardContent>
            </Card>

            {/* Help & Support */}
            <Card className="bg-slate-900/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-sm">Need Help?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <a href="/SystemDocumentation" className="block text-blue-400 hover:text-blue-300">
                  → View Documentation
                </a>
                <a href="/Chat" className="block text-blue-400 hover:text-blue-300">
                  → Chat with Mission AI
                </a>
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

        {/* Footer */}
        <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 text-center text-xs text-slate-500">
          Last updated: {new Date().toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}