import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Zap, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const TEMPLATES = [
  {
    id: 'high_velocity_arbitrage',
    name: 'High-Velocity Arbitrage',
    description: 'Auto-execute arbitrage opportunities with profit > $500 and velocity score > 75',
    icon: '⚡',
    config: {
      rule_name: 'High-Velocity Arbitrage Auto-Executor',
      description: 'Automatically queues arbitrage opportunities meeting velocity and profit thresholds',
      source_department: 'Discovery',
      source_entity: 'Opportunity',
      source_event_type: 'create',
      condition_type: 'profit_threshold',
      condition_field: 'profit_estimate_low',
      condition_operator: '>=',
      condition_value: 500,
      target_department: 'Execution',
      target_task_type: 'auto_apply',
      target_task_config: {
        ai_agent: 'Autopilot',
        execution_mode: 'immediate',
        delay_minutes: 0,
        max_allocation: 1000,
        parameters: {
          min_velocity: 75,
          categories: ['arbitrage'],
          priority_boost: 'high'
        }
      },
      enabled: true,
      priority: 90
    }
  },
  {
    id: 'low_risk_freelance',
    name: 'Low-Risk Freelance',
    description: 'Auto-apply to freelance jobs with risk score < 30 and profit > $100',
    icon: '💼',
    config: {
      rule_name: 'Low-Risk Freelance Auto-Applicant',
      description: 'Automatically applies to vetted freelance opportunities with minimal risk',
      source_department: 'Discovery',
      source_entity: 'Opportunity',
      source_event_type: 'create',
      condition_type: 'value_below',
      condition_field: 'risk_score',
      condition_operator: '<',
      condition_value: 30,
      target_department: 'Execution',
      target_task_type: 'auto_apply',
      target_task_config: {
        ai_agent: 'Autopilot',
        execution_mode: 'immediate',
        delay_minutes: 0,
        max_allocation: 200,
        parameters: {
          min_profit: 100,
          categories: ['freelance'],
          require_portfolio: false
        }
      },
      enabled: true,
      priority: 75
    }
  },
  {
    id: 'high_value_grants',
    name: 'High-Value Grants',
    description: 'Auto-queue grant applications with estimated value > $2000',
    icon: '🎁',
    config: {
      rule_name: 'High-Value Grant Auto-Queuer',
      description: 'Automatically queues significant grant opportunities for processing',
      source_department: 'Discovery',
      source_entity: 'Opportunity',
      source_event_type: 'create',
      condition_type: 'value_above',
      condition_field: 'profit_estimate_high',
      condition_operator: '>=',
      condition_value: 2000,
      target_department: 'Execution',
      target_task_type: 'auto_apply',
      target_task_config: {
        ai_agent: 'Autopilot',
        execution_mode: 'delayed',
        delay_minutes: 5,
        max_allocation: 5000,
        parameters: {
          categories: ['grant'],
          kyc_required: true,
          priority_boost: 'critical'
        }
      },
      enabled: true,
      priority: 85
    }
  },
  {
    id: 'urgent_deadline_sweep',
    name: 'Urgent Deadline Sweep',
    description: 'Auto-execute all opportunities expiring within 24 hours with profit > $50',
    icon: '⏰',
    config: {
      rule_name: 'Urgent Deadline Auto-Executor',
      description: 'Captures time-sensitive opportunities before they expire',
      source_department: 'Discovery',
      source_entity: 'Opportunity',
      source_event_type: 'update',
      condition_type: 'custom_field',
      condition_field: 'time_sensitivity',
      condition_operator: '==',
      condition_value: 'immediate',
      target_department: 'Execution',
      target_task_type: 'auto_apply',
      target_task_config: {
        ai_agent: 'Autopilot',
        execution_mode: 'immediate',
        delay_minutes: 0,
        max_allocation: 500,
        parameters: {
          min_profit: 50,
          skip_captcha_only: false,
          priority_boost: 'maximum'
        }
      },
      enabled: true,
      priority: 95
    }
  },
  {
    id: 'low_capital_service',
    name: 'Low-Capital Service Tasks',
    description: 'Auto-apply to service opportunities requiring < $50 capital with profit > $75',
    icon: '🔧',
    config: {
      rule_name: 'Low-Capital Service Auto-Applicant',
      description: 'Efficiently scales service-based income with minimal capital requirements',
      source_department: 'Discovery',
      source_entity: 'Opportunity',
      source_event_type: 'create',
      condition_type: 'value_below',
      condition_field: 'capital_required',
      condition_operator: '<=',
      condition_value: 50,
      target_department: 'Execution',
      target_task_type: 'auto_apply',
      target_task_config: {
        ai_agent: 'Autopilot',
        execution_mode: 'immediate',
        delay_minutes: 0,
        max_allocation: 300,
        parameters: {
          min_profit: 75,
          categories: ['service'],
          require_specialized_skills: false
        }
      },
      enabled: true,
      priority: 70
    }
  },
  {
    id: 'trending_market_capture',
    name: 'Trending Market Capture',
    description: 'Auto-queue trend-surge and market-inefficiency opportunities immediately',
    icon: '📈',
    config: {
      rule_name: 'Trending Market Opportunity Capture',
      description: 'Capitalizes on real-time market trends and inefficiencies',
      source_department: 'Discovery',
      source_entity: 'Opportunity',
      source_event_type: 'create',
      condition_type: 'status_change',
      condition_field: 'category',
      condition_operator: '==',
      condition_value: 'trend_surge',
      target_department: 'Execution',
      target_task_type: 'auto_apply',
      target_task_config: {
        ai_agent: 'Autopilot',
        execution_mode: 'immediate',
        delay_minutes: 0,
        max_allocation: 2000,
        parameters: {
          categories: ['trend_surge', 'market_inefficiency'],
          priority_boost: 'high',
          execute_immediately: true
        }
      },
      enabled: true,
      priority: 88
    }
  }
];

export default function AutoExecuteTemplateLibrary({ onTemplateApplied }) {
  const [applying, setApplying] = useState(null);
  const qc = useQueryClient();

  const createRuleMutation = useMutation({
    mutationFn: (ruleData) => base44.functions.invoke('createAutoExecuteRule', { rule: ruleData }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['autoExecuteRules'] });
      toast.success('Template rule created successfully');
      setApplying(null);
      onTemplateApplied?.();
    },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const handleApplyTemplate = (template) => {
    setApplying(template.id);
    createRuleMutation.mutate(template.config);
  };

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="font-orbitron text-sm font-bold text-white tracking-wide flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" /> Pre-Configured Templates
        </h3>
        <p className="text-xs text-slate-500 mt-1">Click any template to instantly create a configured auto-execute rule</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {TEMPLATES.map(template => (
          <div key={template.id} className="border border-slate-700/50 rounded-lg p-3.5 bg-slate-800/30 hover:bg-slate-800/50 transition-colors group">
            <div className="flex items-start gap-3 mb-2">
              <div className="text-2xl">{template.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white group-hover:text-cyan-300 transition-colors">{template.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{template.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-700/30">
              <Button
                size="sm"
                onClick={() => handleApplyTemplate(template)}
                disabled={applying === template.id || createRuleMutation.isPending}
                className="flex-1 h-7 gap-1.5 bg-cyan-600/80 hover:bg-cyan-600 text-white text-xs"
              >
                {applying === template.id ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" /> Apply Template
                  </>
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300">
        <p className="font-medium mb-1">💡 Pro Tip:</p>
        <p>Templates create enabled rules that start working immediately. You can edit or disable any rule from the Rules tab.</p>
      </div>
    </div>
  );
}