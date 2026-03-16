import React, { useState, useEffect } from 'react';
import { usePersistentUserData } from '@/hooks/usePersistentUserData';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Save, RotateCcw } from 'lucide-react';

export default function UserPreferencesPanel() {
  const { userData, updateField, resetField, loading } = usePersistentUserData();
  const [saveStatus, setSaveStatus] = useState(null);

  const handleUpdatePreference = async (section, field, value) => {
    setSaveStatus('saving');
    const success = await updateField(section, {
      ...userData?.[section],
      [field]: value,
    });

    if (success) {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } else {
      setSaveStatus('error');
    }
  };

  const handleReset = async (section) => {
    if (window.confirm(`Reset all ${section} to defaults?`)) {
      const success = await resetField(section);
      if (success) {
        setSaveStatus('reset');
        setTimeout(() => setSaveStatus(null), 2000);
      }
    }
  };

  if (loading) {
    return <div className="text-slate-400 text-sm">Loading preferences...</div>;
  }

  const autopilot = userData?.autopilot_preferences || {};
  const ui = userData?.ui_preferences || {};
  const security = userData?.security_preferences || {};

  return (
    <div className="space-y-4">
      {/* Status Messages */}
      {saveStatus && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
            saveStatus === 'saved'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : saveStatus === 'error'
              ? 'bg-red-500/10 text-red-400 border border-red-500/30'
              : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
          }`}
        >
          {saveStatus === 'saved' ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Preferences saved permanently
            </>
          ) : saveStatus === 'error' ? (
            <>
              <AlertCircle className="w-3.5 h-3.5" />
              Error saving preferences
            </>
          ) : (
            <>
              <span className="animate-spin">⏳</span>
              Saving...
            </>
          )}
        </div>
      )}

      {/* Autopilot Preferences */}
      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Autopilot Preferences</CardTitle>
              <CardDescription className="text-xs mt-1">
                These settings control how Autopilot behaves
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleReset('autopilot_preferences')}
              className="h-6 text-xs"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium">Autopilot Enabled</label>
            <Switch
              checked={autopilot.enabled || false}
              onCheckedChange={(value) =>
                handleUpdatePreference('autopilot_preferences', 'enabled', value)
              }
            />
          </div>

          <div>
            <label className="text-xs font-medium block mb-2">Mode</label>
            <Select
              value={autopilot.mode || 'continuous'}
              onValueChange={(value) =>
                handleUpdatePreference('autopilot_preferences', 'mode', value)
              }
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="continuous">Continuous</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium block mb-2">Execution Mode</label>
            <Select
              value={autopilot.execution_mode || 'review_required'}
              onValueChange={(value) =>
                handleUpdatePreference('autopilot_preferences', 'execution_mode', value)
              }
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full_auto">Full Auto</SelectItem>
                <SelectItem value="review_required">Review Required</SelectItem>
                <SelectItem value="notification_only">Notification Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-xs font-medium">Auto-Retry Failed Tasks</label>
            <Switch
              checked={autopilot.retry_preferences?.auto_retry_enabled !== false}
              onCheckedChange={(value) =>
                handleUpdatePreference('autopilot_preferences', 'retry_preferences', {
                  ...autopilot.retry_preferences,
                  auto_retry_enabled: value,
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* UI Preferences */}
      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">UI Preferences</CardTitle>
              <CardDescription className="text-xs mt-1">
                Customize your interface
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleReset('ui_preferences')}
              className="h-6 text-xs"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium">Notification Sound</label>
            <Switch
              checked={ui.notification_sound !== false}
              onCheckedChange={(value) =>
                handleUpdatePreference('ui_preferences', 'notification_sound', value)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-xs font-medium">Compact Mode</label>
            <Switch
              checked={ui.compact_mode || false}
              onCheckedChange={(value) =>
                handleUpdatePreference('ui_preferences', 'compact_mode', value)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Security Preferences */}
      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Security Preferences</CardTitle>
              <CardDescription className="text-xs mt-1">
                Manage security settings
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleReset('security_preferences')}
              className="h-6 text-xs"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium">Two-Factor Authentication</label>
            <Switch
              checked={security.two_factor_enabled !== false}
              onCheckedChange={(value) =>
                handleUpdatePreference('security_preferences', 'two_factor_enabled', value)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-xs font-medium">PIN for Sensitive Actions</label>
            <Switch
              checked={security.require_pin_for_sensitive_actions !== false}
              onCheckedChange={(value) =>
                handleUpdatePreference('security_preferences', 'require_pin_for_sensitive_actions', value)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Data Retention Notice */}
      <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-400">
        <p className="font-semibold mb-1">Indefinite Data Retention</p>
        <p className="text-emerald-300">
          All your preferences are saved permanently and will survive platform updates, system
          changes, and redesigns. Your data will never revert unless you explicitly reset it.
        </p>
      </div>
    </div>
  );
}