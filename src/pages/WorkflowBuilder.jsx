import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Zap, Wand2, Eye, Settings, Save, AlertCircle, Lightbulb, Play, Pause, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import WorkflowDragDrop from '@/components/workflow/WorkflowDragDrop';
import WorkflowConditionBuilder from '@/components/workflow/WorkflowConditionBuilder';
import WorkflowWizard from '@/components/workflow/WorkflowWizard';
import { generateWorkflowRecommendations } from '@/services/recommendationEngine';
import { motion } from 'framer-motion';

const DEFAULT_STRATEGY = {
  name: '',
  description: '',
  blocks: [],
  conditions: [],
  maxConcurrentTasks: 3,
  maxDailySpend: 500,
  targetPlatforms: ['all'],
  enabled: false,
};

export default function WorkflowBuilder() {
  const qc = useQueryClient();
  const [mode, setMode] = useState('builder'); // 'builder', 'wizard', 'preview'
  const [strategy, setStrategy] = useState(DEFAULT_STRATEGY);
  const [recommendations, setRecommendations] = useState([]);
  const [configureBlockId, setConfigureBlockId] = useState(null);
  const [showWizard, setShowWizard] = useState(false);

  // Load custom strategies
  const { data: strategies = [], refetch: refetchStrategies } = useQuery({
    queryKey: ['customStrategies'],
    queryFn: () => base44.entities.Strategy.list('-created_date', 20),
  });

  // Load recommendations on mount
  useEffect(() => {
    const loadRecommendations = async () => {
      const recs = await generateWorkflowRecommendations();
      setRecommendations(recs);
    };
    loadRecommendations();
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!strategy.name?.trim()) {
        throw new Error('Please enter a strategy name before saving');
      }
      const payload = {
        title: strategy.name,
        description: strategy.description,
        variant: strategy.variant || 'fastest',
        status: 'active',
        steps: strategy.blocks?.map((b, i) => ({ day: String(i + 1), action: b.label, expected_outcome: '', completed: false })) || [],
        categories: strategy.targetPlatforms || [],
        performance_notes: JSON.stringify({
          conditions: strategy.conditions,
          maxConcurrentTasks: strategy.maxConcurrentTasks,
          maxDailySpend: strategy.maxDailySpend,
          blocks: strategy.blocks,
        }),
      };
      if (strategy.id) {
        return base44.entities.Strategy.update(strategy.id, payload);
      } else {
        return base44.entities.Strategy.create(payload);
      }
    },
    onSuccess: (saved) => {
      toast.success('Strategy saved and activated!');
      qc.invalidateQueries({ queryKey: ['customStrategies'] });
      refetchStrategies();
      // Keep current strategy loaded, just update its id
      if (saved?.id) setStrategy(prev => ({ ...prev, id: saved.id }));
    },
    onError: e => toast.error(e.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, currentStatus }) => {
      return base44.entities.Strategy.update(id, { status: currentStatus === 'active' ? 'paused' : 'active' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customStrategies'] });
      refetchStrategies();
      toast.success('Strategy updated!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => base44.entities.Strategy.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customStrategies'] });
      refetchStrategies();
      toast.success('Strategy deleted.');
    },
  });

  const applyRecommendation = (rec) => {
    let updatedStrategy = { ...strategy };

    rec.actions.forEach(action => {
      if (action.type === 'filter') {
        updatedStrategy.targetPlatforms = action.config.platforms;
      } else if (action.type === 'condition') {
        updatedStrategy.conditions = [...(updatedStrategy.conditions || []), { id: Date.now(), ...action.config }];
      } else if (action.type === 'config') {
        updatedStrategy.maxConcurrentTasks = action.config.max_concurrent_tasks;
        updatedStrategy.maxDailySpend = action.config.max_spend || 500;
      }
    });

    setStrategy(updatedStrategy);
    toast.success(`Applied: ${rec.title}`);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-orbitron text-lg md:text-2xl font-bold tracking-widest text-white flex items-center gap-2">
            <Zap className="w-5 h-5 md:w-6 md:h-6 text-cyan-400" />
            WORKFLOW BUILDER
          </h1>
          <p className="text-xs text-slate-500 tracking-wide mt-1">Create custom autopilot strategies</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => setMode(mode === 'wizard' ? 'builder' : 'wizard')}
            size="sm"
            className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 gap-1.5 text-xs"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{mode === 'wizard' ? 'Advanced Mode' : 'Wizard Mode'}</span>
            <span className="sm:hidden">{mode === 'wizard' ? 'Advanced' : 'Wizard'}</span>
          </Button>
          {strategy.id && (
            <Button
              onClick={() => setStrategy(DEFAULT_STRATEGY)}
              variant="outline"
              size="sm"
              className="border-slate-600 text-slate-400 hover:text-white text-xs"
            >
              + New
            </Button>
          )}
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 text-xs"
          >
            <Save className="w-3.5 h-3.5" />
            {saveMutation.isPending ? 'Saving...' : strategy.id ? 'Update' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
        {['builder', 'wizard', 'preview'].map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              mode === m
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 border border-slate-700'
            }`}
          >
            {m === 'builder' && '🎨 Builder'}
            {m === 'wizard' && '✨ Wizard'}
            {m === 'preview' && '👁️ Preview'}
          </button>
        ))}
      </div>

      {/* Main Content */}
      {mode === 'builder' && (
        <div className="space-y-6">
          {/* Strategy Name & Description */}
          <div className="p-4 rounded-lg border border-slate-700 bg-slate-900/50">
            <input
              type="text"
              placeholder="Strategy name (e.g., 'Upwork High-Value Focus')"
              value={strategy.name}
              onChange={e => setStrategy({ ...strategy, name: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm mb-3"
            />
            <textarea
              placeholder="What does this strategy do?"
              value={strategy.description}
              onChange={e => setStrategy({ ...strategy, description: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm h-20"
            />
          </div>

          {/* Recommendations Panel */}
          {recommendations.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/10"
            >
              <div className="flex items-start gap-3 mb-3">
                <Lightbulb className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-amber-200 text-sm">AI-Powered Recommendations</h3>
                  <p className="text-xs text-amber-300/70">Based on your activity patterns and goals</p>
                </div>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {recommendations.slice(0, 3).map(rec => (
                  <div key={rec.id} className="p-3 bg-slate-800/50 rounded border border-slate-700 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white text-sm">{rec.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{rec.description}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => applyRecommendation(rec)}
                      className="bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/30 text-xs shrink-0"
                    >
                      Apply
                    </Button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Drag-Drop Builder */}
          <div>
            <h3 className="font-semibold text-white text-sm mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              Define Workflow Blocks
            </h3>
            <WorkflowDragDrop
              blocks={strategy.blocks}
              onUpdate={blocks => setStrategy({ ...strategy, blocks })}
              onConfigureBlock={setConfigureBlockId}
            />
          </div>

          {/* Conditions */}
          <div>
            <h3 className="font-semibold text-white text-sm mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-purple-400" />
              Conditional Logic (If-Then Rules)
            </h3>
            <WorkflowConditionBuilder
              conditions={strategy.conditions}
              onUpdate={conditions => setStrategy({ ...strategy, conditions })}
            />
          </div>

          {/* Settings */}
          <div className="p-4 rounded-lg border border-slate-700 bg-slate-900/50">
            <h3 className="font-semibold text-white text-sm mb-3 flex items-center gap-2">
              <Settings className="w-4 h-4" /> Execution Settings
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-2">Max Concurrent Tasks</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={strategy.maxConcurrentTasks}
                  onChange={e => setStrategy({ ...strategy, maxConcurrentTasks: parseInt(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-2">Max Daily Spend ($)</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={strategy.maxDailySpend}
                  onChange={e => setStrategy({ ...strategy, maxDailySpend: parseInt(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-2">Target Platforms</label>
                <select
                  multiple
                  value={strategy.targetPlatforms}
                  onChange={e => setStrategy({ ...strategy, targetPlatforms: Array.from(e.target.selectedOptions, o => o.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm"
                >
                  <option value="all">All Platforms</option>
                  <option value="upwork">Upwork</option>
                  <option value="fiverr">Fiverr</option>
                  <option value="ebay">eBay</option>
                  <option value="freelancer">Freelancer</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {mode === 'wizard' && (
        <WorkflowWizard
          onComplete={newStrategy => {
            setStrategy(newStrategy);
            setMode('builder');
            toast.success('Workflow created! Review and save when ready.');
          }}
        />
      )}

      {mode === 'preview' && (
        <div className="p-6 rounded-lg border border-slate-700 bg-slate-900/50">
          <h3 className="font-semibold text-white text-lg mb-4">Strategy Preview</h3>
          <pre className="bg-slate-800 rounded p-4 text-slate-300 text-xs overflow-auto max-h-96">
            {JSON.stringify(strategy, null, 2)}
          </pre>
        </div>
      )}

      {/* Saved Strategies */}
      {strategies.length > 0 && (
        <div className="mt-8 pt-8 border-t border-slate-700">
          <h2 className="font-orbitron text-lg font-bold text-white mb-4">Your Strategies</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {strategies.map(s => (
              <div key={s.id}
                className={`p-4 rounded-lg border bg-slate-900/50 transition-colors ${
                  strategy.id === s.id ? 'border-cyan-500/60' : 'border-slate-700 hover:border-cyan-500/30'
                }`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-semibold text-white text-sm cursor-pointer hover:text-cyan-300 transition-colors"
                    onClick={() => {
                      const meta = s.performance_notes ? JSON.parse(s.performance_notes) : {};
                      setStrategy({ id: s.id, name: s.title, description: s.description, variant: s.variant, blocks: meta.blocks || [], conditions: meta.conditions || [], maxConcurrentTasks: meta.maxConcurrentTasks || 3, maxDailySpend: meta.maxDailySpend || 500, targetPlatforms: s.categories || ['all'] });
                      setMode('builder');
                    }}>
                    {s.title}
                  </p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-orbitron shrink-0 ${
                    s.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700/50 text-slate-500 border border-slate-600/30'
                  }`}>
                    {s.status || 'draft'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{s.description}</p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/60">
                  <span className="text-xs text-slate-500">{s.variant} · {s.categories?.join(', ') || 'all'}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => toggleActiveMutation.mutate({ id: s.id, currentStatus: s.status })}
                      className={`p-1.5 rounded transition-colors ${s.status === 'active' ? 'text-amber-400 hover:bg-amber-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'}`}
                      title={s.status === 'active' ? 'Pause strategy' : 'Activate strategy'}
                    >
                      {s.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(s.id)}
                      className="p-1.5 rounded text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete strategy"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}