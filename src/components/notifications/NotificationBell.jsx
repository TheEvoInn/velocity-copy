import React, { useState } from 'react';
import { Bell, X, AlertCircle, Check } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { motion, AnimatePresence } from 'framer-motion';

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, dismiss } = useNotifications();

  const severityColors = {
    critical: 'bg-red-950/50 border-red-500/50 text-red-200',
    urgent: 'bg-orange-950/50 border-orange-500/50 text-orange-200',
    warning: 'bg-amber-950/50 border-amber-500/50 text-amber-200',
    info: 'bg-blue-950/50 border-blue-500/50 text-blue-200'
  };

  const severityIcons = {
    critical: <AlertCircle className="w-4 h-4 text-red-400" />,
    urgent: <AlertCircle className="w-4 h-4 text-orange-400" />,
    warning: <AlertCircle className="w-4 h-4 text-amber-400" />,
    info: <Check className="w-4 h-4 text-blue-400" />
  };

  return (
    <div className="relative">
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-400 hover:text-slate-200 transition-colors"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
        )}
      </button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="absolute right-0 mt-2 w-96 rounded-lg border border-slate-700 bg-slate-900 shadow-2xl z-50"
          >
            {/* Header */}
            <div className="p-3 border-b border-slate-700 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-semibold text-white">Notifications</h3>
                <p className="text-xs text-slate-500">{unreadCount} unread</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-slate-800 rounded text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Notification List */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-sm">
                  No notifications
                </div>
              ) : (
                notifications.map((notif) => (
                  <motion.div
                    key={notif.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-3 border-b border-slate-800 cursor-pointer transition-all hover:bg-slate-800/50 ${
                      !notif.is_read ? 'bg-slate-800/30' : ''
                    }`}
                    onClick={() => !notif.is_read && markAsRead(notif.id)}
                  >
                    <div className="flex gap-2">
                      <div className="flex-shrink-0 mt-1">
                        {severityIcons[notif.severity] || severityIcons.info}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <p className="text-sm font-medium text-white truncate">
                            {notif.title}
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              dismiss(notif.id);
                            }}
                            className="flex-shrink-0 text-slate-500 hover:text-slate-300 p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                          {notif.message}
                        </p>
                        {notif.action_type !== 'none' && (
                          <div className="mt-2 inline-block">
                            <span className="text-xs bg-slate-700 text-slate-200 px-2 py-0.5 rounded">
                              Action required
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-2 border-t border-slate-700 text-center">
                <a
                  href="/UserAccessPage"
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                >
                  View all notifications →
                </a>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}