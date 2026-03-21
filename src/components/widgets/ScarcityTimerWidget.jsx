import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export default function ScarcityTimerWidget({ config = {} }) {
  const [timeLeft, setTimeLeft] = useState(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!config.enabled) return;

    // Calculate time remaining
    const endTime = new Date(config.endTime || new Date(Date.now() + 24 * 60 * 60 * 1000));
    const updateTimer = () => {
      const now = new Date();
      const diff = endTime - now;

      if (diff <= 0) {
        setIsExpired(true);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft({ hours, minutes, seconds });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [config.endTime, config.enabled]);

  if (!config.enabled || isExpired) return null;

  const bgColor = config.bgColor || '#f59e0b';
  const textColor = config.textColor || '#ffffff';
  const position = config.position || 'top-right';

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
        padding: '16px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        maxWidth: '280px',
        fontFamily: 'Inter, sans-serif'
      }}
    >
      <div className="flex items-center gap-3">
        <Clock className="w-5 h-5 animate-spin" />
        <div className="flex-1">
          <p className="text-sm font-semibold mb-1">{config.title || 'Limited Time Offer'}</p>
          {timeLeft && (
            <div className="text-xs font-mono font-bold">
              {String(timeLeft.hours).padStart(2, '0')}:
              {String(timeLeft.minutes).padStart(2, '0')}:
              {String(timeLeft.seconds).padStart(2, '0')}
            </div>
          )}
          {config.message && (
            <p className="text-xs opacity-90 mt-1">{config.message}</p>
          )}
        </div>
      </div>
    </div>
  );
}