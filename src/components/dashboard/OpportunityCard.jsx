import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Zap, Clock, AlertTriangle, ChevronRight, DollarSign } from 'lucide-react';

const categoryLabels = {
  arbitrage: "Arbitrage",
  service: "Service",
  lead_gen: "Lead Gen",
  digital_flip: "Digital Flip",
  auction: "Auction",
  market_inefficiency: "Market Gap",
  trend_surge: "Trend Surge",
  freelance: "Freelance",
  resale: "Resale"
};

const categoryColors = {
  arbitrage: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  service: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  lead_gen: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  digital_flip: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  auction: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  market_inefficiency: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  trend_surge: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  freelance: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  resale: "bg-pink-500/10 text-pink-400 border-pink-500/20"
};

const timeSensitivityIcon = {
  immediate: <AlertTriangle className="w-3 h-3 text-red-400" />,
  hours: <Clock className="w-3 h-3 text-amber-400" />,
  days: <Clock className="w-3 h-3 text-blue-400" />,
  weeks: <Clock className="w-3 h-3 text-slate-400" />,
  ongoing: <Clock className="w-3 h-3 text-emerald-400" />
};

export default function OpportunityCard({ opportunity, onClick }) {
  const {
    title, description, category, profit_estimate_low, profit_estimate_high,
    capital_required, velocity_score, risk_score, overall_score, time_sensitivity, status
  } = opportunity;

  const scoreColor = overall_score >= 75 ? 'text-emerald-400' : overall_score >= 50 ? 'text-amber-400' : 'text-slate-400';
  
  return (
    <div 
      onClick={onClick}
      className="group rounded-xl bg-slate-900/60 border border-slate-800 p-4 hover:border-slate-600 hover:bg-slate-900/90 transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Badge variant="outline" className={`${categoryColors[category]} border text-[10px] shrink-0`}>
            {categoryLabels[category] || category}
          </Badge>
          {time_sensitivity && (
            <span className="flex items-center gap-1 text-[10px] text-slate-500">
              {timeSensitivityIcon[time_sensitivity]}
              {time_sensitivity}
            </span>
          )}
        </div>
        <div className={`text-lg font-bold ${scoreColor} tabular-nums`}>
          {overall_score}
        </div>
      </div>
      
      <h3 className="font-semibold text-white text-sm mb-1 line-clamp-1 group-hover:text-emerald-300 transition-colors">
        {title}
      </h3>
      <p className="text-xs text-slate-400 mb-3 line-clamp-2">{description}</p>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-emerald-400" />
            <span className="text-xs font-medium text-emerald-400">
              ${profit_estimate_low?.toLocaleString()}-${profit_estimate_high?.toLocaleString()}
            </span>
          </div>
          {capital_required > 0 && (
            <span className="text-[10px] text-slate-500">
              ${capital_required} needed
            </span>
          )}
          {capital_required === 0 && (
            <span className="text-[10px] text-emerald-600 font-medium">$0 start</span>
          )}
        </div>
        
        <div className="flex items-center gap-2 text-[10px]">
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-400" />
            <span className="text-slate-400">{velocity_score}</span>
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
        </div>
      </div>
    </div>
  );
}