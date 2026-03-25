import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { AlertTriangle, Loader2, Bot, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import InterventionCard from '@/components/interventions/InterventionCard';
import InterventionForm from '@/components/interventions/InterventionForm';

export default function PendingInterventions() {
  const { user } = useAuth();
  const [interventions, setInterventions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIntervention, setSelectedIntervention] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchInterventions();
    const unsubscribe = base44.entities.UserIntervention.subscribe((event) => {
      if (event.type === 'create' || event.type === 'update') {
        fetchInterventions();
      }
    });
    return () => unsubscribe?.();
  }, []);

  const fetchInterventions = async () => {
    try {
      // Query UserIntervention directly — no function call needed
      const pending = await base44.entities.UserIntervention.filter(
        { status: { $in: ['pending', 'in_progress'] } },
        '-priority',
        50
      );
      setInterventions(Array.isArray(pending) ? pending : []);
    } catch (err) {
      console.error('Failed to fetch interventions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (id) => {
    await base44.functions.invoke('userInterventionManager', {
      action: 'reject_intervention',
      intervention_id: id,
      reason: 'User rejected'
    });
    fetchInterventions();
  };

  const filtered = interventions.filter(i => {
    if (filter === 'urgent') return i.priority > 80;
    if (filter === 'expiring') return new Date(i.expires_at) - new Date() < 3600000;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen galaxy-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen galaxy-bg">
      <div className="max-w-4xl mx-auto p-4 md:p-6">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.4)' }}>
              <AlertTriangle className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h1 className="font-orbitron text-2xl font-bold text-white tracking-wider">USER INTERVENTIONS</h1>
              <p className="text-xs text-slate-400">Autopilot blocks · Missing data · Credential requests · Decisions required</p>
            </div>
          </div>
          <div className="text-right">
            {filtered.length > 0 ? (
              <div className="px-3 py-1.5 rounded-xl" style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.35)' }}>
                <span className="font-orbitron text-xs text-orange-400">{filtered.length} PENDING</span>
              </div>
            ) : (
              <div className="px-3 py-1.5 rounded-xl flex items-center gap-1.5" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-orbitron text-xs text-emerald-400">ALL CLEAR</span>
              </div>
            )}
          </div>
        </div>

        {/* Autopilot sync info */}
        <div className="flex items-start gap-3 p-3 rounded-xl mb-5"
          style={{ background: 'rgba(0,232,255,0.04)', border: '1px solid rgba(0,232,255,0.15)' }}>
          <Bot className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-400">
            These requests were created by the Autopilot engine when it encountered a block. Submitting data here will immediately resume the blocked task and sync the response across all platform modules.
          </p>
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All ({interventions.length})
          </Button>
          <Button
            variant={filter === 'urgent' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('urgent')}
          >
            Urgent
          </Button>
          <Button
            variant={filter === 'expiring' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('expiring')}
          >
            Expiring Soon
          </Button>
        </div>

        {/* Content */}
        {selectedIntervention ? (
          <InterventionForm
            intervention={selectedIntervention}
            onSubmit={fetchInterventions}
            onClose={() => setSelectedIntervention(null)}
          />
        ) : (
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400">No pending interventions</p>
              </div>
            ) : (
              filtered.map(intervention => (
                <InterventionCard
                  key={intervention.id}
                  intervention={intervention}
                  onResolve={() => setSelectedIntervention(intervention)}
                  onReject={handleReject}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}