import React from 'react';

export default function InventoryLevelWidget({ config = {} }) {
  if (!config.enabled) return null;

  const remaining = config.remaining || 5;
  const total = config.total || 20;
  const percentage = (remaining / total) * 100;

  const bgColor = config.bgColor || '#ef4444';
  const textColor = config.textColor || '#ffffff';
  const position = config.position || 'top-right';

  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
  };

  // Only show if low inventory
  if (percentage > config.showThreshold || percentage === 0) return null;

  return (
    <div
      className={`fixed ${positionClasses[position]} z-40`}
      style={{
        background: bgColor,
        color: textColor,
        borderRadius: '8px',
        padding: '14px 16px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        maxWidth: '280px',
        fontFamily: 'Inter, sans-serif'
      }}
    >
      <p className="text-sm font-semibold mb-2">{config.title || 'Only a few left!'}</p>
      <div className="text-xs mb-2">
        <strong>{remaining} of {total} items remaining</strong>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.3)' }}
      >
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${percentage}%`,
            background: 'rgba(255,255,255,0.9)'
          }}
        />
      </div>
      {config.message && (
        <p className="text-xs opacity-90 mt-2">{config.message}</p>
      )}
    </div>
  );
}