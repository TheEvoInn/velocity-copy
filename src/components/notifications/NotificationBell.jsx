import React, { useState } from 'react';
import { Bell, X, Trash2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRealTimeNotifications } from '@/hooks/useRealTimeNotifications';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationBell() {
  const { notifications, unreadCount, clearNotifications, markAsRead } = useRealTimeNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const NOTIF_CONFIG = {
    opportunity:           { color: 'border-l-amber-400',   icon: '🎯', bg: 'rgba(245,158,11,0.06)' },
    task_completed:        { color: 'border-l-emerald-500', icon: '✓',  bg: 'rgba(16,185,129,0.06)' },
    crypto_transaction:    { color: 'border-l-teal-400',    icon: '💰', bg: 'rgba(0,255,217,0.06)'  },
    execution_completed:   { color: 'border-l-emerald-500', icon: '✓',  bg: 'rgba(16,185,129,0.06)' },
    execution_failed:      { color: 'border-l-red-500',     icon: '✗',  bg: 'rgba(239,68,68,0.06)'  },
    kyc_approved:          { color: 'border-l-emerald-500', icon: '🛡️', bg: 'rgba(16,185,129,0.06)' },
    kyc_rejected:          { color: 'border-l-red-500',     icon: '✗',  bg: 'rgba(239,68,68,0.06)'  },
    wallet_updated:        { color: 'border-l-pink-500',    icon: '💼', bg: 'rgba(236,72,153,0.06)' },
    crypto_alert:          { color: 'border-l-red-500',     icon: '⚠️', bg: 'rgba(239,68,68,0.08)'  },
    storefront_alert:      { color: 'border-l-pink-400',    icon: '🛍️', bg: 'rgba(236,72,153,0.06)' },
    autopilot_block:       { color: 'border-l-orange-500',  icon: '🚫', bg: 'rgba(249,115,22,0.08)' },
    credential_alert:      { color: 'border-l-amber-500',   icon: '🔑', bg: 'rgba(245,158,11,0.06)' },
  };

  const getConfig = (type) => NOTIF_CONFIG[type] || { color: 'border-l-slate-500', icon: '•', bg: 'transparent' };

  const getSeverityBadge = (severity) => {
    if (severity === 'critical') return <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-red-500/20 text-red-400 ml-1">CRITICAL</span>;
    if (severity === 'warning') return <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 ml-1">WARN</span>;
    return null;
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
                {notifications.map((notif) => {
                  const cfg = getConfig(notif.type);
                  const actionUrl = notif.metadata?.action_url;
                  const actionLabel = notif.metadata?.action_label;
                  return (
                    <div
                      key={notif.id}
                      className={`border-l-4 ${cfg.color} px-3 py-2.5 border-b border-slate-800/50 transition-colors`}
                      style={{ background: cfg.bg }}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-base flex-shrink-0 mt-0.5">{cfg.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-xs text-slate-200 flex items-center flex-wrap gap-1">
                            {notif.title}
                            {getSeverityBadge(notif.severity)}
                          </div>
                          <div className="text-xs text-slate-400 line-clamp-2 mt-0.5">
                            {notif.message}
                          </div>
                          <div className="flex items-center justify-between mt-1.5 gap-2">
                            <div className="text-[10px] text-slate-600">
                              {notif.timestamp ? formatDistanceToNow(notif.timestamp, { addSuffix: true }) : ''}
                            </div>
                            {actionUrl && actionLabel && (
                              <Link
                                to={actionUrl}
                                onClick={() => setIsOpen(false)}
                                className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg transition-all shrink-0"
                                style={{ background: 'rgba(0,232,255,0.1)', border: '1px solid rgba(0,232,255,0.25)', color: '#00e8ff' }}
                              >
                                <ExternalLink className="w-2.5 h-2.5" />
                                {actionLabel}
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
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