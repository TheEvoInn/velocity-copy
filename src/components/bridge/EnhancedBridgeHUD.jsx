import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import SectorMapView from './SectorMapView';
import { useSectorMapData } from '@/hooks/useSectorMapData';

export default function EnhancedBridgeHUD({ alerts, focusedStation, particleCount, performanceStats = {} }) {
  const { pois } = useSectorMapData();
  const [time, setTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getSeverityIcon = (severity) => {
    const iconClass = "w-4 h-4";
    const colors = {
      critical: 'text-red-500',
      warning: 'text-yellow-500',
      success: 'text-green-500',
      info: 'text-cyan-500'
    };
    
    const icons = {
      critical: <AlertCircle className={`${iconClass} ${colors.critical}`} />,
      warning: <AlertTriangle className={`${iconClass} ${colors.warning}`} />,
      success: <CheckCircle className={`${iconClass} ${colors.success}`} />,
      info: <Info className={`${iconClass} ${colors.info}`} />
    };
    
    return icons[severity] || icons.info;
  };

  return (
    <div className="fixed inset-0 pointer-events-none">
      {/* Top-left: System Status */}
      <div className="absolute top-4 left-4 pointer-events-auto">
        <div className="glass-card p-3 w-64">
          <div className="flex justify-between items-center mb-2">
            <span className="text-cyber-cyan font-orbitron text-sm">BRIDGE STATUS</span>
            <span className="text-xs text-muted-foreground">{time.toLocaleTimeString()}</span>
          </div>
          <div className="space-y-1 text-xs font-mono">
            <div className="flex justify-between">
              <span>PARTICLES:</span>
              <span className="text-cyber-cyan">{particleCount}/1000</span>
            </div>
            <div className="flex justify-between">
              <span>FOCUSED:</span>
              <span className="text-cyber-gold">{focusedStation?.toUpperCase() || 'NONE'}</span>
            </div>
            <div className="flex justify-between">
              <span>ALERTS:</span>
              <span className="text-cyber-magenta">{alerts.length}</span>
            </div>
            <div className="flex justify-between">
              <span>SYSTEMS:</span>
              <span className="text-green-400">NOMINAL</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top-right: Sector Map */}
      <div className="absolute top-4 right-4 pointer-events-auto max-w-sm">
        <SectorMapView 
          pois={pois} 
          focusedStation={focusedStation}
          onPoiClick={(poi) => console.log('POI clicked:', poi)}
        />
      </div>

      {/* Bottom-left: Alert Queue */}
      <div className="absolute bottom-4 left-4 pointer-events-auto">
        <div className="glass-card p-3 w-80 max-h-48 overflow-y-auto">
          <div className="text-cyber-cyan font-orbitron text-sm mb-2">ALERT QUEUE</div>
          {alerts.length === 0 ? (
            <div className="text-xs text-muted-foreground">No active alerts</div>
          ) : (
            <div className="space-y-2">
              {alerts.slice(0, 5).map((alert) => (
                <div key={alert.id} className="flex items-start gap-2 p-2 bg-slate-900/50 rounded border-l-2 border-cyan-500/50">
                  {getSeverityIcon(alert.severity)}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-foreground truncate">{alert.message}</div>
                    <div className="text-xs text-muted-foreground">{alert.station}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Center Reticle */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <svg width="120" height="120" viewBox="0 0 120 120" className="text-cyber-cyan">
          {/* Crosshair */}
          <line x1="60" y1="30" x2="60" y2="50" stroke="currentColor" strokeWidth="2" />
          <line x1="60" y1="70" x2="60" y2="90" stroke="currentColor" strokeWidth="2" />
          <line x1="30" y1="60" x2="50" y2="60" stroke="currentColor" strokeWidth="2" />
          <line x1="70" y1="60" x2="90" y2="60" stroke="currentColor" strokeWidth="2" />
          
          {/* Corner brackets */}
          <line x1="35" y1="35" x2="35" y2="50" stroke="currentColor" strokeWidth="1.5" />
          <line x1="35" y1="35" x2="50" y2="35" stroke="currentColor" strokeWidth="1.5" />
          
          <line x1="85" y1="35" x2="85" y2="50" stroke="currentColor" strokeWidth="1.5" />
          <line x1="70" y1="35" x2="85" y2="35" stroke="currentColor" strokeWidth="1.5" />
          
          <line x1="35" y1="85" x2="35" y2="70" stroke="currentColor" strokeWidth="1.5" />
          <line x1="35" y1="85" x2="50" y2="85" stroke="currentColor" strokeWidth="1.5" />
          
          <line x1="85" y1="85" x2="85" y2="70" stroke="currentColor" strokeWidth="1.5" />
          <line x1="70" y1="85" x2="85" y2="85" stroke="currentColor" strokeWidth="1.5" />
          
          {/* Center dot */}
          <circle cx="60" cy="60" r="3" fill="currentColor" opacity="0.5" />
        </svg>
      </div>

      {/* Bottom-right: Performance Stats */}
      <div className="absolute bottom-4 right-4 pointer-events-auto">
        <div className="glass-card p-3 w-64 text-xs font-mono">
          <div className="text-cyber-cyan font-orbitron text-sm mb-2">PERFORMANCE</div>
          <div className="space-y-1 text-muted-foreground">
            <div className="flex justify-between">
              <span>FRAME RATE:</span>
              <span className={performanceStats.fps >= 55 ? 'text-green-400' : 'text-yellow-400'}>
                {performanceStats.fps || 60} FPS
              </span>
            </div>
            <div className="flex justify-between">
              <span>MEMORY:</span>
              <span className={performanceStats.memoryUsage > 500 ? 'text-yellow-400' : 'text-green-400'}>
                {performanceStats.memoryUsage || 124} MB
              </span>
            </div>
            <div className="flex justify-between">
              <span>FRAME TIME:</span>
              <span className={performanceStats.avgFrameTime > 18 ? 'text-yellow-400' : 'text-green-400'}>
                {performanceStats.avgFrameTime?.toFixed(2) || '16.67'}ms
              </span>
            </div>
            <div className="flex justify-between">
              <span>CAMERA MODE:</span>
              <span className="text-cyan-400">PERSPECTIVE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}