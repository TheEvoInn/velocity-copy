import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, CheckCircle2, Bot, Link2, Clock, Zap, Search, RefreshCw } from 'lucide-react';

export default function AdminControlPanel() {
  const [search, setSearch] = useState('');
  const [expandedUser, setExpandedUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [metadata, setMetadata] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);

  // Fetch admin data
  const fetchAdminData = async () => {
    try {
      setIsLoading(true);
      const res = await base44.functions.invoke('adminPanelSecureQuery', {
        filter_email: search.length > 2 ? search : null
      });
      
      // Response structure: res = { data: { success, admin, timestamp, data: { users, metadata } } }
      const responseData = res.data?.data || res.data;
      
      if (responseData) {
        setUsers(responseData.users || []);
        setMetadata(responseData.metadata || {});
      }
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
      setUsers([]);
      setMetadata({});
    } finally {
      setIsLoading(false);
    }
  };

  const refetch = async () => {
    setIsRefetching(true);
    await fetchAdminData();
    setIsRefetching(false);
  };

  // Load data on mount
  useEffect(() => {
    fetchAdminData();
  }, [search]);

  // Auto-refetch every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAdminData();
    }, 15000);
    return () => clearInterval(interval);
  }, [search]);

  // Status color mapping
  const getStatusColor = (status) => {
    const colors = {
      'verified': '#10b981',
      'approved': '#10b981',
      'pending': '#f59e0b',
      'submitted': '#3b82f6',
      'under_review': '#8b5cf6',
      'rejected': '#ef4444',
      'expired': '#ef4444',
      'healthy': '#10b981',
      'connected': '#10b981',
      'error': '#ef4444',
      'invalid_credentials': '#ef4444'
    };
    return colors[status] || '#6b7280';
  };

  const getStatusBg = (status) => {
    const color = getStatusColor(status);
    return `${color}15`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Admin Control Panel</h1>
            <p className="text-slate-600 mt-1">Manage all users, identities, and platform connections</p>
          </div>
          <Button 
            onClick={() => refetch()}
            disabled={isRefetching}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4" style={{ color: '#a855f7' }} />
                <p className="text-xs font-medium text-slate-600 uppercase">Total Users</p>
              </div>
              <p className="text-2xl font-bold text-slate-900">{metadata.total_users || 0}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4" style={{ color: '#10b981' }} />
                <p className="text-xs font-medium text-slate-600 uppercase">Onboarded</p>
              </div>
              <p className="text-2xl font-bold text-slate-900">{metadata.users_onboarded || 0}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="w-4 h-4" style={{ color: '#06b6d4' }} />
                <p className="text-xs font-medium text-slate-600 uppercase">With Identities</p>
              </div>
              <p className="text-2xl font-bold text-slate-900">{metadata.users_with_identities || 0}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Link2 className="w-4 h-4" style={{ color: '#f59e0b' }} />
                <p className="text-xs font-medium text-slate-600 uppercase">Connected Platforms</p>
              </div>
              <p className="text-2xl font-bold text-slate-900">{metadata.users_with_connections || 0}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4" style={{ color: '#10b981' }} />
                <p className="text-xs font-medium text-slate-600 uppercase">Total Earned</p>
              </div>
              <p className="text-2xl font-bold text-slate-900">${(metadata.total_earned_across_users || 0).toFixed(0)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search by email (min 3 characters)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Users List */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Users ({users.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-slate-500">No users found</div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {users.map((user) => (
                  <UserCard 
                    key={user.email} 
                    user={user}
                    isExpanded={expandedUser === user.email}
                    onToggle={() => setExpandedUser(expandedUser === user.email ? null : user.email)}
                    getStatusColor={getStatusColor}
                    getStatusBg={getStatusBg}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function UserCard({ user, isExpanded, onToggle, getStatusColor, getStatusBg }) {
  return (
    <div 
      className="border rounded-lg p-4 hover:bg-slate-50 cursor-pointer transition"
      onClick={onToggle}
    >
      {/* User Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-slate-900">{user.full_name}</h3>
            {user.role === 'admin' && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">Admin</span>
            )}
          </div>
          <p className="text-sm text-slate-600">{user.email}</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-block w-2 h-2 rounded-full`} style={{
              backgroundColor: user.stats.onboarded ? '#10b981' : '#d1d5db'
            }}></span>
            <span className="text-xs font-medium text-slate-600">
              {user.stats.onboarded ? 'Onboarded' : 'Pending'}
            </span>
          </div>
          <p className="text-xs text-slate-500">Earned: ${user.stats.earned_total.toFixed(2)}</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-200">
        <div className="text-center">
          <p className="text-xs text-slate-600">Identities</p>
          <p className="text-lg font-bold text-slate-900">{user.identities.length}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-600">Platforms</p>
          <p className="text-lg font-bold text-slate-900">{user.connections.length}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-600">KYC</p>
          <p className="text-lg font-bold" style={{ color: getStatusColor(user.stats.kyc_status || 'pending') }}>
            {(user.stats.kyc_status || 'pending').charAt(0).toUpperCase()}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-600">Autopilot</p>
          <p className="text-lg font-bold text-slate-900">{user.stats.autopilot_enabled ? '✓' : '—'}</p>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-slate-200 space-y-4">
          {/* Identities */}
          {user.identities.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">AI Identities ({user.identities.length})</h4>
              <div className="space-y-2">
                {user.identities.map(id => (
                  <div key={id.id} className="p-2 bg-slate-50 rounded border border-slate-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{id.name}</p>
                        <p className="text-xs text-slate-600">{id.role_label}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        id.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {id.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Platform Connections */}
          {user.connections.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Platform Connections ({user.connections.length})</h4>
              <div className="space-y-2">
                {user.connections.map(conn => (
                  <div key={conn.id} className="p-2 bg-slate-50 rounded border border-slate-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-900 capitalize">{conn.platform}</p>
                        <p className="text-xs text-slate-600">{conn.account_username}</p>
                      </div>
                      <span style={{
                        backgroundColor: getStatusBg(conn.status),
                        color: getStatusColor(conn.status)
                      }} className="px-2 py-1 rounded text-xs font-medium">
                        {conn.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* KYC Status */}
          {user.kycs.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">KYC Verification</h4>
              {user.kycs.map(kyc => (
                <div key={kyc.id} className="p-3 bg-slate-50 rounded border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-slate-900">Status</p>
                    <span style={{
                      backgroundColor: getStatusBg(kyc.status),
                      color: getStatusColor(kyc.status)
                    }} className="px-2 py-1 rounded text-xs font-medium">
                      {kyc.status}
                    </span>
                  </div>
                  {kyc.admin_status && (
                    <p className="text-xs text-slate-600">Admin: <span className="font-medium">{kyc.admin_status}</span></p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Opportunities */}
          {user.opportunities.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Opportunities ({user.opportunities.length})</h4>
              <p className="text-xs text-slate-600">{user.stats.total_opportunities} total opportunities found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}