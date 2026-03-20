import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, Check, AlertCircle, Eye, Lock } from 'lucide-react';

export default function ConnectedAccountsSettings() {
  // Fetch platform connections
  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['platformConnections'],
    queryFn: async () => {
      return await base44.entities.PlatformConnection.list('-last_verified_at', 50);
    }
  });

  const statusColors = {
    connected: 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300',
    pending: 'bg-amber-950/30 border-amber-500/30 text-amber-300',
    invalid_credentials: 'bg-red-950/30 border-red-500/30 text-red-300',
    expired_token: 'bg-orange-950/30 border-orange-500/30 text-orange-300',
    disconnected: 'bg-slate-950/30 border-slate-700 text-slate-400'
  };

  const statusIcons = {
    connected: <Check className="w-4 h-4" />,
    pending: <AlertCircle className="w-4 h-4" />,
    invalid_credentials: <AlertCircle className="w-4 h-4" />,
    expired_token: <AlertCircle className="w-4 h-4" />,
    disconnected: <AlertCircle className="w-4 h-4" />
  };

  const permissionColors = {
    view_only: 'bg-blue-500/20 text-blue-300',
    limited_automation: 'bg-amber-500/20 text-amber-300',
    full_automation: 'bg-emerald-500/20 text-emerald-300'
  };

  if (isLoading) {
    return <div className="text-slate-400">Loading connected accounts...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Info Box */}
      <Card className="bg-blue-950/30 border-blue-500/30">
        <CardContent className="pt-6 text-xs text-blue-200 space-y-1">
          <div>• Connected accounts are used by Autopilot for task execution</div>
          <div>• Your credentials are encrypted and never exposed</div>
          <div>• You control permission levels for each platform</div>
          <div>• Verify connections to ensure they remain active</div>
        </CardContent>
      </Card>

      {/* Connections List */}
      {connections.length === 0 ? (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-6 text-center text-slate-500 text-sm">
            <p>No connected accounts yet.</p>
            <a href="/AccountManager" className="text-blue-400 hover:underline">
              Connect your first account →
            </a>
          </CardContent>
        </Card>
      ) : (
        connections.map((conn) => (
          <Card key={conn.id} className="bg-slate-900/50 border-slate-700 hover:border-slate-600 transition-all">
            <CardContent className="p-4 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">{conn.platform}</h4>
                    <p className="text-xs text-slate-500">{conn.label}</p>
                  </div>
                </div>
                <Badge className={statusColors[conn.status]}>
                  {statusIcons[conn.status]}
                  <span className="ml-1">{conn.status.replace(/_/g, ' ')}</span>
                </Badge>
              </div>

              {/* Connection Details */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-800/50 rounded p-2">
                  <p className="text-slate-500">Account</p>
                  <p className="text-slate-200 font-medium mt-1">
                    {conn.account_username || conn.account_email || 'Linked'}
                  </p>
                </div>
                <div className="bg-slate-800/50 rounded p-2">
                  <p className="text-slate-500">Permission Level</p>
                  <p className={`font-medium mt-1 ${permissionColors[conn.autopilot_enabled ? 'full_automation' : 'limited_automation']}`}>
                    {conn.autopilot_enabled ? 'Full Automation' : 'Limited'}
                  </p>
                </div>
              </div>

              {/* Verification Status */}
              {conn.last_verified_at && (
                <div className="text-xs text-slate-500 bg-slate-800/30 rounded p-2">
                  Last verified: {new Date(conn.last_verified_at).toLocaleDateString()}
                </div>
              )}

              {/* Error Display */}
              {conn.verification_error && (
                <div className="text-xs bg-red-950/30 border border-red-500/30 text-red-300 rounded p-2">
                  {conn.verification_error}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-slate-700">
                <button className="flex-1 py-2 px-3 rounded text-xs font-medium bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors">
                  <Eye className="w-3 h-3 inline mr-1" />
                  Details
                </button>
                <button className="flex-1 py-2 px-3 rounded text-xs font-medium bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors">
                  <Lock className="w-3 h-3 inline mr-1" />
                  Permissions
                </button>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* Add New Connection */}
      <a
        href="/AccountManager"
        className="block w-full py-3 px-4 rounded-lg border border-dashed border-slate-600 text-center text-blue-400 hover:text-blue-300 hover:border-slate-500 transition-all text-sm font-medium"
      >
        + Add New Connection
      </a>
    </div>
  );
}