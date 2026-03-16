import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, Calendar, TrendingUp, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

function fmt(n) {
  return (n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const QTR_LABELS = { Q1: 'Jan–Mar', Q2: 'Apr–Jun', Q3: 'Jul–Sep', Q4: 'Oct–Dec' };

export default function TaxEstimatePanel({ taxData }) {
  const [expanded, setExpanded] = useState(false);

  const { data: reportData } = useQuery({
    queryKey: ['tax_report'],
    queryFn: () => base44.functions.invoke('financialTracker', { action: 'get_tax_report' }),
    enabled: expanded
  });

  const report = reportData?.data || {};
  const tax = taxData || {};
  const urgency = tax.tax_still_owed_ytd > 500 ? 'high' : tax.tax_still_owed_ytd > 100 ? 'medium' : 'low';

  return (
    <div className={`rounded-2xl border overflow-hidden ${
      urgency === 'high' ? 'border-amber-500/40 bg-amber-950/20' :
      urgency === 'medium' ? 'border-amber-500/20 bg-slate-900/80' :
      'border-slate-800 bg-slate-900/80'
    }`}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-800/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            urgency === 'high' ? 'bg-amber-500/20' : 'bg-slate-800'
          }`}>
            <AlertTriangle className={`w-4 h-4 ${urgency === 'high' ? 'text-amber-400' : 'text-slate-400'}`} />
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-white">Tax Estimate & Withholding</div>
            <div className="text-xs text-slate-500">
              ~{tax.effective_rate_pct || 0}% effective rate · Next deadline: {tax.next_quarterly_deadline || 'N/A'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className={`text-sm font-bold ${tax.tax_still_owed_ytd > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              ${fmt(tax.tax_still_owed_ytd)} owed
            </div>
            <div className="text-[10px] text-slate-500">YTD estimate</div>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-800 px-5 py-4 space-y-4">
          {/* Key metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'YTD Net Income', value: `$${fmt(tax.ytd_net_income)}`, color: 'text-white' },
              { label: 'Annualized Est.', value: `$${fmt(tax.annualized_estimate)}`, color: 'text-blue-400' },
              { label: 'Annual Tax Est.', value: `$${fmt(tax.estimated_annual_tax)}`, color: 'text-amber-400' },
              { label: 'Quarterly Payment', value: `$${fmt(tax.estimated_quarterly_tax)}`, color: 'text-violet-400' },
            ].map(m => (
              <div key={m.label} className="bg-slate-800/60 rounded-lg p-3">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{m.label}</div>
                <div className={`text-base font-bold ${m.color}`}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Withholding status */}
          <div className="bg-slate-800/40 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-300">Withholding Progress</span>
              <span className="text-xs text-slate-500">
                ${fmt(tax.already_withheld)} withheld of ${fmt(tax.estimated_annual_tax)} est.
              </span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all"
                style={{ width: `${Math.min(100, tax.estimated_annual_tax > 0 ? (tax.already_withheld / tax.estimated_annual_tax) * 100 : 0)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-slate-600">
              <span>Auto-withheld from earnings</span>
              <span className={tax.tax_still_owed_ytd > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                ${fmt(tax.tax_still_owed_ytd)} remaining
              </span>
            </div>
          </div>

          {/* Quarterly breakdown from full report */}
          {report.quarterly_net && (
            <div>
              <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">Quarterly Net Income ({report.year})</div>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(report.quarterly_net).map(([q, amount]) => (
                  <div key={q} className="bg-slate-800/40 rounded-lg p-2.5 text-center">
                    <div className="text-[10px] text-slate-500 mb-1">{q} <span className="text-slate-600">({QTR_LABELS[q]})</span></div>
                    <div className="text-sm font-bold text-white">${fmt(amount)}</div>
                    <div className="text-[10px] text-amber-400 mt-0.5">
                      ~${fmt(amount * (tax.effective_rate_pct || 25) / 100)} tax
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quarterly deadlines */}
          {report.quarterly_deadlines && (
            <div>
              <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Quarterly Payment Deadlines
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(report.quarterly_deadlines).map(([q, date]) => {
                  const isPast = new Date(date) < new Date();
                  return (
                    <div key={q} className={`rounded-lg p-2.5 text-center border ${isPast ? 'border-slate-700/30 bg-slate-800/20' : 'border-amber-500/20 bg-amber-950/20'}`}>
                      <div className="text-[10px] text-slate-500">{q}</div>
                      <div className={`text-xs font-medium mt-0.5 ${isPast ? 'text-slate-500' : 'text-amber-400'}`}>{date}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="flex items-start gap-2 bg-blue-950/30 border border-blue-500/20 rounded-lg px-3 py-2.5">
            <Info className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-[10px] text-blue-300/70">{tax.disclaimer || report.totals?.disclaimer}</p>
          </div>
        </div>
      )}
    </div>
  );
}