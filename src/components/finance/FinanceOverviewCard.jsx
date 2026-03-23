import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, Wallet } from 'lucide-react';

export default function FinanceOverviewCard({ userGoals }) {
  const walletBalance = userGoals?.wallet_balance || 0;
  const totalEarned = userGoals?.total_earned || 0;
  const availableForWithdrawal = Math.max(0, walletBalance - (userGoals?.safety_buffer || 200));

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Wallet Balance */}
      <Card className="glass-card border border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" />
            Wallet Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            ${walletBalance.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Available for withdrawal: ${availableForWithdrawal.toFixed(2)}
          </p>
        </CardContent>
      </Card>

      {/* Total Earned */}
      <Card className="glass-card border border-accent/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent" />
            Total Earned
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">
            ${totalEarned.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Lifetime earnings
          </p>
        </CardContent>
      </Card>

      {/* Available for Withdrawal */}
      <Card className="glass-card border border-emerald-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-500" />
            Ready to Withdraw
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-500">
            ${availableForWithdrawal.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            After safety buffer
          </p>
        </CardContent>
      </Card>
    </div>
  );
}