import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Clock, Zap, RefreshCw } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import AccountOnboardingWizard from '../onboarding/AccountOnboardingWizard';

export default function AccountCreationAudit() {
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [auditResults, setAuditResults] = useState({});

  // Fetch all created accounts for current identity
  const { data: accounts = [], isLoading, refetch } = useQuery({
    queryKey: ['createdAccounts'],
    queryFn: async () => {
      const res = await base44.functions.invoke('automatedAccountCreation', {
        action: 'get_created_accounts',
        identity_id: localStorage.getItem('current_identity_id') || ''
      });
      return res.data.accounts || [];
    },
    enabled: !!localStorage.getItem('current_identity_id')
  });

  // Audit account integrity
  const auditMutation = useMutation({
    mutationFn: async (accountId) => {
      const account = accounts.find(a => a.id === accountId);
      if (!account) throw new Error('Account not found');

      const issues = [];
      const warnings = [];

      // Check for contradictions
      if (account.account_status === 'active' && account.profile_completeness < 50) {
        issues.push({
          level: 'warning',
          title: 'Status Mismatch',
          desc: 'Account marked active but profile incomplete'
        });
      }

      if (account.onboarding_completed && account.activation_status === 'pending') {
        issues.push({
          level: 'error',
          title: 'Contradictory States',
          desc: 'Onboarding complete but activation pending'
        });
      }

      if (!account.credential_vault_id && account.account_status !== 'pending') {
        issues.push({
          level: 'error',
          title: 'Missing Credentials',
          desc: 'No credential vault linked to account'
        });
      }

      if (account.profile_completeness > 100 || account.profile_completeness < 0) {
        issues.push({
          level: 'error',
          title: 'Invalid Progress',
          desc: `Profile completeness out of range: ${account.profile_completeness}%`
        });
      }

      // Verify onboarding steps consistency
      if (account.onboarding_steps) {
        const completed = account.onboarding_steps.filter(s => s.status === 'completed').length;
        const expected = Math.round((account.profile_completeness / 100) * account.onboarding_steps.length);
        
        if (Math.abs(completed - expected) > 1) {
          warnings.push({
            title: 'Step Mismatch',
            desc: `Expected ~${expected} completed steps but found ${completed}`
          });
        }
      }

      return {
        account_id: accountId,
        is_healthy: issues.length === 0,
        issues,
        warnings,
        last_audit: new Date().toISOString()
      };
    },
    onSuccess: (result) => {
      setAuditResults(prev => ({
        ...prev,
        [result.account_id]: result
      }));
      
      if (result.is_healthy) {
        toast.success(`✓ Account ${result.account_id.slice(0, 8)} is healthy`);
      } else {
        toast.warning(`⚠ Found ${result.issues.length} issue(s) in account`);
      }
    },
    onError: (error) => {
      toast.error(`Audit failed: ${error.message}`);
    }
  });

  const getStatusColor = (account) => {
    if (account.account_status === 'active') return 'text-emerald-400';
    if (account.account_status === 'onboarding') return 'text-blue-400';
    return 'text-slate-400';
  };

  if (isLoading) {
    return (
      <Card className="bg-slate-900/50 border-slate-700">
        <CardContent className="pt-8">
          <div className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            <span className="text-sm text-slate-400">Loading accounts...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (selectedAccount) {
    return (
      <div className="space-y-4">
        <Button
          onClick={() => setSelectedAccount(null)}
          variant="ghost"
          size="sm"
          className="text-slate-400"
        >
          ← Back to Accounts
        </Button>
        <AccountOnboardingWizard
          accountId={selectedAccount.id}
          platform={selectedAccount.platform}
          onComplete={() => {
            setSelectedAccount(null);
            refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Created Accounts</h3>
        <Button
          onClick={() => refetch()}
          size="sm"
          variant="outline"
          className="gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {accounts.length === 0 ? (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-8 text-center">
            <p className="text-sm text-slate-400">No accounts created yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {accounts.map(account => {
            const audit = auditResults[account.id];
            const hasIssues = audit && audit.issues.length > 0;

            return (
              <Card key={account.id} className="bg-slate-900/50 border-slate-700">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-sm capitalize">{account.platform}</h4>
                        <Badge variant="outline" className={getStatusColor(account)}>
                          {account.account_status}
                        </Badge>
                        {hasIssues && (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <AlertCircle className="w-3 h-3" /> {audit.issues.length} issue
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-1 text-xs text-slate-400 mb-3">
                        <p>User: {account.username}</p>
                        <p>Progress: {account.profile_completeness}%</p>
                      </div>

                      {/* Issues Display */}
                      {hasIssues && (
                        <div className="space-y-1.5 mb-3">
                          {audit.issues.map((issue, i) => (
                            <div
                              key={i}
                              className={`text-xs p-2 rounded-lg flex gap-2 ${
                                issue.level === 'error'
                                  ? 'bg-red-500/10 text-red-300 border border-red-500/20'
                                  : 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/20'
                              }`}
                            >
                              <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                              <div>
                                <div className="font-semibold">{issue.title}</div>
                                <div className="text-xs opacity-80">{issue.desc}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        onClick={() => auditMutation.mutate(account.id)}
                        disabled={auditMutation.isPending}
                        size="sm"
                        variant="outline"
                        className="text-xs gap-1.5 h-8"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Audit
                      </Button>
                      <Button
                        onClick={() => setSelectedAccount(account)}
                        size="sm"
                        className="gap-1.5 h-8"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        Setup
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}