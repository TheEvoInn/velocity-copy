import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Calendar, AlertCircle, CheckCircle2, Clock, TrendingUp, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import PayoutTimeline from '@/components/prizes/PayoutTimeline';
import PayoutTable from '@/components/prizes/PayoutTable';
import ReconciliationPanel from '@/components/prizes/ReconciliationPanel';

export default function PrizePayoutsTracker() {
  const [activeTab, setActiveTab] = useState('timeline');
  const [reconciliating, setReconciliating] = useState(false);

  // Fetch all payouts
  const { data: payouts, isLoading, refetch } = useQuery({
    queryKey: ['payouts'],
    queryFn: async () => {
      const res = await base44.functions.invoke('prizePayoutReconciliation', {
        action: 'get_payout_summary'
      });
      return res.data?.summary || {};
    },
    refetchInterval: 30000 // Auto-refresh every 30s
  });

  // Fetch overdue detection
  const { data: overdueData } = useQuery({
    queryKey: ['overdue_payouts'],
    queryFn: async () => {
      const res = await base44.functions.invoke('prizePayoutReconciliation', {
        action: 'detect_overdue_payouts'
      });
      return res.data || {};
    },
    refetchInterval: 60000
  });

  const handleReconcile = async () => {
    setReconciliating(true);
    try {
      const res = await base44.functions.invoke('prizePayoutReconciliation', {
        action: 'reconcile_payouts'
      });
      if (res.data?.success) {
        refetch();
      }
    } finally {
      setReconciliating(false);
    }
  };

  const stats = [
    {
      label: 'Total Prizes',
      value: payouts?.total_prizes || 0,
      icon: TrendingUp,
      color: 'text-blue-400'
    },
    {
      label: 'Claimed Value',
      value: `$${(payouts?.total_claimed_value || 0).toLocaleString()}`,
      icon: CheckCircle2,
      color: 'text-emerald-400'
    },
    {
      label: 'Pending Value',
      value: `$${(payouts?.pending_value || 0).toLocaleString()}`,
      icon: Clock,
      color: 'text-amber-400'
    },
    {
      label: 'Overdue',
      value: overdueData?.count || 0,
      icon: AlertCircle,
      color: 'text-red-400'
    }
  ];

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Prize Payouts</h1>
          <p className="text-sm text-slate-400 mt-1">Real-time tracking of all prize earnings and deliveries</p>
        </div>
        <Button
          onClick={handleReconcile}
          disabled={reconciliating}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${reconciliating ? 'animate-spin' : ''}`} />
          Reconcile Payouts
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-slate-900/50 border-slate-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">{label}</p>
                <p className="text-2xl font-bold text-white mt-2">{value}</p>
              </div>
              <Icon className={`w-8 h-8 ${color} opacity-50`} />
            </div>
          </Card>
        ))}
      </div>

      {/* Overdue Alert */}
      {overdueData?.overdue && overdueData.overdue.length > 0 && (
        <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-400">
                {overdueData.overdue.length} overdue payout{overdueData.overdue.length !== 1 ? 's' : ''}
              </p>
              <div className="mt-2 space-y-1">
                {overdueData.overdue.slice(0, 3).map(o => (
                  <p key={o.prize_id} className="text-xs text-red-300">
                    • {o.title}: {o.days_overdue} days late (${o.value})
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800">
        {[
          { id: 'timeline', label: 'Timeline', icon: Calendar },
          { id: 'table', label: 'All Payouts', icon: TrendingUp },
          { id: 'reconciliation', label: 'Reconciliation', icon: RefreshCw }
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === id
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'timeline' && <PayoutTimeline payouts={payouts} />}
        {activeTab === 'table' && <PayoutTable payouts={payouts} />}
        {activeTab === 'reconciliation' && <ReconciliationPanel onReconcile={handleReconcile} />}
      </div>
    </div>
  );
}