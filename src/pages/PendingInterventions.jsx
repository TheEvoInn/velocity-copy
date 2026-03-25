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
    
    // Subscribe to real-time intervention updates
    const unsubscribe = base44.entities.UserIntervention.subscribe((event) => {
      // Only handle events for this user's interventions
      if (event.type === 'create' || event.type === 'update') {
        // Immediately refresh to get latest state
        fetchInterventions();
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.email]);

  const fetchInterventions = async () => {
    if (!user?.email) return;
    
    try {
      setLoading(true);
      
      // Fetch all pending/in_progress interventions for this user
      const userInterventions = await base44.entities.UserIntervention.filter(
        { status: { $in: ['pending', 'in_progress'] }, user_email: user.email },
        '-priority',
        100
      ).catch(() => []);
      
      setInterventions(userInterventions);
    } catch (err) {
      console.error('Failed to fetch interventions:', err);
      setInterventions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (id) => {
    if (!user?.email) return;
    
    try {
      await base44.entities.UserIntervention.update(id, {
        status: 'rejected',
        resolved_at: new Date().toISOString()
      });
      
      // Force immediate refresh
      await fetchInterventions();
    } catch (err) {
      console.error('Failed to reject intervention:', err);
    }
  };

  const handleFormSubmit = async () => {
    // Clear selection and force full refresh after form submission
    setSelectedIntervention(null);
    
    // Delay slightly to allow backend to fully process
    setTimeout(() => {
      fetchInterventions();
    }, 500);
  };

  const handleResolve = async (interventionId) => {
    const intervention = interventions.find(i => i.id === interventionId);
    if (!intervention) return;

    try {
      const response = await base44.functions.invoke('taskResumeAfterIntervention', {
        intervention_id: interventionId,
        user_response: {}
      });

      if (response.data?.success) {
        setInterventions(prev => prev.filter(i => i.id !== interventionId));
      }
    } catch (err) {
      console.error('Error resuming task:', err);
    }
  };

  const filtered = interventions.filter(i => {
    if (filter === 'urgent') return i.priority > 80;
    if (filter === 'expiring') {
      const expiresAt = new Date(i.expires_at);
      const now = new Date();
      const hoursLeft = (expiresAt - now) / 3600000;
      return hoursLeft < 1 && hoursLeft > 0;
    }
    return true;
  });

  if (loading && interventions.length === 0) {
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
              <p className="text-xs text-slate-400">Autopilot blocks · Missing data · Credential requests</p>
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

        {/* Info */}
        <div className="flex items-start gap-3 p-3 rounded-xl mb-5"
          style={{ background: 'rgba(0,232,255,0.04)', border: '1px solid rgba(0,232,255,0.15)' }}>
          <Bot className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-400">
            When you submit data here, the task is immediately resumed and autopilot re-engages. All modules sync automatically.
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
            <Clock className="w-3 h-3 mr-1" />
            Expiring
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchInterventions}
          >
            Refresh
          </Button>
        </div>

        {/* Content */}
        {selectedIntervention ? (
          <InterventionForm
            intervention={selectedIntervention}
            onSubmit={handleFormSubmit}
            onClose={() => setSelectedIntervention(null)}
          />
        ) : (
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-slate-300 font-medium">No pending interventions</p>
                <p className="text-xs text-slate-500 mt-1">All your autopilot tasks are running smoothly</p>
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