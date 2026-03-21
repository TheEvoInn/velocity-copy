import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Plus, Settings, BarChart3, Zap } from 'lucide-react';
import SequenceBuilder from '@/components/email-marketing/SequenceBuilder';
import SequenceMetricsDashboard from '@/components/email-marketing/SequenceMetricsDashboard';
import LeadEnrollmentForm from '@/components/email-marketing/LeadEnrollmentForm';

export default function EmailMarketing() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedSequence, setSelectedSequence] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);

  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    base44.auth.me().then(u => setUser(u)).catch(() => {});
  }, []);

  const { data: sequences, isLoading } = useQuery({
    queryKey: ['emailSequences', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return await base44.entities.EmailSequence.filter(
        { created_by: user.email },
        '-updated_date',
        50
      );
    },
    enabled: !!user?.email,
    initialData: []
  });

  const { data: leads } = useQuery({
    queryKey: ['emailLeads', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return await base44.entities.EmailCampaignLead.filter(
        { created_by: user.email },
        '-enrollment_date',
        200
      );
    },
    enabled: !!user?.email,
    initialData: []
  });

  const stats = {
    total_sequences: sequences.length,
    active_sequences: sequences.filter(s => s.status === 'active').length,
    total_leads: leads.length,
    converted_leads: leads.filter(l => l.conversion_status === 'purchased').length,
    total_revenue: leads.reduce((sum, l) => sum + (l.purchase_amount || 0), 0)
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground font-orbitron">
              <Mail className="w-8 h-8 inline mr-3 text-primary" />
              Email Marketing Hub
            </h1>
            <p className="text-muted-foreground mt-1">Automated nurture sequences for high-ticket conversions</p>
          </div>
          <Button
            onClick={() => setShowBuilder(!showBuilder)}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            New Sequence
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[
            { label: 'Active Sequences', value: stats.active_sequences, icon: Zap, color: 'text-cyan-500' },
            { label: 'Total Leads', value: stats.total_leads, icon: Mail, color: 'text-blue-500' },
            { label: 'Conversions', value: stats.converted_leads, icon: BarChart3, color: 'text-emerald-500' },
            { label: 'Conversion Rate', value: stats.total_leads > 0 ? `${((stats.converted_leads / stats.total_leads) * 100).toFixed(1)}%` : '0%', icon: Settings, color: 'text-amber-500' },
            { label: 'Revenue Generated', value: `$${stats.total_revenue.toLocaleString()}`, icon: Mail, color: 'text-green-500' }
          ].map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <Card key={idx} className="glass-card">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    </div>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Main Content */}
        {showBuilder ? (
          <SequenceBuilder onSequenceCreated={() => {
            setShowBuilder(false);
            // Refetch sequences
          }} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Sequences List */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Your Email Sequences</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <p className="text-muted-foreground">Loading sequences...</p>
                  ) : sequences.length === 0 ? (
                    <div className="text-center py-8">
                      <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                      <p className="text-muted-foreground">No sequences yet</p>
                      <Button onClick={() => setShowBuilder(true)} variant="outline" className="mt-4">
                        Create Your First Sequence
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sequences.map((seq) => (
                        <div
                          key={seq.id}
                          onClick={() => setSelectedSequence(seq.id)}
                          className={`p-4 rounded-lg border cursor-pointer transition ${
                            selectedSequence === seq.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="font-medium text-foreground">{seq.name}</h3>
                              <p className="text-xs text-muted-foreground mt-1">
                                {seq.total_emails} emails • {seq.total_leads_enrolled || 0} leads enrolled
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-emerald-500">${seq.total_revenue_generated || 0}</p>
                              <p className="text-xs text-muted-foreground">{seq.conversion_rate?.toFixed(1) || 0}% conversion</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right: Selected Sequence Details */}
            <div className="lg:col-span-1 space-y-4">
              {selectedSequence ? (
                <>
                  <SequenceMetricsDashboard sequenceId={selectedSequence} />
                  <LeadEnrollmentForm sequenceId={selectedSequence} />
                </>
              ) : (
                <Card className="glass-card">
                  <CardContent className="pt-6 text-center">
                    <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-muted-foreground text-sm">Select a sequence to view details and enroll leads</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}