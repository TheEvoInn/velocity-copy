import React from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

export default function NotificationBell() {
  const { unreadNotifications, unreadCount, isLoading, markAsRead, dismiss } = useNotifications();

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'text-red-500';
      case 'urgent':
        return 'text-orange-500';
      case 'warning':
        return 'text-amber-500';
      default:
        return 'text-cyan-500';
    }
  };

  const getSeverityBg = (severity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/10';
      case 'urgent':
        return 'bg-orange-500/10';
      case 'warning':
        return 'bg-amber-500/10';
      default:
        return 'bg-cyan-500/10';
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-96 max-h-96 overflow-y-auto bg-slate-900 border-slate-700 p-0">
        {isLoading ? (
          <div className="p-4 text-center text-sm text-slate-400">Loading notifications...</div>
        ) : unreadNotifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-slate-400">No new notifications</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {unreadNotifications.map((notif) => (
              <div
                key={notif.id}
                className={cn('p-3 text-xs border-l-4', getSeverityBg(notif.severity))}
                style={{
                  borderLeftColor:
                    notif.severity === 'critical'
                      ? '#ef4444'
                      : notif.severity === 'urgent'
                      ? '#f97316'
                      : notif.severity === 'warning'
                      ? '#f59e0b'
                      : '#06b6d4'
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1">
                    <h4 className={cn('font-semibold', getSeverityColor(notif.severity))}>
                      {notif.title}
                    </h4>
                    <p className="text-slate-400 mt-1">{notif.message}</p>
                  </div>
                  <button
                    onClick={() => dismiss(notif.id)}
                    className="text-slate-500 hover:text-slate-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => markAsRead(notif.id)}
                    className="px-2 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    Mark Read
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}