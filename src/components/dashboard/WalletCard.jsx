import React from 'react';
import { Wallet, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function WalletCard({ balance = 0, totalEarned = 0, todayEarned = 0 }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 p-6">
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full -translate-y-32 translate-x-32" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/5 rounded-full translate-y-24 -translate-x-24" />
      
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Wallet Balance</span>
        </div>
        
        <div className="text-4xl font-bold text-white mb-6 tracking-tight">
          ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
            <div>
              <div className="text-xs text-slate-500">Total Earned</div>
              <div className="text-sm font-semibold text-emerald-400">
                ${totalEarned.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
            <div>
              <div className="text-xs text-slate-500">Today</div>
              <div className="text-sm font-semibold text-blue-400">
                ${todayEarned.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}