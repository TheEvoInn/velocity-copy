import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { AlertTriangle, Loader2 } from 'lucide-react';
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
      const data = await base44.functions.invoke('userInterventionManager', {
        action: 'get_pending_interventions'
      });
      setInterventions(data.interventions || []);
    } catch (err) {
      console.error('Failed to fetch interventions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (id) => {
    try {
      await base44.functions.invoke('userInterventionManager', {
        action: 'reject_intervention',
        intervention_id: id,
        reason: 'User rejected'
      });
      fetchInterventions();
    } catch (err) {
      console.error('Failed to reject:', err);
    }
  };

  const filtered = interventions.filter(i => {
    if (filter === 'urgent') return i.priority > 80;
    if (filter === 'expiring') return new Date(i.expires_at) - new Date() < 3600000;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
            Pending Interventions
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {filtered.length} action{filtered.length !== 1 ? 's' : ''} required
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