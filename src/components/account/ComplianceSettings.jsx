import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, AlertCircle, FileText, CheckCircle } from 'lucide-react';
import KYCWebhookSettings from '@/components/account/KYCWebhookSettings';

export default function ComplianceSettings() {
  // Fetch KYC verification
  const { data: kyc = {} } = useQuery({
    queryKey: ['kycVerification'],
    queryFn: async () => {
      const res = await base44.entities.KYCVerification.list(1);
      return res[0] || {};
    }
  });

  const statusColors = {
    pending: 'bg-slate-950/30 border-slate-700 text-slate-300',
    submitted: 'bg-amber-950/30 border-amber-500/30 text-amber-300',
    under_review: 'bg-blue-950/30 border-blue-500/30 text-blue-300',
    verified: 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300',
    approved: 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300',
    rejected: 'bg-red-950/30 border-red-500/30 text-red-300',
    expired: 'bg-red-950/30 border-red-500/30 text-red-300'
  };

  const statusIcons = {
    pending: <AlertCircle className="w-4 h-4" />,
    submitted: <FileText className="w-4 h-4" />,
    under_review: <AlertCircle className="w-4 h-4" />,
    verified: <CheckCircle className="w-4 h-4" />,
    approved: <CheckCircle className="w-4 h-4" />,
    rejected: <AlertCircle className="w-4 h-4" />,
    expired: <AlertCircle className="w-4 h-4" />
  };

  return (
    <div className="space-y-4">
      {/* KYC Status */}
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            KYC Verification Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Verification Status</span>
            <Badge className={statusColors[kyc.status || 'pending']}>
              {statusIcons[kyc.status || 'pending']}
              <span className="ml-1">{kyc.status?.replace(/_/g, ' ') || 'Not Started'}</span>
            </Badge>
          </div>

          {kyc.status === 'approved' && (
            <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-300">
              ✓ Your identity is verified. All autopilot features are available.
            </div>
          )}

          {kyc.status === 'rejected' && (
            <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 text-xs text-red-300 space-y-1">
              <p className="font-medium">Verification Rejected</p>
              <p>{kyc.admin_denial_reason || 'Please review the requirements and try again.'}</p>
            </div>
          )}

          {['pending', 'submitted', 'under_review'].includes(kyc.status) && (
            <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-500/30 text-xs text-amber-300">
              Your verification is {kyc.status}. This may take 1-3 business days.
            </div>
          )}

          {!kyc.id && (
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={() => window.location.href = '/KYCManagement'}
            >
              Start Verification
            </Button>
          )}

          {kyc.id && kyc.status !== 'approved' && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.location.href = '/KYCManagement'}
            >
              View & Complete
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Verification Details */}
      {kyc.id && (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-sm">Identity Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Name</span>
              <span className="text-slate-200 font-medium">{kyc.full_legal_name || '—'}</span>
            </div>
            <div className="border-t border-slate-700 pt-3 flex justify-between">
              <span className="text-slate-500">ID Type</span>
              <span className="text-slate-200 font-medium">{kyc.government_id_type?.replace(/_/g, ' ') || '—'}</span>
            </div>
            <div className="border-t border-slate-700 pt-3 flex justify-between">
              <span className="text-slate-500">Address</span>
              <span className="text-slate-200 font-medium text-right">
                {kyc.city && kyc.state ? `${kyc.city}, ${kyc.state}` : '—'}
              </span>
            </div>
            <div className="border-t border-slate-700 pt-3 flex justify-between">
              <span className="text-slate-500">Country</span>
              <span className="text-slate-200 font-medium">{kyc.country || '—'}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Allowed Modules */}
      {kyc.allowed_modules && kyc.allowed_modules.length > 0 && (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-sm">Authorized Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {kyc.allowed_modules.map((module) => (
                <div key={module} className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm text-slate-300">{module}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compliance Info */}
      <Card className="bg-blue-950/30 border-blue-500/30">
        <CardContent className="pt-6 text-xs text-blue-200 space-y-2">
          <p className="font-medium">Why We Need Verification</p>
          <div>• Comply with financial regulations and AML requirements</div>
          <div>• Protect your account and prevent fraud</div>
          <div>• Enable payouts and withdrawals</div>
          <div>• Verify you own the accounts you're using</div>
        </CardContent>
      </Card>
    </div>
  );
}