import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Gamepad2, Activity, BarChart3, Zap, Target, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function Dashboard() {
  const [stats, setStats] = useState({
    activeOpportunities: 0,
    totalEarnings: 0,
    activeIdentities: 0,
    pendingTasks: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
    setLoading(false);
  }, []);

  const loadStats = async () => {
    try {
      const opportunities = await base44.entities.Opportunity?.filter?.({ status: 'new' }, '-created_date', 10).catch(() => []) || [];
      const txns = await base44.entities.CryptoTransaction?.list?.().catch(() => []) || [];
      const identities = await base44.entities.AIIdentity?.list?.().catch(() => []) || [];
      const tasks = await base44.entities.AITask?.filter?.({ status: 'queued' }, '-created_date', 10).catch(() => []) || [];

      const totalEarnings = txns.reduce((sum, t) => sum + (t.value_usd || 0), 0);

      setStats({
        activeOpportunities: opportunities.length,
        totalEarnings: totalEarnings,
        activeIdentities: identities.length,
        pendingTasks: tasks.length
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background galaxy-bg p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-orbitron font-bold text-cyber-cyan mb-2">VELOCITY PLATFORM</h1>
          <p className="text-muted-foreground">Choose your interface - flat dashboard or immersive 3D command bridge</p>
        </div>

        {/* Interface Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* 3D Bridge */}
          <Link
            to="/StarshipBridge"
            className="group glass-card p-6 hover:border-cyber-cyan/60 transition-all cursor-pointer h-64"
          >
            <div className="flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <Gamepad2 className="w-6 h-6 text-cyber-cyan group-hover:text-cyber-gold transition-colors" />
                  <h2 className="text-xl font-orbitron text-cyber-cyan">STARSHIP BRIDGE</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Immersive 3D command interface with real-time holographic displays, spatial navigation, and cinematic controls
                </p>
              </div>
              <div className="text-xs text-cyber-cyan/60 group-hover:text-cyber-cyan transition-colors">
                → Enter Bridge
              </div>
            </div>
          </Link>

          {/* Flat Dashboard */}
          <Link
            to="/Control"
            className="group glass-card p-6 hover:border-cyber-magenta/60 transition-all cursor-pointer h-64"
          >
            <div className="flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <Activity className="w-6 h-6 text-cyber-magenta group-hover:text-cyber-gold transition-colors" />
                  <h2 className="text-xl font-orbitron text-cyber-magenta">CONTROL CENTER</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Traditional flat interface with data tables, analytics dashboards, and direct system controls
                </p>
              </div>
              <div className="text-xs text-cyber-magenta/60 group-hover:text-cyber-magenta transition-colors">
                → Open Center
              </div>
            </div>
          </Link>
        </div>

        {/* Live Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-cyber-gold" />
              <span className="text-xs font-orbitron text-muted-foreground">OPPORTUNITIES</span>
            </div>
            <div className="text-2xl font-orbitron text-cyber-gold">{stats.activeOpportunities}</div>
            <div className="text-xs text-muted-foreground mt-1">Active opportunities available</div>
          </div>

          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-cyber-cyan" />
              <span className="text-xs font-orbitron text-muted-foreground">EARNINGS</span>
            </div>
            <div className="text-2xl font-orbitron text-cyber-cyan">${stats.totalEarnings.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground mt-1">Total accumulated</div>
          </div>

          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-cyber-magenta" />
              <span className="text-xs font-orbitron text-muted-foreground">IDENTITIES</span>
            </div>
            <div className="text-2xl font-orbitron text-cyber-magenta">{stats.activeIdentities}</div>
            <div className="text-xs text-muted-foreground mt-1">AI identities deployed</div>
          </div>

          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-cyber-teal" />
              <span className="text-xs font-orbitron text-muted-foreground">QUEUE</span>
            </div>
            <div className="text-2xl font-orbitron text-cyber-teal">{stats.pendingTasks}</div>
            <div className="text-xs text-muted-foreground mt-1">Tasks awaiting execution</div>
          </div>
        </div>

        {/* Feature Overview */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-orbitron text-cyber-cyan mb-4">UNIFIED PLATFORM</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Both interfaces share the same backend workflows, real-time data bindings, and automation systems. 
            Switch between them at any time - your state is synchronized across both views.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1">
              <div className="text-cyber-cyan font-orbitron">3D Bridge Advantages</div>
              <ul className="text-muted-foreground space-y-1">
                <li>• Immersive 3D visualization</li>
                <li>• Cinematic camera transitions</li>
                <li>• Holographic data displays</li>
                <li>• Spatial department navigation</li>
              </ul>
            </div>
            <div className="space-y-1">
              <div className="text-cyber-magenta font-orbitron">Flat Center Advantages</div>
              <ul className="text-muted-foreground space-y-1">
                <li>• Rapid data access</li>
                <li>• Traditional workflows</li>
                <li>• Detailed analytics</li>
                <li>• Accessibility focused</li>
              </ul>
            </div>
            <div className="space-y-1">
              <div className="text-cyber-teal font-orbitron">Shared Systems</div>
              <ul className="text-muted-foreground space-y-1">
                <li>• Real-time notifications</li>
                <li>• Unified data models</li>
                <li>• Cross-interface alerts</li>
                <li>• Synchronized automation</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}