import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { User, Lock, Bell, Globe, Shield, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function UserAccountSettings() {
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const queryClient = useQueryClient();

  // Fetch current user
  useEffect(() => {
    base44.auth.me().then((u) => {
      if (u) {
        setUser(u);
        setFormData(u);
      }
    });
  }, []);

  // Fetch user preferences
  const { data: preferences } = useQuery({
    queryKey: ['userPreferences'],
    queryFn: async () => {
      try {
        const res = await base44.entities.UserDataStore.filter({
          user_email: user?.email
        });
        return res[0] || {};
      } catch (e) {
        return {};
      }
    },
    enabled: !!user?.email
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.auth.updateMe({
        full_name: data.full_name
      });
    },
    onSuccess: () => {
      toast.success('Account settings updated');
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    }
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    await updateUserMutation.mutateAsync(formData);
  };

  if (!user) {
    return <div className="text-slate-400">Loading account settings...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Display Name */}
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="w-4 h-4 text-blue-400" />
            Display Name
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={formData.full_name || ''}
            onChange={(e) => handleChange('full_name', e.target.value)}
            placeholder="Enter your display name"
            className="bg-slate-800 border-slate-600"
          />
          <p className="text-xs text-slate-500">Used across the platform for identification</p>
        </CardContent>
      </Card>

      {/* Email Address (Read-only) */}
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            Email Address
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={user.email}
            disabled
            className="bg-slate-800 border-slate-600 text-slate-400"
          />
          <p className="text-xs text-slate-500 mt-2">Email cannot be changed. Contact support to modify.</p>
        </CardContent>
      </Card>

      {/* Timezone */}
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            Timezone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={formData.timezone || 'America/Los_Angeles'}
            onChange={(e) => handleChange('timezone', e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
          >
            <option value="America/New_York">Eastern Time (ET)</option>
            <option value="America/Chicago">Central Time (CT)</option>
            <option value="America/Denver">Mountain Time (MT)</option>
            <option value="America/Los_Angeles">Pacific Time (PT)</option>
            <option value="Europe/London">London (GMT)</option>
            <option value="Europe/Paris">Paris (CET)</option>
            <option value="Asia/Tokyo">Tokyo (JST)</option>
            <option value="Australia/Sydney">Sydney (AEDT)</option>
          </select>
          <p className="text-xs text-slate-500 mt-2">Used for scheduling and execution timing</p>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            Notification Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Email Notifications</p>
              <p className="text-xs text-slate-500">Receive important alerts via email</p>
            </div>
            <Switch
              checked={preferences?.ui_preferences?.notification_sound !== false}
              onCheckedChange={(checked) => handleChange('emailNotifications', checked)}
            />
          </div>
          <div className="border-t border-slate-700 pt-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Push Notifications</p>
              <p className="text-xs text-slate-500">Get alerts directly in the app</p>
            </div>
            <Switch
              checked={formData.pushNotifications !== false}
              onCheckedChange={(checked) => handleChange('pushNotifications', checked)}
            />
          </div>
          <div className="border-t border-slate-700 pt-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Mission AI Prompts</p>
              <p className="text-xs text-slate-500">Allow AI to request missing information</p>
            </div>
            <Switch
              checked={formData.missionAIPrompts !== false}
              onCheckedChange={(checked) => handleChange('missionAIPrompts', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      {hasChanges && (
        <Button
          onClick={handleSave}
          disabled={updateUserMutation.isPending}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {updateUserMutation.isPending ? 'Saving...' : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      )}
    </div>
  );
}