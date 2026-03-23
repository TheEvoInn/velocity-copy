import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const WIZARD_STEPS = [
  {
    id: 'goal',
    title: 'What\'s Your Goal?',
    description: 'What would you like your autopilot to focus on?',
    options: [
      { value: 'income', label: '💰 Maximize income', icon: '💵' },
      { value: 'consistency', label: '📊 Consistent daily earnings', icon: '📈' },
      { value: 'capital_building', label: '🏦 Build capital for investing', icon: '💎' },
      { value: 'passive', label: '😎 Passive income stream', icon: '🌴' },
    ],
  },
  {
    id: 'source_category',
    title: 'Where Should We Look?',
    description: 'Pick the types of opportunity sources to scan',
    options: [
      { value: 'freelance', label: '💼 Freelance Platforms', subtitle: 'Upwork, Fiverr, Freelancer, Toptal, Guru' },
      { value: 'prizes', label: '🏆 Prizes & Giveaways', subtitle: 'Contests, sweepstakes, beta rewards, raffles' },
      { value: 'grants', label: '🏛️ Grants & Funding', subtitle: 'Government grants, non-profit funding, startup awards' },
      { value: 'resale', label: '📦 Resale & Arbitrage', subtitle: 'eBay, Amazon flips, Craigslist, Facebook Marketplace' },
      { value: 'crypto', label: '🪙 Crypto & DeFi Yield', subtitle: 'Staking, liquidity pools, airdrops, mining' },
      { value: 'surveys', label: '📋 Surveys & Micro-Tasks', subtitle: 'MTurk, Prolific, UserTesting, Swagbucks' },
      { value: 'affiliate', label: '🔗 Affiliate & Referrals', subtitle: 'Signup bonuses, referral programs, cashback' },
      { value: 'digital', label: '🛍️ Digital Commerce', subtitle: 'Etsy, Gumroad, Sellfy, digital product sales' },
    ],
    multi: true,
  },
  {
    id: 'platforms',
    title: 'Specific Platforms',
    description: 'Fine-tune which specific sites to target within your selected categories',
    options: [
      { value: 'upwork', label: 'Upwork', icon: '💼', subtitle: 'Freelance jobs' },
      { value: 'fiverr', label: 'Fiverr', icon: '🎨', subtitle: 'Gig services' },
      { value: 'freelancer', label: 'Freelancer.com', icon: '🚀', subtitle: 'Project bids' },
      { value: 'toptal', label: 'Toptal', icon: '⭐', subtitle: 'Elite freelance' },
      { value: 'ebay', label: 'eBay', icon: '📦', subtitle: 'Resale & auctions' },
      { value: 'amazon', label: 'Amazon FBA', icon: '🛒', subtitle: 'Product selling' },
      { value: 'etsy', label: 'Etsy', icon: '🎁', subtitle: 'Handmade & digital' },
      { value: 'grants_gov', label: 'Grants.gov', icon: '🏛️', subtitle: 'US gov grants' },
      { value: 'prolific', label: 'Prolific', icon: '📋', subtitle: 'Research surveys' },
      { value: 'mturk', label: 'MTurk', icon: '🔧', subtitle: 'Micro-tasks' },
      { value: 'contestwatch', label: 'ContestWatch', icon: '🏆', subtitle: 'Prize contests' },
      { value: 'sweepstakes', label: 'Sweepstakes Sites', icon: '🎰', subtitle: 'Online giveaways' },
      { value: 'binance', label: 'Binance', icon: '🪙', subtitle: 'Crypto yield' },
      { value: 'coinbase', label: 'Coinbase Earn', icon: '💰', subtitle: 'Learn & earn' },
      { value: 'gumroad', label: 'Gumroad', icon: '🛍️', subtitle: 'Digital products' },
      { value: 'reddit', label: 'Reddit Bounties', icon: '📡', subtitle: 'Community jobs & tips' },
    ],
    multi: true,
  },
  {
    id: 'risk',
    title: 'Risk Tolerance',
    description: 'How risk-tolerant are you?',
    options: [
      { value: 'conservative', label: '🛡️ Conservative', subtitle: 'Low risk, steady growth' },
      { value: 'moderate', label: '⚖️ Moderate', subtitle: 'Balanced risk and reward' },
      { value: 'aggressive', label: '🚀 Aggressive', subtitle: 'High reward potential' },
    ],
  },
  {
    id: 'capital',
    title: 'Available Capital',
    description: 'How much can you invest daily?',
    type: 'input',
    inputType: 'number',
    placeholder: '100',
  },
  {
    id: 'intensity',
    title: 'Automation Level',
    description: 'How automated should this be?',
    options: [
      { value: 'full_auto', label: '🤖 Full Autopilot', subtitle: 'Maximum automation, minimal oversight' },
      { value: 'review', label: '👀 Review Mode', subtitle: 'Approve tasks before execution' },
      { value: 'notification', label: '🔔 Notifications Only', subtitle: 'Just alert me, I decide' },
    ],
  },
];

