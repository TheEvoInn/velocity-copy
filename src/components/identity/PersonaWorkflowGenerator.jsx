/**
 * PersonaWorkflowGenerator
 * Reads bio + skills from the active AIIdentity and uses LLM to generate
 * specialized WorkflowTemplate records that Autopilot can select autonomously.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { Sparkles, Zap, Trash2, CheckCircle, AlertCircle, RefreshCw, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

const CATEGORY_COLORS = {
  freelance: '#14b8a6', service: '#22c55e', arbitrage: '#f59e0b',
  lead_gen: '#0ea5e9', grant: '#8b5cf6', resale: '#f97316',
  digital_flip: '#a855f7', general: '#94a3b8',
};

export default function PersonaWorkflowGenerator({ activeIdentity }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [deployingId, setDeployingId] = useState(null);

  // Load all workflow templates generated for this identity
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['workflowTemplates', activeIdentity?.id],
    queryFn: () => base44.entities.WorkflowTemplate.filter(
      { created_by: user?.email },
      '-created_date',
      50
    ).then(all => all.filter(t => t.tags?.includes(`identity:${activeIdentity?.id}`))),
    enabled: !!user?.email && !!activeIdentity?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WorkflowTemplate.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflowTemplates', activeIdentity?.id] });
      qc.invalidateQueries({ queryKey: ['workflowTemplates'] });
      toast.success('Template removed');
    },
  });

  async function generateTemplates() {
    if (!activeIdentity?.bio && !activeIdentity?.skills?.length) {
      toast.error('Add a bio and skills to the active identity first.');
      return;
    }

    setGenerating(true);
    try {
      const bio = activeIdentity.bio || '';
      const skills = (activeIdentity.skills || []).join(', ');
      const role = activeIdentity.role_label || activeIdentity.tagline || '';
      const tone = activeIdentity.communication_tone || 'professional';
      const platforms = (activeIdentity.preferred_platforms || []).join(', ') || 'upwork, fiverr, freelancer';
      const categories = (activeIdentity.preferred_categories || []).join(', ') || 'freelance, service';

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert autonomous income strategist for the VELO AI platform.

PERSONA DATA:
- Name: ${activeIdentity.name}
- Role: ${role}
- Bio: ${bio}
- Skills: ${skills}
- Communication Tone: ${tone}
- Preferred Platforms: ${platforms}
- Preferred Categories: ${categories}

Generate exactly 5 highly specific, actionable Workflow Templates that Autopilot can execute autonomously for this persona.

Each template must:
1. Directly leverage the persona's specific skills and bio context
2. Be executable without user intervention
3. Target real, profitable online opportunities
4. Have realistic daily profit estimates based on the skill set
5. Include concrete autopilot configuration

Return ONLY a JSON object with a "templates" array. Each template object must have exactly these fields:
{
  "name": "Template display name (specific to their skills)",
  "description": "Exactly what Autopilot will do autonomously - be specific",
  "platform": "primary platform (upwork/fiverr/freelancer/multi/ebay/linkedin/etsy)",
  "category": "one of: freelance, service, arbitrage, lead_gen, grant, resale, digital_flip, general",
  "difficulty": "one of: beginner, intermediate, advanced",
  "icon": "single relevant emoji",
  "color": "hex color like #14b8a6",
  "estimated_daily_profit_low": number,
  "estimated_daily_profit_high": number,
  "autopilot_config": {
    "enabled": true,
    "mode": "continuous or scheduled",
    "execution_mode": "full_auto or review_required or notification_only",
    "max_concurrent_tasks": number (1-8),
    "max_daily_spend": number,
    "preferred_categories": ["category1"]
  },
  "execution_rules": {
    "minimum_profit_threshold": number,
    "minimum_success_probability": number
  },
  "goals_config": {
    "risk_tolerance": "conservative or moderate or aggressive"
  },
  "setup_steps": ["Step 1", "Step 2", "Step 3"]
}`,
        response_json_schema: {
          type: 'object',
          properties: {
            templates: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  platform: { type: 'string' },
                  category: { type: 'string' },
                  difficulty: { type: 'string' },
                  icon: { type: 'string' },
                  color: { type: 'string' },
                  estimated_daily_profit_low: { type: 'number' },
                  estimated_daily_profit_high: { type: 'number' },
                  autopilot_config: { type: 'object' },
                  execution_rules: { type: 'object' },
                  goals_config: { type: 'object' },
                  setup_steps: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
      });

      const generated = result?.templates || [];
      if (!generated.length) throw new Error('No templates returned from AI');

      // Save each as a WorkflowTemplate entity with identity tag
      let saved = 0;
      for (const tpl of generated) {
        await base44.entities.WorkflowTemplate.create({
          ...tpl,
          tags: [`identity:${activeIdentity.id}`, `persona:${activeIdentity.name}`, ...(tpl.tags || [])],
          is_official: false,
          use_count: 0,
          rating: 0,
        });
        saved++;
      }

      qc.invalidateQueries({ queryKey: ['workflowTemplates', activeIdentity.id] });
      qc.invalidateQueries({ queryKey: ['workflowTemplates'] }); // sync TemplatesLibrary
      toast.success(`✓ ${saved} specialized templates generated for ${activeIdentity.name}`);
    } catch (err) {
      console.error('[PersonaWorkflowGenerator] Error:', err);
      toast.error('Generation failed: ' + (err.message || 'Unknown error'));
    } finally {
      setGenerating(false);
    }
  }

  async function deployTemplate(template) {
    setDeployingId(template.id);
    try {
      const me = await base44.auth.me();

      // Load or create UserDataStore
      const stores = await base44.entities.UserDataStore.filter({ user_email: me.email });
      const store = stores[0] || null;

      const newAutopilotPrefs = {
        ...(store?.autopilot_preferences || {}),
        ...(template.autopilot_config || {}),
        active_template_id: template.id,
        active_template_name: template.name,
      };
      const newExecutionRules = {
        ...(store?.execution_rules || {}),
        ...(template.execution_rules || {}),
      };

      if (store) {
        await base44.entities.UserDataStore.update(store.id, {
          autopilot_preferences: newAutopilotPrefs,
          execution_rules: newExecutionRules,
        });
      } else {
        await base44.entities.UserDataStore.create({
          user_email: me.email,
          autopilot_preferences: newAutopilotPrefs,
          execution_rules: newExecutionRules,
        });
      }

      // Apply goals config
      if (template.goals_config) {
        const goals = await base44.entities.UserGoals.filter({ created_by: me.email });
        if (goals[0]) {
          await base44.entities.UserGoals.update(goals[0].id, template.goals_config);
        }
      }

      // Create a Strategy record for visibility in WorkflowBuilder
      const existing = await base44.entities.Strategy.filter({ title: template.name });
      const strategyPayload = {
        title: template.name,
        description: template.description,
        variant: template.autopilot_config?.execution_mode === 'full_auto'
          ? 'fastest'
          : template.goals_config?.risk_tolerance === 'conservative'
            ? 'safest' : 'highest_yield',
        status: 'active',
        categories: template.autopilot_config?.preferred_categories || [template.category],
        steps: (template.setup_steps || []).map((action, i) => ({
          day: `Step ${i + 1}`, action, expected_outcome: '', completed: false,
        })),
        performance_notes: `Auto-generated for persona: ${activeIdentity.name}. Skills: ${(activeIdentity.skills || []).join(', ')}.`,
      };
      if (existing.length) {
        await base44.entities.Strategy.update(existing[0].id, strategyPayload);
      } else {
        await base44.entities.Strategy.create(strategyPayload);
      }

      // Increment use_count
      await base44.entities.WorkflowTemplate.update(template.id, {
        use_count: (template.use_count || 0) + 1,
      });

      // Notify via ActivityLog
      await base44.entities.ActivityLog.create({
        action_type: 'strategy_generated',
        message: `Persona workflow "${template.name}" deployed to Autopilot for identity ${activeIdentity.name}`,
        severity: 'success',
        metadata: { template_id: template.id, identity_id: activeIdentity.id },
      });

      qc.invalidateQueries({ queryKey: ['workflowTemplates'] });
      qc.invalidateQueries({ queryKey: ['userDataStore_templates'] });
      qc.invalidateQueries({ queryKey: ['strategies'] });
      qc.invalidateQueries({ queryKey: ['userGoals'] });

      toast.success(`⚡ "${template.name}" is now active in Autopilot`);
    } catch (err) {
      toast.error('Deploy failed: ' + (err.message || 'Unknown error'));
    } finally {
      setDeployingId(null);
    }
  }

  if (!activeIdentity) {
    return (
      <Card className="glass-card">
        <CardContent className="text-center py-12">
          <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No active identity selected.</p>
          <p className="text-xs text-slate-500 mt-1">Activate an identity to generate persona workflows.</p>
        </CardContent>
      </Card>
    );
  }

  const hasBioOrSkills = !!(activeIdentity.bio || activeIdentity.skills?.length);

  return (
    <div className="space-y-5">
      {/* Identity Context Card */}
      <div className="rounded-2xl p-5"
        style={{ background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.25)' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-xl">{activeIdentity.icon || '👤'}</div>
              <div>
                <span className="font-orbitron text-sm font-bold text-white">{activeIdentity.name}</span>
                <span className="ml-2 text-xs text-slate-500">{activeIdentity.role_label || ''}</span>
              </div>
              <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">ACTIVE</span>
            </div>

            {activeIdentity.bio && (
              <p className="text-xs text-slate-400 mb-3 leading-relaxed line-clamp-2">{activeIdentity.bio}</p>
            )}

            {activeIdentity.skills?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {activeIdentity.skills.map(s => (
                  <span key={s} className="px-2 py-0.5 text-[10px] rounded-full bg-indigo-500/12 border border-indigo-500/25 text-indigo-300">{s}</span>
                ))}
              </div>
            )}

            {!hasBioOrSkills && (
              <div className="flex items-center gap-2 text-amber-400 text-xs">
                <AlertCircle className="w-4 h-4" />
                Add a bio and skills to this identity to enable AI workflow generation.
              </div>
            )}
          </div>

          <Button
            onClick={generateTemplates}
            disabled={generating || !hasBioOrSkills}
            className="shrink-0 gap-2 font-orbitron text-xs tracking-wide"
            style={{
              background: generating ? 'rgba(129,140,248,0.2)' : 'linear-gradient(135deg, #818cf8, #06b6d4)',
              color: 'white',
            }}
          >
            {generating ? (
              <><RefreshCw className="w-4 h-4 animate-spin" />Generating...</>
            ) : (
              <><Sparkles className="w-4 h-4" />Generate Workflows</>
            )}
          </Button>
        </div>
      </div>

      {/* Generated Templates */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-2xl p-10 text-center"
          style={{ background: 'rgba(10,15,42,0.5)', border: '1px dashed rgba(129,140,248,0.2)' }}>
          <Sparkles className="w-12 h-12 text-indigo-400/30 mx-auto mb-3" />
          <p className="font-orbitron text-sm text-slate-500 tracking-wide mb-1">No Persona Workflows Yet</p>
          <p className="text-xs text-slate-600 max-w-xs mx-auto">
            Click "Generate Workflows" to let NEXUS AI analyze your identity profile and create
            specialized Autopilot templates tailored to your skills.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-orbitron text-slate-500 tracking-widest">
              {templates.length} PERSONA-SPECIFIC TEMPLATES
            </p>
            <button
              onClick={generateTemplates}
              disabled={generating}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${generating ? 'animate-spin' : ''}`} />
              Regenerate
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map(template => {
              const color = template.color || CATEGORY_COLORS[template.category] || '#818cf8';
              const isDeploying = deployingId === template.id;
              return (
                <div key={template.id} className="rounded-2xl p-4 transition-all"
                  style={{ background: 'rgba(10,15,42,0.75)', border: `1px solid ${color}22` }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}55`; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = `${color}22`; }}>

                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{template.icon || '⚡'}</span>
                      <div>
                        <div className="font-orbitron text-sm font-bold text-white leading-tight">{template.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full capitalize"
                            style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
                            {template.category?.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] text-slate-600 capitalize">{template.difficulty}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteMutation.mutate(template.id)}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-400 mb-3 leading-relaxed">{template.description}</p>

                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs">
                      <span className="text-slate-600">Est. Daily: </span>
                      <span className="font-semibold" style={{ color }}>
                        ${template.estimated_daily_profit_low}–${template.estimated_daily_profit_high}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-600">
                      {template.autopilot_config?.execution_mode && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800/60 border border-slate-700/40 capitalize">
                          {template.autopilot_config.execution_mode.replace('_', ' ')}
                        </span>
                      )}
                      {template.autopilot_config?.mode && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800/60 border border-slate-700/40 capitalize">
                          {template.autopilot_config.mode}
                        </span>
                      )}
                    </div>
                  </div>

                  {template.setup_steps?.length > 0 && (
                    <div className="mb-3 space-y-1">
                      {template.setup_steps.slice(0, 2).map((step, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <CheckCircle className="w-3 h-3 text-slate-600 shrink-0 mt-0.5" />
                          <span className="text-[10px] text-slate-600">{step}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    size="sm"
                    onClick={() => deployTemplate(template)}
                    disabled={isDeploying}
                    className="w-full gap-1.5 font-orbitron text-xs tracking-wide h-8"
                    style={{ background: `linear-gradient(135deg, ${color}cc, ${color}88)`, color: '#000', fontWeight: 700 }}
                  >
                    {isDeploying ? (
                      <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Deploying...</>
                    ) : (
                      <><Zap className="w-3.5 h-3.5" />Deploy to Autopilot</>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}