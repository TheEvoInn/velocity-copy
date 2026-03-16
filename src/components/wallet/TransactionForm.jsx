import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus } from 'lucide-react';

export default function TransactionForm({ onClose, currentBalance = 0 }) {
  const [type, setType] = useState('income');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('other');
  const [description, setDescription] = useState('');
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const newBalance = data.type === 'income' 
        ? currentBalance + data.amount 
        : currentBalance - data.amount;
      
      await base44.entities.Transaction.create({ ...data, balance_after: newBalance });
      
      // Update user goals wallet balance
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
      onClose();
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;
    createMutation.mutate({
      type,
      amount: parseFloat(amount),
      category,
      description
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