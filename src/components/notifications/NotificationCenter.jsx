import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Bell, Trash2, CheckCircle2, Settings, X } from 'lucide-react';

export default function NotificationCenter() {
  const [showPreferences, setShowPreferences] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState('all');
  const queryClient = useQueryClient();

  const { data: { notifications = [], unread_count = 0 } = {}, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await base44.functions.invoke('notificationOrchestrator', {
        action: 'get_user_notifications',
        limit: 100
      });
      return res.data;
    },
    refetchInterval: 60000 // 1 min
  });

  const { data: preferences = {} } = useQuery({
    queryKey: ['notificationPreferences'],
    queryFn: async () => {
      const res = await base44.functions.invoke('notificationOrchestrator', {
        action: 'get_notification_preferences'
      });
      return res.data?.preferences || {};
    }
  });

  const markAsReadMutation = useMutation({
    mutationFn: (notification_id) => 
      base44.functions.invoke('notificationOrchestrator', {
        action: 'mark_as_read',
        notification_id
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const dismissMutation = useMutation({
    mutationFn: (notification_id) => 
      base44.functions.invoke('notificationOrchestrator', {
        action: 'dismiss_notification',
        notification_id
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const updatePrefsMutation = useMutation({
    mutationFn: (prefs) => 
      base44.functions.invoke('notificationOrchestrator', {
        action: 'update_notification_preferences',
        ...prefs
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationPreferences'] });
    }
  });

  const getSeverityColor = (severity) => {
    switch(severity) {
      case 'critical': return 'bg-red-950 border-red-700 text-red-400';
      case 'urgent': return 'bg-orange-950 border-orange-700 text-orange-400';
      case 'warning': return 'bg-amber-950 border-amber-700 text-amber-400';
      case 'info': return 'bg-blue-950 border-blue-700 text-blue-400';
      default: return 'bg-slate-900 border-slate-700 text-slate-400';
    }
  };

  const getSeverityBadge = (severity) => {
    switch(severity) {
      case 'critical': return 'bg-red-600';
      case 'urgent': return 'bg-orange-600';
      case 'warning': return 'bg-amber-600';
      case 'info': return 'bg-blue-600';
      default: return 'bg-slate-600';
    }
  };

  const filtered = filterSeverity === 'all' 
    ? notifications 
    : notifications.filter(n => n.severity === filterSeverity);

  const activeNotifications = filtered.filter(n => !n.is_dismissed);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-cyan-400" />
          <h2 className="font-bold text-lg">Notifications</h2>
          {unread_count > 0 && (
            <Badge className="bg-red-600">{unread_count} new</Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowPreferences(!showPreferences)}
          className="gap-1"
        >
          <Settings className="w-3.5 h-3.5" /> Preferences
        </Button>
      </div>

      {/* Preferences Panel */}
      {showPreferences && (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-sm">Notification Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.email_enabled}
                  onChange={(e) => updatePrefsMutation.mutate({ email_enabled: e.target.checked })}
                  className="w-4 h-4"
                />
                <span>Email Notifications</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.in_app_enabled}
                  onChange={(e) => updatePrefsMutation.mutate({ in_app_enabled: e.target.checked })}
                  className="w-4 h-4"
                />
                <span>In-App Notifications</span>
              </label>
            </div>
            <div className="border-t border-slate-700 pt-2">
              <p className="text-xs text-slate-500 mb-2">Alert Types</p>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.critical_alerts}
                  onChange={(e) => updatePrefsMutation.mutate({ critical_alerts: e.target.checked })}
                  className="w-4 h-4"
                />
                <span>Critical</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.urgent_alerts}
                  onChange={(e) => updatePrefsMutation.mutate({ urgent_alerts: e.target.checked })}
                  className="w-4 h-4"
                />
                <span>Urgent</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.warning_alerts}
                  onChange={(e) => updatePrefsMutation.mutate({ warning_alerts: e.target.checked })}
                  className="w-4 h-4"
                />
                <span>Warning</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.info_alerts}
                  onChange={(e) => updatePrefsMutation.mutate({ info_alerts: e.target.checked })}
                  className="w-4 h-4"
                />
                <span>Info</span>
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <div className="flex gap-1">
        {['all', 'critical', 'urgent', 'warning', 'info'].map(severity => (
          <Button
            key={severity}
            size="sm"
            variant={filterSeverity === severity ? 'default' : 'outline'}
            onClick={() => setFilterSeverity(severity)}
            className="text-xs capitalize"
          >
            {severity}
          </Button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {activeNotifications.length === 0 ? (
          <Card className="bg-emerald-950/30 border-emerald-700/50">
            <CardContent className="pt-4 flex gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <p className="text-sm text-emerald-400">All caught up! No notifications.</p>
            </CardContent>
          </Card>
        ) : (
          activeNotifications.map(notif => (
            <div
              key={notif.id}
              className={`p-3 rounded-lg border flex items-start gap-3 ${getSeverityColor(notif.severity)} ${
                notif.is_read ? 'opacity-60' : ''
              }`}
            >
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{notif.title}</p>
                <p className="text-xs opacity-75 line-clamp-2">{notif.message}</p>
                <div className="flex gap-1 mt-2 flex-wrap">
                  <Badge className={getSeverityBadge(notif.severity)} variant="outline">{notif.severity}</Badge>
                  {notif.type && <Badge variant="outline" className="text-xs">{notif.type}</Badge>}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {!notif.is_read && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => markAsReadMutation.mutate(notif.id)}
                    className="h-6 w-6 p-0"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => dismissMutation.mutate(notif.id)}
                  className="h-6 w-6 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}