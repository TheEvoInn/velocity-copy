import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function APIThroughputPanel({ department }) {
  const [data, setData] = useState([
    { time: '00:00', calls: 120, errors: 2 },
    { time: '01:00', calls: 200, errors: 5 },
    { time: '02:00', calls: 150, errors: 1 },
    { time: '03:00', calls: 180, errors: 3 },
    { time: '04:00', calls: 220, errors: 2 },
  ]);

  const [activeRequests, setActiveRequests] = useState([
    { id: 1, endpoint: 'POST /api/opportunities', status: 200, time: '45ms', rate: '2.4K/min' },
    { id: 2, endpoint: 'GET /api/tasks', status: 200, time: '23ms', rate: '1.2K/min' },
    { id: 3, endpoint: 'POST /api/execute', status: 500, time: '1200ms', rate: '156/min' },
    { id: 4, endpoint: 'GET /api/wallet', status: 200, time: '67ms', rate: '890/min' },
  ]);

  return (
    <div className="space-y-4">
      {/* Request Chart */}
      <Card className="bg-slate-900/50 border-slate-800 p-4">
        <h3 className="text-sm font-semibold text-white mb-4">API Calls per Hour</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.2)" />
            <XAxis dataKey="time" stroke="rgba(148,163,184,0.5)" />
            <YAxis stroke="rgba(148,163,184,0.5)" />
            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
            <Bar dataKey="calls" fill="#3b82f6" />
            <Bar dataKey="errors" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Active Requests */}
      <Card className="bg-slate-900/50 border-slate-800 p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Recent API Calls</h3>
        <div className="space-y-2">
          {activeRequests.map(req => (
            <div key={req.id} className="flex items-center justify-between p-2 bg-slate-800/30 rounded text-xs">
              <span className="text-slate-300">{req.endpoint}</span>
              <div className="flex gap-3">
                <span className={req.status === 200 ? 'text-emerald-400' : 'text-red-400'}>
                  {req.status}
                </span>
                <span className="text-blue-400">{req.time}</span>
                <span className="text-violet-400">{req.rate}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Rate Limits */}
      <Card className="bg-slate-900/50 border-slate-800 p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Rate Limits</h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Requests remaining</span>
              <span className="text-white font-semibold">8,420/10,000</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded overflow-hidden">
              <div className="h-full bg-emerald-500" style={{ width: '84.2%' }} />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}