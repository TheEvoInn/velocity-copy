import React, { useState } from 'react';
import UnifiedMailbox from '@/components/communications/UnifiedMailbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNotifications } from '@/hooks/useNotifications';
import {
  Zap,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  X,
  Trash2,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function NotificationsCenter() {
  const { unreadNotifications, allNotifications, isLoading, markAsRead, dismiss, dismissAll } = useNotifications();
  const [filterSeverity, setFilterSeverity] = useState(null);
  const [tab, setTab] = useState('inbox'); // inbox, communications, settings

  const getIcon = (type) => {
    switch (type) {
      case 'autopilot_execution':
        return <Zap className="w-4 h-4" />;
      case 'compliance_alert':
        return <AlertTriangle className="w-4 h-4" />;
      case 'user_action_required':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getSeverityBadge = (severity) => {
    const variants = {
      critical: 'bg-red-500/20 text-red-400 border-red-500/30',
      urgent: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      info: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
    };
    return variants[severity] || variants.info;
  };

  const handleDismissAll = async (type) => {
    try {
      await dismissAll(type);
      toast.success('All notifications dismissed');
    } catch (error) {
      toast.error('Failed to dismiss notifications');
    }
  };

  const filteredNotifications = filterSeverity
    ? allNotifications.filter(n => n.severity === filterSeverity)
    : allNotifications;

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-800 pb-3">
        {['inbox', 'communications', 'settings'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-orbitron uppercase transition-all ${
              tab === t
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            {t === 'inbox' && '📬 Notifications'}
            {t === 'communications' && '✉ Mailbox'}
            {t === 'settings' && '⚙ Settings'}
          </button>
        ))}
      </div>

      {tab !== 'inbox' && (
        <div className="mb-4">
          {tab === 'communications' && <UnifiedMailbox />}
          {tab === 'settings' && (
            <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
              <h3 className="text-sm font-bold text-cyan-400 mb-3">Notification Preferences</h3>
              <div className="space-y-2 text-xs text-slate-400">
                <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> Email alerts on critical events</label>
                <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> Autopilot execution summaries</label>
                <label className="flex items-center gap-2"><input type="checkbox" /> Daily digest emails</label>
                <label className="flex items-center gap-2"><input type="checkbox" /> Marketing campaign updates</label>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'inbox' && (
      <div className="grid grid-cols-4 gap-3">
        {/* Stats Cards */}
        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-cyan-400">{unreadNotifications.length}</div>
            <p className="text-xs text-slate-400 mt-1">Unread</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-400">
              {allNotifications.filter(n => n.severity === 'critical').length}
            </div>
            <p className="text-xs text-slate-400 mt-1">Critical</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-orange-400">
              {allNotifications.filter(n => n.severity === 'urgent').length}
            </div>
            <p className="text-xs text-slate-400 mt-1">Urgent</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-amber-400">
              {allNotifications.filter(n => n.severity === 'warning').length}
            </div>
            <p className="text-xs text-slate-400 mt-1">Warnings</p>
          </CardContent>
        </Card>
      </div>

      {/* Notifications List */}
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Real-time alerts and updates</CardDescription>
          </div>
          <div className="flex gap-2">
            <select
              value={filterSeverity || ''}
              onChange={(e) => setFilterSeverity(e.target.value || null)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-400"
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="urgent">Urgent</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400 mt-2">Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm text-slate-400">All caught up!</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  className={cn(
                    'p-3 rounded-lg border-l-4 transition-all',
                    notif.is_read ? 'bg-slate-900/30 opacity-60' : 'bg-slate-800/50',
                    getSeverityBadge(notif.severity)
                  )}
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
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="text-slate-400">{getIcon(notif.type)}</div>
                        <h4 className="font-semibold text-sm">{notif.title}</h4>
                        <Badge variant="outline" className="text-xs">
                          {notif.source_module}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{notif.message}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(notif.created_date).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex gap-1 shrink-0">
                      {!notif.is_read && (
                        <button
                          onClick={() => markAsRead(notif.id)}
                          className="p-1.5 rounded hover:bg-slate-700 transition-colors"
                          title="Mark as read"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        </button>
                      )}
                      <button
                        onClick={() => dismiss(notif.id)}
                        className="p-1.5 rounded hover:bg-slate-700 transition-colors"
                        title="Dismiss"
                      >
                        <X className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {notif.action_type && notif.action_type !== 'none' && (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" className="text-xs h-7">
                        {notif.action_type === 'review_required' && 'Review Details'}
                        {notif.action_type === 'user_input_required' && 'Complete Action'}
                        {notif.action_type === 'confirmation_required' && 'Confirm'}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}