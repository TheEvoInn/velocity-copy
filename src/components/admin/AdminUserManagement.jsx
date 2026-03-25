import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, Search, Shield, User, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

export default function AdminUserManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedUser, setExpandedUser] = useState(null);
  const [search, setSearch] = useState('');

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await base44.functions.invoke('adminService', { action: 'list_users' });
      return res.data;
    },
  });

  const { data: kycsData, isLoading: kycsLoading } = useQuery({
    queryKey: ['admin-kycs'],
    queryFn: async () => {
      const res = await base44.functions.invoke('adminService', { action: 'list_kycs' });
      return res.data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (kyc_id) => {
      const res = await base44.functions.invoke('adminService', { action: 'approve_kyc', kyc_id });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-kycs'] });
      toast({ title: 'KYC Approved', description: 'User KYC has been approved.' });
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const denyMutation = useMutation({
    mutationFn: async (kyc_id) => {
      const res = await base44.functions.invoke('adminService', { action: 'deny_kyc', kyc_id });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-kycs'] });
      toast({ title: 'KYC Denied', description: 'User KYC has been denied.' });
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const roleMutation = useMutation({
    mutationFn: async ({ user_id, role }) => {
      const res = await base44.functions.invoke('adminService', { action: 'update_user_role', user_id, role });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Role Updated' });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (user_id) => {
      const res = await base44.functions.invoke('adminService', { action: 'force_verify_user', user_id });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'User Verified', description: 'User can now log in.' });
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const users = usersData?.users || [];
  const kycsRaw = kycsData?.kycs || [];
  
  // Deduplicate KYCs: keep only latest per user per status
  const kycs = kycsRaw.reduce((acc, kyc) => {
    const key = `${kyc.user_email || kyc.created_by}_${kyc.status || 'pending'}`;
    if (!acc[key] || new Date(kyc.created_date) > new Date(acc[key].created_date)) {
      acc[key] = kyc;
    }
    return acc;
  }, {});
  const kycsList = Object.values(kycs);

  const filtered = users.filter(u =>
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (usersLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-slate-700 border-t-violet-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{users.length}</p>
            <p className="text-xs text-slate-500">Total Users</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{kycsList.filter(k => k.status === 'submitted' || k.status === 'pending').length}</p>
            <p className="text-xs text-slate-500">Pending KYC</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{kycsList.filter(k => k.status === 'approved').length}</p>
            <p className="text-xs text-slate-500">KYC Approved</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search users by name or email..."
          className="pl-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
        />
      </div>

      {/* User Cards */}
      <div className="space-y-2">
        {filtered.map(u => {
          const userKYC = kycsList.find(k => (k.user_email === u.email || k.created_by === u.email) && (k.status === 'submitted' || k.status === 'pending'));
          const isExpanded = expandedUser === u.id;

          return (
            <Card key={u.id} className="bg-slate-900 border-slate-800">
              {/* User Row */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-800/50 transition-colors"
                onClick={() => setExpandedUser(isExpanded ? null : u.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-300">
                    {(u.full_name || u.email || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{u.full_name || '—'}</p>
                    <p className="text-xs text-slate-400">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {userKYC && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      userKYC.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                      userKYC.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                      'bg-amber-500/20 text-amber-400'
                    }`}>
                      KYC: {userKYC.status}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-violet-500/20 text-violet-400' : 'bg-slate-700 text-slate-400'}`}>
                    {u.role || 'user'}
                  </span>
                  <span className="text-xs text-slate-600 hidden sm:block">{format(new Date(u.created_date), 'MMM d, yyyy')}</span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <CardContent className="border-t border-slate-800 pt-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* User Info */}
                    <div className="bg-slate-800/40 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Account Details</p>
                      <div className="space-y-1 text-xs text-slate-300">
                        <p>ID: <span className="text-slate-500 font-mono">{u.id}</span></p>
                        <p>Joined: <span className="text-white">{format(new Date(u.created_date), 'MMMM d, yyyy HH:mm')}</span></p>
                        <p>Verified: <span className={u.is_verified ? 'text-emerald-400' : 'text-red-400'}>{u.is_verified ? 'Yes' : 'No'}</span></p>
                      </div>
                      <div className="flex gap-2 pt-2 flex-wrap">
                        {u.is_verified ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" /> Verified
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); verifyMutation.mutate(u.id); }}
                            disabled={verifyMutation.isPending && verifyMutation.variables === u.id}
                            className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            {verifyMutation.isPending && verifyMutation.variables === u.id ? 'Verifying...' : 'Force Verify'}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* KYC Section */}
                    <div className="bg-slate-800/40 rounded-lg p-3">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">KYC Verification</p>
                      {userKYC ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400">Status</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              userKYC.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                              userKYC.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                              'bg-amber-500/20 text-amber-400'
                            }`}>{userKYC.status || 'pending'}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-1 text-xs text-slate-400">
                            <p>Name: <span className="text-white">{userKYC.full_legal_name || '—'}</span></p>
                            <p>DOB: <span className="text-white">{userKYC.date_of_birth || '—'}</span></p>
                            <p>Phone: <span className="text-white">{userKYC.phone_number || '—'}</span></p>
                            <p>ID Type: <span className="text-white capitalize">{userKYC.government_id_type?.replace(/_/g,' ') || '—'}</span></p>
                            {(userKYC.city || userKYC.state) && (
                              <p className="col-span-2">Location: <span className="text-white">{[userKYC.city, userKYC.state, userKYC.country].filter(Boolean).join(', ')}</span></p>
                            )}
                          </div>

                          {/* Document Images */}
                          {(userKYC.id_document_front_url || userKYC.id_document_back_url || userKYC.selfie_url) && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1.5">Submitted Documents</p>
                              <div className="grid grid-cols-3 gap-2">
                                {userKYC.id_document_front_url && (
                                  <a href={userKYC.id_document_front_url} target="_blank" rel="noreferrer" className="group">
                                    <img src={userKYC.id_document_front_url} alt="ID Front" className="w-full h-16 object-cover rounded border border-slate-600 group-hover:border-violet-400 transition-colors" />
                                    <p className="text-[10px] text-slate-500 text-center mt-0.5">ID Front</p>
                                  </a>
                                )}
                                {userKYC.id_document_back_url && (
                                  <a href={userKYC.id_document_back_url} target="_blank" rel="noreferrer" className="group">
                                    <img src={userKYC.id_document_back_url} alt="ID Back" className="w-full h-16 object-cover rounded border border-slate-600 group-hover:border-violet-400 transition-colors" />
                                    <p className="text-[10px] text-slate-500 text-center mt-0.5">ID Back</p>
                                  </a>
                                )}
                                {userKYC.selfie_url && (
                                  <a href={userKYC.selfie_url} target="_blank" rel="noreferrer" className="group">
                                    <img src={userKYC.selfie_url} alt="Selfie" className="w-full h-16 object-cover rounded border border-slate-600 group-hover:border-violet-400 transition-colors" />
                                    <p className="text-[10px] text-slate-500 text-center mt-0.5">Selfie</p>
                                  </a>
                                )}
                              </div>
                            </div>
                          )}

                          {userKYC.source === 'identity_onboarding' && (
                            <p className="text-[10px] text-amber-400/60 italic">* Submitted via identity onboarding</p>
                          )}

                          {/* KYC Actions */}
                          {userKYC.status !== 'approved' && userKYC.status !== 'rejected' && (
                            <div className="flex gap-2 pt-1">
                              <Button size="sm" onClick={() => approveMutation.mutate(userKYC.id)} disabled={approveMutation.isPending}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1 flex-1">
                                <CheckCircle2 className="w-3 h-3" /> Approve
                              </Button>
                              <Button size="sm" onClick={() => denyMutation.mutate(userKYC.id)} disabled={denyMutation.isPending}
                                className="bg-red-700 hover:bg-red-800 text-white text-xs gap-1 flex-1">
                                <XCircle className="w-3 h-3" /> Deny
                              </Button>
                            </div>
                          )}
                          {(userKYC.status === 'approved' || userKYC.status === 'rejected') && (
                            <p className="text-xs text-slate-500 italic">Decision: <span className="capitalize text-slate-400">{userKYC.status}</span></p>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Clock className="w-4 h-4" />
                          <span>No KYC submission yet.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}