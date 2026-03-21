import React, { useState, useEffect } from 'react';
import { Play, Pause, Power, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function CockpitControlPanel({ panelType, onAction }) {
  const [status, setStatus] = useState('idle');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [panelType]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (panelType === 'autopilot') {
        const tasks = await base44.entities.AITask.filter({ status: 'queued' }, '-created_date', 5);
        setData({ tasks, queueSize: tasks.length });
      } else if (panelType === 'wallet') {
        const txns = await base44.entities.CryptoTransaction.filter({}, '-timestamp', 5);
        const balance = txns.reduce((sum, t) => sum + (t.value_usd || 0), 0);
        setData({ balance, recentTransactions: txns });
      } else if (panelType === 'navigation') {
        setData({ status: 'ready' });
      }
    } catch (error) {
      console.error('Panel data load failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartAutopilot = async () => {
    setStatus('running');
    try {
      await base44.functions.invoke('autopilotScheduler', {});
      onAction('autopilot_started');
    } catch (error) {
      setStatus('error');
      console.error('Autopilot start failed:', error);
    }
  };

  const handleWithdraw = async () => {
    setStatus('processing');
    try {
      await base44.functions.invoke('withdrawalEngine', {});
      onAction('withdrawal_initiated');
    } catch (error) {
      setStatus('error');
    }
  };

  const renderContent = () => {
    if (panelType === 'autopilot') {
      return (
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span>Queue:</span>
            <span className="text-cyber-cyan">{data?.queueSize || 0} tasks</span>
          </div>
          <div className="flex justify-between">
            <span>Status:</span>
            <span className={status === 'running' ? 'text-green-400' : 'text-yellow-400'}>
              {status.toUpperCase()}
            </span>
          </div>
          <button
            onClick={handleStartAutopilot}
            disabled={status === 'running'}
            className="w-full mt-2 px-2 py-1 bg-cyber-cyan/20 border border-cyber-cyan text-cyber-cyan text-xs rounded hover:bg-cyber-cyan/40 disabled:opacity-50"
          >
            {status === 'running' ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {status === 'running' ? 'PAUSE' : 'START'}
          </button>
        </div>
      );
    }

    if (panelType === 'wallet') {
      return (
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span>Balance:</span>
            <span className="text-cyber-gold">${data?.balance?.toFixed(2) || '0.00'}</span>
          </div>
          <div className="flex justify-between">
            <span>Txns:</span>
            <span className="text-cyber-gold">{data?.recentTransactions?.length || 0}</span>
          </div>
          <button
            onClick={handleWithdraw}
            className="w-full mt-2 px-2 py-1 bg-cyber-gold/20 border border-cyber-gold text-cyber-gold text-xs rounded hover:bg-cyber-gold/40"
          >
            <Power className="w-3 h-3 inline mr-1" />
            WITHDRAW
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-2 text-xs text-muted-foreground">
        <div>Navigation Ready</div>
        <div>Available: 6 departments</div>
      </div>
    );
  };

  return (
    <div className="glass-card p-2">
      <div className="text-cyber-cyan font-orbitron text-xs mb-1">
        {panelType.toUpperCase()}
      </div>
      {renderContent()}
    </div>
  );
}