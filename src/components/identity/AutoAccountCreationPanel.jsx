import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, Zap, CheckCircle2, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function AutoAccountCreationPanel({ identity }) {
  const queryClient = useQueryClient();
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [isCreating, setIsCreating] = useState(false);

  // Get platform list
  const { data: platformList = [] } = useQuery({
    queryKey: ['availablePlatforms'],
    queryFn: async () => {
      const res = await base44.functions.invoke('automatedAccountCreation', {
        action: 'get_platform_list'
      });
      return res.data?.platforms || [];
    }
  });

  // Create accounts mutation
  const createAccountsMutation = useMutation({
    mutationFn: async (platformsToCreate) => {
      setIsCreating(true);
      const res = await base44.functions.invoke('automatedAccountCreation', {
        action: 'create_accounts',
        identity_id: identity.id,
        platforms_to_create: platformsToCreate
      });
      return res.data;
    },
    onSuccess: (data) => {
      if (data.created_count > 0) {
        toast.success(`Created ${data.created_count} account(s) successfully`);
        queryClient.invalidateQueries({ queryKey: ['linkedAccounts'] });
        queryClient.invalidateQueries({ queryKey: ['createdAccounts'] });
        setSelectedPlatforms([]);
      }
      if (data.skipped_count > 0) {
        toast.info(`${data.skipped_count} account(s) skipped (already exist)`);
      }
      setIsCreating(false);
    },
    onError: (err) => {
      toast.error(`Creation failed: ${err.message}`);
      setIsCreating(false);
    }
  });

  const handleSelectPlatform = (platform) => {
    setSelectedPlatforms(prev => {
      if (prev.includes(platform)) {
        return prev.filter(p => p !== platform);
      } else {
        return [...prev, platform];
      }
    });
  };

  const handleCreateAccounts = () => {
    if (selectedPlatforms.length === 0) {
      toast.error('Select at least one platform');
      return;
    }
    createAccountsMutation.mutate(selectedPlatforms);
  };

  if (!identity) {
    return null;
  }

  return (
    <Card className="bg-slate-900 border-slate-800 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          Auto-Create Accounts
        </h3>
      </div>

      <p className="text-sm text-slate-400 mb-6">
        Instantly generate and create accounts on popular platforms using {identity.name}'s profile information.
      </p>

      {/* Platform Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {platformList.map(platform => (
          <button
            key={platform.platform}
            onClick={() => handleSelectPlatform(platform.platform)}
            className={`p-4 rounded-lg border transition-all text-left ${
              selectedPlatforms.includes(platform.platform)
                ? 'bg-amber-950/30 border-amber-500/50'
                : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <p className="font-semibold text-white text-sm">{platform.label}</p>
              {selectedPlatforms.includes(platform.platform) && (
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
              )}
            </div>
            <p className="text-xs text-slate-400">{platform.description}</p>
            {platform.skills_required && (
              <p className="text-[10px] text-slate-500 mt-2">📊 Skills-based profile</p>
            )}
          </button>
        ))}
      </div>

      {/* Create Button */}
      <div className="flex gap-3">
        <Button
          onClick={handleCreateAccounts}
          disabled={selectedPlatforms.length === 0 || isCreating || createAccountsMutation.isPending}
          className="flex-1 bg-amber-600 hover:bg-amber-500 text-white gap-2"
        >
          {createAccountsMutation.isPending ? (
            <>
              <Zap className="w-4 h-4 animate-spin" />
              Creating Accounts...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Create {selectedPlatforms.length} Account{selectedPlatforms.length !== 1 ? 's' : ''}
            </>
          )}
        </Button>
      </div>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-slate-800/50 border border-slate-700 rounded-lg flex gap-3">
        <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-400 space-y-1">
          <p className="font-medium text-white">Auto-Creation Details:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Uses {identity.name}'s profile information</li>
            <li>Generates unique usernames per platform</li>
            <li>Creates secure credential vault entries</li>
            <li>Accounts ready for immediate use</li>
            <li>All real-time, no manual intervention needed</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}