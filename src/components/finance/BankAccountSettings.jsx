import React, { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus, Edit2, CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';

export default function BankAccountSettings() {
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    label: '',
    bank_name: '',
    account_type: 'checking',
    last_four: '',
    routing_last_four: '',
    allocation_pct: 100
  });
  const queryClient = useQueryClient();

  // Fetch withdrawal policy
  const { data: policy, isLoading } = useQuery({
    queryKey: ['withdrawalPolicy'],
    queryFn: async () => {
      const result = await base44.entities.WithdrawalPolicy.filter({}, null, 1);
      return result[0] || {};
    }
  });

  // Add/update bank account
  const updatePolicyMutation = useMutation({
    mutationFn: async (updatedPolicy) => {
      if (policy?.id) {
        return await base44.entities.WithdrawalPolicy.update(policy.id, updatedPolicy);
      } else {
        return await base44.entities.WithdrawalPolicy.create(updatedPolicy);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['withdrawalPolicy'] });
      toast.success(editingId ? 'Bank account updated' : 'Bank account added');
      resetForm();
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    }
  });

  // Delete bank account
  const deleteAccountMutation = useMutation({
    mutationFn: async (accountIndex) => {
      const updatedAccounts = (policy.bank_accounts || []).filter((_, i) => i !== accountIndex);
      return await base44.entities.WithdrawalPolicy.update(policy.id, {
        bank_accounts: updatedAccounts,
        // If deleted account was primary, set next as primary
        ...(updatedAccounts.length > 0 && policy.bank_accounts[accountIndex]?.is_primary && {
          bank_accounts: updatedAccounts.map((acc, idx) => ({
            ...acc,
            is_primary: idx === 0
          }))
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['withdrawalPolicy'] });
      toast.success('Bank account removed');
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    }
  });

  // Set primary account
  const setPrimaryMutation = useMutation({
    mutationFn: async (accountIndex) => {
      const updatedAccounts = (policy.bank_accounts || []).map((acc, idx) => ({
        ...acc,
        is_primary: idx === accountIndex
      }));
      return await base44.entities.WithdrawalPolicy.update(policy.id, {
        bank_accounts: updatedAccounts
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['withdrawalPolicy'] });
      toast.success('Primary account updated');
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    }
  });

  // Toggle account enabled/disabled
  const toggleAccountMutation = useMutation({
    mutationFn: async (accountIndex) => {
      const account = (policy.bank_accounts || [])[accountIndex];
      const updatedAccounts = (policy.bank_accounts || []).map((acc, idx) =>
        idx === accountIndex ? { ...acc, is_active: !acc.is_active } : acc
      );
      return await base44.entities.WithdrawalPolicy.update(policy.id, {
        bank_accounts: updatedAccounts
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['withdrawalPolicy'] });
      toast.success('Account status updated');
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    }
  });

  const resetForm = () => {
    setFormData({
      label: '',
      bank_name: '',
      account_type: 'checking',
      last_four: '',
      routing_last_four: '',
      allocation_pct: 100
    });
    setIsAddingAccount(false);
    setEditingId(null);
  };

  const startEdit = (account, index) => {
    setFormData(account);
    setEditingId(index);
    setIsAddingAccount(true);
  };

  const handleAddOrUpdate = () => {
    // Validate required fields
    if (!formData.label || !formData.bank_name || !formData.last_four) {
      toast.error('Please fill in label, bank name, and account number');
      return;
    }

    if (formData.last_four.length < 4) {
      toast.error('Account number must be at least 4 digits');
      return;
    }

    if (formData.allocation_pct < 0 || formData.allocation_pct > 100) {
      toast.error('Allocation percentage must be between 0-100');
      return;
    }

    const currentAccounts = policy.bank_accounts || [];
    let updatedAccounts;

    if (editingId !== null) {
      // Update existing
      updatedAccounts = currentAccounts.map((acc, idx) =>
        idx === editingId
          ? { ...formData, is_active: acc.is_active || true, is_primary: acc.is_primary }
          : acc
      );
    } else {
      // Add new
      const newAccount = {
        ...formData,
        is_active: true,
        is_primary: currentAccounts.length === 0, // First account is primary
        vault_credential_id: `vault_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
      updatedAccounts = [...currentAccounts, newAccount];
    }

    updatePolicyMutation.mutate({
      bank_accounts: updatedAccounts
    });
  };

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Loading bank accounts...</div>;
  }

  const bankAccounts = policy?.bank_accounts || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold font-orbitron text-foreground">Bank Accounts</h2>
          <p className="text-muted-foreground mt-1">Manage withdrawal destinations</p>
        </div>
        {!isAddingAccount && (
          <Button
            onClick={() => setIsAddingAccount(true)}
            className="gap-2 bg-primary hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            Add Account
          </Button>
        )}
      </div>

      {/* Add/Edit Form */}
      {isAddingAccount && (
        <Card className="glass-card border border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg">
              {editingId !== null ? 'Edit Bank Account' : 'Add New Bank Account'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Label */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">
                  Account Label *
                </label>
                <Input
                  placeholder="e.g., Primary Checking"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  className="bg-input border-border"
                />
              </div>

              {/* Bank Name */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">
                  Bank Name *
                </label>
                <Input
                  placeholder="e.g., Chase Bank"
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  className="bg-input border-border"
                />
              </div>

              {/* Account Type */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">
                  Account Type
                </label>
                <select
                  value={formData.account_type}
                  onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                  className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground text-sm"
                >
                  <option>checking</option>
                  <option>savings</option>
                  <option>money_market</option>
                </select>
              </div>

              {/* Last 4 Digits */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">
                  Last 4 Digits *
                </label>
                <Input
                  placeholder="1234"
                  maxLength="4"
                  value={formData.last_four}
                  onChange={(e) => setFormData({ ...formData, last_four: e.target.value.slice(0, 4) })}
                  className="bg-input border-border"
                />
              </div>

              {/* Routing Last 4 */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">
                  Routing # Last 4
                </label>
                <Input
                  placeholder="5678"
                  maxLength="4"
                  value={formData.routing_last_four}
                  onChange={(e) => setFormData({ ...formData, routing_last_four: e.target.value.slice(0, 4) })}
                  className="bg-input border-border"
                />
              </div>

              {/* Allocation % */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">
                  Allocation %
                </label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.allocation_pct}
                  onChange={(e) => setFormData({ ...formData, allocation_pct: parseInt(e.target.value) || 0 })}
                  className="bg-input border-border"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 justify-end pt-4">
              <Button
                variant="outline"
                onClick={resetForm}
                disabled={updatePolicyMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddOrUpdate}
                disabled={updatePolicyMutation.isPending}
                className="bg-primary hover:bg-primary/90"
              >
                {updatePolicyMutation.isPending ? 'Saving...' : editingId !== null ? 'Update Account' : 'Add Account'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bank Accounts List */}
      <div className="space-y-3">
        {bankAccounts.length === 0 ? (
          <Card className="glass-card border border-border/50">
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">
                No bank accounts configured yet. Add one to enable automated withdrawals.
              </p>
            </CardContent>
          </Card>
        ) : (
          bankAccounts.map((account, idx) => (
            <Card key={idx} className={`glass-card border ${account.is_primary ? 'border-primary/50 bg-primary/5' : 'border-border/50'}`}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between gap-4">
                  {/* Account Info */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setPrimaryMutation.mutate(idx)}
                        disabled={setPrimaryMutation.isPending}
                        className="hover:opacity-70 transition-opacity"
                      >
                        {account.is_primary ? (
                          <CheckCircle2 className="w-5 h-5 text-primary" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted-foreground" />
                        )}
                      </button>
                      <div>
                        <p className="font-semibold text-foreground">{account.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {account.bank_name} • {account.account_type} • ••••{account.last_four}
                        </p>
                      </div>
                      {account.is_primary && (
                        <span className="ml-auto px-2 py-1 bg-primary/20 text-primary text-xs font-medium rounded">
                          Primary
                        </span>
                      )}
                    </div>
                    {account.allocation_pct !== 100 && (
                      <p className="text-xs text-muted-foreground ml-8">
                        Allocation: {account.allocation_pct}%
                      </p>
                    )}
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-3">
                    {/* Enable/Disable Toggle */}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={account.is_active !== false}
                        onCheckedChange={() => toggleAccountMutation.mutate(idx)}
                        disabled={toggleAccountMutation.isPending}
                      />
                      <span className="text-xs text-muted-foreground">
                        {account.is_active !== false ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>

                    {/* Edit Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => startEdit(account, idx)}
                      disabled={updatePolicyMutation.isPending || isAddingAccount}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>

                    {/* Delete Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm('Remove this bank account?')) {
                          deleteAccountMutation.mutate(idx);
                        }
                      }}
                      disabled={deleteAccountMutation.isPending || bankAccounts.length === 1}
                      className="text-destructive hover:text-destructive/90"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Info Box */}
      {bankAccounts.length > 0 && (
        <Card className="glass-card border border-accent/30 bg-accent/5">
          <CardContent className="pt-6">
            <div className="space-y-2 text-sm">
              <p className="font-medium text-accent">💡 Withdrawal Settings</p>
              <ul className="text-muted-foreground space-y-1 ml-4 list-disc">
                <li>Primary account receives automatic withdrawals</li>
                <li>Disabled accounts are skipped during withdrawals</li>
                <li>Allocation % determines fund distribution across enabled accounts</li>
                <li>At least one account must be enabled and active</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}