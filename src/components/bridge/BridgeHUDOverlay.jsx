import { X } from 'lucide-react';

export default function BridgeHUDOverlay({ alerts, focusedStation, particleCount }) {
  return (
    <div className="fixed inset-0 pointer-events-none text-white font-mono text-xs">
      {/* TOP LEFT - System Status */}
      <div className="absolute top-4 left-4 pointer-events-auto">
        <div className="bg-black/60 border border-cyan-500 rounded p-3 space-y-1 min-w-40">
          <div className="text-cyan-400 font-bold">SYS STAT</div>
          <div className="text-gray-300">
            Particles: <span className="text-yellow-400">{particleCount}</span>
          </div>
          <div className="text-gray-300">
            Alerts: <span className="text-yellow-400">{alerts.length}</span>
          </div>
          {focusedStation && (
            <div className="text-green-400">
              Focus: <span className="text-white">{focusedStation.toUpperCase()}</span>
            </div>
          )}
        </div>
      </div>

      {/* TOP RIGHT - Performance */}
      <div className="absolute top-4 right-4 pointer-events-auto">
        <div className="bg-black/60 border border-cyan-500 rounded p-3 space-y-1">
          <div className="text-cyan-400 font-bold">STATUS</div>
          <div className="text-green-400">✓ Online</div>
          <div className="text-gray-300 text-xs">Bridge Active</div>
        </div>
      </div>

      {/* CENTER - Crosshair */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <svg
          width="40"
          height="40"
          viewBox="0 0 40 40"
          className="text-cyan-500"
          style={{
            filter: focusedStation ? 'drop-shadow(0 0 8px currentColor)' : 'none'
          }}
        >
          {/* Crosshair circle */}
          <circle cx="20" cy="20" r="10" fill="none" stroke="currentColor" strokeWidth="1" />
          
          {/* Crosshair lines */}
          <line x1="20" y1="0" x2="20" y2="8" stroke="currentColor" strokeWidth="1" />
          <line x1="20" y1="32" x2="20" y2="40" stroke="currentColor" strokeWidth="1" />
          <line x1="0" y1="20" x2="8" y2="20" stroke="currentColor" strokeWidth="1" />
          <line x1="32" y1="20" x2="40" y2="20" stroke="currentColor" strokeWidth="1" />
          
          {/* Center dot */}
          <circle cx="20" cy="20" r="2" fill="currentColor" />
        </svg>
      </div>

      {/* BOTTOM LEFT - Mini Map */}
      <div className="absolute bottom-4 left-4 pointer-events-auto">
        <div className="bg-black/60 border border-cyan-500 rounded p-3 w-48">
          <div className="text-cyan-400 font-bold mb-2">MINI-MAP</div>
          <div className="relative w-full aspect-square bg-black border border-cyan-500/30 rounded">
            {/* Top-down view of stations */}
            <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">
              ◯ TAC
              <br />
              ◯ COM ◯ LOG
            </div>
            
            {/* Station indicators */}
            <div className="absolute top-1/3 left-1/2 w-2 h-2 bg-red-500 rounded-full transform -translate-x-1/2" />
            <div className="absolute bottom-1/3 left-1/4 w-2 h-2 bg-green-500 rounded-full transform -translate-x-1/2" />
            <div className="absolute bottom-1/3 right-1/4 w-2 h-2 bg-yellow-500 rounded-full transform translate-x-1/2" />
          </div>
          <div className="text-xs text-gray-400 mt-2">
            [TAC] | [COM] | [LOG]
          </div>
        </div>
      </div>

      {/* BOTTOM RIGHT - Alert Queue */}
      <div className="absolute bottom-4 right-4 pointer-events-auto max-w-xs">
        <div className="bg-black/60 border border-cyan-500 rounded p-3 max-h-64 overflow-y-auto">
          <div className="text-cyan-400 font-bold mb-2">ALERTS</div>
          {alerts.length === 0 ? (
            <div className="text-gray-500 text-xs">No active alerts</div>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`text-xs p-2 rounded border ${
                    alert.severity === 'critical'
                      ? 'border-red-500 bg-red-900/20 text-red-300'
                      : alert.severity === 'warning'
                      ? 'border-yellow-500 bg-yellow-900/20 text-yellow-300'
                      : alert.severity === 'success'
                      ? 'border-green-500 bg-green-900/20 text-green-300'
                      : 'border-blue-500 bg-blue-900/20 text-blue-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-bold">{alert.message}</div>
                      <div className="text-xs opacity-70">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="text-xs opacity-50">
                      {Math.round((alert.duration - (Date.now() - alert.timestamp)) / 1000)}s
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ESC HINT - When focused */}
      {false && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-center text-gray-400 text-xs pointer-events-none">
          Press ESC to return | Click background to exit
        </div>
      )}
    </div>
  );
}