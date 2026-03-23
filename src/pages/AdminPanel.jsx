import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Users, Shield, Search, Trash2, CheckCircle2, XCircle,
  Eye, RefreshCw, Clock, AlertCircle, Activity, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';

async function adminCall(action, extra = {}) {
  const res = await base44.functions.invoke('adminService', { action, ...extra });
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
}

export default function AdminPanel() {
  const [searchEmail, setSearchEmail] = useState('');
  const [expandedUser, setExpandedUser] = useState(null);
  const queryClient = useQueryClient();

  const { data: usersData, isLoading: loadingUsers, refetch, error: usersError } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: () => adminCall('list_users'),
    staleTime: 0,
  });

  const { data: kycsData, isLoading: loadingKYCs } = useQuery({
    queryKey: ['adminKYCs'],
    queryFn: () => adminCall('list_kycs'),
    staleTime: 0,
  });

  const { data: identitiesData } = useQuery({
    queryKey: ['adminIdentities'],
    queryFn: () => adminCall('list_identities'),
    staleTime: 0,
  });

  const users = usersData?.users || [];
  const kycs = kycsData?.kycs || [];
  const identities = identitiesData?.identities || [];

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    queryClient.invalidateQueries({ queryKey: ['adminKYCs'] });
    queryClient.invalidateQueries({ queryKey: ['adminIdentities'] });
  };

  const approveMutation = useMutation({
    mutationFn: async (kycId) => adminCall('approve_kyc', { kyc_id: kycId }),
    onSuccess: () => { invalidateAll(); toast.success('KYC approved'); },
    onError: (e) => toast.error(`Failed: ${e.message}`)
  });

  const denyMutation = useMutation({
    mutationFn: async (kycId) => adminCall('deny_kyc', { kyc_id: kycId }),
    onSuccess: () => { invalidateAll(); toast.success('KYC denied'); },
    onError: (e) => toast.error(`Failed: ${e.message}`)
  });

  const setRoleMutation = useMutation({
    mutationFn: async ({ userId, role }) => adminCall('update_user_role', { user_id: userId, role }),
    onSuccess: () => { invalidateAll(); toast.success('Role updated'); },
    onError: (e) => toast.error(`Failed: ${e.message}`)
  });

  const filteredUsers = searchEmail.length >= 2
    ? users.filter(u => u.email?.toLowerCase().includes(searchEmail.toLowerCase()) || u.full_name?.toLowerCase().includes(searchEmail.toLowerCase()))
    : users;

  const totalUsers = users.length;
  const verifiedCount = kycs.filter(k => k.status === 'approved').length;
  const rejectedCount = kycs.filter(k => k.status === 'rejected').length;
  const pendingCount = kycs.filter(k => !['approved', 'rejected'].includes(k.status)).length;

  const isLoading = loadingUsers || loadingKYCs;

  return (
    <div className="min-h-screen galaxy-bg p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-orbitron font-bold text-white mb-2">ADMIN PANEL</h1>
            <p className="text-slate-400 text-sm">Platform-wide user and KYC management</p>
          </div>
          <Button onClick={() => { invalidateAll(); refetch(); }} disabled={isLoading} variant="outline" className="gap-2">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Error state */}
        {usersError && (
          <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            Error loading users: {usersError.message}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Users', value: totalUsers, color: 'text-cyan-400', icon: Users },
            { label: 'KYC Approved', value: verifiedCount, color: 'text-emerald-400', icon: CheckCircle2 },
            { label: 'KYC Pending', value: pendingCount, color: 'text-amber-400', icon: Clock },
            { label: 'KYC Rejected', value: rejectedCount, color: 'text-red-400', icon: AlertCircle },
          ].map(stat => (
            <Card key={stat.label} className="glass-card">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-xs uppercase">{stat.label}</p>
                    <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{isLoading ? '…' : stat.value}</p>
                  </div>
                  <stat.icon className={`w-8 h-8 opacity-40 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search */}
        <Card className="glass-card mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search by name or email..."
                value={searchEmail}
                onChange={e => setSearchEmail(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </CardContent>
        </Card>

        {/* Users List */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              Users ({filteredUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                Loading users...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-slate-500">No users found</div>
            ) : (
              <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
                {filteredUsers.map(u => {
                  const userKYC = kycs.find(k => k.created_by === u.email);
                  const userIdentities = identities.filter(i => i.created_by === u.email);
                  const isExpanded = expandedUser === u.id;

                  const kycStatusColor = userKYC?.status === 'approved'
                    ? 'text-emerald-400 border-emerald-400/30'
                    : userKYC?.status === 'rejected'
                    ? 'text-red-400 border-red-400/30'
                    : 'text-amber-400 border-amber-400/30';

                  return (
                    <div key={u.id} className="border border-slate-700/50 rounded-xl overflow-hidden hover:border-slate-600 transition-colors">
                      {/* Row */}
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02]"
                        onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${u.role === 'admin' ? 'bg-cyan-400' : 'bg-slate-600'}`} />
                          <div className="min-w-0">
                            <p className="text-white font-medium truncate">{u.full_name || 'No name'}</p>
                            <p className="text-xs text-slate-400 truncate">{u.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                          <Badge variant="outline" className="text-xs">
                            {u.role || 'user'}
                          </Badge>
                          {userKYC ? (
                            <Badge variant="outline" className={`text-xs ${kycStatusColor}`}>
                              KYC: {userKYC.status}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-slate-500">No KYC</Badge>
                          )}
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                        </div>
                      </div>

                      {/* Expanded */}
                      {isExpanded && (
                        <div className="border-t border-slate-700/50 bg-slate-900/30 p-4 space-y-4">

                          {/* User info */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-slate-800/40 rounded p-2">
                              <p className="text-slate-500 mb-0.5">User ID</p>
                              <p className="text-slate-300 font-mono">{u.id?.substring(0, 16)}...</p>
                            </div>
                            <div className="bg-slate-800/40 rounded p-2">
                              <p className="text-slate-500 mb-0.5">Joined</p>
                              <p className="text-slate-300">{new Date(u.created_date).toLocaleDateString()}</p>
                            </div>
                          </div>

                          {/* Role management */}
                          <div className="bg-slate-800/40 rounded p-3">
                            <p className="text-xs font-semibold text-cyan-400 mb-2">Role Management</p>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setRoleMutation.mutate({ userId: u.id, role: 'user' })}
                                disabled={setRoleMutation.isPending || u.role === 'user'}
                                className="text-xs"
                              >
                                Set User
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setRoleMutation.mutate({ userId: u.id, role: 'admin' })}
                                disabled={setRoleMutation.isPending || u.role === 'admin'}
                                className="text-xs border-cyan-400/30 text-cyan-400 hover:bg-cyan-400/10"
                              >
                                Set Admin
                              </Button>
                            </div>
                          </div>

                          {/* KYC section */}
                          {userKYC ? (
                            <div className="bg-slate-800/40 rounded p-3">
                              <p className="text-xs font-semibold text-violet-400 mb-2">KYC Verification</p>
                              <div className="space-y-1 text-xs text-slate-300 mb-3">
                                <p>Legal Name: <span className="text-white">{userKYC.full_legal_name || '—'}</span></p>
                                <p>Status: <span className="text-white capitalize">{userKYC.status}</span></p>
                                {userKYC.verified_at && (
                                  <p>Verified: <span className="text-emerald-400">{new Date(userKYC.verified_at).toLocaleString()}</span></p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => approveMutation.mutate(userKYC.id)}
                                  disabled={approveMutation.isPending || userKYC.status === 'approved'}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
                                >
                                  <CheckCircle2 className="w-3 h-3" /> Approve
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => denyMutation.mutate(userKYC.id)}
                                  disabled={denyMutation.isPending || userKYC.status === 'rejected'}
                                  className="bg-red-700 hover:bg-red-800 text-white text-xs gap-1"
                                >
                                  <XCircle className="w-3 h-3" /> Deny
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-slate-800/40 rounded p-3 text-xs text-slate-500">
                              No KYC submission found for this user.
                            </div>
                          )}

                          {/* Identities */}
                          {userIdentities.length > 0 && (
                            <div className="bg-slate-800/40 rounded p-3">
                              <p className="text-xs font-semibold text-amber-400 mb-2">AI Identities ({userIdentities.length})</p>
                              <div className="space-y-1">
                                {userIdentities.map(id => (
                                  <div key={id.id} className="flex items-center justify-between text-xs">
                                    <span className="text-slate-300">{id.name}</span>
                                    <Badge variant="outline" className="text-xs">{id.is_active ? 'Active' : 'Inactive'}</Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}