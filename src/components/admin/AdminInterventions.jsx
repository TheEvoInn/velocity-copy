import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminInterventions() {
  const [interventions, setInterventions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllInterventions();
  }, []);

  const fetchAllInterventions = async () => {
    try {
      const data = await base44.asServiceRole.entities.UserIntervention.list('-created_date', 100);
      setInterventions(data || []);
    } catch (err) {
      console.error('Failed to fetch interventions:', err);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    pending: interventions.filter(i => i.status === 'pending').length,
    resolved: interventions.filter(i => i.status === 'resolved').length,
    rejected: interventions.filter(i => i.status === 'rejected').length,
    expired: interventions.filter(i => i.status === 'expired').length,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-cyan-400">{stats.pending}</p>
              <p className="text-xs text-slate-400 mt-1">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-400">{stats.resolved}</p>
              <p className="text-xs text-slate-400 mt-1">Resolved</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-400">{stats.rejected}</p>
              <p className="text-xs text-slate-400 mt-1">Rejected</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-400">{stats.expired}</p>
              <p className="text-xs text-slate-400 mt-1">Expired</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* List */}
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-sm">All Interventions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {interventions.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No interventions</p>
            ) : (
              interventions.map(intervention => (
                <div key={intervention.id} className="bg-slate-800/50 rounded p-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white">{intervention.created_by}</p>
                    <p className="text-xs text-slate-400 truncate">{intervention.requirement_type}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {intervention.status === 'pending' && (
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    )}
                    {intervention.status === 'resolved' && (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    )}
                    {intervention.status === 'rejected' && (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span className="text-xs text-slate-400 whitespace-nowrap">{intervention.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}