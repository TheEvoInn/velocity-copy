import React from 'react';
import { getDeptStyle } from '@/lib/galaxyTheme';
import AutomationDashboard from '@/components/automation/AutomationDashboard';
import { Clock } from 'lucide-react';

const style = getDeptStyle('automation');

export default function AutomationManager() {
  return (
    <div className="min-h-screen galaxy-bg p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `rgba(0,232,255,0.1)`, border: `1px solid ${style.color}` }}>
            <Clock className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="font-orbitron text-2xl font-bold text-white">Automation Manager</h1>
            <p className="text-xs text-slate-400">Schedule recurring operations across VIPZ & NED</p>
          </div>
        </div>

        {/* Dashboard */}
        <AutomationDashboard />
      </div>
    </div>
  );
}