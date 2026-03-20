import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Mail, Zap, Send, BarChart3, Loader } from 'lucide-react';
import { toast } from 'sonner';

export default function AutopilotEmailScheduler() {
  const [autopilotEnabled, setAutopilotEnabled] = useState(false);
  const [cycleInterval, setCycleInterval] = useState(3600000); // 1 hour default
  const queryClient = useQueryClient();

  // Fetch email stats
  const { data: stats = {} } = useQuery({
    queryKey: ['emailStats'],
    queryFn: async () => {
      const res = await base44.functions.invoke('emailOutreachEngine', {
        action: 'get_email_stats'
      });
      return res.data?.stats || {};
    },
    refetchInterval: 30000
  });

  // Manual send mutation
  const sendScheduledMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('emailOutreachEngine', {
        action: 'send_scheduled_emails'
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Sent ${data.sent_count} emails`);
      queryClient.invalidateQueries({ queryKey: ['emailStats'] });
    },
    onError: (error) => {
      toast.error(`Send failed: ${error.message}`);
    }
  });

  // Auto-send scheduled emails when autopilot is enabled
  useEffect(() => {
    if (!autopilotEnabled) return;

    const interval = setInterval(() => {
      sendScheduledMutation.mutate();
    }, cycleInterval);

    return () => clearInterval(interval);
  }, [autopilotEnabled, cycleInterval, sendScheduledMutation]);

  const totalEmails = (stats.total || 0);
  const sentEmails = (stats.sent || 0);
  const pendingEmails = (stats.pending || 0);

  return (
    <div className="space-y-4">
      {/* Control Panel */}
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" />
            Autopilot Email Scheduler
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-cyan-400" />
              <div>
                <div className="text-sm font-medium">Enable Autopilot</div>
                <div className="text-xs text-slate-500">Auto-send scheduled emails</div>
              </div>
            </div>
            <Switch
              checked={autopilotEnabled}
              onCheckedChange={setAutopilotEnabled}
            />
          </div>

          {/* Cycle Interval */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Send Cycle Interval</label>
            <select
              value={cycleInterval}
              onChange={(e) => setCycleInterval(parseInt(e.target.value))}
              disabled={!autopilotEnabled}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-2 text-xs"
            >
              <option value={600000}>Every 10 minutes</option>
              <option value={1800000}>Every 30 minutes</option>
              <option value={3600000}>Every 1 hour</option>
              <option value={7200000}>Every 2 hours</option>
              <option value={21600000}>Every 6 hours</option>
              <option value={86400000}>Every 24 hours</option>
            </select>
          </div>

          {/* Manual Send Button */}
          <Button
            onClick={() => sendScheduledMutation.mutate()}
            disabled={sendScheduledMutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {sendScheduledMutation.isPending ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send Now
              </>
            )}
          </Button>

          {autopilotEnabled && (
            <div className="p-2 rounded bg-green-500/10 border border-green-500/30 text-xs text-green-300">
              ✓ Autopilot active: Emails will send automatically every {(cycleInterval / 1000 / 60).toFixed(0)} minutes
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card className="bg-blue-950/30 border-blue-500/30">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-400">{totalEmails}</div>
            <div className="text-xs text-blue-600 mt-1">Total Emails</div>
          </CardContent>
        </Card>

        <Card className="bg-emerald-950/30 border-emerald-500/30">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-emerald-400">{sentEmails}</div>
            <div className="text-xs text-emerald-600 mt-1">Sent</div>
          </CardContent>
        </Card>

        <Card className="bg-amber-950/30 border-amber-500/30">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-amber-400">{pendingEmails}</div>
            <div className="text-xs text-amber-600 mt-1">Pending Review</div>
          </CardContent>
        </Card>

        <Card className="bg-purple-950/30 border-purple-500/30">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-purple-400">
              {totalEmails > 0 ? Math.round((sentEmails / totalEmails) * 100) : 0}%
            </div>
            <div className="text-xs text-purple-600 mt-1">Success Rate</div>
          </CardContent>
        </Card>
      </div>

      {/* Info Box */}
      <Card className="bg-blue-950/30 border-blue-500/30">
        <CardContent className="pt-6 text-xs text-blue-200 space-y-1">
          <div>• Autopilot sends emails on your defined cycle</div>
          <div>• Only approved & scheduled emails are sent</div>
          <div>• All sends are logged with timestamps</div>
          <div>• Manual send forces immediate delivery check</div>
          <div>• Failed sends retry automatically up to 3x</div>
        </CardContent>
      </Card>
    </div>
  );
}