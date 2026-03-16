import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Info } from 'lucide-react';

const PLATFORM_FEE_RATES = {
  upwork: 0.20, fiverr: 0.20, freelancer: 0.10,
  peopleperhour: 0.20, toptal: 0.00, guru: 0.089, other: 0.10
};

const SE_TAX_RATE = 0.25; // simplified withholding estimate

export default function TransactionForm({ onClose, currentBalance = 0 }) {
  const [type, setType] = useState('income');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('other');
  const [description, setDescription] = useState('');
  const [platform, setPlatform] = useState('');
  const [payoutStatus, setPayoutStatus] = useState('available');
  const queryClient = useQueryClient();

  const gross = parseFloat(amount) || 0;
  const feeRate = PLATFORM_FEE_RATES[platform] || 0;
  const platformFee = type === 'income' ? Math.round(gross * feeRate * 100) / 100 : 0;
  const netAfterFees = gross - platformFee;
  const taxWithheld = type === 'income' ? Math.round(netAfterFees * SE_TAX_RATE * 100) / 100 : 0;
  const netAmount = Math.round((netAfterFees) * 100) / 100;

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const newBalance = data.type === 'income'
        ? currentBalance + (data.net_amount || data.amount)
        : currentBalance - data.amount;

      await base44.entities.Transaction.create({ ...data, balance_after: newBalance });

      const goals = await base44.entities.UserGoals.list();
      if (goals.length > 0) {
        const updateData = { wallet_balance: newBalance };
        if (data.type === 'income') {
          updateData.total_earned = (goals[0].total_earned || 0) + data.amount;
        }
        await base44.entities.UserGoals.update(goals[0].id, updateData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['userGoals'] });
      queryClient.invalidateQueries({ queryKey: ['financial_summary'] });
      onClose();
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || gross <= 0) return;
    createMutation.mutate({
      type, amount: gross, category, description,
      platform: platform || null,
      platform_fee: platformFee,
      platform_fee_pct: Math.round(feeRate * 100),
      net_amount: netAmount,
      tax_withheld: taxWithheld,
      tax_rate_pct: type === 'income' ? Math.round(SE_TAX_RATE * 100) : 0,
      payout_status: payoutStatus
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">Record Transaction</h2>
          <Button size="icon" variant="ghost" onClick={onClose} className="text-slate-500 hover:text-white">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {['income', 'expense'].map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                  type === t 
                    ? t === 'income' 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-rose-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {t === 'income' ? '+ Income' : '- Expense'}
              </button>
            ))}
          </div>

          <Input
            type="number"
            step="0.01"
            placeholder="Amount ($)"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="bg-slate-800 border-slate-700 text-white text-lg font-bold placeholder:text-slate-600"
          />

          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="arbitrage">Arbitrage</SelectItem>
              <SelectItem value="service">Service</SelectItem>
              <SelectItem value="lead_gen">Lead Gen</SelectItem>
              <SelectItem value="digital_flip">Digital Flip</SelectItem>
              <SelectItem value="auction">Auction</SelectItem>
              <SelectItem value="freelance">Freelance</SelectItem>
              <SelectItem value="resale">Resale</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Description (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600"
          />

          {type === 'income' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Platform (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upwork">Upwork (20% fee)</SelectItem>
                    <SelectItem value="fiverr">Fiverr (20% fee)</SelectItem>
                    <SelectItem value="freelancer">Freelancer (10% fee)</SelectItem>
                    <SelectItem value="peopleperhour">PeoplePerHour (20%)</SelectItem>
                    <SelectItem value="toptal">Toptal (0% fee)</SelectItem>
                    <SelectItem value="guru">Guru (8.9% fee)</SelectItem>
                    <SelectItem value="other">Other (10% est.)</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={payoutStatus} onValueChange={setPayoutStatus}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Payout status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_transit">In Transit</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {gross > 0 && (
                <div className="bg-slate-800/60 rounded-xl p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Gross amount</span><span>${gross.toFixed(2)}</span>
                  </div>
                  {platformFee > 0 && (
                    <div className="flex justify-between text-rose-400">
                      <span>Platform fee ({Math.round(feeRate * 100)}%)</span>
                      <span>-${platformFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-amber-400">
                    <span>Tax withholding est. (25%)</span>
                    <span>-${taxWithheld.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-400 border-t border-slate-700 pt-1.5">
                    <span>Net to wallet</span>
                    <span>${(netAmount - taxWithheld).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </>
          )}

          <Button
            type="submit"
            disabled={createMutation.isPending || !amount}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            <Plus className="w-4 h-4 mr-2" /> Record Transaction
          </Button>
        </form>
      </div>
    </div>
  );
}