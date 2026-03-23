import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, Loader2, Zap } from 'lucide-react';

export default function KYCConsolidationStatus({ targetEmail, fullName }) {
  const [activating, setActivating] = useState(false);

  // Verify consolidation status
  const { data: verification, isLoading: verifying, refetch } = useQuery({
    queryKey: ['kyc-consolidation', targetEmail],
    queryFn: async () => {
      const res = await base44.functions.invoke('kycConsolidationVerifier', {
        action: 'verify_consolidation',
        target_email: targetEmail
      });
      return res.data?.verification;
    },
    enabled: !!targetEmail,
    refetchInterval: 5000
  });

  // Activate for KYC
  const activateMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('kycConsolidationVerifier', {
        action: 'activate_for_kyc',
        target_email: targetEmail
      });
      return res.data?.activation;
    },
    onSuccess: () => {
      refetch();
      setActivating(false);
    }
  });

  if (verifying) {
    return (
      <Card className="glass-card border-cyan-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
            Verifying Consolidation...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (!verification) {
    return null;
  }

  const isConsolidated = verification.consolidation_status === 'consolidated';
  const isApproved = verification.summary.kyc_verified;
  const canActivate = isApproved && !activating;

  return (
    <Card className={`glass-card ${isConsolidated ? 'border-emerald-500/30' : 'border-amber-500/30'}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isConsolidated ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <span className="text-emerald-300">KYC Consolidated & Approved</span>
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5 text-amber-400" />
              <span className="text-amber-300">KYC Status: {verification.consolidation_status}</span>
            </>
          )}
        </CardTitle>
        <CardDescription>{fullName || targetEmail}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="text-sm">
            <span className="text-muted-foreground">KYC ID: </span>
            <span className="font-mono text-cyan-300">{verification.summary.kyc_id}</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Status: </span>
            <span className={isApproved ? 'text-emerald-300' : 'text-amber-300'}>
              {verification.summary.kyc_status}
            </span>
          </div>
        </div>

        <div className="space-y-1 bg-slate-900/30 p-3 rounded border border-slate-700/50">
          {verification.checks.map((check, idx) => (
            <div key={idx} className="text-xs text-muted-foreground">
              {check}
            </div>
          ))}
        </div>

        {isApproved && (
          <Button
            onClick={() => {
              setActivating(true);
              activateMutation.mutate();
            }}
            disabled={!canActivate || activateMutation.isPending}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500"
          >
            {activating || activateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Activating Autopilot...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Activate Autopilot
              </>
            )}
          </Button>
        )}

        {activateMutation.data && (
          <div className="bg-emerald-900/20 border border-emerald-500/30 p-3 rounded space-y-1">
            {activateMutation.data.updates.map((update, idx) => (
              <div key={idx} className="text-xs text-emerald-300">
                {update}
              </div>
            ))}
          </div>
        )}

        {activateMutation.data?.errors?.length > 0 && (
          <div className="bg-red-900/20 border border-red-500/30 p-3 rounded space-y-1">
            {activateMutation.data.errors.map((error, idx) => (
              <div key={idx} className="text-xs text-red-300">
                {error}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}