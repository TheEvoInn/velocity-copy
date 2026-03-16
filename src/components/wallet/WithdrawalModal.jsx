import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { X, Building2, CreditCard, AlertCircle, CheckCircle2, ArrowDownRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const BANK_TYPES = [
  { value: 'checking', label: 'Checking Account' },
  { value: 'savings', label: 'Savings Account' },
];

export default function WithdrawalModal({ onClose, currentBalance }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState('form'); // 'form' | 'confirm' | 'success'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    amount: '',
    bankName: '',
    accountHolderName: '',
    accountType: 'checking',
    routingNumber: '',
    accountNumber: '',
    confirmAccountNumber: '',
  });

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const validate = () => {
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) return 'Enter a valid withdrawal amount.';
    if (amount > currentBalance) return `Insufficient funds. Available: $${currentBalance.toFixed(2)}`;
    if (amount < 1) return 'Minimum withdrawal is $1.00';
    if (!form.bankName.trim()) return 'Enter your bank name.';
    if (!form.accountHolderName.trim()) return 'Enter account holder name.';
    if (!/^\d{9}$/.test(form.routingNumber)) return 'Routing number must be exactly 9 digits.';
    if (!/^\d{4,17}$/.test(form.accountNumber)) return 'Account number must be 4–17 digits.';
    if (form.accountNumber !== form.confirmAccountNumber) return 'Account numbers do not match.';
    return null;
  };

  const handleReview = () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setStep('confirm');
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      const amount = parseFloat(form.amount);
      const goals = await base44.entities.UserGoals.list();
      const goalsRecord = goals[0];
      const newBalance = (goalsRecord?.wallet_balance || 0) - amount;

      // Create withdrawal transaction
      await base44.entities.Transaction.create({
        type: 'expense',
        amount,
        category: 'other',
        description: `Withdrawal to ${form.bankName} ****${form.accountNumber.slice(-4)}`,
        balance_after: newBalance,
        notes: `Bank: ${form.bankName} | Account type: ${form.accountType} | Holder: ${form.accountHolderName}`,
      });

      // Deduct from wallet
      if (goalsRecord?.id) {
        await base44.entities.UserGoals.update(goalsRecord.id, {
          wallet_balance: newBalance,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['userGoals'] });
      setStep('success');
    } catch (e) {
      setError('Withdrawal failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const amount = parseFloat(form.amount) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ArrowDownRight className="w-4 h-4 text-rose-400" />
            <span className="text-sm font-semibold text-white">Withdraw Funds</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          {step === 'success' ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-white mb-1">Withdrawal Submitted</h3>
              <p className="text-sm text-slate-400 mb-1">
                <span className="text-emerald-400 font-bold">${amount.toFixed(2)}</span> will be sent to
              </p>
              <p className="text-xs text-slate-500 mb-1">{form.bankName} — {form.accountType}</p>
              <p className="text-xs text-slate-500 mb-6">Account ****{form.accountNumber.slice(-4)}</p>
              <p className="text-[11px] text-slate-600 mb-6">Transfers typically arrive within 1–3 business days.</p>
              <Button onClick={onClose} className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm w-full">
                Done
              </Button>
            </div>
          ) : step === 'confirm' ? (
            <div>
              <p className="text-xs text-slate-400 mb-5">Please review your withdrawal details before confirming.</p>
              <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-4 space-y-2.5 mb-5">
                <Row label="Amount" value={<span className="text-rose-400 font-bold">${amount.toFixed(2)}</span>} />
                <Row label="Bank" value={form.bankName} />
                <Row label="Account Holder" value={form.accountHolderName} />
                <Row label="Account Type" value={form.accountType} />
                <Row label="Routing #" value={`****${form.routingNumber.slice(-4)}`} />
                <Row label="Account #" value={`****${form.accountNumber.slice(-4)}`} />
                <Row label="Balance After" value={<span className="text-slate-300">${(currentBalance - amount).toFixed(2)}</span>} />
              </div>
              {error && <p className="text-xs text-rose-400 mb-3">{error}</p>}
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep('form')} className="flex-1 border-slate-700 text-slate-400 text-xs">
                  Back
                </Button>
                <Button onClick={handleConfirm} disabled={loading} className="flex-1 bg-rose-600 hover:bg-rose-500 text-white text-xs">
                  {loading ? 'Processing...' : 'Confirm Withdrawal'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Balance display */}
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 flex items-center justify-between">
                <span className="text-xs text-slate-400">Available Balance</span>
                <span className="text-lg font-bold text-emerald-400">${currentBalance.toFixed(2)}</span>
              </div>

              {/* Amount */}
              <div>
                <label className="text-[11px] text-slate-500 mb-1 block">Withdrawal Amount ($)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={e => set('amount', e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600"
                />
                <div className="flex gap-2 mt-2">
                  {[25, 50, 100, currentBalance].map(v => (
                    <button
                      key={v}
                      onClick={() => set('amount', v === currentBalance ? v.toFixed(2) : String(v))}
                      className="text-[10px] px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
                    >
                      {v === currentBalance ? 'Max' : `$${v}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-800 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-300">Bank Account Details</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] text-slate-500 mb-1 block">Bank Name</label>
                    <Input placeholder="e.g. Chase, Bank of America" value={form.bankName} onChange={e => set('bankName', e.target.value)} className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 mb-1 block">Account Holder Name</label>
                    <Input placeholder="Full legal name" value={form.accountHolderName} onChange={e => set('accountHolderName', e.target.value)} className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 mb-1 block">Account Type</label>
                    <div className="flex gap-2">
                      {BANK_TYPES.map(t => (
                        <button
                          key={t.value}
                          onClick={() => set('accountType', t.value)}
                          className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                            form.accountType === t.value
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 mb-1 block">Routing Number (9 digits)</label>
                    <Input placeholder="123456789" value={form.routingNumber} onChange={e => set('routingNumber', e.target.value.replace(/\D/g, '').slice(0, 9))} className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 font-mono" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 mb-1 block">Account Number</label>
                    <Input placeholder="Account number" value={form.accountNumber} onChange={e => set('accountNumber', e.target.value.replace(/\D/g, '').slice(0, 17))} className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 font-mono" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 mb-1 block">Confirm Account Number</label>
                    <Input placeholder="Re-enter account number" value={form.confirmAccountNumber} onChange={e => set('confirmAccountNumber', e.target.value.replace(/\D/g, '').slice(0, 17))} className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 font-mono" />
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg p-3">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-xs">{error}</span>
                </div>
              )}

              <Button onClick={handleReview} className="w-full bg-rose-600 hover:bg-rose-500 text-white text-sm">
                Review Withdrawal
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className="text-xs text-white">{value}</span>
    </div>
  );
}