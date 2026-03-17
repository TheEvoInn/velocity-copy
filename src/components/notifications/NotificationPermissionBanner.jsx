import React, { useState, useEffect } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotificationPermissionBanner() {
  const [status, setStatus] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!('Notification' in window)) {
      setStatus('unsupported');
      return;
    }
    setStatus(Notification.permission);
  }, []);

  const handleEnable = async () => {
    const result = await Notification.requestPermission();
    setStatus(result);
    if (result === 'granted') {
      new Notification('🔔 Notifications Enabled', {
        body: 'You\'ll be alerted for high-value income & completed opportunities.',
        icon: '/favicon.ico',
      });
    }
  };

  // Don't show if granted, unsupported, dismissed, or unknown
  if (dismissed || status === 'granted' || status === 'unsupported' || status === null) return null;
  // Don't show if permanently denied (can't prompt again)
  if (status === 'denied') return null;

  return (
    <div className="flex items-center gap-3 rounded-xl bg-amber-950/30 border border-amber-700/30 px-4 py-3 mb-4">
      <Bell className="w-4 h-4 text-amber-400 shrink-0" />
      <p className="text-xs text-amber-300 flex-1">
        Enable browser notifications to get instant alerts for income received and opportunities completed.
      </p>
      <Button
        size="sm"
        onClick={handleEnable}
        className="bg-amber-600 hover:bg-amber-500 text-white text-xs h-7 px-3 shrink-0"
      >
        Enable
      </Button>
      <button onClick={() => setDismissed(true)} className="text-slate-500 hover:text-slate-300 shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}