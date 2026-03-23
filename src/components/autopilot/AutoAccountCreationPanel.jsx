import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Zap, Lock } from 'lucide-react';
import { toast } from 'sonner';

export default function AutoAccountCreationPanel() {
  const [expandedPlatform, setExpandedPlatform] = useState(null);
  const queryClient = useQueryClient();

  // Fetch user's linked accounts
  const { data: linkedAccounts, isLoading: accountsLoading } = useQuery({
    queryKey: ['linkedAccounts'],
    queryFn: async () => {
      const result = await base44.entities.LinkedAccount.filter({}, null, 50);
      return result || [];
    }
  });

  // Fetch user goals for identity info
  const { data: userGoals } = useQuery({
    queryKey: ['userGoals'],
    queryFn: async () => {
      const result = await base44.entities.UserGoals.filter({}, null, 1);
      return result[0] || {};
    }
  });

  // Check auto-creation support
  const checkSupportMutation = useMutation({
    mutationFn: async (platform) => {
      const response = await base44.functions.invoke('autonomousAccountCreationEngine', {
        action: 'check_auto_creation_support',
        opportunity: { platform }
      });
      return response.data;
    }
  });

  // Auto-create account
  const autoCreateMutation = useMutation({
    mutationFn: async ({ platform, identityId }) => {
      const response = await base44.functions.invoke('autonomousAccountCreationEngine', {
        action: 'auto_create_account',
        identityId,
        opportunity: { platform, url: `https://${platform}.com/signup` }
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`✅ ${data.account?.platform} account created automatically`);
        queryClient.invalidateQueries({ queryKey: ['linkedAccounts'] });
      } else {
        toast.error(`Failed: ${data.status || 'Account creation failed'}`);
      }
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    }
  });

  const supportedPlatforms = [
    'upwork',
    'fiverr',
    'freelancer',
    'guru',
    'peopleperhour',
    'ebay',
    'etsy'
  ];

  const accountsByPlatform = {};
  (linkedAccounts || []).forEach(acc => {
    accountsByPlatform[acc.platform] = acc;
  });

  if (accountsLoading) {
    return <div className="p-6 text-muted-foreground">Loading accounts...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Zap className="w-5 h-5 text-primary" />
        <div>
          <h3 className="font-semibold text-foreground">Auto Account Creation</h3>
          <p className="text-xs text-muted-foreground">
            Autopilot can automatically create accounts on supported platforms
          </p>
        </div>
      </div>

      {/* Security Notice */}
      <Card className="glass-card border border-accent/30 bg-accent/5">
        <CardContent className="pt-4 flex items-start gap-3">
          <Lock className="w-4 h-4 text-accent mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-accent">🔒 Verified & Secure</p>
            <p>Accounts are created using your KYC-verified data. All credentials are encrypted and stored securely.</p>
          </div>
        </CardContent>
      </Card>

      {/* Platforms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {supportedPlatforms.map(platform => {
          const hasAccount = !!accountsByPlatform[platform];
          
          return (
            <Card
              key={platform}
              className={`glass-card cursor-pointer transition-all ${
                hasAccount
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-border/50 hover:border-primary/30'
              }`}
              onClick={() => setExpandedPlatform(expandedPlatform === platform ? null : platform)}
            >
              <CardContent className="pt-4 space-y-3">
                {/* Platform Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground capitalize">{platform}</p>
                    <p className="text-xs text-muted-foreground">
                      {hasAccount ? '✓ Account exists' : 'No account'}
                    </p>
                  </div>
                  {hasAccount && (
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  )}
                </div>

                {/* Expanded Details */}
                {expandedPlatform === platform && (
                  <div className="border-t border-border/50 pt-3 space-y-3">
                    {hasAccount ? (
                      <>
                        <div className="text-xs space-y-2 text-muted-foreground">
                          <p><span className="text-foreground">Username:</span> {accountsByPlatform[platform].username}</p>
                          <p><span className="text-foreground">Status:</span> {accountsByPlatform[platform].health_status}</p>
                          <p><span className="text-foreground">Created:</span> {new Date(accountsByPlatform[platform].created_date).toLocaleDateString()}</p>
                        </div>
                        <p className="text-xs text-primary font-medium">Ready for Autopilot tasks</p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Autopilot will automatically create a {platform} account using your verified information.
                        </p>
                        <Button
                          onClick={() => autoCreateMutation.mutate({
                            platform,
                            identityId: userGoals?.id || ''
                          })}
                          disabled={autoCreateMutation.isPending || !userGoals?.id}
                          className="w-full h-8 text-xs gap-2 bg-primary hover:bg-primary/90"
                        >
                          {autoCreateMutation.isPending ? (
                            <>Creating...</>
                          ) : (
                            <>
                              <Zap className="w-3 h-3" />
                              Create Account
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info Box */}
      <Card className="glass-card border border-border/50 bg-card/50">
        <CardContent className="pt-4 text-xs text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">💡 How It Works</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Auto-creation uses only your KYC-verified data</li>
            <li>No personal information is shared or simulated</li>
            <li>Credentials are encrypted and never exposed</li>
            <li>Accounts are instantly available for Autopilot tasks</li>
            <li>You can disable auto-creation anytime in settings</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}