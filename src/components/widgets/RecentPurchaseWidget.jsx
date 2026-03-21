import React, { useState, useEffect } from 'react';
import { ShoppingBag } from 'lucide-react';

export default function RecentPurchaseWidget({ config = {} }) {
  const [purchases, setPurchases] = useState([]);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!config.enabled) return;

    // Simulate recent purchases (in real app, fetch from backend)
    const samplePurchases = [
      { buyer: 'John D.', location: 'California', timeAgo: '2 minutes ago' },
      { buyer: 'Sarah M.', location: 'Texas', timeAgo: '5 minutes ago' },
      { buyer: 'Mike L.', location: 'New York', timeAgo: '12 minutes ago' },
    ];

    setPurchases(samplePurchases);

    // Auto-hide after configured duration
    const hideTimer = setTimeout(() => setIsVisible(false), config.displayDuration || 5000);
    return () => clearTimeout(hideTimer);
  }, [config]);

  if (!isVisible || !config.enabled) return null;

  const bgColor = config.bgColor || '#06b6d4';
  const textColor = config.textColor || '#ffffff';
  const position = config.position || 'bottom-right';

  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
  };

  return (
    <div
      className={`fixed ${positionClasses[position]} z-40 animate-slide-in`}
      style={{
        background: bgColor,
        color: textColor,
        borderRadius: '8px',
        padding: '12px 16px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        maxWidth: '300px',
        fontFamily: 'Inter, sans-serif'
      }}
    >
      <div className="flex items-start gap-3">
        <ShoppingBag className="w-4 h-4 flex-shrink-0 mt-1" />
        <div className="flex-1 text-sm">
          <p className="font-semibold mb-2">{config.title || 'Someone just bought!'}</p>
          {purchases.length > 0 && (
            <div className="space-y-1">
              {purchases.slice(0, config.maxNotifications || 2).map((purchase, idx) => (
                <p key={idx} className="text-xs opacity-90">
                  <strong>{purchase.buyer}</strong> from {purchase.location} {purchase.timeAgo}
                </p>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="flex-shrink-0 text-lg opacity-70 hover:opacity-100"
        >
          ✕
        </button>
      </div>
    </div>
  );
}