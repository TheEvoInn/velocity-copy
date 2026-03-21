import React, { useState, useEffect } from 'react';
import { MapPin, Crosshair } from 'lucide-react';

export default function SectorMapView({ pois = [], focusedStation = null, onPoiClick = () => {} }) {
  const [mapScale, setMapScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [hoveredPoi, setHoveredPoi] = useState(null);

  const mapWidth = 400;
  const mapHeight = 300;
  const gridSize = 50;

  // Starship is always at center (200, 150)
  const shipX = mapWidth / 2;
  const shipY = mapHeight / 2;

  // Scale POI positions to map coordinates
  const scaleToMap = (worldPos) => {
    const scaleFactor = 20; // Adjust for visual density
    return {
      x: shipX + (worldPos.x * scaleFactor * mapScale) + panOffset.x,
      y: shipY - (worldPos.z * scaleFactor * mapScale) + panOffset.y
    };
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setMapScale(Math.max(0.5, Math.min(3, mapScale * delta)));
  };

  const handleMapClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicked on a POI
    pois.forEach((poi) => {
      const mapPos = scaleToMap(poi.position);
      const dist = Math.sqrt(Math.pow(x - mapPos.x, 2) + Math.pow(y - mapPos.y, 2));
      if (dist < 12) {
        onPoiClick(poi);
      }
    });
  };

  return (
    <div className="glass-card p-3 w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="text-cyber-cyan font-orbitron text-sm">SECTOR MAP</div>
        <div className="text-xs text-muted-foreground">Scale: {(mapScale * 100).toFixed(0)}%</div>
      </div>

      <svg
        viewBox={`0 0 ${mapWidth} ${mapHeight}`}
        className="w-full border border-cyan-500/30 bg-slate-950 cursor-crosshair"
        onWheel={handleWheel}
        onClick={handleMapClick}
      >
        {/* Grid background */}
        <defs>
          <pattern id="mapgrid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
            <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="rgba(0,204,255,0.1)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={mapWidth} height={mapHeight} fill="url(#mapgrid)" />

        {/* Sector boundary */}
        <rect x="10" y="10" width={mapWidth - 20} height={mapHeight - 20} fill="none" stroke="rgba(0,204,255,0.3)" strokeWidth="1" strokeDasharray="3,3" />

        {/* Compass directions */}
        <text x={mapWidth / 2} y="20" textAnchor="middle" className="text-xs fill-cyan-500 opacity-50">N</text>
        <text x={mapWidth - 20} y={mapHeight / 2 + 4} textAnchor="middle" className="text-xs fill-cyan-500 opacity-50">E</text>
        <text x={mapWidth / 2} y={mapHeight - 10} textAnchor="middle" className="text-xs fill-cyan-500 opacity-50">S</text>
        <text x="20" y={mapHeight / 2 + 4} textAnchor="middle" className="text-xs fill-cyan-500 opacity-50">W</text>

        {/* POI markers */}
        {pois.map((poi) => {
          const mapPos = scaleToMap(poi.position);
          const isHovered = hoveredPoi?.id === poi.id;
          const color = poi.type === 'station' ? '#ff6b6b' : poi.type === 'anomaly' ? '#ff2ec4' : '#ffd93d';

          return (
            <g
              key={poi.id}
              onMouseEnter={() => setHoveredPoi(poi)}
              onMouseLeave={() => setHoveredPoi(null)}
            >
              {/* Outer ring */}
              <circle cx={mapPos.x} cy={mapPos.y} r={isHovered ? 14 : 10} fill="none" stroke={color} strokeWidth={isHovered ? 2 : 1.5} opacity={isHovered ? 1 : 0.7} />

              {/* Inner dot */}
              <circle cx={mapPos.x} cy={mapPos.y} r="3" fill={color} opacity={0.9} />

              {/* Label on hover */}
              {isHovered && (
                <g>
                  <rect x={mapPos.x + 8} y={mapPos.y - 20} width="80" height="20" fill="rgba(0,26,51,0.95)" stroke={color} strokeWidth="1" rx="2" />
                  <text x={mapPos.x + 12} y={mapPos.y - 6} className="text-xs fill-white font-mono">
                    {poi.name}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Starship at center */}
        <g>
          {/* Outer circle */}
          <circle cx={shipX} cy={shipY} r="12" fill="none" stroke="#00ff00" strokeWidth="2" opacity="0.8" />

          {/* Inner crosshair */}
          <line x1={shipX - 6} y1={shipY} x2={shipX + 6} y2={shipY} stroke="#00ff00" strokeWidth="1.5" />
          <line x1={shipX} y1={shipY - 6} x2={shipX} y2={shipY + 6} stroke="#00ff00" strokeWidth="1.5" />

          {/* Center dot */}
          <circle cx={shipX} cy={shipY} r="2" fill="#00ff00" />

          {/* Label */}
          <text x={shipX} y={shipY + 25} textAnchor="middle" className="text-xs fill-green-400 font-mono font-bold">
            SHIP
          </text>
        </g>

        {/* Scan radius indicator */}
        <circle cx={shipX} cy={shipY} r="80" fill="none" stroke="rgba(0,255,0,0.1)" strokeWidth="1" strokeDasharray="5,5" />
      </svg>

      {/* Info panel */}
      {hoveredPoi && (
        <div className="mt-2 p-2 bg-slate-900/50 border-l-2 border-cyan-500 text-xs text-muted-foreground space-y-1">
          <div><span className="text-cyber-cyan">POI:</span> {hoveredPoi.name}</div>
          <div><span className="text-cyber-cyan">Type:</span> {hoveredPoi.type}</div>
          <div><span className="text-cyber-cyan">Pos:</span> {hoveredPoi.position.x.toFixed(1)}, {hoveredPoi.position.z.toFixed(1)}</div>
          {hoveredPoi.distance && <div><span className="text-cyber-cyan">Dist:</span> {hoveredPoi.distance.toFixed(1)}u</div>}
        </div>
      )}
    </div>
  );
}