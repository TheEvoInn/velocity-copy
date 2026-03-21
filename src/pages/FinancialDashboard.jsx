import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DollarSign, TrendingUp, Wallet, Send, ArrowUpRight, ArrowDownLeft, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const statusColors = {
  income: 'text-emerald-400 bg-emerald-400/10',
  expense: 'text-red-400 bg-red-400/10',
  transfer: 'text-blue-400 bg-blue-400/10',
  cleared: 'text-emerald-400',
  pending: 'text-amber-400',
  failed: 'text-red-400'
};

export default function FinancialDashboard() {
  const [transferModal, setTransferModal] = useState(false);
  const [payoutModal, setPayoutModal] = useState(false);
  const [transferData, setTransferData] = useState({ amount: '', recipient: '' });
  const [payoutData, setPayoutData] = useState({ amount: '', method: 'bank' });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // Fetch transactions - real-time refresh every 10s
  const { data: transactions = [], isLoading: transLoading } = useQuery({
    queryKey: ['transactions', user?.email],
    queryFn: () => base44.entities.Transaction.filter(
      { created_by: user?.email },
      '-created_date',
      50
    ),
    enabled: !!user?.email,
    refetchInterval: 10000,
    staleTime: 0
  });

  // Fetch user goals (for balance/earnings info) - real-time refresh every 5s
  const { data: userGoals } = useQuery({
    queryKey: ['userGoals', user?.email],
    queryFn: () => base44.entities.UserGoals.filter(
      { created_by: user?.email },
      '-created_date',
      1
    ),
    enabled: !!user?.email,
    refetchInterval: 5000,
    staleTime: 0
  });

  // Fetch AI identities for earnings breakdown - real-time every 15s
  const { data: identities = [] } = useQuery({
    queryKey: ['identities', user?.email],
    queryFn: () => base44.entities.AIIdentity.filter(
      { created_by: user?.email },
      '-last_used_at',
      100
    ),
    enabled: !!user?.email,
    refetchInterval: 15000,
    staleTime: 0
  });

  const currentBalance = userGoals?.[0]?.wallet_balance || 0;
  const totalEarned = userGoals?.[0]?.total_earned || 0;
  const aiEarned = userGoals?.[0]?.ai_total_earned || 0;
  const userEarned = userGoals?.[0]?.user_total_earned || 0;

  const recentIncome = transactions
    .filter(t => t.type === 'income')
    .slice(0, 5)
    .reduce((sum, t) => sum + (t.net_amount || 0), 0);

  const pendingTransactions = transactions.filter(t => t.payout_status === 'pending').length;

  // Handle transfer
  const handleTransfer = async () => {
    if (!transferData.amount || !transferData.recipient) {
      toast.error('Please fill in all fields');
      return;
    }
    try {
      await base44.entities.Transaction.create({
        type: 'transfer',
        amount: parseFloat(transferData.amount),
        net_amount: parseFloat(transferData.amount),
        description: `Transfer to ${transferData.recipient}`,
        payout_status: 'pending',
      });
      toast.success('Transfer initiated');
      setTransferData({ amount: '', recipient: '' });
      setTransferModal(false);
    } catch (err) {
      toast.error('Transfer failed: ' + err.message);
    }
  };

  // Handle payout
  const handlePayout = async () => {
    if (!payoutData.amount) {
      toast.error('Please enter an amount');
      return;
    }
    try {
      await base44.entities.Transaction.create({
        type: 'income',
        amount: parseFloat(payoutData.amount),
        net_amount: parseFloat(payoutData.amount),
        description: `Payout via ${payoutData.method}`,
        payout_status: 'in_transit',
      });
      toast.success('Payout initiated');
      setPayoutData({ amount: '', method: 'bank' });
      setPayoutModal(false);
    } catch (err) {
      toast.error('Payout failed: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Financial Dashboard</h1>
        <p className="text-slate-400">Manage earnings, balances, and payouts across all identities</p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Current Balance */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-400">Current Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-emerald-400">${currentBalance.toFixed(2)}</span>
              <Wallet className="w-5 h-5 text-emerald-400/50" />
            </div>
            <p className="text-xs text-slate-500 mt-2">Available for withdrawal</p>
          </CardContent>
        </Card>

        {/* Total Earned */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-400">Total Earned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-cyan-400">${totalEarned.toFixed(2)}</span>
              <TrendingUp className="w-5 h-5 text-cyan-400/50" />
            </div>
            <p className="text-xs text-slate-500 mt-2">All-time earnings</p>
          </CardContent>
        </Card>

        {/* AI Earnings */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-400">AI Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-violet-400">${aiEarned.toFixed(2)}</span>
              <DollarSign className="w-5 h-5 text-violet-400/50" />
            </div>
            <p className="text-xs text-slate-500 mt-2">Generated by autopilot</p>
          </CardContent>
        </Card>

        {/* Pending Payouts */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-400">Pending Payouts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-amber-400">{pendingTransactions}</span>
              <Clock className="w-5 h-5 text-amber-400/50" />
            </div>
            <p className="text-xs text-slate-500 mt-2">In processing</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Dialog open={payoutModal} onOpenChange={setPayoutModal}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-500">
              <ArrowUpRight className="w-4 h-4 mr-2" />
              Initiate Payout
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-800">
            <DialogHeader>
              <DialogTitle className="text-white">Initiate Payout</DialogTitle>
              <DialogDescription>Withdraw funds to your bank account</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Amount (USD)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={payoutData.amount}
                  onChange={(e) => setPayoutData({ ...payoutData, amount: e.target.value })}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <Button onClick={handlePayout} className="w-full bg-emerald-600 hover:bg-emerald-500">
                Confirm Payout
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={transferModal} onOpenChange={setTransferModal}>
          <DialogTrigger asChild>
            <Button variant="outline" className="border-slate-700">
              <Send className="w-4 h-4 mr-2" />
              Transfer Funds
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-800">
            <DialogHeader>
              <DialogTitle className="text-white">Transfer Funds</DialogTitle>
              <DialogDescription>Send funds between identities or accounts</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Amount (USD)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={transferData.amount}
                  onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Recipient</label>
                <Input
                  placeholder="Recipient email or account"
                  value={transferData.recipient}
                  onChange={(e) => setTransferData({ ...transferData, recipient: e.target.value })}
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <Button onClick={handleTransfer} className="w-full bg-blue-600 hover:bg-blue-500">
                Confirm Transfer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* AI Identities Earnings Breakdown */}
      {identities.length > 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Earnings by Identity</CardTitle>
            <CardDescription>Performance breakdown across AI personas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {identities.slice(0, 5).map(identity => (
                <div key={identity.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: identity.color || '#7c3aed' }}></div>
                    <div>
                      <p className="text-sm font-medium text-white">{identity.name}</p>
                      <p className="text-xs text-slate-500">{identity.tasks_executed || 0} tasks completed</p>
                    </div>
                  </div>
                  <span className="text-lg font-semibold text-emerald-400">${(identity.total_earned || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Recent Transactions</CardTitle>
          <CardDescription>Latest financial activity</CardDescription>
        </CardHeader>
        <CardContent>
          {transLoading ? (
            <div className="text-center py-8 text-slate-500">Loading transactions...</div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No transactions yet</div>
          ) : (
            <div className="space-y-2">
              {transactions.slice(0, 10).map(transaction => (
                <div key={transaction.id} className="flex items-center justify-between p-3 border border-slate-800 rounded-lg hover:bg-slate-800/50 transition">
                  <div className="flex items-center gap-3">
                    {transaction.type === 'income' ? (
                      <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                    ) : transaction.type === 'transfer' ? (
                      <Send className="w-5 h-5 text-blue-400" />
                    ) : (
                      <ArrowUpRight className="w-5 h-5 text-red-400" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-white capitalize">{transaction.type}</p>
                      <p className="text-xs text-slate-500">{transaction.description || transaction.category || 'Transaction'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${statusColors[transaction.type]}`}>
                        {transaction.type === 'income' ? '+' : '-'}${(transaction.net_amount || 0).toFixed(2)}
                      </p>
                      <p className={`text-xs capitalize ${statusColors[transaction.payout_status]}`}>
                        {transaction.payout_status}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}