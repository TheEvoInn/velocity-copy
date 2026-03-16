import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Shield, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import useIdentityRouting from '@/hooks/useIdentityRouting';

export default function IdentityAwareTaskPanel({ opportunity, onProceed }) {
  const { getIdentityForOpportunity, isDetecting } = useIdentityRouting();
  const [identityInfo, setIdentityInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const detectIdentity = async () => {
      setLoading(true);
      const info = await getIdentityForOpportunity(opportunity);
      setIdentityInfo(info);
      setLoading(false);
    };
    detectIdentity();
  }, [opportunity.id]);

  if (loading || isDetecting) {
    return (
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <span className="text-xs text-slate-400">Analyzing identity requirements...</span>
        </CardContent>
      </Card>
    );
  }

  if (!identityInfo) return null;

  const isKYCRequired = identityInfo.requires_kyc;
  const canProceed = identityInfo.can_proceed;

  return (
    <Card className={`border-l-4 ${isKYCRequired ? 'border-l-emerald-500 bg-emerald-950/20 border-emerald-900/30' : 'border-l-blue-500 bg-blue-950/20 border-blue-900/30'}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          {isKYCRequired ? (
            <>
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-300">Legal Identity Required</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 text-blue-400" />
              <span className="text-blue-300">Persona Identity</span>
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-slate-300">
          {isKYCRequired
            ? 'This opportunity requires verified legal identity for compliance. Your KYC verification will be used automatically.'
            : 'This opportunity will be executed using your active persona identity.'}
        </p>

        <div className="bg-black/20 rounded-lg p-2.5 text-xs text-slate-400 space-y-1">
          <div className="flex items-start gap-2">
            <span className="text-slate-500 mt-0.5">→</span>
            <span>{identityInfo.reason}</span>
          </div>
        </div>

        {!canProceed && (
          <div className="bg-red-950/40 border border-red-900/50 rounded-lg p-2.5 flex gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="text-xs text-red-300">
              <p className="font-semibold mb-1">Cannot proceed</p>
              <p>This task requires verified KYC. Please complete identity verification first.</p>
            </div>
          </div>
        )}

        {canProceed && (
          <Button
            onClick={onProceed}
            className={`w-full text-xs ${
              isKYCRequired
                ? 'bg-emerald-600 hover:bg-emerald-500'
                : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            <Lock className="w-3 h-3 mr-1" />
            {isKYCRequired ? 'Proceed with Legal Identity' : 'Proceed with Persona'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}