import React from 'react';
import { Card } from '@/components/ui/card';
import { CheckCircle2, ArrowRight, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function IntegrationGuide() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Unified Autonomous System - Integration Guide</h1>
        <p className="text-slate-400">Complete end-to-end automation from opportunity discovery to earnings</p>
      </div>

      {/* System Overview */}
      <Card className="bg-gradient-to-r from-emerald-950/40 to-blue-950/40 border-emerald-900/30 p-6">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-emerald-400" />
          What Has Been Built
        </h2>
        <div className="space-y-3">
          <p className="text-slate-300">
            A complete autonomous earning engine that:
          </p>
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <span>Discovers opportunities from any source (web scrape, prize module, user input)</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <span>Queues opportunities for execution with smart priority scoring</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <span>Automatically selects or creates AI identities for each task</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <span>Navigates to URLs, analyzes page structures, fills forms with identity data</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <span>Submits applications and captures confirmations automatically</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <span>Generates high-conversion, platform-specific proposals with context</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <span>Runs continuous autonomous cycles every 30 seconds</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <span>Logs everything with full audit trail and real-time analytics</span>
            </li>
          </ul>
        </div>
      </Card>

      {/* Core Modules */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Core Modules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              title: 'Identity Manager',
              desc: 'Create & manage AI personas',
              items: ['9+ persona types', 'Auto bio generation', 'Instant switching']
            },
            {
              title: 'Account Manager',
              desc: 'Manage platform accounts',
              items: ['Auto account creation', 'Health monitoring', 'Account rotation']
            },
            {
              title: 'Agent Worker',
              desc: 'Execute applications',
              items: ['Page analysis', 'Form filling', 'Confirmation capture']
            },
            {
              title: 'Proposal Engine',
              desc: 'Generate proposals',
              items: ['Context fusion', 'Platform-adaptive', 'Learning loop']
            },
            {
              title: 'Autopilot Orchestrator',
              desc: 'End-to-end workflow',
              items: ['Complete automation', 'Batch processing', 'Full logging']
            },
            {
              title: 'Execution Scheduler',
              desc: 'Continuous cycles',
              items: ['30-second cycles', 'Auto execution', 'Live monitoring']
            }
          ].map((mod, idx) => (
            <Card key={idx} className="bg-slate-900/50 border-slate-800 p-4">
              <h3 className="font-semibold text-white mb-1">{mod.title}</h3>
              <p className="text-xs text-slate-400 mb-3">{mod.desc}</p>
              <div className="flex flex-wrap gap-1">
                {mod.items.map((item, i) => (
                  <span key={i} className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded">
                    {item}
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">How It Works</h2>
        <div className="space-y-3">
          {[
            {
              step: 1,
              title: 'Opportunity Discovered',
              desc: 'From web scraper, prize module, or user input. Assigned identity preference & deadline.'
            },
            {
              step: 2,
              title: 'Queued for Execution',
              desc: 'Priority calculated based on value, deadline, platform. Added to task queue.'
            },
            {
              step: 3,
              title: 'Agent Executes',
              desc: 'Navigate to URL, analyze form structure, detect required fields, fill with identity data.'
            },
            {
              step: 4,
              title: 'Form Submitted',
              desc: 'LLM generates contextual responses, fills all fields, submits form, captures confirmation.'
            },
            {
              step: 5,
              title: 'Proposal Generated',
              desc: 'For freelance opportunities, auto-generate platform-specific proposal with high confidence.'
            },
            {
              step: 6,
              title: 'Results Logged',
              desc: 'Update opportunity status, log execution, feed analytics, track success rate.'
            }
          ].map((item, idx) => (
            <div key={idx} className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <span className="text-emerald-400 font-semibold text-sm">{item.step}</span>
                </div>
              </div>
              <div className="flex-1 pt-1">
                <h3 className="font-semibold text-white">{item.title}</h3>
                <p className="text-sm text-slate-400 mt-1">{item.desc}</p>
              </div>
              {idx < 5 && <ArrowRight className="w-5 h-5 text-slate-600 mt-2" />}
            </div>
          ))}
        </div>
      </div>

      {/* Getting Started */}
      <Card className="bg-blue-950/30 border-blue-900/30 p-6">
        <h2 className="text-xl font-semibold text-blue-400 mb-4">Quick Start</h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 text-xs font-semibold text-blue-400 shrink-0">1</div>
            <div>
              <p className="font-semibold text-white">Create Identities</p>
              <Link to="/IdentityManagerExpanded" className="text-xs text-blue-400 hover:text-blue-300">
                Go to Identity Manager → Create persona
              </Link>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 text-xs font-semibold text-blue-400 shrink-0">2</div>
            <div>
              <p className="font-semibold text-white">Start Execution</p>
              <Link to="/AutoPilot" className="text-xs text-blue-400 hover:text-blue-300">
                Go to AutoPilot → Click "Start Cycles"
              </Link>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 text-xs font-semibold text-blue-400 shrink-0">3</div>
            <div>
              <p className="font-semibold text-white">Monitor Execution</p>
              <Link to="/AgentWorkerCenter" className="text-xs text-blue-400 hover:text-blue-300">
                Go to Agent Worker Center → Watch tasks execute
              </Link>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 text-xs font-semibold text-blue-400 shrink-0">4</div>
            <div>
              <p className="font-semibold text-white">Review Analytics</p>
              <Link to="/AnalyticsDashboard" className="text-xs text-blue-400 hover:text-blue-300">
                Go to Analytics → View success rates & earnings
              </Link>
            </div>
          </div>
        </div>
      </Card>

      {/* Key Pages */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Key Pages</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { path: '/Dashboard', title: 'Dashboard', desc: 'System overview & quick stats' },
            { path: '/AutoPilot', title: 'AutoPilot', desc: 'Control continuous execution cycles' },
            { path: '/AgentWorkerCenter', title: 'Agent Worker', desc: 'Monitor task execution in real-time' },
            { path: '/Opportunities', title: 'Opportunities', desc: 'Batch queue opportunities for execution' },
            { path: '/IdentityManagerExpanded', title: 'Identity Manager', desc: 'Create & manage AI personas' },
            { path: '/AnalyticsDashboard', title: 'Analytics', desc: 'Performance tracking & insights' }
          ].map((page, idx) => (
            <Link key={idx} to={page.path}>
              <Card className="bg-slate-900/50 border-slate-800 p-4 hover:border-slate-700 transition-colors cursor-pointer h-full">
                <h3 className="font-semibold text-white">{page.title}</h3>
                <p className="text-xs text-slate-400 mt-2">{page.desc}</p>
                <p className="text-xs text-emerald-400 mt-2">→ Open</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* System Stats */}
      <Card className="bg-slate-900/50 border-slate-800 p-6">
        <h2 className="text-xl font-semibold text-white mb-4">System Statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Backend Functions', value: '12+' },
            { label: 'Entities', value: '20+' },
            { label: 'UI Components', value: '30+' },
            { label: 'Pages', value: '15+' },
            { label: 'Supported Platforms', value: '8+' },
            { label: 'Persona Types', value: '9+' },
            { label: 'Automation Types', value: '3' },
            { label: 'Update Frequency', value: '30s' }
          ].map((stat, idx) => (
            <div key={idx} className="border border-slate-800 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">{stat.value}</p>
              <p className="text-xs text-slate-400 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Next Steps */}
      <Card className="bg-emerald-950/20 border-emerald-900/30 p-6">
        <h2 className="text-xl font-semibold text-emerald-400 mb-4">Next Steps</h2>
        <ol className="space-y-3 text-sm text-slate-300">
          <li>
            <span className="font-semibold text-emerald-400">1. </span>
            Create your first AI identity in the Identity Manager
          </li>
          <li>
            <span className="font-semibold text-emerald-400">2. </span>
            Navigate opportunities to the Agent Worker (batch execution recommended)
          </li>
          <li>
            <span className="font-semibold text-emerald-400">3. </span>
            Start continuous cycles in AutoPilot
          </li>
          <li>
            <span className="font-semibold text-emerald-400">4. </span>
            Monitor execution in Agent Worker Center
          </li>
          <li>
            <span className="font-semibold text-emerald-400">5. </span>
            Review generated proposals before they're submitted
          </li>
          <li>
            <span className="font-semibold text-emerald-400">6. </span>
            Analyze performance and optimize identities based on results
          </li>
        </ol>
      </Card>
    </div>
  );
}