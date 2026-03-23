import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Clock, Zap, Eye, X } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminInterventions() {
  const queryClient = useQueryClient();
  const [selectedIntervention, setSelectedIntervention] = useState(null);

  // Fetch pending interventions
  const { data: interventions = [], isLoading } = useQuery({
    queryKey: ['userInterventions'],
    queryFn: async () => {
      const res = await base44.entities.UserIntervention.filter(
        { status: 'pending' },
        '-created_date',
        100
      );
      return res || [];
    },
    refetchInterval: 30000 // 30 seconds
  });

  // Resolve intervention
  const resolveMutation = useMutation({
    mutationFn: async ({ id, status, response }) => {
      return await base44.entities.UserIntervention.update(id, {
        status,
        user_response: response,
        resolved_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userInterventions'] });
      toast.success('Intervention resolved');
      setSelectedIntervention(null);
    },
    onError: (err) => {
      toast.error(`Failed: ${err.message}`);
    }
  });

  const pendingCount = interventions.length;
  const criticalCount = interventions.filter(i => i.priority >= 80).length;

  const typeConfig = {
    captcha: { label: 'CAPTCHA', color: 'text-amber-400', icon: '🔐' },
    form_validation: { label: 'Form Validation', color: 'text-blue-400', icon: '📋' },
    credential_invalid: { label: 'Credential Invalid', color: 'text-red-400', icon: '🔑' },
    two_factor: { label: '2FA Required', color: 'text-violet-400', icon: '📱' },
    email_confirmation: { label: 'Email Confirm', color: 'text-cyan-400', icon: '📧' },
    manual_review: { label: 'Manual Review', color: 'text-pink-400', icon: '👁️' },
    missing_data: { label: 'Missing Data', color: 'text-orange-400', icon: '⚠️' },
    decision_required: { label: 'Decision', color: 'text-yellow-400', icon: '🤔' },
    payment_confirmation: { label: 'Payment Confirm', color: 'text-green-400', icon: '💳' },
    other: { label: 'Other', color: 'text-slate-400', icon: '❓' }
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-4">
            <p className="text-xs text-slate-400 mb-1">Pending</p>
            <p className="text-2xl font-bold text-white">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-red-950/20 border-red-700/30">
          <CardContent className="pt-4">
            <p className="text-xs text-red-400 mb-1">Critical (P≥80)</p>
            <p className="text-2xl font-bold text-red-400">{criticalCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-4">
            <p className="text-xs text-slate-400 mb-1">Avg Wait</p>
            <p className="text-2xl font-bold text-slate-300">
              {interventions.length > 0
                ? Math.round(
                    interventions.reduce((sum, i) => {
                      const created = new Date(i.created_date);
                      const now = new Date();
                      return sum + (now - created) / 60000;
                    }, 0) / interventions.length
                  )
                : 0}
              m
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Interventions List */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Active Interventions</h3>
        {isLoading ? (
          <Card className="bg-slate-900/50 border-slate-700">
            <CardContent className="pt-6 text-center text-slate-400">Loading...</CardContent>
          </Card>
        ) : interventions.length === 0 ? (
          <Card className="bg-emerald-950/20 border-emerald-700/30">
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-emerald-400">No pending interventions</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {interventions.map((intervention) => {
              const type = typeConfig[intervention.requirement_type] || typeConfig.other;
              const isPriority = intervention.priority >= 80;

              return (
                <Card
                  key={intervention.id}
                  className={`cursor-pointer transition ${
                    isPriority
                      ? 'bg-red-950/20 border-red-700/50 hover:border-red-600'
                      : 'bg-slate-900/30 border-slate-700 hover:border-slate-600'
                  }`}
                  onClick={() => setSelectedIntervention(intervention)}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <span className="text-lg">{type.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className={`text-sm font-medium ${type.color}`}>{type.label}</p>
                            {isPriority && (
                              <Badge className="bg-red-600 text-white text-xs">P{intervention.priority}</Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mb-2">{intervention.required_data}</p>
                          <p className="text-xs text-slate-600">
                            Task: {intervention.task_id?.slice(0, 8)}...
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-slate-500 mb-2">
                          {Math.round(
                            (new Date() - new Date(intervention.created_date)) / 60000
                          )}m ago
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedIntervention(intervention);
                          }}
                          className="text-xs gap-1"
                        >
                          <Eye className="w-3 h-3" /> View
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedIntervention && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-slate-900 border-slate-700 max-h-96 overflow-y-auto">
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-sm">Intervention Details</CardTitle>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIntervention(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-slate-500">Type</p>
                <p className="text-sm font-medium text-white">
                  {typeConfig[selectedIntervention.requirement_type]?.label}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Task ID</p>
                <p className="text-xs font-mono text-slate-300">{selectedIntervention.task_id}</p>
              </div>
              {selectedIntervention.opportunity_id && (
                <div>
                  <p className="text-xs text-slate-500">Opportunity</p>
                  <p className="text-xs font-mono text-slate-300">
                    {selectedIntervention.opportunity_id?.slice(0, 8)}...
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-500">Required Data</p>
                <p className="text-sm text-slate-300">{selectedIntervention.required_data}</p>
              </div>
              {selectedIntervention.direct_link && (
                <div>
                  <p className="text-xs text-slate-500">Link</p>
                  <a
                    href={selectedIntervention.direct_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-cyan-400 hover:underline break-all"
                  >
                    {selectedIntervention.direct_link}
                  </a>
                </div>
              )}
              <div className="pt-3 border-t border-slate-700 space-y-2">
                <Button
                  size="sm"
                  className="w-full gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() =>
                    resolveMutation.mutate({
                      id: selectedIntervention.id,
                      status: 'resolved',
                      response: {}
                    })
                  }
                  disabled={resolveMutation.isPending}
                >
                  <CheckCircle2 className="w-3 h-3" /> Mark Resolved
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-1"
                  onClick={() =>
                    resolveMutation.mutate({
                      id: selectedIntervention.id,
                      status: 'rejected',
                      response: {}
                    })
                  }
                  disabled={resolveMutation.isPending}
                >
                  <X className="w-3 h-3" /> Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}