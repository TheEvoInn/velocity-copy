import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import WorkflowBuilder from './WorkflowBuilder';

const WIZARD_STEPS = [
  { id: 'basics', label: 'Basics', description: 'Template name & category' },
  { id: 'workflow', label: 'Workflow', description: 'Chain tasks together' },
  { id: 'settings', label: 'Settings', description: 'Configure execution' },
  { id: 'review', label: 'Review', description: 'Preview & save' },
];

export default function WorkflowWizard({ onClose, onSuccess }) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'general',
    difficulty: 'intermediate',
    icon: '⚙️',
    workflow: null,
    autopilot_config: {
      enabled: true,
      mode: 'continuous',
      execution_mode: 'review_required',
      max_concurrent_tasks: 3,
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const template = {
        ...formData,
        is_official: false,
        use_count: 0,
        estimated_daily_profit_low: 0,
        estimated_daily_profit_high: 0,
      };
      return base44.entities.WorkflowTemplate.create(template);
    },
    onSuccess: (newTemplate) => {
      toast.success(`✓ Custom template "${formData.name}" created!`);
      qc.invalidateQueries({ queryKey: ['workflowTemplates'] });
      onSuccess?.(newTemplate);
      onClose();
    },
    onError: (e) => toast.error(`Failed to save: ${e.message}`),
  });

  const handleNext = () => {
    if (step === 0 && !formData.name.trim()) {
      toast.error('Template name is required');
      return;
    }
    if (step === 1 && !formData.workflow?.tasks?.length) {
      toast.error('Add at least one task to your workflow');
      return;
    }
    if (step < WIZARD_STEPS.length - 1) setStep(step + 1);
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSave = () => {
    saveMutation.mutate();
  };

  const currentStep = WIZARD_STEPS[step];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-6">
          <h2 className="text-xl font-orbitron font-bold text-white mb-2">Create Custom Template</h2>
          <div className="flex gap-2">
            {WIZARD_STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setStep(i)}
                disabled={i > step}
                className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  i === step
                    ? 'bg-violet-600 text-white'
                    : i < step
                      ? 'bg-emerald-600/30 text-emerald-300'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {i < step ? <CheckCircle2 className="w-3 h-3 inline mr-1" /> : `${i + 1}`}
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Step 1: Basics */}
          {step === 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-white">What is your template called?</h3>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Premium Freelance Hunter"
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm"
              />

              <h3 className="text-sm font-semibold text-white mt-4">Brief description</h3>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="What does this template do? Who should use it?"
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm h-20 resize-none"
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400">Category</label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm mt-1"
                  >
                    <option value="general">General</option>
                    <option value="freelance">Freelance</option>
                    <option value="arbitrage">Arbitrage</option>
                    <option value="lead_gen">Lead Gen</option>
                    <option value="service">Service</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400">Difficulty</label>
                  <select
                    value={formData.difficulty}
                    onChange={e => setFormData({ ...formData, difficulty: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm mt-1"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Workflow */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-white">Build your workflow</h3>
              <p className="text-xs text-slate-400">Chain tasks together to create your automated sequence</p>
              <WorkflowBuilder
                onSave={workflow => setFormData({ ...formData, workflow })}
                initialWorkflow={formData.workflow}
              />
            </div>
          )}

          {/* Step 3: Settings */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-white">Execution Settings</h3>

              <div>
                <label className="text-xs text-slate-400">Mode</label>
                <select
                  value={formData.autopilot_config.mode}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      autopilot_config: { ...formData.autopilot_config, mode: e.target.value },
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm mt-1"
                >
                  <option value="continuous">Continuous (always running)</option>
                  <option value="scheduled">Scheduled (specific times)</option>
                  <option value="manual">Manual (user triggered)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400">Execution Level</label>
                <select
                  value={formData.autopilot_config.execution_mode}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      autopilot_config: { ...formData.autopilot_config, execution_mode: e.target.value },
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm mt-1"
                >
                  <option value="review_required">Review Required (safer)</option>
                  <option value="notification_only">Notification Only (alerts only)</option>
                  <option value="full_auto">Full Auto (hands-free)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400">Max Concurrent Tasks</label>
                <input
                  type="number"
                  value={formData.autopilot_config.max_concurrent_tasks}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      autopilot_config: {
                        ...formData.autopilot_config,
                        max_concurrent_tasks: parseInt(e.target.value),
                      },
                    })
                  }
                  min="1"
                  max="10"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm mt-1"
                />
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-white">Review Your Template</h3>
              <div className="bg-slate-800/50 rounded p-4 space-y-2 text-sm">
                <p>
                  <span className="text-slate-400">Name:</span> <span className="text-white">{formData.name}</span>
                </p>
                <p>
                  <span className="text-slate-400">Description:</span> <span className="text-white">{formData.description}</span>
                </p>
                <p>
                  <span className="text-slate-400">Category:</span> <span className="text-white capitalize">{formData.category}</span>
                </p>
                <p>
                  <span className="text-slate-400">Difficulty:</span> <span className="text-white capitalize">{formData.difficulty}</span>
                </p>
                <p>
                  <span className="text-slate-400">Tasks:</span> <span className="text-white">{formData.workflow?.tasks?.length || 0}</span>
                </p>
                <p>
                  <span className="text-slate-400">Mode:</span> <span className="text-white capitalize">{formData.autopilot_config.mode}</span>
                </p>
              </div>
              <p className="text-xs text-slate-500 italic">Everything looks good? Click "Create" below to save your template.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 p-6 flex gap-3 justify-between">
          <Button
            onClick={handlePrev}
            disabled={step === 0}
            variant="outline"
            className="text-xs h-8 gap-1"
          >
            <ChevronLeft className="w-3 h-3" />
            Back
          </Button>

          <div className="flex gap-2">
            <Button onClick={onClose} variant="ghost" className="text-xs h-8">
              Cancel
            </Button>
            {step < WIZARD_STEPS.length - 1 ? (
              <Button onClick={handleNext} className="bg-violet-600 hover:bg-violet-500 text-white text-xs h-8 gap-1">
                Next
                <ChevronRight className="w-3 h-3" />
              </Button>
            ) : (
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8"
              >
                {saveMutation.isPending ? 'Creating...' : 'Create Template'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}