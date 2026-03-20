import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Zap, Target, AlertTriangle, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function AutopilotSettings() {
  const [formData, setFormData] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const queryClient = useQueryClient();

  // Fetch user goals
  const { data: goals = {} } = useQuery({
    queryKey: ['userGoals'],
    queryFn: async () => {
      const res = await base44.entities.UserGoals.list(1);
      return res[0] || {};
    }
  });

  // Fetch autopilot state
  const { data: autopilotState = {} } = useQuery({
    queryKey: ['autopilotState'],
    queryFn: async () => {
      const res = await base44.entities.PlatformState.list(1);
      return res[0] || {};
    }
  });

  useEffect(() => {
    setFormData(goals);
  }, [goals]);

  // Update goals mutation
  const updateGoalsMutation = useMutation({
    mutationFn: async (data) => {
      if (goals.id) {
        return await base44.entities.UserGoals.update(goals.id, data);
      } else {
        return await base44.entities.UserGoals.create(data);
      }
    },
    onSuccess: () => {
      toast.success('Autopilot settings updated');
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['userGoals'] });
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
    await updateGoalsMutation.mutateAsync(formData);
  };

  return (
    <div className="space-y-4">
      {/* Master Toggle */}
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            Autopilot Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
            <div>
              <p className="font-medium text-white">Enable Autopilot</p>
              <p className="text-xs text-slate-500 mt-1">Master switch for autonomous task execution</p>
            </div>
            <Switch
              checked={formData.autopilot_enabled !== false}
              onCheckedChange={(checked) => handleChange('autopilot_enabled', checked)}
            />
          </div>

          {formData.autopilot_enabled && (
            <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-300">
              ✓ Autopilot is active. Tasks will execute based on your settings.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily Targets */}
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            Daily Earning Targets
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-white">Total Daily Target</label>
            <div className="flex gap-2 mt-2">
              <span className="text-slate-400">$</span>
              <Input
                type="number"
                value={formData.daily_target || 1000}
                onChange={(e) => handleChange('daily_target', parseFloat(e.target.value))}
                className="bg-slate-800 border-slate-600"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">Total earnings goal per day</p>
          </div>

          <div className="border-t border-slate-700 pt-4">
            <label className="text-sm font-medium text-white">AI Target</label>
            <div className="flex gap-2 mt-2">
              <span className="text-slate-400">$</span>
              <Input
                type="number"
                value={formData.ai_daily_target || 500}
                onChange={(e) => handleChange('ai_daily_target', parseFloat(e.target.value))}
                className="bg-slate-800 border-slate-600"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">How much AI should generate autonomously</p>
          </div>

          <div className="border-t border-slate-700 pt-4">
            <label className="text-sm font-medium text-white">Risk Tolerance</label>
            <select
              value={formData.risk_tolerance || 'moderate'}
              onChange={(e) => handleChange('risk_tolerance', e.target.value)}
              className="w-full mt-2 bg-slate-800 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
            >
              <option value="conservative">Conservative (Low risk, slower growth)</option>
              <option value="moderate">Moderate (Balanced risk & rewards)</option>
              <option value="aggressive">Aggressive (High risk, higher returns)</option>
            </select>
            <p className="text-xs text-slate-500 mt-2">Controls which opportunities autopilot pursues</p>
          </div>
        </CardContent>
      </Card>

      {/* Categories & Preferences */}
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-sm">Preferred Opportunity Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {['freelance', 'service', 'arbitrage', 'digital_flip', 'grant', 'contest'].map((cat) => (
              <Badge
                key={cat}
                variant="outline"
                className={`cursor-pointer transition-all ${
                  formData.preferred_categories?.includes(cat)
                    ? 'bg-blue-500/30 text-blue-200 border-blue-500/50'
                    : 'bg-slate-800 text-slate-400 border-slate-600'
                }`}
                onClick={() => {
                  const current = formData.preferred_categories || [];
                  const updated = current.includes(cat)
                    ? current.filter(c => c !== cat)
                    : [...current, cat];
                  handleChange('preferred_categories', updated);
                }}
              >
                {cat.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-3">Click to toggle categories autopilot should focus on</p>
        </CardContent>
      </Card>

      {/* Security & Limits */}
      <Card className="bg-red-950/20 border-red-500/30">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            Safety Limits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-red-200">
          <div>
            <p className="font-medium">Auto-Stop on Errors</p>
            <p>Autopilot stops automatically after 5 consecutive errors</p>
          </div>
          <div className="border-t border-red-500/20 pt-3">
            <p className="font-medium">Manual Oversight</p>
            <p>Complex tasks require your approval before execution</p>
          </div>
          <div className="border-t border-red-500/20 pt-3">
            <p className="font-medium">Compliance</p>
            <p>All executions follow your KYC status and legal requirements</p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      {hasChanges && (
        <Button
          onClick={handleSave}
          disabled={updateGoalsMutation.isPending}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {updateGoalsMutation.isPending ? 'Saving...' : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Autopilot Settings
            </>
          )}
        </Button>
      )}
    </div>
  );
}