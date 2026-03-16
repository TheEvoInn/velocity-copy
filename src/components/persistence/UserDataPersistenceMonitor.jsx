import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, AlertCircle, RefreshCw, Shield, Database } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function UserDataPersistenceMonitor() {
  const [validationInProgress, setValidationInProgress] = useState(false);

  const { data: userStore } = useQuery({
    queryKey: ['userDataStore'],
    queryFn: () => base44.functions.invoke('userDataPersistenceManager', {
      action: 'list_all',
    }).then(r => r.data?.data),
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: auditLog } = useQuery({
    queryKey: ['userDataAuditLog'],
    queryFn: () => base44.entities.UserDataAuditLog.filter(
      {},
      '-created_date',
      10
    ),
    initialData: [],
    refetchInterval: 30000,
  });

  const handleValidateIntegrity = async () => {
    setValidationInProgress(true);
    try {
      await base44.functions.invoke('userDataIntegrityValidator', {
        validate_all: false,
      });
    } catch (error) {
      console.error('Validation error:', error);
    } finally {
      setValidationInProgress(false);
    }
  };

  const getDataStatus = () => {
    if (!userStore) return { status: 'warning', label: 'No Data' };
    if (userStore.checksum) return { status: 'success', label: 'Verified' };
    return { status: 'warning', label: 'Unverified' };
  };

  const status = getDataStatus();
  const lastModified = userStore?.last_modified_at
    ? new Date(userStore.last_modified_at).toLocaleString()
    : 'Never';

  return (
    <Card className="bg-slate-900/80 border-slate-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <div>
              <CardTitle className="text-sm">User Data Persistence</CardTitle>
              <CardDescription className="text-xs mt-1">
                All preferences are saved indefinitely and survive system changes
              </CardDescription>
            </div>
          </div>
          <Badge
            className={`text-xs ${
              status.status === 'success'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/20 text-amber-400'
            }`}
          >
            {status.status === 'success' ? (
              <CheckCircle2 className="w-3 h-3 mr-1" />
            ) : (
              <AlertCircle className="w-3 h-3 mr-1" />
            )}
            {status.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Status Grid */}
        <div className="grid grid-cols-3 gap-2 text-[9px]">
          <div className="p-2 bg-slate-800/50 rounded border border-slate-700">
            <p className="text-slate-400 mb-1">Store Status</p>
            <p className="text-emerald-400 font-semibold flex items-center gap-1">
              <Shield className="w-3 h-3" />
              {userStore ? 'Active' : 'Missing'}
            </p>
          </div>
          <div className="p-2 bg-slate-800/50 rounded border border-slate-700">
            <p className="text-slate-400 mb-1">Last Modified</p>
            <p className="text-white font-semibold truncate">{lastModified}</p>
          </div>
          <div className="p-2 bg-slate-800/50 rounded border border-slate-700">
            <p className="text-slate-400 mb-1">Audit Entries</p>
            <p className="text-white font-semibold">{auditLog?.length || 0}</p>
          </div>
        </div>

        {/* Data Fields Status */}
        {userStore && (
          <div className="border-t border-slate-700 pt-3">
            <p className="text-[9px] text-slate-400 mb-2">Data Fields</p>
            <div className="grid grid-cols-2 gap-1.5 text-[8px]">
              {[
                'ui_preferences',
                'autopilot_preferences',
                'identity_preferences',
                'security_preferences',
                'wallet_preferences',
                'execution_rules',
              ].map(field => (
                <div
                  key={field}
                  className="flex items-center gap-1.5 p-1.5 bg-slate-800/50 rounded border border-slate-700"
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                  <span className="text-slate-300 truncate">{field.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Audit Log */}
        {auditLog && auditLog.length > 0 && (
          <div className="border-t border-slate-700 pt-3">
            <p className="text-[9px] text-slate-400 mb-2">Recent Activity</p>
            <div className="space-y-1">
              {auditLog.slice(0, 3).map(entry => (
                <div
                  key={entry.id}
                  className="text-[8px] p-1.5 bg-slate-800/50 rounded border border-slate-700"
                >
                  <p className="text-slate-300">
                    {entry.change_description || entry.event_type}
                  </p>
                  <p className="text-slate-500">
                    {new Date(entry.created_date).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            onClick={handleValidateIntegrity}
            disabled={validationInProgress}
            className="flex-1 h-6 text-xs bg-blue-600 hover:bg-blue-500"
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${validationInProgress ? 'animate-spin' : ''}`} />
            {validationInProgress ? 'Validating...' : 'Validate'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}