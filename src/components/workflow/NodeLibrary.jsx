import React, { useState } from 'react';
import { ChevronDown, Zap, GitBranch, Send, Bell, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';

const NODE_LIBRARY = {
  Triggers: [
    { type: 'trigger', label: 'Manual Start', department: 'System', icon: Zap },
    { type: 'trigger', label: 'On Schedule', department: 'System', icon: Zap },
    { type: 'trigger', label: 'Webhook Event', department: 'System', icon: Zap },
    { type: 'trigger', label: 'On Opportunity', department: 'Discovery', icon: Zap },
    { type: 'trigger', label: 'On Task Complete', department: 'Execution', icon: Zap },
    { type: 'trigger', label: 'On Earnings', department: 'Finance', icon: Zap },
  ],
  Conditions: [
    { type: 'condition', label: 'IF Statement', department: 'System', icon: GitBranch },
    { type: 'condition', label: 'AND Logic', department: 'System', icon: GitBranch },
    { type: 'condition', label: 'OR Logic', department: 'System', icon: GitBranch },
    { type: 'condition', label: 'Value Threshold', department: 'System', icon: GitBranch },
    { type: 'condition', label: 'Time Based', department: 'System', icon: GitBranch },
  ],
  Autopilot: [
    { type: 'action', label: 'Start Execution', department: 'Autopilot', icon: Cpu },
    { type: 'action', label: 'Allocate Funds', department: 'Autopilot', icon: Cpu },
    { type: 'action', label: 'Apply to Job', department: 'Autopilot', icon: Cpu },
    { type: 'action', label: 'Submit Work', department: 'Autopilot', icon: Cpu },
    { type: 'action', label: 'Trigger Mission AI', department: 'Autopilot', icon: Cpu },
  ],
  NED: [
    { type: 'crypto', label: 'Detect Arbitrage', department: 'NED', icon: Cpu },
    { type: 'crypto', label: 'Claim Airdrop', department: 'NED', icon: Cpu },
    { type: 'crypto', label: 'Start Mining', department: 'NED', icon: Cpu },
    { type: 'crypto', label: 'Stake Tokens', department: 'NED', icon: Cpu },
    { type: 'crypto', label: 'Send Alert', department: 'NED', icon: Cpu },
  ],
  VIPZ: [
    { type: 'action', label: 'Generate Landing Page', department: 'VIPZ', icon: Cpu },
    { type: 'action', label: 'Publish Product', department: 'VIPZ', icon: Cpu },
    { type: 'action', label: 'Optimize Funnel', department: 'VIPZ', icon: Cpu },
    { type: 'action', label: 'Marketing Burst', department: 'VIPZ', icon: Cpu },
  ],
  System: [
    { type: 'notification', label: 'Send Notification', department: 'System', icon: Bell },
    { type: 'notification', label: 'Send Email', department: 'System', icon: Send },
    { type: 'action', label: 'Update Dashboard', department: 'System', icon: Cpu },
    { type: 'action', label: 'Log Event', department: 'System', icon: Cpu },
    { type: 'action', label: 'Trigger Webhook', department: 'System', icon: Cpu },
  ]
};

export default function NodeLibrary({ onSelectNode }) {
  const [expandedCategory, setExpandedCategory] = useState('Triggers');

  return (
    <div className="space-y-2">
      {Object.entries(NODE_LIBRARY).map(([category, nodes]) => (
        <div key={category}>
          <button
            onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-800/50 transition-colors text-left"
          >
            <span className="text-xs font-semibold text-slate-300">{category}</span>
            <ChevronDown
              className={`w-3 h-3 text-slate-500 transition-transform ${
                expandedCategory === category ? 'rotate-180' : ''
              }`}
            />
          </button>

          {expandedCategory === category && (
            <div className="space-y-1.5 pl-2">
              {nodes.map((node, idx) => (
                <Button
                  key={idx}
                  onClick={() => onSelectNode(node)}
                  variant="outline"
                  className="w-full justify-start text-xs h-8 gap-2 text-slate-300 hover:text-white hover:border-violet-500/50"
                >
                  <node.icon className="w-3 h-3" />
                  <span className="truncate">{node.label}</span>
                </Button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}