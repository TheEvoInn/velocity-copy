import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Bell, Mail, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function NotificationPreferences() {
  const queryClient = useQueryClient();
  const [localPrefs, setLocalPrefs] = useState(null);

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['notificationPreferences'],
    queryFn: async () => {
      const result = await base44.functions.invoke('notificationSubscriptionManager', {
        action: 'get_notification_preferences'
      });
      return result.data?.preferences;
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (updatedPrefs) => {
      const result = await base44.functions.invoke('notificationSubscriptionManager', {
        action: 'update_preferences',
        ...updatedPrefs
      });
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationPreferences'] });
      toast.success('Notification preferences updated');
    },
    onError: (err) => {
      toast.error(`Failed to update: ${err.message}`);
    }
  });

  const handleChannelToggle = async (notificationType, channel) => {
    if (!preferences) return;

    const updated = {
      ...preferences,
      notification_subscriptions: {
        ...preferences.notification_subscriptions,
        [notificationType]: {
          ...preferences.notification_subscriptions[notificationType],
          [channel]: !preferences.notification_subscriptions[notificationType][channel]
        }
      }
    };

    setLocalPrefs(updated);
    updateMutation.mutate(updated);
  };

  const handleQuietHoursToggle = async (enabled) => {
    const updated = {
      ...preferences,
      quiet_hours_enabled: enabled
    };
    setLocalPrefs(updated);
    updateMutation.mutate(updated);
  };

  const displayPrefs = localPrefs || preferences || {};

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="text-center text-slate-400">Loading preferences...</div>
        </CardContent>
      </Card>
    );
  }

  const notificationTypes = [
    { key: 'compliance_alert', label: 'Compliance Alerts', icon: '🔐', description: 'Critical compliance notifications' },
    { key: 'autopilot_execution', label: 'Autopilot Updates', icon: '⚙️', description: 'Task execution status updates' },
    { key: 'opportunity_alert', label: 'Opportunity Alerts', icon: '🎯', description: 'New opportunities and revenue milestones' },
    { key: 'system_alert', label: 'System Alerts', icon: '⚠️', description: 'Important system notifications' },
    { key: 'user_action_required', label: 'Action Required', icon: '📋', description: 'Requires your attention' }
  ];

  return (
    <div className="space-y-6">
      {/* Quiet Hours Section */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            Quiet Hours
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-white">Mute notifications during sleep hours</div>
              <p className="text-xs text-slate-400 mt-1">Skip notifications between set times</p>
            </div>
            <Switch
              checked={displayPrefs.quiet_hours_enabled || false}
              onCheckedChange={handleQuietHoursToggle}
            />
          </div>

          {displayPrefs.quiet_hours_enabled && (
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-700">
              <div>
                <label className="text-xs text-slate-400 block mb-2">Start Time</label>
                <input
                  type="time"
                  value={displayPrefs.quiet_hours_start || '22:00'}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                  onChange={(e) => {
                    const updated = { ...displayPrefs, quiet_hours_start: e.target.value };
                    setLocalPrefs(updated);
                  }}
                  onBlur={() => updateMutation.mutate(displayPrefs)}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-2">End Time</label>
                <input
                  type="time"
                  value={displayPrefs.quiet_hours_end || '08:00'}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                  onChange={(e) => {
                    const updated = { ...displayPrefs, quiet_hours_end: e.target.value };
                    setLocalPrefs(updated);
                  }}
                  onBlur={() => updateMutation.mutate(displayPrefs)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Type Preferences */}
      <div className="space-y-3">
        {notificationTypes.map((type) => (
          <Card key={type.key} className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-medium text-white flex items-center gap-2">
                    <span className="text-lg">{type.icon}</span>
                    {type.label}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{type.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {['in_app', 'email'].map((channel) => (
                  <div key={channel} className="flex items-center gap-2 p-2 rounded bg-slate-800/30">
                    <Switch
                      checked={displayPrefs.notification_subscriptions?.[type.key]?.[channel] || false}
                      onCheckedChange={() => handleChannelToggle(type.key, channel)}
                    />
                    <label className="text-xs text-slate-300 capitalize cursor-pointer flex-1">
                      {channel === 'in_app' ? (
                        <>
                          <Bell className="w-3 h-3 inline mr-1" />
                          In-App
                        </>
                      ) : (
                        <>
                          <Mail className="w-3 h-3 inline mr-1" />
                          Email
                        </>
                      )}
                    </label>
                  </div>
                ))}
                <div className="flex items-center justify-center p-2 rounded bg-slate-800/30 text-xs text-slate-500">
                  Push (coming soon)
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Save Button */}
      <Button
        onClick={() => updateMutation.mutate(displayPrefs)}
        disabled={updateMutation.isPending || !localPrefs}
        className="w-full bg-cyan-600 hover:bg-cyan-700"
      >
        {updateMutation.isPending ? 'Saving...' : 'Save Preferences'}
      </Button>
    </div>
  );
}