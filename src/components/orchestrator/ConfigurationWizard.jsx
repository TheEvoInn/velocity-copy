/**
 * Configuration Wizard
 * Guided setup for multi-step automations with AI recommendations
 */
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { ChevronRight, Lightbulb, CheckCircle2, AlertCircle, Loader } from 'lucide-react';
import { toast } from 'sonner';

const WIZARD_STEPS = [
  { id: 'intro', label: 'Overview', icon: '📋' },
  { id: 'recommendations', label: 'Recommendations', icon: '💡' },
  { id: 'select', label: 'Select Automation', icon: '✓' },
  { id: 'customize', label: 'Customize', icon: '⚙️' },
  { id: 'review', label: 'Review & Deploy', icon: '🚀' },
];

export default function ConfigurationWizard({ onComplete }) {
  const [currentStep, setCurrentStep] = useState('intro');
  const [userContext, setUserContext] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [selectedAutomation, setSelectedAutomation] = useState(null);
  const [customConfig, setCustomConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user context
  useEffect(() => {
    const loadContext = async () => {
      try {
        const res = await base44.functions.invoke('taskOrchestratorEngine', {
          action: 'get_user_context'
        });
        setUserContext(res.data?.user_context);

        // Generate recommendations
        const recRes = await base44.functions.invoke('taskOrchestratorEngine', {
          action: 'generate_recommendations',
          payload: res.data?.user_context
        });
        setRecommendations(recRes.data?.recommendations || []);
      } catch (err) {
        console.error('Failed to load context:', err);
        toast.error('Failed to load user context');
      } finally {
        setLoading(false);
      }
    };

    loadContext();
  }, []);

  // Create automation mutation
  const createMutation = useMutation({
    mutationFn: async (config) => {
      const res = await base44.functions.invoke('taskOrchestratorEngine', {
        action: 'create_automation_from_wizard',
        payload: {
          automation_config: config,
          user_preferences: userContext?.preferences
        }
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Automation "${data.automation.trigger_name}" created successfully`);
      onComplete?.();
    },
    onError: (err) => {
      toast.error('Failed to create automation: ' + err.message);
    }
  });

  const handleSelectAutomation = (automation) => {
    setSelectedAutomation(automation);
    setCustomConfig({ ...automation });
    setCurrentStep('customize');
  };

  const handleDeploy = () => {
    if (selectedAutomation) {
      createMutation.mutate(customConfig || selectedAutomation);
    }
  };

  const steps = {
    intro: <StepIntro onNext={() => setCurrentStep('recommendations')} />,
    recommendations: (
      <StepRecommendations
        recommendations={recommendations}
        loading={loading}
        onSelect={handleSelectAutomation}
      />
    ),
    customize: (
      <StepCustomize
        automation={selectedAutomation}
        config={customConfig}
        setConfig={setCustomConfig}
        onNext={() => setCurrentStep('review')}
        onBack={() => setCurrentStep('recommendations')}
      />
    ),
    review: (
      <StepReview
        automation={customConfig}
        isLoading={createMutation.isPending}
        onDeploy={handleDeploy}
        onBack={() => setCurrentStep('customize')}
      />
    ),
  };

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {WIZARD_STEPS.map((step, idx) => (
          <React.Fragment key={step.id}>
            <button
              onClick={() => setCurrentStep(step.id)}
              disabled={!steps[step.id]}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
                currentStep === step.id
                  ? 'bg-violet-500/20 border border-violet-500/50 text-violet-300'
                  : 'bg-slate-800/50 border border-slate-700 text-slate-400 hover:text-slate-300'
              }`}
            >
              <span className="text-lg">{step.icon}</span>
              <span className="text-xs font-medium">{step.label}</span>
            </button>
            {idx < WIZARD_STEPS.length - 1 && (
              <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <Card className="p-6 bg-slate-900/50 border-slate-800 min-h-96">
        {steps[currentStep] || (
          <div className="flex flex-col items-center justify-center h-80">
            <AlertCircle className="w-8 h-8 text-slate-500 mb-3" />
            <p className="text-slate-400">Step not found</p>
          </div>
        )}
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => {
            const stepIdx = WIZARD_STEPS.findIndex(s => s.id === currentStep);
            if (stepIdx > 0) setCurrentStep(WIZARD_STEPS[stepIdx - 1].id);
          }}
          disabled={currentStep === 'intro'}
        >
          Back
        </Button>
        {currentStep !== 'review' && (
          <Button
            onClick={() => {
              const stepIdx = WIZARD_STEPS.findIndex(s => s.id === currentStep);
              if (stepIdx < WIZARD_STEPS.length - 1) {
                setCurrentStep(WIZARD_STEPS[stepIdx + 1].id);
              }
            }}
            className="bg-violet-600 hover:bg-violet-500"
          >
            Next
          </Button>
        )}
      </div>
    </div>
  );
}

function StepIntro({ onNext }) {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/30">
        <p className="text-sm text-violet-200 flex items-start gap-3">
          <Lightbulb className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>
            This wizard will guide you through creating multi-step automations that coordinate actions across departments. 
            You can use AI-recommended templates or build custom workflows.
          </span>
        </p>
      </div>

      <div className="space-y-3 mt-6">
        <h3 className="text-sm font-semibold text-white">What you can automate:</h3>
        <ul className="space-y-2">
          {[
            'Launch storefronts when new niches are discovered',
            'Allocate budget to marketing based on performance',
            'Stake profits automatically in crypto yield programs',
            'Scale execution tasks when targets are exceeded',
            'Claim airdrops and manage portfolio rebalancing'
          ].map((item, idx) => (
            <li key={idx} className="flex items-center gap-2 text-sm text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <Button onClick={onNext} className="w-full mt-6 bg-violet-600 hover:bg-violet-500">
        Get Started
      </Button>
    </div>
  );
}

function StepRecommendations({ recommendations, loading, onSelect }) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-3">
        <Loader className="w-8 h-8 text-violet-400 animate-spin" />
        <p className="text-slate-400">Analyzing your preferences...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white mb-2">Recommended Automations</h3>
        <p className="text-xs text-slate-400">Based on your configuration and activity patterns</p>
      </div>

      <div className="space-y-3">
        {recommendations.map((rec) => (
          <Card
            key={rec.id}
            className="p-4 bg-slate-800/50 border-slate-700 hover:border-violet-500/50 cursor-pointer transition-all hover:bg-slate-800"
            onClick={() => onSelect(rec)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-white text-sm">{rec.title}</h4>
                  {rec.recommended && (
                    <Badge className="text-xs bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                      Recommended
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-400 mb-3">{rec.description}</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge variant="secondary" className="text-xs">
                    ROI: {rec.estimated_roi}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {rec.complexity}
                  </Badge>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-500 flex-shrink-0 mt-1" />
            </div>
          </Card>
        ))}
      </div>

      {recommendations.length === 0 && (
        <p className="text-center text-slate-400 py-8">No recommendations available. You can still create a custom automation.</p>
      )}
    </div>
  );
}

function StepCustomize({ automation, config, setConfig, onNext, onBack }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white mb-1">{automation?.title}</h3>
        <p className="text-xs text-slate-400">{automation?.description}</p>
      </div>

      <div className="space-y-3">
        {config?.actions?.map((action, idx) => (
          <Card key={idx} className="p-3 bg-slate-800/50 border-slate-700">
            <div className="text-xs">
              <p className="font-semibold text-white mb-1">
                {action.system}: {action.action}
              </p>
              <p className="text-slate-400">{JSON.stringify(action.params)}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex gap-3 mt-6">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button onClick={onNext} className="flex-1 bg-violet-600 hover:bg-violet-500">
          Continue to Review
        </Button>
      </div>
    </div>
  );
}

function StepReview({ automation, isLoading, onDeploy, onBack }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-white">{automation?.title}</h3>

      <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
        <p className="text-xs text-slate-300 font-mono whitespace-pre-wrap">
          {JSON.stringify(automation, null, 2)}
        </p>
      </div>

      <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
        <p className="text-sm text-emerald-200 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>Ready to deploy. This automation will be immediately active and integrated with your system.</span>
        </p>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1" disabled={isLoading}>
          Back
        </Button>
        <Button
          onClick={onDeploy}
          className="flex-1 bg-emerald-600 hover:bg-emerald-500"
          disabled={isLoading}
        >
          {isLoading ? 'Deploying...' : 'Deploy Automation'}
        </Button>
      </div>
    </div>
  );
}