import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Users, TrendingUp, DollarSign, Target, Mail, CheckCircle } from 'lucide-react';
import { Loader2 } from 'lucide-react';

export default function SequenceMetricsDashboard({ sequenceId }) {
  const [metrics, setMetrics] = useState(null);
  const [sequence, setSequence] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [sequenceId]);

  const loadMetrics = async () => {
    try {
      const response = await base44.functions.invoke('emailSequenceOrchestrator', {
        action: 'get_metrics',
        data: { sequence_id: sequenceId }
      });

      if (response.data.success) {
        setMetrics(response.data.metrics);
        setSequence(response.data.sequence);
      }
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!metrics) return <div>No data available</div>;

  const metricCards = [
    {
      label: 'Total Enrolled',
      value: metrics.total_enrolled,
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10'
    },
    {
      label: 'Active Leads',
      value: metrics.active,
      icon: Mail,
      color: 'text-cyan-500',
      bg: 'bg-cyan-500/10'
    },
    {
      label: 'Conversions',
      value: metrics.converted,
      icon: CheckCircle,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10'
    },
    {
      label: 'Conversion Rate',
      value: `${metrics.conversion_rate.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10'
    },
    {
      label: 'Revenue Generated',
      value: `$${metrics.total_revenue.toLocaleString()}`,
      icon: DollarSign,
      color: 'text-green-500',
      bg: 'bg-green-500/10'
    },
    {
      label: 'Unsubscribe Rate',
      value: `${metrics.unsubscribe_rate.toFixed(1)}%`,
      icon: Target,
      color: 'text-red-500',
      bg: 'bg-red-500/10'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metricCards.map((metric, idx) => {
          const Icon = metric.icon;
          return (
            <Card key={idx} className="glass-card">
              <CardContent className="pt-6">
                <div className={`${metric.bg} w-12 h-12 rounded-lg flex items-center justify-center mb-3`}>
                  <Icon className={`w-6 h-6 ${metric.color}`} />
                </div>
                <p className="text-sm text-muted-foreground mb-1">{metric.label}</p>
                <p className="text-2xl font-bold">{metric.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Email Engagement */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Email Engagement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-primary/10 rounded p-4">
              <p className="text-sm text-muted-foreground">Avg Open Rate</p>
              <p className="text-2xl font-bold mt-2">{metrics.avg_open_rate.toFixed(1)}%</p>
            </div>
            <div className="bg-secondary/10 rounded p-4">
              <p className="text-sm text-muted-foreground">Bounce Rate</p>
              <p className="text-2xl font-bold mt-2">{metrics.bounce_rate.toFixed(1)}%</p>
            </div>
            <div className="bg-accent/10 rounded p-4">
              <p className="text-sm text-muted-foreground">Unsubscribe Rate</p>
              <p className="text-2xl font-bold mt-2">{metrics.unsubscribe_rate.toFixed(1)}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status */}
      {sequence && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{sequence.name}</span>
              <Badge className={sequence.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}>
                {sequence.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Sequence Type</p>
                <p className="font-medium">{sequence.sequence_type}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Emails</p>
                <p className="font-medium">{sequence.total_emails}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Sent From</p>
                <p className="font-medium">{sequence.sender_name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Activity</p>
                <p className="font-medium">
                  {sequence.last_sent_at ? new Date(sequence.last_sent_at).toLocaleDateString() : 'Never'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}