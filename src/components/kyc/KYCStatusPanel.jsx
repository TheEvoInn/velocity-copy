import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, AlertCircle, Clock, Lock, Shield, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function KYCStatusPanel({ onStartKYC }) {
  const { data: kyc = [], isLoading } = useQuery({
    queryKey: ['kyc'],
    queryFn: () => base44.entities.KYCVerification.filter({}, '-created_date', 1),
    initialData: [],
  });

  const kycRecord = kyc[0];

  if (!kycRecord) {
    return (
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            Legal Identity Verification (KYC)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              Submit your verified legal identity to enable the Autopilot to complete financial accounts, claim prizes, and file tax documents on your behalf.
            </p>
            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex gap-2">
                <span className="text-emerald-400">✓</span>
                <span>Securely encrypt all sensitive data</span>
              </div>
              <div className="flex gap-2">
                <span className="text-emerald-400">✓</span>
                <span>Used only when legally required</span>
              </div>
              <div className="flex gap-2">
                <span className="text-emerald-400">✓</span>
                <span>Separate from personas for privacy</span>
              </div>
            </div>
            <Button onClick={onStartKYC} className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500">
              <Lock className="w-3.5 h-3.5 mr-2" />
              Start KYC Verification
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const statusConfig = {
    pending: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Pending Submission' },
    submitted: { icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Under Review' },
    under_review: { icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Under Review' },
    verified: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Verified' },
    approved: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Approved & Active' },
    rejected: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Rejected' },
  };

  const config = statusConfig[kycRecord.status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-400" />
          Legal Identity Verification
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Badge */}
        <div className={`${config.bg} border border-slate-700 rounded-lg p-3 flex items-center gap-3`}>
          <Icon className={`w-5 h-5 ${config.color}`} />
          <div>
            <p className={`text-sm font-semibold ${config.color}`}>{config.label}</p>
            {kycRecord.status === 'rejected' && (
              <p className="text-xs text-red-300 mt-1">{kycRecord.rejection_reason}</p>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">Name:</span>
            <span className="text-white font-semibold">{kycRecord.full_legal_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Verification Type:</span>
            <span className="text-white capitalize">{kycRecord.verification_type}</span>
          </div>
          {kycRecord.verified_at && (
            <div className="flex justify-between">
              <span className="text-slate-400">Verified:</span>
              <span className="text-emerald-400">{new Date(kycRecord.verified_at).toLocaleDateString()}</span>
            </div>
          )}
          {kycRecord.expires_at && (
            <div className="flex justify-between">
              <span className="text-slate-400">Expires:</span>
              <span className="text-amber-400">{new Date(kycRecord.expires_at).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Approval Status */}
        {kycRecord.status === 'approved' && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
            <p className="text-xs font-semibold text-emerald-300 mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Autopilot Access
            </p>
            <p className={`text-xs ${kycRecord.user_approved_for_autopilot ? 'text-emerald-300' : 'text-slate-400'}`}>
              {kycRecord.user_approved_for_autopilot
                ? 'Approved for use by Autopilot on KYC-required tasks'
                : 'Approval pending - Autopilot cannot use this identity yet'}
            </p>
          </div>
        )}

        {/* Allowed Modules */}
        {kycRecord.allowed_modules && kycRecord.allowed_modules.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-300 mb-2">Allowed Modules:</p>
            <div className="flex flex-wrap gap-1">
              {kycRecord.allowed_modules.map(mod => (
                <span key={mod} className="text-[10px] bg-slate-800 text-slate-300 px-2 py-1 rounded-full">
                  {mod}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Access Log */}
        {kycRecord.access_log && kycRecord.access_log.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-300 mb-2">Recent Access:</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {kycRecord.access_log.slice(-5).reverse().map((log, idx) => (
                <div key={idx} className="text-[10px] text-slate-500 flex justify-between">
                  <span>{log.purpose || log.module}</span>
                  <span>{new Date(log.accessed_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {kycRecord.status === 'rejected' && (
          <Button onClick={onStartKYC} className="w-full text-xs bg-blue-600 hover:bg-blue-500">
            <FileText className="w-3 h-3 mr-1" />
            Resubmit
          </Button>
        )}
      </CardContent>
    </Card>
  );
}