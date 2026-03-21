import React from 'react';
import { Card } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DepartmentSpecificPanel({ department }) {
  const departmentPanels = {
    Autopilot: () => (
      <div className="space-y-4">
        {/* Task Queue */}
        <Card className="bg-slate-900/50 border-slate-800 p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Task Queue Status</h3>
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center">
              <div className="text-xs text-slate-500 mb-1">Queued</div>
              <div className="text-2xl font-bold text-amber-400">24</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-500 mb-1">Running</div>
              <div className="text-2xl font-bold text-blue-400">8</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-500 mb-1">Completed</div>
              <div className="text-2xl font-bold text-emerald-400">324</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-500 mb-1">Failed</div>
              <div className="text-2xl font-bold text-red-400">3</div>
            </div>
          </div>
        </Card>

        {/* Execution Loop Timeline */}
        <Card className="bg-slate-900/50 border-slate-800 p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Execution Loop Timeline</h3>
          <div className="space-y-2">
            {[
              { step: 'Initialize', time: '0ms', status: '✓' },
              { step: 'Validate', time: '45ms', status: '✓' },
              { step: 'Execute', time: '1200ms', status: '✓' },
              { step: 'Finalize', time: '100ms', status: '✓' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-slate-800/30 rounded text-xs">
                <span className="text-slate-300">{item.step}</span>
                <span className="text-emerald-400">{item.status}</span>
                <span className="text-slate-500">{item.time}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    ),

    NED: () => (
      <div className="space-y-4">
        {/* Mining Yield */}
        <Card className="bg-slate-900/50 border-slate-800 p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Mining Performance</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={[
              { time: '00:00', yield: 2.1 },
              { time: '04:00', yield: 2.3 },
              { time: '08:00', yield: 1.9 },
              { time: '12:00', yield: 2.4 },
              { time: '16:00', yield: 2.6 },
              { time: '20:00', yield: 2.2 },
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.2)" />
              <XAxis dataKey="time" stroke="rgba(148,163,184,0.5)" />
              <YAxis stroke="rgba(148,163,184,0.5)" />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
              <Line type="monotone" dataKey="yield" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Staking Status */}
        <Card className="bg-slate-900/50 border-slate-800 p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Active Stakes</h3>
          <div className="space-y-2">
            {[
              { token: 'ETH Staking', apy: '3.2%', amount: '5.2 ETH', daily: '$3.45' },
              { token: 'SOL Staking', apy: '4.5%', amount: '100 SOL', daily: '$2.10' },
            ].map((stake, idx) => (
              <div key={idx} className="p-3 bg-slate-800/30 rounded">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-semibold text-white">{stake.token}</span>
                  <span className="text-emerald-400 font-semibold">{stake.apy} APY</span>
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>{stake.amount}</span>
                  <span className="text-emerald-400">+{stake.daily}/day</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    ),

    VIPZ: () => (
      <div className="space-y-4">
        {/* Funnel Performance */}
        <Card className="bg-slate-900/50 border-slate-800 p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Funnel Conversion</h3>
          <div className="space-y-3">
            {[
              { stage: 'Visitors', count: 8420, rate: '100%' },
              { stage: 'Leads', count: 1240, rate: '14.7%' },
              { stage: 'Customers', count: 87, rate: '7%' },
              { stage: 'Repeat', count: 12, rate: '13.8%' },
            ].map((s, idx) => (
              <div key={idx} className="p-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">{s.stage}</span>
                  <span className="text-white font-semibold">{s.count} ({s.rate})</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-violet-500 to-pink-500" 
                    style={{ width: s.rate }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Sales Velocity */}
        <Card className="bg-slate-900/50 border-slate-800 p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Sales Velocity</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-xs text-slate-500 mb-1">Today</div>
              <div className="text-2xl font-bold text-emerald-400">$2.1K</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">This Week</div>
              <div className="text-2xl font-bold text-blue-400">$14.5K</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">This Month</div>
              <div className="text-2xl font-bold text-violet-400">$67.3K</div>
            </div>
          </div>
        </Card>
      </div>
    ),

    Discovery: () => (
      <Card className="bg-slate-900/50 border-slate-800 p-4">
        <h3 className="text-sm font-semibold text-white mb-4">Opportunity Scanning</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-slate-800/30 rounded">
            <div className="text-xs text-slate-500 mb-1">Opportunities Found</div>
            <div className="text-3xl font-bold text-amber-400">2,847</div>
          </div>
          <div className="p-3 bg-slate-800/30 rounded">
            <div className="text-xs text-slate-500 mb-1">Avg Profit/Opp</div>
            <div className="text-3xl font-bold text-emerald-400">$127</div>
          </div>
          <div className="p-3 bg-slate-800/30 rounded">
            <div className="text-xs text-slate-500 mb-1">Success Rate</div>
            <div className="text-3xl font-bold text-blue-400">84%</div>
          </div>
          <div className="p-3 bg-slate-800/30 rounded">
            <div className="text-xs text-slate-500 mb-1">Last Scan</div>
            <div className="text-sm font-bold text-slate-300">2 min ago</div>
          </div>
        </div>
      </Card>
    )
  };

  const PanelComponent = departmentPanels[department];

  return PanelComponent ? <PanelComponent /> : null;
}