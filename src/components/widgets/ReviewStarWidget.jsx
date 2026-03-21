import React from 'react';
import { Star } from 'lucide-react';

export default function ReviewStarWidget({ config = {} }) {
  if (!config.enabled) return null;

  const rating = config.rating || 4.8;
  const reviewCount = config.reviewCount || 1240;
  const bgColor = config.bgColor || '#10b981';
  const textColor = config.textColor || '#ffffff';
  const position = config.position || 'top-left';

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
        <div className="flex gap-1">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className="w-4 h-4 fill-current"
              style={{ opacity: i < Math.floor(rating) ? 1 : 0.5 }}
            />
          ))}
        </div>
        <div className="text-sm">
          <p className="font-semibold">{rating.toFixed(1)}</p>
          <p className="text-xs opacity-90">{reviewCount.toLocaleString()} reviews</p>
        </div>
      </div>
      {config.message && (
        <p className="text-xs opacity-90 mt-2">{config.message}</p>
      )}
    </div>
  );
}