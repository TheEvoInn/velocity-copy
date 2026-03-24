import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Loader2, AlertCircle, DollarSign, Calculator, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const QUARTERS = [
  { q: 1, label: 'Q1 (Jan-Mar)', month: 3 },
  { q: 2, label: 'Q2 (Apr-Jun)', month: 6 },
  { q: 3, label: 'Q3 (Jul-Sep)', month: 9 },
  { q: 4, label: 'Q4 (Oct-Dec)', month: 12 }
];

export default function TaxDashboard() {
  const [selectedYear] = useState(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3));
  const queryClient = useQueryClient();

  // Fetch quarterly tax calculations
  const { data: taxData = {}, isLoading, refetch } = useQuery({
    queryKey: ['quarterlyTaxes', selectedYear, selectedQuarter],
    queryFn: async () => {
      const res = await base44.functions.invoke('taxAutomationEngine', {
        action: 'calculate_quarterly_taxes',
        quarter: selectedQuarter,
        year: selectedYear
      });
      return res.data || {};
    }
  });

  // Fetch annual summary
  const { data: annualData = {} } = useQuery({
    queryKey: ['annualTaxSummary', selectedYear],
    queryFn: async () => {
      const res = await base44.functions.invoke('taxAutomationEngine', {
        action: 'calculate_annual_summary',
        year: selectedYear
      });
      return res.data || {};
    }
  });

  // Generate W-9 form
  const generateW9Mutation = useMutation({
    mutationFn: () => base44.functions.invoke('taxFormGenerator', {
      action: 'generate_form',
      form_type: 'w9',
      quarter: selectedQuarter,
      year: selectedYear,
      tax_record_id: taxData.tax_record_id
    }),
    onSuccess: (data) => {
      toast.success('W-9 form generated successfully');
      queryClient.invalidateQueries({ queryKey: ['taxForms'] });
      refetch();
    },
    onError: (err) => {
      toast.error(`Form generation failed: ${err.message}`);
    }
  });

  // Generate 1099-NEC form
  const generate1099Mutation = useMutation({
    mutationFn: () => base44.functions.invoke('taxFormGenerator', {
      action: 'generate_form',
      form_type: '1099-nec',
      quarter: selectedQuarter,
      year: selectedYear,
      tax_record_id: taxData.tax_record_id
    }),
    onSuccess: (data) => {
      toast.success('1099-NEC form generated successfully');
      queryClient.invalidateQueries({ queryKey: ['taxForms'] });
      refetch();
    },
    onError: (err) => {
      toast.error(`Form generation failed: ${err.message}`);
    }
  });

  // Export form
  const exportFormMutation = useMutation({
    mutationFn: (formRecordId) => base44.functions.invoke('taxFormGenerator', {
      action: 'export_form',
      tax_record_id: formRecordId
    }),
    onSuccess: (data) => {
      // Trigger download
      const element = document.createElement('a');
      element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(data.data.form_content));
      element.setAttribute('download', data.data.form_name);
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      toast.success('Form downloaded');
    },
    onError: (err) => {
      toast.error(`Export failed: ${err.message}`);
    }
  });

  const {
    gross_income = 0,
    net_income = 0,
    estimated_quarterly_tax = 0,
    tax_withheld = 0,
    transaction_count = 0,
    self_employment_tax = 0,
    estimated_income_tax = 0
  } = taxData;

  const annualTaxOwed = annualData.tax_owed_or_refund || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Calculator className="w-6 h-6 text-blue-400" />
          Tax Automation Dashboard
        </h1>
        <p className="text-sm text-slate-400 mt-1">Quarterly tax calculations & form generation</p>
      </div>

      {/* Quarter Selector */}
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-2">Select Quarter ({selectedYear})</label>
        <div className="grid grid-cols-4 gap-2">
          {QUARTERS.map(q => (
            <button
              key={q.q}
              onClick={() => setSelectedQuarter(q.q)}
              className={`p-2 rounded-lg border transition-all text-sm font-medium ${
                selectedQuarter === q.q
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-6 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-blue-400 mx-auto" />
            <p className="text-slate-400 text-sm mt-3">Calculating taxes...</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Quarterly Summary */}
          <Card className="bg-slate-900/50 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <DollarSign className="w-5 h-5 text-cyan-400" />
                Q{selectedQuarter} {selectedYear} Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-xs text-slate-400 mb-1">Gross Income</p>
                  <p className="text-2xl font-bold text-cyan-400">${gross_income.toFixed(2)}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-xs text-slate-400 mb-1">Net Income</p>
                  <p className="text-2xl font-bold text-emerald-400">${net_income.toFixed(2)}</p>
                </div>
                <div className={`rounded-lg p-4 ${estimated_quarterly_tax > 0 ? 'bg-red-950/30 border border-red-700/30' : 'bg-slate-800/50'}`}>
                  <p className="text-xs text-slate-400 mb-1">Estimated Quarterly Tax</p>
                  <p className={`text-2xl font-bold ${estimated_quarterly_tax > 0 ? 'text-red-400' : 'text-slate-300'}`}>
                    ${estimated_quarterly_tax.toFixed(2)}
                  </p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-xs text-slate-400 mb-1">Tax Withheld</p>
                  <p className="text-2xl font-bold text-blue-400">${tax_withheld.toFixed(2)}</p>
                </div>
              </div>

              {/* Tax Breakdown */}
              <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4 space-y-2">
                <p className="text-sm font-semibold text-white">Tax Breakdown</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Self-Employment Tax</span>
                    <span className="text-slate-300 font-medium">${self_employment_tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Estimated Income Tax</span>
                    <span className="text-slate-300 font-medium">${estimated_income_tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between col-span-2 border-t border-slate-600 pt-2">
                    <span className="text-slate-300 font-semibold">Total Quarterly Tax</span>
                    <span className="text-cyan-400 font-bold">${estimated_quarterly_tax.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Transactions Info */}
              <div className="text-xs text-slate-400">
                <p>Transactions included: <span className="font-semibold text-slate-300">{transaction_count}</span></p>
              </div>
            </CardContent>
          </Card>

          {/* Form Generation */}
          <Card className="bg-blue-950/20 border border-blue-700/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-400">
                <FileText className="w-5 h-5" />
                Tax Form Generation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-300">
                Generate pre-filled W-9 or 1099-NEC forms with your income and address information.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => generateW9Mutation.mutate()}
                  disabled={generateW9Mutation.isPending || generate1099Mutation.isPending}
                  className="gap-2 bg-blue-600 hover:bg-blue-500"
                >
                  <FileText className="w-4 h-4" />
                  {generateW9Mutation.isPending ? 'Generating...' : 'Generate W-9'}
                </Button>
                <Button
                  onClick={() => generate1099Mutation.mutate()}
                  disabled={generate1099Mutation.isPending || generateW9Mutation.isPending}
                  className="gap-2 bg-blue-600 hover:bg-blue-500"
                >
                  <FileText className="w-4 h-4" />
                  {generate1099Mutation.isPending ? 'Generating...' : 'Generate 1099-NEC'}
                </Button>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-xs text-slate-400 flex gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  Forms are pre-filled with KYC-verified information. Review all details before submitting.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Annual Summary */}
          {annualData.gross_income && (
            <Card className="bg-emerald-950/20 border border-emerald-700/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                  Annual Summary {selectedYear}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400">Total Gross Income</p>
                    <p className="text-lg font-bold text-emerald-400">${annualData.gross_income.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Total Tax Withheld</p>
                    <p className="text-lg font-bold text-blue-400">${annualData.tax_withheld?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div className={annualTaxOwed > 0 ? 'text-red-400' : 'text-emerald-400'}>
                    <p className="text-xs text-slate-400">Tax Owed / (Refund)</p>
                    <p className="text-lg font-bold">
                      {annualTaxOwed > 0 ? '+' : '-'}${Math.abs(annualTaxOwed).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Total Transactions</p>
                    <p className="text-lg font-bold text-slate-300">{annualData.transaction_count}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {!taxData.gross_income && (
            <Card className="bg-amber-950/20 border border-amber-700/30">
              <CardContent className="pt-6 text-center">
                <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
                <p className="text-sm text-amber-300">No income transactions found for this quarter</p>
                <p className="text-xs text-slate-500 mt-1">Tax calculations will appear when earnings are recorded</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}