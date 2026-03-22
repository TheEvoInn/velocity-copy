import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Users, Shield, Search, Trash2, CheckCircle2, XCircle,
  Mail, Eye, Lock, RefreshCw, Download, Clock, AlertCircle, Activity
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminPanel() {
  const [searchEmail, setSearchEmail] = useState('');
  const [expandedUser, setExpandedUser] = useState(null);
  const [liveUpdates, setLiveUpdates] = useState(0);
  const queryClient = useQueryClient();

  // Fetch all users with service role access
  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      try {
        const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 1000);
        return Array.isArray(allUsers) ? allUsers : [];
      } catch (error) {
        console.error('Error fetching users:', error);
        return [];
      }
    },
    staleTime: 0,
    refetchInterval: 10000
  });

  // Real-time subscriptions for live updates
  useEffect(() => {
    const unsubscribeUser = base44.entities.User.subscribe((event) => {
      setLiveUpdates(prev => prev + 1);
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      toast.info(`User ${event.type}d: ${event.data?.email}`);
    });

    const unsubscribeKYC = base44.entities.KYCVerification.subscribe((event) => {
      setLiveUpdates(prev => prev + 1);
      queryClient.invalidateQueries({ queryKey: ['adminKYCs'] });
    });

    const unsubscribeIdentity = base44.entities.AIIdentity.subscribe((event) => {
      setLiveUpdates(prev => prev + 1);
      queryClient.invalidateQueries({ queryKey: ['adminIdentities'] });
    });

    const unsubscribeConnection = base44.entities.PlatformConnection.subscribe((event) => {
      setLiveUpdates(prev => prev + 1);
      queryClient.invalidateQueries({ queryKey: ['adminConnections'] });
    });

    return () => {
      unsubscribeUser();
      unsubscribeKYC();
      unsubscribeIdentity();
      unsubscribeConnection();
    };
  }, [queryClient]);

  // Fetch user-related data
  const { data: kycs = [] } = useQuery({
    queryKey: ['adminKYCs'],
    queryFn: async () => {
      try {
        return await base44.asServiceRole.entities.KYCVerification.list('-created_date', 1000) || [];
      } catch {
        return [];
      }
    }
  });

  const { data: identities = [] } = useQuery({
    queryKey: ['adminIdentities'],
    queryFn: async () => {
      try {
        return await base44.asServiceRole.entities.AIIdentity.list('-created_date', 1000) || [];
      } catch {
        return [];
      }
    }
  });

  const { data: connections = [] } = useQuery({
    queryKey: ['adminConnections'],
    queryFn: async () => {
      try {
        return await base44.asServiceRole.entities.PlatformConnection.list('-created_date', 1000) || [];
      } catch {
        return [];
      }
    }
  });

  // Mutations for admin actions
  const approveUserMutation = useMutation({
    mutationFn: async (userId) => {
      const kyc = kycs.find(k => k.created_by === userId);
      if (kyc) {
        await base44.asServiceRole.entities.KYCVerification.update(kyc.id, {
          admin_status: 'approved',
          status: 'approved'
        });
      }
      return userId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminKYCs'] });
      toast.success('User approved');
    },
    onError: () => toast.error('Failed to approve user')
  });

  const denyUserMutation = useMutation({
    mutationFn: async (userId) => {
      const kyc = kycs.find(k => k.created_by === userId);
      if (kyc) {
        await base44.asServiceRole.entities.KYCVerification.update(kyc.id, {
          admin_status: 'rejected',
          status: 'rejected'
        });
      }
      return userId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminKYCs'] });
      toast.success('User denied');
    },
    onError: () => toast.error('Failed to deny user')
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId) => {
      // Delete related records first
      const relatedKYCs = kycs.filter(k => k.created_by === userId);
      const relatedIdentities = identities.filter(i => i.created_by === userId);
      const relatedConnections = connections.filter(c => c.created_by === userId);

      for (const kyc of relatedKYCs) {
        try {
          await base44.asServiceRole.entities.KYCVerification.delete(kyc.id);
        } catch {}
      }
      for (const identity of relatedIdentities) {
        try {
          await base44.asServiceRole.entities.AIIdentity.delete(identity.id);
        } catch {}
      }
      for (const conn of relatedConnections) {
        try {
          await base44.asServiceRole.entities.PlatformConnection.delete(conn.id);
        } catch {}
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers', 'adminKYCs', 'adminIdentities', 'adminConnections'] });
      toast.success('User and related data deleted');
      setExpandedUser(null);
    },
    onError: () => toast.error('Failed to delete user')
  });

  const verifyKYCMutation = useMutation({
    mutationFn: async (kycId) => {
      await base44.asServiceRole.entities.KYCVerification.update(kycId, {
        verified_at: new Date().toISOString(),
        admin_status: 'approved'
      });
      return kycId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminKYCs'] });
      toast.success('KYC verified');
    },
    onError: () => toast.error('Failed to verify KYC')
  });

  // Filter users by search
  const filteredUsers = searchEmail.length >= 3
    ? users.filter(u => u.email?.toLowerCase().includes(searchEmail.toLowerCase()))
    : users;

  // Get user stats
  const totalUsers = users.length;
  const verifiedUsers = kycs.filter(k => k.status === 'approved').length;
  const rejectedUsers = kycs.filter(k => k.status === 'rejected').length;
  const pendingKYC = kycs.filter(k => k.status === 'pending' || k.status === 'submitted').length;
  const usersWithIdentities = identities.length;
  const activeConnections = connections.filter(c => c.status === 'connected').length;

  return (
    <div className="min-h-screen galaxy-bg p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-orbitron font-bold text-white mb-2">ADMIN PANEL</h1>
            <p className="text-slate-400 text-sm">Full platform administrative control and user management</p>
          </div>
          <Button
            onClick={() => refetch()}
            disabled={isLoading}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-xs uppercase">Total Users</p>
                  <p className="text-3xl font-bold text-white mt-1">{totalUsers}</p>
                </div>
                <Users className="w-8 h-8 text-cyan-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-xs uppercase">Verified</p>
                  <p className="text-3xl font-bold text-emerald-400 mt-1">{verifiedUsers}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-emerald-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-xs uppercase">Pending KYC</p>
                  <p className="text-3xl font-bold text-amber-400 mt-1">{pendingKYC}</p>
                </div>
                <Mail className="w-8 h-8 text-amber-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-xs uppercase">Identities</p>
                  <p className="text-3xl font-bold text-violet-400 mt-1">{usersWithIdentities}</p>
                </div>
                <Shield className="w-8 h-8 text-violet-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="glass-card mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
              <Input
                type="email"
                placeholder="Search by email (min 3 chars)..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </CardContent>
        </Card>

        {/* Users List */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-white">Users ({filteredUsers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto">
              {isLoading ? (
                <div className="text-center py-8 text-slate-400">Loading users...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-slate-400">No users found</div>
              ) : (
                filteredUsers.map(user => {
                  const userKYC = kycs.find(k => k.created_by === user.email);
                  const userIdentities = identities.filter(i => i.created_by === user.email);
                  const userConnections = connections.filter(c => c.created_by === user.email);
                  const isExpanded = expandedUser === user.id;

                  return (
                    <div key={user.id} className="border border-slate-700 rounded-lg p-4 hover:border-cyan-500/30 transition">
                      {/* Main user row */}
                      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedUser(isExpanded ? null : user.id)}>
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-slate-500" />
                            <div>
                              <p className="text-white font-semibold">{user.full_name || 'Unknown'}</p>
                              <p className="text-xs text-slate-400">{user.email}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                            {user.role || 'user'}
                          </Badge>
                          <Badge variant={userKYC?.status === 'approved' ? 'default' : 'secondary'}>
                            {userKYC?.status || 'no kyc'}
                          </Badge>
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-slate-700 space-y-4">
                          {/* KYC Section */}
                          {userKYC && (
                            <div className="bg-slate-800/50 rounded p-3">
                              <p className="text-xs font-semibold text-cyan-400 mb-2">KYC Verification</p>
                              <div className="space-y-1 text-xs text-slate-300">
                                <p>Status: <span className="text-white">{userKYC.status}</span></p>
                                <p>Name: <span className="text-white">{userKYC.full_legal_name || '—'}</span></p>
                                <p>Verified: <span className="text-white">{userKYC.verified_at ? 'Yes' : 'No'}</span></p>
                                <div className="flex gap-2 mt-3">
                                  {userKYC.status !== 'approved' && (
                                    <Button
                                      size="sm"
                                      onClick={() => approveUserMutation.mutate(user.email)}
                                      disabled={approveUserMutation.isPending}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
                                    >
                                      <CheckCircle2 className="w-3 h-3" /> Approve
                                    </Button>
                                  )}
                                  {userKYC.status !== 'rejected' && (
                                    <Button
                                      size="sm"
                                      onClick={() => denyUserMutation.mutate(user.email)}
                                      disabled={denyUserMutation.isPending}
                                      className="bg-red-600 hover:bg-red-700 text-white text-xs gap-1"
                                    >
                                      <XCircle className="w-3 h-3" /> Deny
                                    </Button>
                                  )}
                                  {!userKYC.verified_at && (
                                    <Button
                                      size="sm"
                                      onClick={() => verifyKYCMutation.mutate(userKYC.id)}
                                      disabled={verifyKYCMutation.isPending}
                                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1"
                                    >
                                      <Eye className="w-3 h-3" /> Verify
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Identities Section */}
                          {userIdentities.length > 0 && (
                            <div className="bg-slate-800/50 rounded p-3">
                              <p className="text-xs font-semibold text-violet-400 mb-2">AI Identities ({userIdentities.length})</p>
                              <div className="space-y-1 text-xs text-slate-300">
                                {userIdentities.map(identity => (
                                  <p key={identity.id}>{identity.name} - <Badge variant="outline">{identity.is_active ? 'Active' : 'Inactive'}</Badge></p>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Connections Section */}
                          {userConnections.length > 0 && (
                            <div className="bg-slate-800/50 rounded p-3">
                              <p className="text-xs font-semibold text-amber-400 mb-2">Platform Connections ({userConnections.length})</p>
                              <div className="space-y-1 text-xs text-slate-300">
                                {userConnections.map(conn => (
                                  <p key={conn.id}>{conn.platform} - <Badge variant="outline">{conn.status}</Badge></p>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Admin Actions */}
                          <div className="flex gap-2 pt-2">
                            <Button
                              size="sm"
                              onClick={() => deleteUserMutation.mutate(user.email)}
                              disabled={deleteUserMutation.isPending}
                              variant="destructive"
                              className="text-xs gap-1"
                            >
                              <Trash2 className="w-3 h-3" /> Delete User
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}