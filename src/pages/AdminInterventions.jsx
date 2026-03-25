import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export default function AdminInterventions() {
  const [selectedFilter, setSelectedFilter] = useState('pending');
  const [comment, setComment] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [stats, setStats] = useState(null);

  // Fetch interventions
  const { data: interventions, isLoading, refetch } = useQuery({
    queryKey: ['interventions', selectedFilter],
    queryFn: async () => {
      const res = await base44.functions.invoke('adminInterventionQueueManager', {
        action: 'fetch_pending',
        filter: { status: selectedFilter }
      });
      return res.data?.interventions || [];
    }
  });

  // Fetch stats
  useEffect(() => {
    const loadStats = async () => {
      try {
        const res = await base44.functions.invoke('adminInterventionQueueManager', {
          action: 'get_stats'
        });
        setStats(res.data?.stats);
      } catch (e) {
        console.error('Error loading stats:', e);
      }
    };
    loadStats();
  }, []);

  const handleSelectAll = () => {
    if (selected.size === interventions?.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(interventions?.map(i => i.id) || []));
    }
  };

  const handleToggleSelect = (id) => {
    const newSet = new Set(selected);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelected(newSet);
  };

  const handleBulkApprove = async () => {
    const interventionsData = (interventions || [])
      .filter(i => selected.has(i.id))
      .map(i => ({ intervention_id: i.id, task_id: i.task_id, comment }));

    try {
      await base44.functions.invoke('adminInterventionQueueManager', {
        action: 'bulk_approve',
        interventions_data: interventionsData
      });
      setSelected(new Set());
      setComment('');
      refetch();
    } catch (e) {
      console.error('Error approving:', e);
    }
  };

  const handleBulkReject = async () => {
    const interventionsData = (interventions || [])
      .filter(i => selected.has(i.id))
      .map(i => ({ intervention_id: i.id, task_id: i.task_id, comment }));

    try {
      await base44.functions.invoke('adminInterventionQueueManager', {
        action: 'bulk_reject',
        interventions_data: interventionsData
      });
      setSelected(new Set());
      setComment('');
      refetch();
    } catch (e) {
      console.error('Error rejecting:', e);
    }
  };

  const handleEscalate = async (interventionId) => {
    try {
      await base44.functions.invoke('adminInterventionQueueManager', {
        action: 'escalate',
        interventions_data: { intervention_id: interventionId, comment }
      });
      setComment('');
      refetch();
    } catch (e) {
      console.error('Error escalating:', e);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'captcha': return <AlertCircle className="w-4 h-4" />;
      case 'credential_invalid': return <AlertTriangle className="w-4 h-4" />;
      case 'two_factor': return <AlertCircle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Admin Interventions Queue</h1>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-sm text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card className="border-yellow-200">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <p className="text-sm text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card className="border-green-200">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
              <p className="text-sm text-muted-foreground">Resolved</p>
            </CardContent>
          </Card>
          <Card className="border-red-200">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
              <p className="text-sm text-muted-foreground">Rejected</p>
            </CardContent>
          </Card>
          <Card className="border-orange-200">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-orange-600">{stats.escalated}</div>
              <p className="text-sm text-muted-foreground">Escalated</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {['pending', 'escalated', 'resolved', 'rejected'].map(status => (
          <Button
            key={status}
            variant={selectedFilter === status ? 'default' : 'outline'}
            onClick={() => setSelectedFilter(status)}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Button>
        ))}
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-medium">{selected.size} selected</span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
              </div>
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Admin comment (optional)"
              className="w-full p-2 border rounded text-sm"
              rows={2}
            />

            <div className="flex gap-2">
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={handleBulkApprove}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Approve {selected.size}
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700"
                onClick={handleBulkReject}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject {selected.size}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Interventions list */}
      <div className="space-y-3">
        {isLoading ? (
          <p className="text-muted-foreground">Loading interventions...</p>
        ) : interventions?.length === 0 ? (
          <p className="text-muted-foreground">No interventions found.</p>
        ) : (
          <>
            {/* Select all header */}
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded">
              <input
                type="checkbox"
                checked={selected.size === interventions.length && interventions.length > 0}
                onChange={handleSelectAll}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">
                Select All ({interventions.length})
              </span>
            </div>

            {interventions.map((intervention) => (
              <Card key={intervention.id} className="p-4">
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={selected.has(intervention.id)}
                    onChange={() => handleToggleSelect(intervention.id)}
                    className="w-4 h-4 mt-1"
                  />
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getIcon(intervention.requirement_type)}
                      <span className="font-medium">{intervention.user_email}</span>
                      <Badge className={getPriorityColor(intervention.priority)}>
                        {intervention.priority}
                      </Badge>
                      <Badge variant="outline">
                        {intervention.requirement_type.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-3">
                      {intervention.required_data}
                    </p>

                    <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                      <div>
                        <span className="text-muted-foreground">Task ID:</span> {intervention.task_id?.slice(0, 8)}...
                      </div>
                      <div>
                        <span className="text-muted-foreground">Expires:</span> {new Date(intervention.expires_at).toLocaleDateString()}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Created:</span> {new Date(intervention.created_date).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600"
                        onClick={() => {
                          setSelected(new Set([intervention.id]));
                          // User will click approve button
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600"
                        onClick={() => {
                          setSelected(new Set([intervention.id]));
                        }}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEscalate(intervention.id)}
                      >
                        Escalate
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  );
}