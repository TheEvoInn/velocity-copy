import React, { useState } from 'react';
import { ChevronRight, Zap, Users, Mail, Workflow, CheckCircle2, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function StrategySetupWizard() {
  const [step, setStep] = useState(1); // 1-5
  const [strategyName, setStrategyName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [numIdentities, setNumIdentities] = useState(5);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);

  const PLATFORMS = [
    { id: 'upwork', name: 'Upwork', icon: '💼' },
    { id: 'fiverr', name: 'Fiverr', icon: '🎯' },
    { id: 'freelancer', name: 'Freelancer', icon: '👤' },
    { id: 'twitter', name: 'Twitter/X', icon: '𝕏' },
    { id: 'reddit', name: 'Reddit', icon: '🔴' },
    { id: 'github', name: 'GitHub', icon: '⚫' },
    { id: 'linkedin', name: 'LinkedIn', icon: '🔵' },
    { id: 'gmail', name: 'Gmail', icon: '📧' },
  ];

  const togglePlatform = (id) => {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleExecute = async () => {
    if (!strategyName || selectedPlatforms.length === 0 || numIdentities < 1) {
      alert('Please fill in all required fields');
      return;
    }

    setIsExecuting(true);
    try {
      const res = await base44.functions.invoke('bulkStrategyExecutor', {
        action: 'execute_strategy',
        strategy_name: strategyName,
        description,
        platforms: selectedPlatforms,
        num_identities: numIdentities,
        category: 'account_creation'
      });

      setExecutionResult(res.data);
      setStep(5);
    } catch (error) {
      alert(`Execution error: ${error.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-600 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-orbitron font-bold text-white tracking-wider">Strategy Setup Wizard</h1>
              <p className="text-sm text-slate-400">Bulk create identities, emails, and sign-up workflows</p>
            </div>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4, 5].map(s => (
            <div key={s} className="flex-1 flex items-center">
              <button
                onClick={() => s < step && setStep(s)}
                className={`w-10 h-10 rounded-full font-bold text-sm transition-all ${
                  s === step
                    ? 'bg-cyan-600 text-white scale-110'
                    : s < step
                    ? 'bg-emerald-600/30 text-emerald-400 cursor-pointer'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {s < step ? '✓' : s}
              </button>
              {s < 5 && (
                <div className={`flex-1 h-1 mx-2 rounded-full ${s < step ? 'bg-emerald-600/50' : 'bg-slate-800'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Define Strategy */}
        {step === 1 && (
          <div className="glass-card-bright p-6 space-y-4">
            <h2 className="text-xl font-orbitron text-white">Step 1: Define Strategy</h2>
            
            <div>
              <label className="text-xs text-slate-400 font-mono mb-2 block">STRATEGY NAME *</label>
              <input
                type="text"
                value={strategyName}
                onChange={(e) => setStrategyName(e.target.value)}
                placeholder="e.g., 10 New Social Accounts"
                className="w-full px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 font-mono mb-2 block">DESCRIPTION (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the strategy goal..."
                rows={3}
                className="w-full px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={() => setStep(2)}
                disabled={!strategyName}
                className="ml-auto px-6 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-black font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Select Platforms */}
        {step === 2 && (
          <div className="glass-card-bright p-6 space-y-4">
            <h2 className="text-xl font-orbitron text-white">Step 2: Select Platforms</h2>
            
            <p className="text-sm text-slate-400">Which platforms should the identities sign up on?</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {PLATFORMS.map(platform => (
                <button
                  key={platform.id}
                  onClick={() => togglePlatform(platform.id)}
                  className={`p-4 rounded-lg border transition-all ${
                    selectedPlatforms.includes(platform.id)
                      ? 'bg-cyan-600/20 border-cyan-500/50 text-cyan-300'
                      : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <div className="text-2xl mb-2">{platform.icon}</div>
                  <div className="text-xs font-semibold">{platform.name}</div>
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={selectedPlatforms.length === 0}
                className="ml-auto px-6 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-black font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Set Identity Count */}
        {step === 3 && (
          <div className="glass-card-bright p-6 space-y-4">
            <h2 className="text-xl font-orbitron text-white">Step 3: Number of Identities</h2>
            
            <p className="text-sm text-slate-400">How many unique identities should be created? Each will get its own email and accounts.</p>

            <div>
              <label className="text-xs text-slate-400 font-mono mb-3 block">IDENTITIES: {numIdentities}</label>
              <input
                type="range"
                min="1"
                max="50"
                value={numIdentities}
                onChange={(e) => setNumIdentities(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-2">
                <span>1</span>
                <span>50</span>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-cyan-600/10 border border-cyan-600/30 space-y-2">
              <p className="text-sm text-cyan-400 font-semibold">Execution Summary:</p>
              <ul className="text-xs text-cyan-300 space-y-1">
                <li>• {numIdentities} identities will be created</li>
                <li>• {numIdentities * selectedPlatforms.length} in-platform emails will be generated</li>
                <li>• {numIdentities * selectedPlatforms.length} sign-up workflows will be queued</li>
                <li>• All accounts synced to Identity Hub automatically</li>
              </ul>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(4)}
                className="ml-auto px-6 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-black font-bold text-sm transition-colors flex items-center gap-2"
              >
                Review & Execute <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Review & Execute */}
        {step === 4 && (
          <div className="glass-card-bright p-6 space-y-4">
            <h2 className="text-xl font-orbitron text-white">Step 4: Review & Execute</h2>
            
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700 space-y-2">
                <p className="text-xs text-slate-500 font-mono">STRATEGY</p>
                <p className="text-lg font-bold text-white">{strategyName}</p>
                {description && <p className="text-xs text-slate-400">{description}</p>}
              </div>

              <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-700 space-y-2">
                <p className="text-xs text-slate-500 font-mono">PLATFORMS ({selectedPlatforms.length})</p>
                <div className="flex flex-wrap gap-2">
                  {selectedPlatforms.map(pid => {
                    const platform = PLATFORMS.find(p => p.id === pid);
                    return (
                      <span key={pid} className="px-3 py-1 rounded-full bg-cyan-600/20 text-cyan-400 text-xs font-semibold">
                        {platform.icon} {platform.name}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-emerald-600/10 border border-emerald-600/30 space-y-2">
                <p className="text-xs text-emerald-400 font-mono">TOTAL WORKFLOWS TO QUEUE</p>
                <p className="text-3xl font-bold text-emerald-300">{numIdentities * selectedPlatforms.length}</p>
                <p className="text-xs text-emerald-300">{numIdentities} identities × {selectedPlatforms.length} platforms</p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-blue-600/10 border border-blue-600/30">
              <p className="text-xs text-blue-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Autopilot will autonomously execute all workflows. Monitor progress in the Execution Hub.</span>
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={() => setStep(3)}
                className="px-6 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleExecute}
                disabled={isExecuting}
                className="ml-auto px-8 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isExecuting ? 'Executing...' : 'Execute Strategy'}
                <Zap className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Execution Results */}
        {step === 5 && executionResult && (
          <div className="glass-card-bright p-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              <h2 className="text-xl font-orbitron text-white">Strategy Executed Successfully!</h2>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-emerald-600/10 border border-emerald-600/30 space-y-2">
                <p className="text-xs text-emerald-400 font-mono">RESULTS</p>
                <ul className="text-sm text-emerald-300 space-y-1 font-semibold">
                  <li>✓ Identities Created: <span className="text-emerald-200">{executionResult.identities_created}</span></li>
                  <li>✓ Emails Generated: <span className="text-emerald-200">{executionResult.emails_generated}</span></li>
                  <li>✓ Workflows Queued: <span className="text-emerald-200">{executionResult.workflows_queued}</span></li>
                </ul>
              </div>

              {executionResult.errors && executionResult.errors.length > 0 && (
                <div className="p-4 rounded-lg bg-orange-600/10 border border-orange-600/30 space-y-2">
                  <p className="text-xs text-orange-400 font-mono">WARNINGS</p>
                  <ul className="text-xs text-orange-300 space-y-1">
                    {executionResult.errors.slice(0, 3).map((err, i) => (
                      <li key={i}>⚠ {err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="p-4 rounded-lg bg-cyan-600/10 border border-cyan-600/30 space-y-2">
                <p className="text-xs text-cyan-400 font-mono">NEXT STEPS</p>
                <ul className="text-xs text-cyan-300 space-y-1">
                  <li>• All identities are now in the Identity Hub</li>
                  <li>• In-platform emails are ready in the Email Management Hub</li>
                  <li>• Sign-up workflows are queued in Autopilot</li>
                  <li>• Monitor execution in VeloAutopilotControl</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={() => {
                  setStep(1);
                  setStrategyName('');
                  setDescription('');
                  setSelectedPlatforms([]);
                  setNumIdentities(5);
                  setExecutionResult(null);
                }}
                className="ml-auto px-6 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-black font-bold text-sm transition-colors"
              >
                Create Another Strategy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}