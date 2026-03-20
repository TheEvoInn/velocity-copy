import React, { useState } from 'react';
import { X, Plus, AlertCircle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const accountTypes = {
  freelance: {
    label: 'Freelance Platforms',
    platforms: ['upwork', 'fiverr', 'freelancer', 'guru', 'toptal', '99designs'],
    fields: ['username', 'password'],
  },
  ecommerce: {
    label: 'E-Commerce Platforms',
    platforms: ['ebay', 'amazon', 'etsy', 'shopify'],
    fields: ['username', 'password'],
  },
  email: {
    label: 'Email Providers',
    platforms: ['gmail', 'outlook', 'yahoo'],
    fields: ['email', 'password', 'app_password'],
  },
  banking: {
    label: 'Banking Institutions',
    platforms: ['chase', 'wells_fargo', 'bank_of_america', 'paypal', 'stripe', 'revolut'],
    fields: ['username', 'password', 'account_number', 'routing_number'],
  },
  social: {
    label: 'Social Media',
    platforms: ['twitter', 'linkedin', 'instagram', 'tiktok', 'facebook'],
    fields: ['username', 'password'],
  },
  content: {
    label: 'Content & Subscription',
    platforms: ['medium', 'substack', 'patreon', 'youtube'],
    fields: ['username', 'password', 'api_key'],
  },
  grants: {
    label: 'Grant & Prize Platforms',
    platforms: ['grants_gov', 'prize_portal', 'contest_site'],
    fields: ['username', 'password', 'tax_id'],
  },
  other: {
    label: 'Custom URL Accounts',
    platforms: [],
    fields: ['website_url', 'username', 'password', 'notes'],
  },
};

export default function AccountLinker({ identity, onClose, onSuccess }) {
  const [selectedAccountType, setSelectedAccountType] = useState('freelance');
  const [selectedPlatform, setSelectedPlatform] = useState('upwork');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [useExistingAccount, setUseExistingAccount] = useState(false);
  const [userAccountData, setUserAccountData] = useState({});

  const currentType = accountTypes[selectedAccountType];
  const availablePlatforms = currentType.platforms.length > 0 
    ? currentType.platforms 
    : selectedPlatform ? [selectedPlatform] : [];

  // Fetch linked accounts
  const { data: linkedAccounts, refetch } = useQuery({
    queryKey: ['linked_accounts', identity.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('accountCreationEngine', {
        action: 'list_accounts',
        identity_id: identity.id
      });
      return res.data?.accounts || [];
    }
  });

  const handleAutoCreate = async () => {
    setIsCreatingAccount(true);
    try {
      const res = await base44.functions.invoke('accountCreationEngine', {
        action: 'check_and_create_account',
        platform: selectedPlatform,
        identity_id: identity.id
      });

      if (res.data?.success) {
        refetch();
        setSelectedPlatform('upwork');
      }
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const handleUserOverride = async () => {
    if (!userAccountData.username.trim()) return;

    try {
      const res = await base44.functions.invoke('accountCreationEngine', {
        action: 'override_with_user_account',
        account_id: linkedAccounts?.[0]?.id,
        user_username: userAccountData.username,
        user_credential_data: userAccountData
      });

      if (res.data?.success) {
        refetch();
        setUseExistingAccount(false);
        setUserAccountData({ username: '' });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const accountsForIdentity = linkedAccounts?.filter(a => a.identity_id === identity.id) || [];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="bg-slate-900 border-slate-700 w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between sticky top-0 bg-slate-900 pb-4 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">Manage Accounts: {identity.name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Existing Accounts */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Linked Accounts ({accountsForIdentity.length})</h3>
          {accountsForIdentity.length === 0 ? (
            <p className="text-xs text-slate-400">No accounts linked yet</p>
          ) : (
            <div className="space-y-2">
              {accountsForIdentity.map((account) => (
                <div key={account.id} className="bg-slate-950 rounded-lg p-3 border border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{account.platform}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{account.username} {account.is_user_override ? '(Your account)' : '(AI-created)'}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    account.health_status === 'healthy'
                      ? 'bg-emerald-950 text-emerald-400'
                      : 'bg-amber-950 text-amber-400'
                  }`}>
                    {account.health_status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create/Override Options */}
        <div className="border-t border-slate-800 pt-4 space-y-4">
          {!useExistingAccount ? (
            <>
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-2">Select Platform</label>
                <select
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-slate-700 bg-slate-950 text-white text-sm"
                >
                  {platformOptions.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleAutoCreate}
                  disabled={isCreatingAccount}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {isCreatingAccount ? 'Creating...' : 'Auto-Create Account'}
                </Button>
                <Button
                  onClick={() => setUseExistingAccount(true)}
                  variant="outline"
                  className="flex-1"
                >
                  Use My Account
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-3 bg-slate-950 rounded-lg p-4 border border-slate-800">
              <p className="text-sm text-white font-medium">Link Your Account</p>
              <input
                type="text"
                placeholder="Your username"
                value={userAccountData.username}
                onChange={(e) => setUserAccountData({ ...userAccountData, username: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-slate-700 bg-slate-900 text-white text-sm"
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => setUseExistingAccount(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUserOverride}
                  disabled={!userAccountData.username.trim()}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  Link Account
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="bg-blue-950/20 border border-blue-900/30 rounded-lg p-3 flex gap-2">
          <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-300">
            Autopilot can auto-create accounts and store credentials securely. You can always replace any account with your own.
          </p>
        </div>
      </Card>
    </div>
  );
}