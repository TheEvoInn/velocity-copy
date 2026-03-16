import React from 'react';
import { Card } from '@/components/ui/card';
import { CheckCircle2, Zap, Bot, Users, FileText } from 'lucide-react';

export default function SystemDocumentation() {
  const components = [
    {
      name: 'Identity Manager',
      status: '✅ Complete',
      description: '9+ AI personas with auto-generated bios, skills, tone. Instant identity switching.',
      features: ['Auto-generation', 'Multi-persona', 'Instant switching', 'Profile customization']
    },
    {
      name: 'Account Manager',
      status: '✅ Complete',
      description: 'Auto-create accounts, monitor health, rotate on blocks, encrypted credential storage.',
      features: ['Auto-creation', 'Health monitoring', 'Account rotation', 'CredentialVault']
    },
    {
      name: 'Agent Worker',
      status: '✅ Complete',
      description: 'Navigate URLs, analyze pages, fill forms, submit autonomously. Real-time monitoring.',
      features: ['Page analysis', 'Form filling', 'Document handling', 'Confirmation capture']
    },
    {
      name: 'Proposal Engine',
      status: '✅ Complete',
      description: 'High-conversion proposals with platform-specific adaptation and learning loop.',
      features: ['Context fusion', 'Platform-adaptive', 'Learning loop', 'Confidence scoring']
    },
    {
      name: 'Autopilot Orchestrator',
      status: '✅ Complete',
      description: 'End-to-end workflow: discover → queue → execute → generate proposals → log.',
      features: ['End-to-end automation', 'Batch processing', 'Full audit trail']
    },
    {
      name: 'Execution Scheduler',
      status: '✅ Complete',
      description: 'Continuous autonomous cycles. Pre-flight → queue → execute → health check → stats.',
      features: ['Continuous cycles', 'Manual triggers', 'Live monitoring', 'Real-time stats']
    }
  ];

  const workflow = [
    { step: '1', title: 'Opportunity Discovered', desc: 'From web scraper, prize module, or user input' },
    { step: '2', title: 'Queue to Agent Worker', desc: 'Bind opportunity to task with identity preference' },
    { step: '3', title: 'Autonomous Execution', desc: 'Navigate, analyze, fill forms, submit application' },
    { step: '4', title: 'Proposal Generation', desc: 'Auto-generate platform-specific, identity-aware proposal' },
    { step: '5', title: 'Result Logging', desc: 'Capture confirmation, update opportunity, feed analytics' },
    { step: '6', title: 'Analytics Update', desc: 'Track success rates, identity performance, earnings' }
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
          <Bot className="w-8 h-8 text-emerald-400" />
          Unified Autonomous Earning Engine
        </h1>
        <p className="text-slate-400">Complete system architecture and implementation status</p>
      </div>

      {/* Core Components */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          Core Components
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {components.map((comp, idx) => (
            <Card key={idx} className="bg-slate-900/50 border-slate-800 p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-white">{comp.name}</h3>
                <span className="text-xs text-emerald-400">{comp.status}</span>
              </div>
              <p className="text-sm text-slate-400 mb-3">{comp.description}</p>
              <div className="flex flex-wrap gap-1">
                {comp.features.map((feat, i) => (
                  <span key={i} className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded">
                    {feat}
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Workflow */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-400" />
          End-to-End Workflow
        </h2>
        <div className="space-y-2">
          {workflow.map((item, idx) => (
            <div key={idx} className="flex items-start gap-4 bg-slate-900/50 border border-slate-800 rounded-lg p-4">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <span className="text-emerald-400 font-semibold text-sm">{item.step}</span>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-white">{item.title}</h4>
                <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Key Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-emerald-950/20 border-emerald-900/30 p-4">
          <h3 className="font-semibold text-emerald-400 mb-2">Autonomy</h3>
          <ul className="text-xs text-slate-400 space-y-1">
            <li>✓ Discovers opportunities</li>
            <li>✓ Queues automatically</li>
            <li>✓ Creates accounts on demand</li>
            <li>✓ Fills forms & submits</li>
            <li>✓ Generates proposals</li>
            <li>✓ Tracks & learns</li>
          </ul>
        </Card>

        <Card className="bg-blue-950/20 border-blue-900/30 p-4">
          <h3 className="font-semibold text-blue-400 mb-2">Intelligence</h3>
          <ul className="text-xs text-slate-400 space-y-1">
            <li>✓ Context-aware proposals</li>
            <li>✓ Platform-specific adaptation</li>
            <li>✓ Identity-aware filling</li>
            <li>✓ Multi-step handling</li>
            <li>✓ Error classification</li>
            <li>✓ Learning loop</li>
          </ul>
        </Card>

        <Card className="bg-amber-950/20 border-amber-900/30 p-4">
          <h3 className="font-semibold text-amber-400 mb-2">Reliability</h3>
          <ul className="text-xs text-slate-400 space-y-1">
            <li>✓ Auto-retry logic</li>
            <li>✓ Health monitoring</li>
            <li>✓ Account rotation</li>
            <li>✓ Fallback to manual</li>
            <li>✓ Full audit trail</li>
            <li>✓ Real-time stats</li>
          </ul>
        </Card>
      </div>

      {/* Execution Cycle */}
      <Card className="bg-slate-900/50 border-slate-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Execution Cycle (Every 30 Seconds)</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-xs text-emerald-400 font-mono">00:00</span>
            <span className="text-slate-400">Pre-flight checks (System ready, Identity active, Accounts healthy)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-emerald-400 font-mono">00:01</span>
            <span className="text-slate-400">Batch queue opportunities (Find new, assign identity, set priority)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-emerald-400 font-mono">00:06</span>
            <span className="text-slate-400">Execute agent tasks (Navigate, analyze, fill, submit, confirm)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-emerald-400 font-mono">00:26</span>
            <span className="text-slate-400">Account health checks (Monitor, repair, rotate if needed)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-emerald-400 font-mono">00:28</span>
            <span className="text-slate-400">Collect statistics (Success rate, value completed, timing)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-emerald-400 font-mono">00:30</span>
            <span className="text-slate-400">Log results, next cycle starts</span>
          </div>
        </div>
      </Card>

      {/* Platform Coverage */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Supported Platforms</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {['Upwork', 'Fiverr', 'Freelancer', 'Toptal', 'Guru', 'Grant.gov', 'Contests', 'Giveaways'].map((platform, idx) => (
            <div key={idx} className="bg-slate-900/50 border border-slate-800 rounded-lg p-2 text-xs text-center text-slate-400">
              {platform}
            </div>
          ))}
        </div>
      </div>

      {/* Getting Started */}
      <Card className="bg-emerald-950/20 border-emerald-900/30 p-6">
        <h3 className="text-lg font-semibold text-emerald-400 mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          Getting Started
        </h3>
        <ol className="space-y-3 text-sm text-slate-300">
          <li><span className="font-semibold text-emerald-400">1.</span> Create identities in Identity Manager</li>
          <li><span className="font-semibold text-emerald-400">2.</span> Go to AutoPilot page and click "Start Cycles"</li>
          <li><span className="font-semibold text-emerald-400">3.</span> Watch Agent Worker execute in real-time</li>
          <li><span className="font-semibold text-emerald-400">4.</span> Monitor earnings and success rates in analytics</li>
          <li><span className="font-semibold text-emerald-400">5.</span> Optimize identities & proposals based on performance</li>
        </ol>
      </Card>
    </div>
  );
}