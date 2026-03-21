import React, { useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, AlertCircle, CheckCircle, AlertTriangle, Info, Zap, Target, Milestone, Settings, Trash2, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const SEVERITY_COLORS = {
  critical: { bg: 'bg-red-950/30', border: 'border-red-500/50', text: 'text-red-200', icon: '🔴' },
  urgent: { bg: 'bg-orange-950/30', border: 'border-orange-500/50', text: 'text-orange-200', icon: '🟠' },
  warning: { bg: 'bg-amber-950/30', border: 'border-amber-500/50', text: 'text-amber-200', icon: '🟡' },
  info: { bg: 'bg-blue-950/30', border: 'border-blue-500/50', text: 'text-blue-200', icon: '🔵' },
};

const TYPE_ICONS = {
  autopilot_action: <Zap className="w-4 h-4" />,
  high_value_opportunity: <Target className="w-4 h-4" />,
  task_failure: <AlertTriangle className="w-4 h-4" />,
  kyc_required: <AlertCircle className="w-4 h-4" />,
  low_balance: <AlertTriangle className="w-4 h-4" />,
  milestone_reached: <Milestone className="w-4 h-4" />,
  system_alert: <Settings className="w-4 h-4" />,
};

export default function NotificationsDashboard() {
  const { notifications, unreadCount, markAsRead, dismiss } = useNotifications();
  const [search, setSearch] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterType, setFilterType] = useState('all');

  const filtered = notifications.filter(n => {
    if (search && !n.title.toLowerCase().includes(search.toLowerCase()) &&
        !n.message.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterSeverity !== 'all' && n.severity !== filterSeverity) return false;
    if (filterType !== 'all' && n.type !== filterType) return false;
    return true;
  });

  const groupedByType = Object.groupBy(filtered, n => n.type);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-orbitron text-2xl font-bold tracking-widest text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-cyan-400" />
            NOTIFICATIONS HUB
          </h1>
          <p className="text-xs text-slate-500 tracking-wide mt-1">
            {unreadCount} unread • {notifications.length} total
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-orbitron text-cyan-400 font-bold">{unreadCount}</div>
          <p className="text-xs text-slate-500 mt-1">Unread Alerts</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notifications..."
            className="pl-9 bg-slate-800/60 border-slate-700 text-sm"
          />
        </div>

        <select
          value={filterSeverity}
          onChange={e => setFilterSeverity(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-xs"
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="urgent">Urgent</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>

        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-xs"
        >
          <option value="all">All Types</option>
          <option value="autopilot_action">Autopilot Action</option>
          <option value="high_value_opportunity">High-Value Opportunity</option>
          <option value="task_failure">Task Failure</option>
          <option value="kyc_required">KYC Required</option>
          <option value="low_balance">Low Balance</option>
          <option value="milestone_reached">Milestone</option>
          <option value="system_alert">System Alert</option>
        </select>
      </div>

      {/* Notification Counts by Type */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 mb-6">
        {Object.entries(groupedByType).map(([type, items]) => (
          <div
            key={type}
            className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 text-center"
            onClick={() => setFilterType(type)}
            style={{ cursor: 'pointer' }}
          >
            <div className="text-xl mb-1">{SEVERITY_COLORS[items[0].severity]?.icon}</div>
            <div className="text-sm font-bold text-white">{items.length}</div>
            <div className="text-xs text-slate-400 mt-0.5 capitalize">{type.replace(/_/g, ' ')}</div>
          </div>
        ))}
      </div>

      {/* Notifications List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Bell className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-sm">No notifications match your filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map(notif => {
              const colors = SEVERITY_COLORS[notif.severity] || SEVERITY_COLORS.info;
              return (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className={`p-4 rounded-xl border ${colors.bg} ${colors.border} cursor-pointer transition-all hover:scale-[1.01] ${
                    !notif.is_read ? 'ring-2 ring-offset-2 ring-offset-slate-950 ring-cyan-500/50' : ''
                  }`}
                  onClick={() => !notif.is_read && markAsRead(notif.id)}
                >
                  <div className="flex gap-4">
                    {/* Icon */}
                    <div className="flex-shrink-0 mt-1">
                      {TYPE_ICONS[notif.type]}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className={`font-semibold ${colors.text}`}>
                            {notif.title}
                          </h3>
                          <p className="text-sm text-slate-300 mt-1">{notif.message}</p>

                          {/* Metadata */}
                          <div className="flex gap-2 mt-2 text-xs text-slate-400">
                            <span className="capitalize">{notif.severity}</span>
                            <span>•</span>
                            <span>{new Date(notif.created_date).toLocaleDateString()}</span>
                            {notif.action_type !== 'none' && (
                              <>
                                <span>•</span>
                                <span className="text-amber-400 font-medium">Action Required</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-1 flex-shrink-0">
                          {!notif.is_read && (
                            <button
                              onClick={e => { e.stopPropagation(); markAsRead(notif.id); }}
                              className="p-1.5 hover:bg-slate-700/50 rounded text-slate-400 hover:text-slate-200 transition-colors"
                              title="Mark as read"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={e => { e.stopPropagation(); dismiss(notif.id); }}
                            className="p-1.5 hover:bg-slate-700/50 rounded text-slate-400 hover:text-slate-200 transition-colors"
                            title="Dismiss"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Related entity link */}
                      {notif.related_entity_type && (
                        <a
                          href={`/${notif.related_entity_type}?id=${notif.related_entity_id}`}
                          className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-block"
                        >
                          View {notif.related_entity_type} →
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}