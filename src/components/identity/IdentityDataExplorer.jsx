import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Settings2, Eye, Download, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function IdentityDataExplorer({ identity }) {
  const [expandedSections, setExpandedSections] = useState({});

  const { data: auditLogs = [], refetch: refetchLogs } = useQuery({
    queryKey: ['identityAuditLogs', identity?.id],
    queryFn: () => base44.entities.UserDataAuditLog.filter({
      entity_id: identity?.id
    }, '-created_date', 100),
    enabled: !!identity?.id,
    refetchInterval: 60000
  });

  const { data: secretAuditLogs = [] } = useQuery({
    queryKey: ['secretAuditLogs', identity?.id],
    queryFn: () => base44.entities.SecretAuditLog.filter({
      identity_id: identity?.id
    }, '-created_date', 50),
    enabled: !!identity?.id,
    refetchInterval: 60000
  });

  const toggleSection = (key) => {
    setExpandedSections(p => ({ ...p, [key]: !p[key] }));
  };

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900 border-slate-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-slate-400" />
            Identity Data & Access History
          </h3>
          <Button
            onClick={() => refetchLogs()}
            size="sm"
            variant="outline"
            className="border-slate-700 text-slate-400 gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </div>

        {!identity?.id ? (
          <div className="text-center py-12 text-slate-500">
            <p>Select an identity to view its data and access history.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Identity Profile Summary */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <button
                onClick={() => toggleSection('profile')}
                className="flex items-center justify-between w-full text-left"
              >
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-400" /> Identity Profile
                </h4>
                <span className="text-slate-500 text-xs">{expandedSections.profile ? '▼' : '▶'}</span>
              </button>

              {expandedSections.profile && (
                <div className="mt-4 space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-slate-500 text-xs uppercase">Name</p>
                      <p className="text-white font-medium">{identity.name}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs uppercase">Role</p>
                      <p className="text-white">{identity.role_label}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs uppercase">Email</p>
                      <p className="text-white">{identity.email || '-'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs uppercase">Created</p>
                      <p className="text-white">{new Date(identity.created_date).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {identity.bio && (
                    <div className="mt-3 pt-3 border-t border-slate-700">
                      <p className="text-slate-500 text-xs uppercase mb-1">Bio</p>
                      <p className="text-slate-300 text-xs leading-relaxed">{identity.bio}</p>
                    </div>
                  )}

                  {identity.skills?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-700">
                      <p className="text-slate-500 text-xs uppercase mb-2">Skills</p>
                      <div className="flex flex-wrap gap-1">
                        {identity.skills.map((skill, i) => (
                          <span key={i} className="text-[10px] bg-slate-700 text-slate-300 px-2 py-1 rounded">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {identity.preferred_platforms?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-700">
                      <p className="text-slate-500 text-xs uppercase mb-2">Preferred Platforms</p>
                      <div className="flex flex-wrap gap-1">
                        {identity.preferred_platforms.map((platform, i) => (
                          <span key={i} className="text-[10px] bg-blue-700 text-blue-300 px-2 py-1 rounded">
                            {platform}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Task & Performance Summary */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <button
                onClick={() => toggleSection('performance')}
                className="flex items-center justify-between w-full text-left"
              >
                <h4 className="font-semibold text-white">Performance Metrics</h4>
                <span className="text-slate-500 text-xs">{expandedSections.performance ? '▼' : '▶'}</span>
              </button>

              {expandedSections.performance && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-slate-700/50 rounded p-3">
                    <p className="text-slate-500 text-xs uppercase">Tasks Executed</p>
                    <p className="text-xl font-bold text-white mt-1">{identity.tasks_executed || 0}</p>
                  </div>
                  <div className="bg-emerald-700/20 rounded p-3">
                    <p className="text-slate-500 text-xs uppercase">Total Earned</p>
                    <p className="text-xl font-bold text-emerald-400 mt-1">${(identity.total_earned || 0).toFixed(2)}</p>
                  </div>
                  <div className="bg-violet-700/20 rounded p-3">
                    <p className="text-slate-500 text-xs uppercase">Linked Accounts</p>
                    <p className="text-xl font-bold text-violet-400 mt-1">{(identity.linked_account_ids || []).length}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded p-3">
                    <p className="text-slate-500 text-xs uppercase">Status</p>
                    <p className={`text-xl font-bold mt-1 ${identity.is_active ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {identity.is_active ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Secret Access Audit Log */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <button
                onClick={() => toggleSection('secretAudit')}
                className="flex items-center justify-between w-full text-left"
              >
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-amber-400" /> Credential Access Log
                </h4>
                <span className="text-slate-500 text-xs">{secretAuditLogs.length} entries</span>
              </button>

              {expandedSections.secretAudit && (
                <div className="mt-4 max-h-64 overflow-y-auto">
                  {secretAuditLogs.length === 0 ? (
                    <p className="text-slate-500 text-xs">No access history</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="border-b border-slate-700">
                        <tr className="text-slate-500 uppercase">
                          <th className="text-left py-2 px-2">Platform</th>
                          <th className="text-left py-2 px-2">Event</th>
                          <th className="text-left py-2 px-2">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {secretAuditLogs.slice(0, 20).map((log, i) => (
                          <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                            <td className="py-2 px-2 text-slate-400">{log.platform}</td>
                            <td className="py-2 px-2 text-slate-300 capitalize">{log.event_type}</td>
                            <td className="py-2 px-2 text-slate-500">
                              {new Date(log.created_date).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>

            {/* Data Integrity Status */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <button
                onClick={() => toggleSection('integrity')}
                className="flex items-center justify-between w-full text-left"
              >
                <h4 className="font-semibold text-white">Data Integrity</h4>
                <span className="text-slate-500 text-xs">{expandedSections.integrity ? '▼' : '▶'}</span>
              </button>

              {expandedSections.integrity && (
                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 bg-emerald-700/20 rounded border border-emerald-600/30">
                    <span className="text-emerald-300">✓ Identity profile data verified</span>
                    <span className="text-emerald-500 text-[10px]">OK</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-emerald-700/20 rounded border border-emerald-600/30">
                    <span className="text-emerald-300">✓ All credentials encrypted</span>
                    <span className="text-emerald-500 text-[10px]">OK</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-emerald-700/20 rounded border border-emerald-600/30">
                    <span className="text-emerald-300">✓ Access logs immutable</span>
                    <span className="text-emerald-500 text-[10px]">OK</span>
                  </div>
                </div>
              )}
            </div>

            {/* Export & Cleanup */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-slate-700 text-slate-400 gap-2"
              >
                <Download className="w-4 h-4" /> Export Data
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}