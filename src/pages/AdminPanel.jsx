import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminOverview from '@/components/admin/AdminOverview.jsx';
import AdminUserManagement from '@/components/admin/AdminUserManagement.jsx';
import AdminOpportunities from '@/components/admin/AdminOpportunities.jsx';
import AdminTransactions from '@/components/admin/AdminTransactions.jsx';
import AdminActivityLog from '@/components/admin/AdminActivityLog.jsx';
import AdminSystemHealth from '@/components/admin/AdminSystemHealth.jsx';
import AdminInterventions from '@/components/admin/AdminInterventions.jsx';
import AdminAnalytics from '@/components/admin/AdminAnalytics.jsx';
import AdminCommandCenter from '@/components/admin/AdminCommandCenter.jsx';
import AdminCompliance from '@/components/admin/AdminCompliance.jsx';
import NotificationCenter from '@/components/notifications/NotificationCenter.jsx';
import AuditTrailDashboard from '@/components/admin/AuditTrailDashboard.jsx';
import { Shield, LayoutDashboard, Users, TrendingUp, DollarSign, Activity, Zap, AlertTriangle, BarChart3, Joystick, Lock, Bell, Database, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminPanel() {
  const { user, logout } = useAuth();

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-slate-400">Admin privileges required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Admin Control Center</h1>
              <p className="text-xs text-slate-400">Profit Engine Management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">Logged in as <span className="text-violet-400 font-medium">{user.full_name || user.email}</span></span>
            <Button variant="ghost" size="sm" onClick={() => logout()} className="text-slate-400 hover:text-white gap-1">
              <LogOut className="w-4 h-4" /> Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <Tabs defaultValue="overview">
          <TabsList className="bg-slate-900 border border-slate-800 mb-6 flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white text-slate-400 gap-1.5">
              <LayoutDashboard className="w-3.5 h-3.5" /> Overview
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white text-slate-400 gap-1.5">
              <Users className="w-3.5 h-3.5" /> User Management
            </TabsTrigger>
            <TabsTrigger value="opportunities" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white text-slate-400 gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Opportunities
            </TabsTrigger>
            <TabsTrigger value="transactions" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white text-slate-400 gap-1.5">
              <DollarSign className="w-3.5 h-3.5" /> Transactions
            </TabsTrigger>
            <TabsTrigger value="activity" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white text-slate-400 gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Activity Log
            </TabsTrigger>
            <TabsTrigger value="health" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white text-slate-400 gap-1.5">
              <Zap className="w-3.5 h-3.5" /> System Health
            </TabsTrigger>
            <TabsTrigger value="interventions" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white text-slate-400 gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Interventions
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white text-slate-400 gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" /> Analytics
            </TabsTrigger>
            <TabsTrigger value="command" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-slate-400 gap-1.5">
              <Joystick className="w-3.5 h-3.5" /> Command Center
            </TabsTrigger>
            <TabsTrigger value="compliance" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Compliance
            </TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-400 gap-1.5">
              <Bell className="w-3.5 h-3.5" /> Notifications
            </TabsTrigger>
            <TabsTrigger value="audit" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-slate-400 gap-1.5">
              <Database className="w-3.5 h-3.5" /> Audit Trail
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview"><AdminOverview /></TabsContent>
          <TabsContent value="users"><AdminUserManagement /></TabsContent>
          <TabsContent value="opportunities"><AdminOpportunities /></TabsContent>
          <TabsContent value="transactions"><AdminTransactions /></TabsContent>
          <TabsContent value="activity"><AdminActivityLog /></TabsContent>
          <TabsContent value="health"><AdminSystemHealth /></TabsContent>
          <TabsContent value="interventions"><AdminInterventions /></TabsContent>
          <TabsContent value="analytics"><AdminAnalytics /></TabsContent>
          <TabsContent value="command"><AdminCommandCenter /></TabsContent>
          <TabsContent value="compliance"><AdminCompliance /></TabsContent>
          <TabsContent value="notifications"><NotificationCenter /></TabsContent>
          <TabsContent value="audit"><AuditTrailDashboard /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}