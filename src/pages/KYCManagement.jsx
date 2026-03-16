import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Lock, Eye, EyeOff, Trash2, RefreshCw, CheckCircle2, AlertCircle, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import KYCIntakeForm from '../components/kyc/KYCIntakeForm';
import KYCStatusPanel from '../components/kyc/KYCStatusPanel';

export default function KYCManagement() {
  const [showIntake, setShowIntake] = useState(false);
  const [showSensitive, setShowSensitive] = useState(false);
  const queryClient = useQueryClient();

  const { data: kyc = [], isLoading } = useQuery({
    queryKey: ['kyc'],
    queryFn: () => base44.entities.KYCVerification.filter({}, '-created_date', 1),
    initialData: [],
  });

  const { data: routingLogs = [] } = useQuery({
    queryKey: ['routingLogs'],
    queryFn: () => base44.entities.IdentityRoutingLog.filter({}, '-created_date', 20),
    initialData: [],
  });

  const { data: routingPolicies = [] } = useQuery({
    queryKey: ['routingPolicies'],
    queryFn: () => base44.entities.IdentityRoutingPolicy.filter({ enabled: true }, '-priority', 50),
    initialData: [],
  });

  const approveKYCMutation = useMutation({
    mutationFn: async (kycId) => {
      await base44.entities.KYCVerification.update(kycId, {
        user_approved_for_autopilot: true,
        allowed_modules: ['financial_onboarding', 'payment_payout', 'prize_claiming', 'tax_compliance', 'government_compliance']
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc'] });
      toast.success('KYC approved for Autopilot usage');
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const revokeKYCMutation = useMutation({
    mutationFn: async (kycId) => {
      await base44.entities.KYCVerification.update(kycId, {
        user_approved_for_autopilot: false
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc'] });
      toast.success('Autopilot access revoked');
    },
  });

  const deleteKYCMutation = useMutation({
    mutationFn: async (kycId) => {
      await base44.entities.KYCVerification.delete(kycId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc'] });
      toast.success('KYC data deleted');
    },
  });

  const kycRecord = kyc[0];

  if (showIntake) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <Button onClick={() => setShowIntake(false)} variant="ghost" className="text-slate-400">
            ← Back
          </Button>
        </div>
        <KYCIntakeForm onSubmitSuccess={() => setShowIntake(false)} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            Legal Identity & KYC Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Securely manage verified legal identity for Autopilot compliance</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: KYC Status & Controls */}
        <div className="lg:col-span-1 space-y-4">
          <KYCStatusPanel onStartKYC={() => setShowIntake(true)} />

          {/* Approval Controls */}
          {kycRecord && kycRecord.status === 'approved' && (
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white text-sm">Autopilot Access Control</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {kycRecord.user_approved_for_autopilot ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                    <p className="text-xs text-emerald-300 font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Active
                    </p>
                    <Button
                      onClick={() => revokeKYCMutation.mutate(kycRecord.id)}
                      variant="outline"
                      className="w-full text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                      disabled={revokeKYCMutation.isPending}
                    >
                      <LogOut className="w-3 h-3 mr-1" />
                      Revoke Access
                    </Button>
                  </div>
                ) : (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                    <p className="text-xs text-amber-300 font-semibold mb-3 flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Not Approved
                    </p>
                    <Button
                      onClick={() => approveKYCMutation.mutate(kycRecord.id)}
                      className="w-full text-xs bg-emerald-600 hover:bg-emerald-500"
                      disabled={approveKYCMutation.isPending}
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Approve for Autopilot
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Dangerous Zone */}
          {kycRecord && (
            <Card className="bg-red-950/20 border border-red-900/30">
              <CardHeader>
                <CardTitle className="text-red-400 text-sm">Manage KYC Data</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  onClick={() => {
                    if (confirm('Delete all KYC data? This cannot be undone.')) {
                      deleteKYCMutation.mutate(kycRecord.id);
                    }
                  }}
                  variant="outline"
                  className="w-full text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                  disabled={deleteKYCMutation.isPending}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete All Data
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Details & Logs */}
        <div className="lg:col-span-2 space-y-4">
          {kycRecord && (
            <>
              {/* Detailed Information */}
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white text-sm flex items-center justify-between">
                    <span>Personal Information</span>
                    <button
                      onClick={() => setShowSensitive(!showSensitive)}
                      className="text-slate-400 hover:text-slate-200 p-1"
                    >
                      {showSensitive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-slate-400">Full Name</p>
                      <p className="text-white font-semibold">{kycRecord.full_legal_name}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Date of Birth</p>
                      <p className="text-white font-semibold">{kycRecord.date_of_birth}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-slate-400">Address</p>
                      <p className="text-white font-semibold">
                        {kycRecord.residential_address}, {kycRecord.city}, {kycRecord.state} {kycRecord.postal_code}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Phone</p>
                      <p className="text-white font-semibold">{kycRecord.phone_number}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Email</p>
                      <p className="text-white font-semibold">{kycRecord.email_verified}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Verification Results */}
              {(kycRecord.face_match_result || kycRecord.document_authenticity || kycRecord.data_consistency_check) && (
                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-white text-sm">Verification Results</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {kycRecord.face_match_result && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Face Match</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold ${kycRecord.face_match_result.matched ? 'text-emerald-400' : 'text-red-400'}`}>
                            {kycRecord.face_match_result.matched ? 'Passed' : 'Failed'}
                          </span>
                          {kycRecord.face_match_result.confidence_score && (
                            <span className="text-xs text-slate-500">{kycRecord.face_match_result.confidence_score}%</span>
                          )}
                        </div>
                      </div>
                    )}
                    {kycRecord.document_authenticity && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Document Authenticity</span>
                        <span className={`text-xs font-semibold ${kycRecord.document_authenticity.authentic ? 'text-emerald-400' : 'text-red-400'}`}>
                          {kycRecord.document_authenticity.authentic ? 'Verified' : 'Failed'}
                          {kycRecord.document_authenticity.tampering_detected && ' (Tampering Detected)'}
                        </span>
                      </div>
                    )}
                    {kycRecord.data_consistency_check && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-slate-400">Data Consistency</span>
                          <span className={`text-xs font-semibold ${kycRecord.data_consistency_check.consistent ? 'text-emerald-400' : 'text-red-400'}`}>
                            {kycRecord.data_consistency_check.consistent ? 'Consistent' : 'Discrepancies Found'}
                          </span>
                        </div>
                        {kycRecord.data_consistency_check.discrepancies?.length > 0 && (
                          <div className="text-[10px] text-red-400 space-y-1">
                            {kycRecord.data_consistency_check.discrepancies.map((d, i) => (
                              <div key={i}>• {d}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Identity Routing Rules */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-sm">Active Routing Rules</CardTitle>
            </CardHeader>
            <CardContent>
              {routingPolicies.length === 0 ? (
                <p className="text-xs text-slate-400">No routing policies configured.</p>
              ) : (
                <div className="space-y-2">
                  {routingPolicies.slice(0, 5).map((policy) => (
                    <div key={policy.id} className="text-xs border-b border-slate-800 pb-2 last:border-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-300">{policy.rule_name}</span>
                        {policy.requires_kyc && (
                          <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-[9px]">
                            Requires KYC
                          </span>
                        )}
                      </div>
                      <p className="text-slate-500 mt-1">{policy.kyc_reason || 'Persona identity'}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Routing Logs */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-sm">Recent Identity Usage</CardTitle>
            </CardHeader>
            <CardContent>
              {routingLogs.length === 0 ? (
                <p className="text-xs text-slate-400">No routing history yet.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {routingLogs.map((log) => (
                    <div key={log.id} className="text-[10px] border-b border-slate-800 pb-2 last:border-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-semibold ${log.identity_used === 'legal' ? 'text-emerald-400' : 'text-blue-400'}`}>
                          {log.identity_name}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded ${log.status === 'executed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                          {log.status}
                        </span>
                      </div>
                      <p className="text-slate-500">{log.routing_reason}</p>
                      {log.platform && <p className="text-slate-600 mt-0.5">{log.platform}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}