import React, { useState, useEffect } from 'react';
import { Activity, Gauge } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function BridgePerformanceMonitor({ audioEngine }) {
  const [stats, setStats] = useState({
    audioContextTime: 0,
    audioContextState: 'running',
    soundCount: 0
  });

  useEffect(() => {
    const interval = setInterval(() => {
      if (audioEngine) {
        setStats({
          audioContextTime: audioEngine.audioContext.currentTime.toFixed(2),
          audioContextState: audioEngine.audioContext.state,
          soundCount: Object.keys(audioEngine.sounds).length
        });
      }
    }, 500);

    return () => clearInterval(interval);
  }, [audioEngine]);

  return (
    <div className="fixed bottom-20 right-4 pointer-events-auto">
      <Card className="glass-card p-3 w-72 space-y-2 bg-slate-950/95 border-cyan-500/30">
        <div className="flex items-center gap-2 text-xs text-cyber-cyan mb-3">
          <Activity className="w-4 h-4" />
          <span className="font-mono">AUDIO SUBSYSTEM</span>
        </div>

        <div className="space-y-2 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Audio Context:</span>
            <span className={stats.audioContextState === 'running' ? 'text-green-400' : 'text-yellow-400'}>
              {stats.audioContextState.toUpperCase()}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-muted-foreground">Context Time:</span>
            <span className="text-cyber-cyan">{stats.audioContextTime}s</span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">Active Sounds:</span>
            <span className="text-cyber-cyan">{stats.soundCount}</span>
          </div>
        </div>

        <div className="text-xs text-green-400 flex items-center gap-2 pt-2 border-t border-cyan-500/20">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span>Audio Engine Active</span>
        </div>
      </Card>
    </div>
  );
}