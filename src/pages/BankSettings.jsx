import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import BankAccountSettings from '@/components/finance/BankAccountSettings';
import FinanceOverviewCard from '@/components/finance/FinanceOverviewCard';

export default function BankSettings() {
  // Fetch user goals for overview
  const { data: userGoals } = useQuery({
    queryKey: ['userGoals'],
    queryFn: async () => {
      const result = await base44.entities.UserGoals.filter({}, null, 1);
      return result[0] || {};
    }
  });

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold font-orbitron text-foreground">Finance Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage your wallet and configure bank accounts for automated withdrawals
          </p>
        </div>

        {/* Finance Overview */}
        <div className="mb-10">
          <FinanceOverviewCard userGoals={userGoals} />
        </div>

        {/* Bank Account Settings */}
        <div className="bg-background">
          <BankAccountSettings />
        </div>
      </div>
    </div>
  );
}