/**
 * Task Reader Page
 * 3rd-Party Task Reading System - Browser-level intelligence for external automation
 */
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, Brain, Zap, Shield, CheckCircle2, Info } from 'lucide-react';
import TaskReaderInterface from '@/components/task-reader/TaskReaderInterface';

export default function TaskReader() {
  return (
    <div className="min-h-screen galaxy-bg p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-cyan-500/10 border border-cyan-500/50">
              <Brain className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="font-orbitron text-2xl font-bold text-white text-glow-cyan">3rd-Party Task Reader</h1>
              <p className="text-xs text-slate-400">Browser-level intelligence for external automation</p>
            </div>
          </div>
        </div>

        {/* Capabilities Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              icon: Globe,
              title: 'Read External Sites',
              desc: 'Forms, dashboards, web apps'
            },
            {
              icon: Brain,
              title: 'Understand Structure',
              desc: 'Fields, validation, logic'
            },
            {
              icon: Zap,
              title: 'Compile Actions',
              desc: 'Executable workflows'
            },
            {
              icon: Shield,
              title: 'Full Sync',
              desc: 'Bidirectional integration'
            }
          ].map((cap, idx) => {
            const Icon = cap.icon;
            return (
              <Card key={idx} className="p-4 bg-slate-800/50 border-slate-700">
                <Icon className="w-5 h-5 text-cyan-400 mb-2" />
                <h3 className="text-sm font-semibold text-white mb-1">{cap.title}</h3>
                <p className="text-xs text-slate-400">{cap.desc}</p>
              </Card>
            );
          })}
        </div>

        {/* Main Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Task Reader Input */}
          <div className="lg:col-span-2">
            <TaskReaderInterface />
          </div>

          {/* Information Panel */}
          <div className="space-y-4">
            {/* How It Works */}
            <Card className="p-4 bg-slate-900/50 border-slate-800">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Info className="w-4 h-4 text-cyan-400" />
                How It Works
              </h3>
              <ol className="space-y-2 text-xs text-slate-300">
                <li className="flex gap-2">
                  <span className="text-cyan-400 font-semibold">1.</span>
                  <span>Paste external website URL</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-cyan-400 font-semibold">2.</span>
                  <span>System reads & analyzes page</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-cyan-400 font-semibold">3.</span>
                  <span>Understands forms & fields</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-cyan-400 font-semibold">4.</span>
                  <span>Generates executable actions</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-cyan-400 font-semibold">5.</span>
                  <span>Creates workflow</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-cyan-400 font-semibold">6.</span>
                  <span>Execute with Autopilot/Agent</span>
                </li>
              </ol>
            </Card>

            {/* Supported Actions */}
            <Card className="p-4 bg-slate-900/50 border-slate-800">
              <h3 className="text-sm font-semibold text-white mb-3">Supported Actions</h3>
              <div className="flex flex-wrap gap-2">
                {[
                  'Navigate',
                  'Click',
                  'Type',
                  'Select',
                  'Upload',
                  'Submit',
                  'Wait',
                  'Validate'
                ].map(action => (
                  <Badge key={action} variant="secondary" className="text-xs">
                    {action}
                  </Badge>
                ))}
              </div>
            </Card>

            {/* Integration Points */}
            <Card className="p-4 bg-slate-900/50 border-slate-800">
              <h3 className="text-sm font-semibold text-white mb-3">Integrations</h3>
              <div className="space-y-1">
                {[
                  'Autopilot',
                  'Agent Worker',
                  'Workflow Architect',
                  'Task Orchestrator',
                  'Event Bus',
                  'Credential Vault',
                  'Identity Router'
                ].map(sys => (
                  <div key={sys} className="flex items-center gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    {sys}
                  </div>
                ))}
              </div>
            </Card>

            {/* Key Features */}
            <Card className="p-4 bg-cyan-500/10 border border-cyan-500/30">
              <h3 className="text-sm font-semibold text-cyan-200 mb-2">Key Features</h3>
              <ul className="space-y-1 text-xs text-cyan-100">
                <li>✓ Browser-level intelligence</li>
                <li>✓ Form field detection</li>
                <li>✓ Multi-step workflows</li>
                <li>✓ Bidirectional sync</li>
                <li>✓ Error handling paths</li>
                <li>✓ Credential injection</li>
                <li>✓ Pattern matching</li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}