export default function WorkflowWizard({ onComplete }) {
  const [step, setStep] = useState(0);
  const [responses, setResponses] = useState({});
  const [selectedOptions, setSelectedOptions] = useState({});

  const currentStep = WIZARD_STEPS[step];
  const progress = ((step + 1) / WIZARD_STEPS.length) * 100;

  const handleSelect = (value) => {
    if (currentStep.multi) {
      const current = selectedOptions[currentStep.id] || [];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      setSelectedOptions({ ...selectedOptions, [currentStep.id]: updated });
    } else {
      setSelectedOptions({ ...selectedOptions, [currentStep.id]: value });
      setResponses({ ...responses, [currentStep.id]: value });
    }
  };

  const handleInputChange = (value) => {
    setResponses({ ...responses, [currentStep.id]: value });
  };

  const handleMultiSubmit = () => {
    setResponses({ ...responses, [currentStep.id]: selectedOptions[currentStep.id] });
    if (step < WIZARD_STEPS.length - 1) {
      setStep(step + 1);
    }
  };

  const goNext = () => {
    if (currentStep.multi) {
      handleMultiSubmit();
    } else if (step < WIZARD_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      generateStrategy();
    }
  };

  const goBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const generateStrategy = () => {
    const strategy = buildStrategyFromResponses(responses);
    onComplete(strategy);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 text-right">
          Step {step + 1} of {WIZARD_STEPS.length}
        </p>
      </div>

      {/* Current Step */}
      <div className="p-8 rounded-xl border border-slate-700 bg-slate-900/50 mb-6">
        <h2 className="font-orbitron text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-cyan-400" />
          {currentStep.title}
        </h2>
        <p className="text-slate-400 text-sm mb-6">{currentStep.description}</p>

        {/* Input Field */}
        {currentStep.type === 'input' && (
          <div className="mb-6">
            <input
              type={currentStep.inputType}
              placeholder={currentStep.placeholder}
              value={responses[currentStep.id] || ''}
              onChange={e => handleInputChange(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-lg"
            />
          </div>
        )}

        {/* Options Grid */}
        {currentStep.options && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            {currentStep.options.map(opt => {
              const isSelected = currentStep.multi
                ? (selectedOptions[currentStep.id] || []).includes(opt.value)
                : responses[currentStep.id] === opt.value;

              return (
                <button
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    isSelected
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{opt.icon}</span>
                    <div>
                      <p className="font-medium text-white">{opt.label}</p>
                      {opt.subtitle && <p className="text-xs text-slate-400 mt-0.5">{opt.subtitle}</p>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 justify-between">
        <Button
          onClick={goBack}
          disabled={step === 0}
          variant="outline"
          className="border-slate-700 text-slate-400 hover:text-white gap-1"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>

        <Button
          onClick={goNext}
          disabled={!responses[currentStep.id] && !currentStep.multi}
          className="bg-cyan-600 hover:bg-cyan-500 text-white gap-1"
        >
          {step === WIZARD_STEPS.length - 1 ? (
            <>
              Create Strategy <Sparkles className="w-4 h-4" />
            </>
          ) : (
            <>
              Next <ChevronRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function buildStrategyFromResponses(responses) {
  const platforms = responses.platforms || [];
  const riskLevel = responses.risk || 'moderate';
  const automationLevel = responses.intensity || 'review';

  const riskConfig = {
    conservative: { maxConcurrentTasks: 2, maxDailySpend: 100, profitThreshold: 100 },
    moderate: { maxConcurrentTasks: 3, maxDailySpend: 500, profitThreshold: 50 },
    aggressive: { maxConcurrentTasks: 6, maxDailySpend: 1000, profitThreshold: 20 },
  };

  const config = riskConfig[riskLevel];

  const conditions = [];
  if (config.profitThreshold > 0) {
    conditions.push({
      id: `cond_profit_${Date.now()}`,
      type: 'profit_threshold',
      operator: '>',
      value: config.profitThreshold,
      action: 'queue_task',
    });
  }

  return {
    name: `${responses.goal ? responses.goal.charAt(0).toUpperCase() + responses.goal.slice(1) : 'Custom'} Strategy`,
    description: `Auto-generated workflow optimized for ${riskLevel} risk with ${automationLevel} mode`,
    blocks: [
      { id: `block_scan_${Date.now()}`, type: 'trigger', label: 'Scan for opportunities', templateId: 'trigger_scan', config: {} },
      { id: `block_filter_${Date.now()}`, type: 'filter', label: 'Filter by platform', templateId: 'filter_platform', config: { platforms } },
      { id: `block_action_${Date.now()}`, type: 'action', label: 'Queue task', templateId: 'action_queue', config: {} },
    ],
    conditions,
    maxConcurrentTasks: config.maxConcurrentTasks,
    maxDailySpend: parseInt(responses.capital) || config.maxDailySpend,
    targetPlatforms: platforms.length > 0 ? platforms : ['all'],
    enabled: true,
  };
}