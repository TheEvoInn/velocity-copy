import React, { useState } from 'react';
import { Bell, X, Trash2 } from 'lucide-react';
import { useRealTimeNotifications } from '@/hooks/useRealTimeNotifications';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationBell() {
  const { notifications, unreadCount, clearNotifications, markAsRead } = useRealTimeNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const getNotificationColor = (type) => {
    const colors = {
      opportunity: 'border-l-cyber-gold',
      task_completed: 'border-l-green-500',
      crypto_transaction: 'border-l-cyber-cyan',
      execution_completed: 'border-l-green-500',
      execution_failed: 'border-l-red-500',
      kyc_approved: 'border-l-green-500',
      kyc_rejected: 'border-l-red-500',
      wallet_updated: 'border-l-cyber-magenta'
    };
    return colors[type] || 'border-l-slate-500';
  };

  const getNotificationIcon = (type) => {
    const icons = {
      opportunity: '🎯',
      task_completed: '✓',
      crypto_transaction: '💰',
      execution_completed: '✓',
      execution_failed: '✗',
      kyc_approved: '✓',
      kyc_rejected: '✗',
      wallet_updated: '💼'
    };
    return icons[type] || '•';
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) markAsRead();
        }}
        className="relative p-2 hover:bg-slate-800/50 rounded-lg transition-colors"
      >
        <Bell className="w-4 h-4 text-cyan-400" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 max-h-96 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-slate-800/50 border-b border-slate-700 p-3 flex items-center justify-between">
            <h3 className="text-sm font-orbitron text-cyan-400">NOTIFICATIONS</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-500 hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                No notifications yet
              </div>
            ) : (
              <div className="space-y-0">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`border-l-4 ${getNotificationColor(notif.type)} px-3 py-2 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg flex-shrink-0">
                        {getNotificationIcon(notif.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-xs text-slate-200">
                          {notif.title}
                        </div>
                        <div className="text-xs text-slate-400 line-clamp-2 mt-0.5">
                          {notif.message}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {formatDistanceToNow(notif.timestamp, { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-slate-700 p-2 flex gap-2">
              <button
                onClick={() => {
                  clearNotifications();
                  setIsOpen(false);
                }}
                className="flex-1 px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded transition-colors flex items-center justify-center gap-1 text-slate-300"
              >
                <Trash2 className="w-3 h-3" />
                Clear All
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}