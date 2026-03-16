import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Search, Download, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function DataPersistenceAudit() {
  const [search, setSearch] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('all');

  const { data: auditLog = [] } = useQuery({
    queryKey: ['userDataAuditLog', search, eventTypeFilter],
    queryFn: () => base44.entities.UserDataAuditLog.filter(
      eventTypeFilter !== 'all' ? { event_type: eventTypeFilter } : {},
      '-created_date',
      100
    ),
    initialData: [],
  });

  const { data: userStore } = useQuery({
    queryKey: ['userDataStore'],
    queryFn: () => base44.entities.UserDataStore.filter({}, '-created_date', 1),
    initialData: [],
  });

  const store = userStore?.[0];
  const filteredLog = auditLog.filter(
    entry =>
      !search ||
      entry.field_modified?.toLowerCase().includes(search.toLowerCase()) ||
      entry.change_description?.toLowerCase().includes(search.toLowerCase())
  );

  const eventTypeColors = {
    data_read: 'bg-blue-500/20 text-blue-400',
    data_created: 'bg-emerald-500/20 text-emerald-400',
    data_updated: 'bg-amber-500/20 text-amber-400',
    data_deleted: 'bg-red-500/20 text-red-400',
    integrity_check: 'bg-purple-500/20 text-purple-400',
    system_access: 'bg-slate-500/20 text-slate-400',
  };

  const getEventIcon = (eventType) => {
    switch (eventType) {
      case 'data_updated':
        return '📝';
      case 'data_created':
        return '✨';
      case 'data_read':
        return '👁️';
      case 'integrity_check':
        return '✅';
      default:
        return '📋';
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Data Persistence Audit</h1>
        <p className="text-slate-400">
          Complete audit trail of all user data modifications and system access
        </p>
      </div>

      {/* Store Summary */}
      {store && (
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader>
            <CardTitle className="text-sm">Data Store Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-slate-400 mb-1">Store ID</p>
                <p className="text-xs font-mono text-emerald-400 truncate">{store.id}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Created</p>
                <p className="text-xs text-white">{new Date(store.created_date).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Last Modified</p>
                <p className="text-xs text-white">{new Date(store.last_modified_at).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Version</p>
                <p className="text-xs font-semibold text-white">{store.version}</p>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-700">
              <p className="text-xs text-slate-400 mb-1">Stored Fields</p>
              <div className="flex flex-wrap gap-1">
                {[
                  'ui_preferences',
                  'autopilot_preferences',
                  'identity_preferences',
                  'security_preferences',
                  'wallet_preferences',
                  'execution_rules',
                ].map(field => (
                  <Badge key={field} variant="outline" className="text-[10px]">
                    {field.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
            <Input
              placeholder="Search by field or description..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 text-xs"
            />
          </div>
        </div>
        <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
          <SelectTrigger className="w-44 bg-slate-900 border-slate-800 text-white text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="data_updated">Updates</SelectItem>
            <SelectItem value="data_created">Created</SelectItem>
            <SelectItem value="data_read">Read</SelectItem>
            <SelectItem value="integrity_check">Integrity Checks</SelectItem>
            <SelectItem value="system_access">System Access</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Audit Log */}
      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Audit Log</CardTitle>
              <CardDescription className="text-xs mt-1">
                {filteredLog.length} entries · Complete history of data changes
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs">
              <Download className="w-3 h-3 mr-1" />
              Export
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {filteredLog.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400">No audit entries found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLog.map(entry => (
                <div
                  key={entry.id}
                  className={`p-3 rounded-lg border border-slate-700 text-xs ${
                    eventTypeColors[entry.event_type] || 'bg-slate-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg">{getEventIcon(entry.event_type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${eventTypeColors[entry.event_type]}`}
                        >
                          {entry.event_type.replace(/_/g, ' ')}
                        </Badge>
                        {entry.field_modified && (
                          <span className="text-slate-300 font-mono">{entry.field_modified}</span>
                        )}
                        {entry.explicit_user_consent && (
                          <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                            User Consent
                          </Badge>
                        )}
                      </div>
                      <p className="text-slate-300 mb-1">{entry.change_description}</p>
                      <p className="text-slate-500">
                        {new Date(entry.created_date).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Show old/new values for updates */}
                  {entry.event_type === 'data_updated' && entry.old_value !== undefined && (
                    <div className="mt-2 pl-11 text-[10px] space-y-1 border-t border-slate-700/50 pt-2">
                      <div>
                        <span className="text-slate-400">Old: </span>
                        <span className="text-slate-300 font-mono">
                          {JSON.stringify(entry.old_value)?.substring(0, 50)}...
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">New: </span>
                        <span className="text-slate-300 font-mono">
                          {JSON.stringify(entry.new_value)?.substring(0, 50)}...
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}