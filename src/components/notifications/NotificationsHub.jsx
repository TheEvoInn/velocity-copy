import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/useNotifications';
import { AlertCircle, Check, Info, Trash2, Archive } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function NotificationsHub() {
  const [filter, setFilter] = useState('all');
  const { notifications, dismissAll, dismiss } = useNotifications();

  const severityColors = {
    critical: 'bg-red-950/30 border-red-500/30 text-red-200',
    urgent: 'bg-orange-950/30 border-orange-500/30 text-orange-200',
    warning: 'bg-amber-950/30 border-amber-500/30 text-amber-200',
    info: 'bg-blue-950/30 border-blue-500/30 text-blue-200'
  };

  const typeIcons = {
    compliance_alert: <AlertCircle className="w-4 h-4" />,
    autopilot_execution: <Check className="w-4 h-4" />,
    system_alert: <AlertCircle className="w-4 h-4" />,
    opportunity_alert: <Info className="w-4 h-4" />,
    integration_alert: <AlertCircle className="w-4 h-4" />,
    user_action_required: <AlertCircle className="w-4 h-4" />
  };

  const filteredNotifications = filter === 'all'
    ? notifications
    : filter === 'critical'
    ? notifications.filter(n => n.severity === 'critical')
    : notifications.filter(n => n.type === filter);

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          'all',
          'critical',
          'compliance_alert',
          'autopilot_execution',
          'user_action_required',
          'opportunity_alert',
          'system_alert',
          'vipz_alert',
          'ned_alert',
          'workflow_alert'
        ].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-all ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {f === 'all' ? 'All' : f.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        <Card className="bg-red-950/30 border-red-500/30">
          <CardContent className="pt-4">
            <div className="text-xl font-bold text-red-400">
              {notifications.filter(n => n.severity === 'critical').length}
            </div>
            <div className="text-xs text-red-600 mt-1">Critical</div>
          </CardContent>
        </Card>

        <Card className="bg-orange-950/30 border-orange-500/30">
          <CardContent className="pt-4">
            <div className="text-xl font-bold text-orange-400">
              {notifications.filter(n => n.severity === 'urgent').length}
            </div>
            <div className="text-xs text-orange-600 mt-1">Urgent</div>
          </CardContent>
        </Card>

        <Card className="bg-amber-950/30 border-amber-500/30">
          <CardContent className="pt-4">
            <div className="text-xl font-bold text-amber-400">
              {notifications.filter(n => n.severity === 'warning').length}
            </div>
            <div className="text-xs text-amber-600 mt-1">Warnings</div>
          </CardContent>
        </Card>

        <Card className="bg-blue-950/30 border-blue-500/30">
          <CardContent className="pt-4">
            <div className="text-xl font-bold text-blue-400">
              {notifications.filter(n => n.severity === 'info').length}
            </div>
            <div className="text-xs text-blue-600 mt-1">Info</div>
          </CardContent>
        </Card>
      </div>

      {/* Clear Button */}
      {notifications.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => dismissAll()}
          className="border-slate-600 text-slate-300"
        >
          <Archive className="w-3 h-3 mr-1" />
          Dismiss All
        </Button>
      )}

      {/* Notifications List */}
      <div className="space-y-2">
        <AnimatePresence>
          {filteredNotifications.length === 0 ? (
            <Card className="bg-slate-900/50 border-slate-700">
              <CardContent className="pt-6 text-center text-slate-500 text-sm">
                No notifications in this category
              </CardContent>
            </Card>
          ) : (
            filteredNotifications.map((notif) => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card className={`border cursor-pointer transition-all hover:shadow-lg ${severityColors[notif.severity]}`}>
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {typeIcons[notif.type]}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <h4 className="font-semibold text-white">{notif.title}</h4>
                            <p className="text-sm mt-1 opacity-90">{notif.message}</p>
                          </div>
                          <button
                            onClick={() => dismiss(notif.id)}
                            className="flex-shrink-0 p-1 hover:bg-white/20 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Metadata */}
                        <div className="flex items-center gap-2 mt-3 text-xs opacity-75">
                          <span>{notif.type.replace(/_/g, ' ')}</span>
                          <span>•</span>
                          <span>{new Date(notif.created_date).toLocaleDateString()}</span>
                          {notif.action_type !== 'none' && (
                            <>
                              <span>•</span>
                              <span className="bg-white/20 px-2 py-0.5 rounded">Action required</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* History Limit Note */}
      <Card className="bg-blue-950/20 border-blue-500/20">
        <CardContent className="pt-4 text-xs text-blue-300">
          Showing recent notifications. Older notifications are automatically archived.
        </CardContent>
      </Card>
    </div>
  );
}