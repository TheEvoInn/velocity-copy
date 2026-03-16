import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DollarSign, Send, Plus, CheckCircle, Clock, AlertCircle, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

export default function PayoutDashboard() {
  const [showWithdrawalForm, setShowWithdrawalForm] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [showPayoutCalculator, setShowPayoutCalculator] = useState(false);
  const queryClient = useQueryClient();

  // Fetch user goals
  const { data: userGoals = [] } = useQuery({
    queryKey: ['userGoals'],
    queryFn: () => base44.entities.UserGoals.list(),
    initialData: []
  });

  // Fetch payout methods
  const { data: methods = {} } = useQuery({
    queryKey: ['payoutMethods'],
    queryFn: async () => {
      const res = await base44.functions.invoke('payoutManagementEngine', {
        action: 'get_payout_methods',
        payload: {}
      });
      return res.data || {};
    },
    refetchInterval: 60000
  });

  // Fetch payout history
  const { data: history = {} } = useQuery({
    queryKey: ['payoutHistory'],
    queryFn: async () => {
      const res = await base44.functions.invoke('payoutManagementEngine', {
        action: 'get_payout_history',
        payload: {}
      });
      return res.data || {};
    },
    refetchInterval: 60000
  });

  // Fetch settlement status
  const { data: settlement = {} } = useQuery({
    queryKey: ['settlementStatus'],
    queryFn: async () => {
      const res = await base44.functions.invoke('payoutManagementEngine', {
        action: 'get_settlement_status',
        payload: {}
      });
      return res.data || {};
    },
    refetchInterval: 60000
  });

  // Fetch tax summary
  const { data: taxSummary = {} } = useQuery({
    queryKey: ['taxSummary'],
    queryFn: async () => {
      const res = await base44.functions.invoke('payoutManagementEngine', {
        action: 'get_tax_summary',
        payload: {}
      });
      return res.data || {};
    },
    refetchInterval: 120000
  });

  // Calculate payout mutation
  const calculateMutation = useMutation({
    mutationFn: async (amount) => {
      const res = await base44.functions.invoke('payoutManagementEngine', {
        action: 'calculate_payout',
        payload: { amount: parseFloat(amount), platform: selectedMethod?.platform || 'stripe' }
      });
      return res.data;
    },
    onError: (error) => {
      toast.error(`Calculation failed: ${error.message}`);
    }
  });

  // Initiate withdrawal mutation
  const withdrawalMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('payoutManagementEngine', {
        action: 'initiate_withdrawal',
        payload: {
          amount: parseFloat(withdrawalAmount),
          payout_method_id: selectedMethod?.id
        }
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`✓ Withdrawal initiated: $${data.amount}`);
      setWithdrawalAmount('');
      setShowWithdrawalForm(false);
      queryClient.invalidateQueries({ queryKey: ['payoutHistory'] });
      queryClient.invalidateQueries({ queryKey: ['settlementStatus'] });
    },
    onError: (error) => {
      toast.error(`Withdrawal failed: ${error.message}`);
    }
  });

  const goal = userGoals[0] || {};
  const balance = goal.wallet_balance || 0;

  const handleInitiateWithdrawal = async () => {
    if (!withdrawalAmount || !selectedMethod) {
      toast.error('Please enter amount and select a payout method');
      return;
    }
    if (parseFloat(withdrawalAmount) > balance) {
      toast.error('Insufficient balance');
      return;
    }
    withdrawalMutation.mutate();
  };

  return (
    <div className="space-y-4">
      {/* Balance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg bg-emerald-950/30 border border-emerald-500/30 p-4">
          <div className="text-emerald-400 text-xs mb-1">Available Balance</div>
          <div className="text-3xl font-bold text-white">${balance.toFixed(2)}</div>
          <div className="text-emerald-600 text-[10px] mt-1">Ready to withdraw</div>
        </div>

        <div className="rounded-lg bg-blue-950/30 border border-blue-500/30 p-4">
          <div className="text-blue-400 text-xs mb-1">Pending Deposits</div>
          <div className="text-3xl font-bold text-white">{settlement.pending_deposits || 0}</div>
          <div className="text-blue-600 text-[10px] mt-1">In settlement</div>
        </div>

        <div className="rounded-lg bg-purple-950/30 border border-purple-500/30 p-4">
          <div className="text-purple-400 text-xs mb-1">Lifetime Payouts</div>
          <div className="text-3xl font-bold text-white">${settlement.total_lifetime_payouts?.toFixed(2) || '0.00'}</div>
          <div className="text-purple-600 text-[10px] mt-1">All time</div>
        </div>
      </div>

      {/* Quick Withdraw Section */}
      {!showWithdrawalForm ? (
        <Button
          onClick={() => setShowWithdrawalForm(true)}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white h-10"
        >
          <Send className="w-4 h-4 mr-2" />
          Initiate Withdrawal
        </Button>
      ) : (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">New Withdrawal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Amount</label>
              <Input
                type="number"
                value={withdrawalAmount}
                onChange={(e) => setWithdrawalAmount(e.target.value)}
                placeholder="0.00"
                className="bg-slate-800 border-slate-700 text-white"
              />
              <div className="text-[10px] text-slate-500 mt-1">Available: ${balance.toFixed(2)}</div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Payout Method</label>
              <select
                value={selectedMethod?.id || ''}
                onChange={(e) => {
                  const selected = methods.methods?.find(m => m.id === e.target.value);
                  setSelectedMethod(selected);
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm"
              >
                <option value="">Select method...</option>
                {methods.methods?.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.platform} - {m.username}
                  </option>
                ))}
              </select>
            </div>

            {withdrawalAmount && selectedMethod && (
              <Button
                onClick={() => calculateMutation.mutate(withdrawalAmount)}
                variant="outline"
                className="w-full text-xs h-8"
              >
                Calculate Breakdown
              </Button>
            )}

            {calculateMutation.data && (
              <div className="bg-slate-800/50 rounded-lg p-3 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Gross Amount</span>
                  <span className="font-bold">${calculateMutation.data.gross_amount?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-red-400">
                  <span>Tax Withheld</span>
                  <span>-${calculateMutation.data.tax_withheld?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-orange-400">
                  <span>Platform Fee</span>
                  <span>-${calculateMutation.data.platform_fee?.toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-700 pt-1 mt-1 flex justify-between font-bold text-emerald-400">
                  <span>You Receive</span>
                  <span>${calculateMutation.data.net_amount?.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleInitiateWithdrawal}
                disabled={withdrawalMutation.isPending || !withdrawalAmount || !selectedMethod}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white h-8 text-xs"
              >
                {withdrawalMutation.isPending ? 'Processing...' : 'Confirm Withdrawal'}
              </Button>
              <Button
                onClick={() => {
                  setShowWithdrawalForm(false);
                  setWithdrawalAmount('');
                }}
                variant="outline"
                className="flex-1 text-xs h-8"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payout Methods */}
      {methods.methods && methods.methods.length > 0 && (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Payout Methods ({methods.total_methods || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {methods.methods.map(m => (
                <div
                  key={m.id}
                  className={`p-2 rounded-lg border cursor-pointer transition-all ${
                    selectedMethod?.id === m.id
                      ? 'bg-slate-800 border-emerald-500/50'
                      : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                  }`}
                  onClick={() => setSelectedMethod(m)}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-white">{m.platform}</div>
                    <div className={`text-[10px] px-2 py-0.5 rounded ${
                      m.health_status === 'healthy'
                        ? 'bg-emerald-950/50 text-emerald-400'
                        : 'bg-amber-950/50 text-amber-400'
                    }`}>
                      {m.health_status || 'unknown'}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">{m.username}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Payouts */}
      {history.recent_payouts && history.recent_payouts.length > 0 && (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Recent Payouts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-xs max-h-56 overflow-y-auto">
              {history.recent_payouts.slice(0, 5).map((payout) => (
                <div key={payout.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30 border border-slate-700/50">
                  <div>
                    <div className="font-medium text-white capitalize">{payout.platform}</div>
                    <div className="text-slate-500 text-[9px]">{new Date(payout.date).toLocaleDateString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-emerald-400">${payout.amount?.toFixed(2)}</div>
                    <div className={`text-[9px] ${
                      payout.status === 'cleared'
                        ? 'text-emerald-500'
                        : payout.status === 'processing'
                        ? 'text-blue-500'
                        : 'text-slate-500'
                    }`}>
                      {payout.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tax Summary */}
      {taxSummary.ytd_income && (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              Tax Summary ({taxSummary.year})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">YTD Income</span>
              <span className="font-bold">${taxSummary.ytd_income?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Self-Employment Tax</span>
              <span className="font-bold text-orange-400">${taxSummary.self_employment_tax?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Estimated Income Tax</span>
              <span className="font-bold text-orange-400">${taxSummary.estimated_income_tax?.toFixed(2)}</span>
            </div>
            <div className="border-t border-slate-700 pt-2 mt-2 flex justify-between">
              <span className="text-slate-400">Remaining Tax Liability</span>
              <span className={`font-bold ${taxSummary.remaining_tax_liability > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                ${taxSummary.remaining_tax_liability?.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}