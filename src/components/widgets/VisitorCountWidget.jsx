import React, { useState, useEffect } from 'react';
import { Users } from 'lucide-react';

export default function VisitorCountWidget({ config = {} }) {
  const [count, setCount] = useState(config.startCount || 1240);

  useEffect(() => {
    if (!config.enabled || config.updateFrequency === 'none') return;

    const frequencies = {
      'every-minute': 60000,
      'every-5-min': 300000,
      'every-hour': 3600000,
    };

    const interval = setInterval(() => {
      setCount(prev => {
        const increment = Math.floor(Math.random() * (config.maxIncrement || 10)) + 1;
        return prev + increment;
      });
    }, frequencies[config.updateFrequency] || 300000);

    return () => clearInterval(interval);
  }, [config.enabled, config.updateFrequency, config.maxIncrement]);

  if (!config.enabled) return null;

  const bgColor = config.bgColor || '#8b5cf6';
  const textColor = config.textColor || '#ffffff';
  const position = config.position || 'bottom-left';

  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
  };

  return (
    <div
      className={`fixed ${positionClasses[position]} z-40`}
      style={{
        background: bgColor,
        color: textColor,
        borderRadius: '8px',
        padding: '12px 16px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        maxWidth: '260px',
        fontFamily: 'Inter, sans-serif'
      }}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <Users className="w-5 h-5" />
          <div
            className="absolute top-0 right-0 w-2 h-2 bg-white rounded-full animate-pulse"
          />
        </div>
        <div className="text-sm">
          <p className="font-semibold">{count.toLocaleString()} {config.label || 'people'}</p>
          <p className="text-xs opacity-90">{config.message || 'visiting now'}</p>
        </div>
      </div>
    </div>
  );
}