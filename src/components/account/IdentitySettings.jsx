import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Settings, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

export default function IdentitySettings() {
  const [activeIdentity, setActiveIdentity] = useState(null);
  const queryClient = useQueryClient();

  // Fetch all identities
  const { data: identities = [], isLoading } = useQuery({
    queryKey: ['identities'],
    queryFn: async () => {
      return await base44.entities.AIIdentity.list('-updated_date', 50);
    }
  });

  // Fetch user goals to get active identity
  const { data: goals } = useQuery({
    queryKey: ['userGoals'],
    queryFn: async () => {
      const res = await base44.entities.UserGoals.list(1);
      return res[0] || {};
    }
  });

  // Switch identity mutation
  const switchIdentityMutation = useMutation({
    mutationFn: async (identityId) => {
      const identity = identities.find(i => i.id === identityId);
      return await base44.auth.updateMe({
        active_identity_id: identityId
      });
    },
    onSuccess: (data, identityId) => {
      const identity = identities.find(i => i.id === identityId);
      toast.success(`Switched to ${identity.name}`);
      setActiveIdentity(identityId);
      queryClient.invalidateQueries({ queryKey: ['userGoals'] });
    },
    onError: (error) => {
      toast.error(`Failed to switch identity: ${error.message}`);
    }
  });

  if (isLoading) {
    return <div className="text-slate-400">Loading identities...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Active Identity Info */}
      {activeIdentity && (
        <Card className="bg-gradient-to-r from-purple-950 to-blue-950 border-purple-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">Active Identity</p>
                <p className="text-lg font-semibold text-white mt-1">
                  {identities.find(i => i.id === activeIdentity)?.name || 'Unknown'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Used for autopilot task execution and communications
                </p>
              </div>
              <Zap className="w-6 h-6 text-amber-400" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Identities */}
      <div>
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Settings className="w-4 h-4 text-cyan-400" />
            Available Identities
          </h3>
          <p className="text-xs text-slate-500 mt-1">Switch between personas for different task types</p>
        </div>

        <div className="space-y-2">
          {identities.length === 0 ? (
            <Card className="bg-slate-900/50 border-slate-700">
              <CardContent className="pt-6 text-center text-slate-500 text-sm">
                No identities created yet. <a href="/AIIdentityStudio" className="text-blue-400 hover:underline">Create one</a>
              </CardContent>
            </Card>
          ) : (
            identities.map((identity) => (
              <Card
                key={identity.id}
                className={`border cursor-pointer transition-all ${
                  identity.id === activeIdentity
                    ? 'bg-purple-950/30 border-purple-500/50'
                    : 'bg-slate-900/30 border-slate-700 hover:border-slate-600'
                }`}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-white">{identity.name}</h4>
                      <Badge variant="outline" className="text-xs">
                        {identity.role_label || 'Persona'}
                      </Badge>
                      {identity.is_active && (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                          Active
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {identity.bio || identity.tagline || 'No description'}
                    </p>
                    <div className="flex gap-2 mt-2">
                      {identity.skills && identity.skills.slice(0, 3).map((skill) => (
                        <span key={skill} className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => switchIdentityMutation.mutate(identity.id)}
                    disabled={identity.id === activeIdentity || switchIdentityMutation.isPending}
                    className={`ml-4 p-2 rounded transition-colors ${
                      identity.id === activeIdentity
                        ? 'bg-purple-500/30 text-purple-300 cursor-default'
                        : 'hover:bg-slate-700 text-slate-400'
                    }`}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Create New Identity */}
      <Button
        variant="outline"
        className="w-full border-slate-600 text-slate-200 hover:bg-slate-800"
        onClick={() => window.location.href = '/AIIdentityStudio'}
      >
        Create New Identity
      </Button>
    </div>
  );
}