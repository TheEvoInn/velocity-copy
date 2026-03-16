import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ChevronDown, AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PayoutTable({ payouts }) {
  const [expandedRows, setExpandedRows] = useState({});

  const prizes = payouts?.timeline || [];

  if (prizes.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">No payouts found</p>
      </div>
    );
  }

  const statusBadge = (status) => {
    const config = {
      discovered: 'bg-blue-950/30 text-blue-400 border-blue-900/30',
      applying: 'bg-amber-950/30 text-amber-400 border-amber-900/30',
      applied: 'bg-amber-950/30 text-amber-400 border-amber-900/30',
      pending_verification: 'bg-amber-950/30 text-amber-400 border-amber-900/30',
      won: 'bg-emerald-950/30 text-emerald-400 border-emerald-900/30',
      claimed: 'bg-emerald-950/30 text-emerald-400 border-emerald-900/30',
      expired: 'bg-red-950/30 text-red-400 border-red-900/30'
    };
    return config[status] || config.discovered;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800">
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Prize</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Value</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Expected Date</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400">Status</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400">Actions</th>
          </tr>
        </thead>
        <tbody>
          {prizes.map((item) => (
            <React.Fragment key={item.prize_id}>
              <tr className="border-b border-slate-900 hover:bg-slate-900/50 transition-colors">
                <td className="px-4 py-4">
                  <p className="font-medium text-white">{item.title}</p>
                </td>
                <td className="px-4 py-4">
                  <p className="text-emerald-400 font-semibold">${item.value.toLocaleString()}</p>
                </td>
                <td className="px-4 py-4">
                  <p className="text-slate-400">
                    {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </td>
                <td className="px-4 py-4">
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium border ${statusBadge(item.status)}`}>
                    {item.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-4 py-4 text-right">
                  <button
                    onClick={() => setExpandedRows(prev => ({ ...prev, [item.prize_id]: !prev[item.prize_id] }))}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform ${expandedRows[item.prize_id] ? 'rotate-180' : ''}`} />
                  </button>
                </td>
              </tr>

              {expandedRows[item.prize_id] && (
                <tr className="bg-slate-950/50 border-b border-slate-900">
                  <td colSpan="5" className="px-4 py-4">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-slate-500 font-medium">Prize ID</p>
                          <p className="text-sm text-white font-mono">{item.prize_id.slice(0, 12)}...</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-medium">Status</p>
                          <p className="text-sm text-white capitalize">{item.status}</p>
                        </div>
                      </div>
                      <Button size="sm" className="text-xs" onClick={() => window.open(`/PrizeDashboard?prize=${item.prize_id}`)}>
                        View Details
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}