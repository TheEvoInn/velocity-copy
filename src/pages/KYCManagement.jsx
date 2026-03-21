import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Shield, Lock, Trash2, AlertCircle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import KYCIntakeForm from '../components/kyc/KYCIntakeForm';
import KYCStatusPanel from '../components/kyc/KYCStatusPanel';
import KYCAdminQueue from '../components/kyc/KYCAdminQueue';
import KYCAuditLog from '../components/kyc/KYCAuditLog';

export default function KYCManagement() {
  const [showIntake, setShowIntake] = useState(false);
  const [user, setUser] = useState(null);
  const [view, setView] = useState('status'); // 'status' | 'admin'
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const isAdmin = user?.role === 'admin';

  if (showIntake) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <Button onClick={() => setShowIntake(false)} variant="ghost" className="text-slate-400 mb-4">
          ← Back
        </Button>
        <KYCIntakeForm onSubmitSuccess={() => setShowIntake(false)} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            Identity & KYC Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manual administrator-driven verification · Human review required
          </p>
        </div>
        {/* Admin toggle */}
        {isAdmin && (
          <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setView('status')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'status' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              My Status
            </button>
            <button
              onClick={() => setView('admin')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${view === 'admin' ? 'bg-blue-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Users className="w-3 h-3" />
              Admin Queue
            </button>
          </div>
        )}
      </div>

      {/* Admin View */}
      {isAdmin && view === 'admin' ? (
        <div className="space-y-6">
          {/* Policy Notice */}
          <div className="bg-blue-950/30 border border-blue-800/30 rounded-xl p-4 flex gap-3">
            <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-200 space-y-1">
              <p className="font-semibold text-blue-300">Administrator Review Policy</p>
              <p>All KYC decisions must be made by a certified human verifier. No automated approvals are permitted. All actions are logged for compliance and auditing.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2">
              <KYCAdminQueue />
            </div>
            <div>
              <KYCAuditLog />
            </div>
          </div>
        </div>
      ) : (
        /* User View */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Status */}
          <div className="lg:col-span-1 space-y-4">
            <KYCStatusPanel onStartKYC={() => setShowIntake(true)} />

            {/* Data Management */}
            <Card className="bg-red-950/20 border border-red-900/30">
              <CardHeader>
                <CardTitle className="text-red-400 text-sm">Manage KYC Data</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500 mb-3">Deleting your KYC data will reset verification status and lock identity-dependent features.</p>
                <Button
                  onClick={async () => {
                   if (!confirm('Delete all KYC data? This cannot be undone.')) return;
                   try {
                     const records = await base44.entities.KYCVerification.filter({}, '-created_date', 1);
                     if (records[0]) {
                       await base44.entities.KYCVerification.delete(records[0].id);
                       queryClient.invalidateQueries({ queryKey: ['kyc_my'] });
                       queryClient.invalidateQueries({ queryKey: ['kyc_admin_notifications'] });
                       toast.success('KYC data deleted');
                     }
                   } catch (err) {
                     toast.error(`Failed to delete KYC data: ${err.message || 'Unknown error'}`);
                   }
                  }}
                  variant="outline"
                  className="w-full text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete All KYC Data
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right: Info & Policy */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Lock className="w-4 h-4 text-blue-400" />
                  How Manual KYC Verification Works
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-400 space-y-3">
                {[
                  ['1. Submit Your Application', 'Complete the 4-step form with your personal information, government ID details, and document uploads.'],
                  ['2. Queue for Human Review', 'Your submission enters a queue reviewed by a certified platform administrator — no automated processing occurs.'],
                  ['3. Verification Review', 'The reviewer examines your documents, validates personal information, and checks for authenticity and consistency.'],
                  ['4. Decision Issued', 'You will be notified of Approval, Denial, or a request for additional information. Processing takes up to 5 business days.'],
                  ['5. Feature Unlock', 'Upon approval, identity-dependent features are unlocked. All access is logged for compliance.'],
                ].map(([title, desc]) => (
                  <div key={title} className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                    <div>
                      <p className="font-semibold text-slate-300 mb-0.5">{title}</p>
                      <p>{desc}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white text-sm">Required Documents</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2 text-slate-400">
                {[
                  ['Government-Issued Photo ID', 'Passport, Driver\'s License, National ID, or State ID (front + back)'],
                  ['Selfie / Live Capture', 'A clear photo of your face for identity matching'],
                  ['Personal Information', 'Full legal name, date of birth, residential address, phone, and email'],
                  ['Tax Identification (Optional)', 'Tax ID or SSN for financial and government-related features'],
                ].map(([doc, desc]) => (
                  <div key={doc} className="flex gap-2 border-b border-slate-800 pb-2 last:border-0">
                    <span className="text-blue-400 shrink-0">•</span>
                    <div>
                      <p className="font-semibold text-slate-300">{doc}</p>
                      <p>{desc}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}