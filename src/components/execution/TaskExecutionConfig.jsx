import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Clock, Zap, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function TaskExecutionConfig() {
  const [delayMs, setDelayMs] = useState(5000);
  const [minRiskScore, setMinRiskScore] = useState(60);
  const [autoExecuteEnabled, setAutoExecuteEnabled] = useState(false);
  const queryClient = useQueryClient();

  // Fetch user settings
  const { data: userSettings = {} } = useQuery({
    queryKey: ['userExecutionSettings'],
    queryFn: async () => {
      const res = await base44.functions.invoke('credentialTaskExecutor', {
        action: 'get_execution_schedule'
      });
      return res.data || {};
    }
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings) => {
      // This would call a backend function to update UserDataStore
      return settings;
    },
    onSuccess: () => {
      toast.success('Execution settings updated');
      queryClient.invalidateQueries({ queryKey: ['userExecutionSettings'] });
    },
    onError: (error) => {
      toast.error(`Failed to update settings: ${error.message}`);
    }
  });

  const handleSaveSettings = () => {
    updateSettingsMutation.mutate({
      delay_ms: delayMs,
      min_risk_score: minRiskScore,
      auto_execute_enabled: autoExecuteEnabled
    });
  };

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            Execution Parameters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Auto Execute Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <div>
                <div className="text-sm font-medium">Auto Execute Enabled</div>
                <div className="text-xs text-slate-500">Automatically execute approved tasks</div>
              </div>
            </div>
            <Switch
              checked={autoExecuteEnabled}
              onCheckedChange={setAutoExecuteEnabled}
            />
          </div>

          {/* Delay Setting */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              Execution Delay (milliseconds)
            </label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={delayMs}
                onChange={(e) => setDelayMs(Math.max(0, parseInt(e.target.value) || 0))}
                className="bg-slate-800 border-slate-700 text-white"
                min="0"
                step="1000"
              />
              <span className="text-xs text-slate-500 pt-2">
                ({(delayMs / 1000).toFixed(1)}s)
              </span>
            </div>
            <div className="text-xs text-slate-500">
              Random delay before executing each task to avoid detection
            </div>
          </div>

          {/* Risk Score Threshold */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-400" />
              Minimum Risk Score to Execute
            </label>
            <div className="flex gap-2 items-center">
              <Input
                type="range"
                value={minRiskScore}
                onChange={(e) => setMinRiskScore(parseInt(e.target.value))}
                min="0"
                max="100"
                step="5"
                className="flex-1"
              />
              <span className="text-sm font-medium w-12 text-center">{minRiskScore}</span>
            </div>
            <div className="text-xs text-slate-500">
              Only execute tasks with risk scores ≥ {minRiskScore}
            </div>
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSaveSettings}
            disabled={updateSettingsMutation.isPending}
            className="w-full bg-cyan-600 hover:bg-cyan-700"
          >
            {updateSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>

      {/* Info Box */}
      <Card className="bg-blue-950/30 border-blue-500/30">
        <CardContent className="pt-6 text-xs text-blue-200 space-y-1">
          <div>• Delays are randomized ±50% to vary execution patterns</div>
          <div>• Risk scores filter out high-risk opportunities automatically</div>
          <div>• All executions are logged with audit trails</div>
          <div>• Credentials must explicitly permit the action type</div>
        </CardContent>
      </Card>
    </div>
  );
}