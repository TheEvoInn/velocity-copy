/**
 * VELOCITY AI COMMAND CONSOLE
 * Centralized natural language interface for autonomous agents
 * Coordinate NED, Autopilot, and VIPZ across all departments
 */
import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, AlertCircle, CheckCircle2, Bot } from 'lucide-react';
import { toast } from 'sonner';
import CommandInput from '@/components/command-console/CommandInput';
import CommandHistory from '@/components/command-console/CommandHistory';

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [agents, setAgents] = useState(null);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const messagesEndRef = useRef(null);

  // Load agent status
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const res = await base44.functions.invoke('aiCommandConsole', {
          action: 'get_agent_status'
        });
        setAgents(res.data?.agents);
      } catch (err) {
        console.error('Failed to load agents:', err);
        toast.error('Failed to load agent status');
      } finally {
        setLoadingAgents(false);
      }
    };

    loadAgents();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Command execution mutation
  const parseMutation = useMutation({
    mutationFn: async ({ instruction, selectedAgent }) => {
      const res = await base44.functions.invoke('aiCommandConsole', {
        action: 'execute_command',
        instruction,
        agent_target: selectedAgent
      });
      return res.data;
    },
    onSuccess: (data) => {
      // Add command with action plan
      setMessages(prev => [...prev, {
        type: 'command',
        instruction: data.instruction,
        agent: data.target_agent,
        intent: data.intent,
        action_plan: data.action_plan,
        needs_confirmation: data.confirmation_required
      }]);

      // Add confirmation/execution request
      if (data.confirmation_required) {
        setMessages(prev => [...prev, {
          type: 'system',
          status: 'confirm',
          message: `Ready to execute ${data.action_plan.length} actions via ${data.target_agent}`,
          details: {
            estimated_impact: data.estimated_impact,
            reversible: true
          }
        }]);
      } else {
        executeMutation.mutate({
          command_intent: data.intent,
          target_agent: data.target_agent,
          action_plan: data.action_plan
        });
      }
    },
    onError: (err) => {
      toast.error('Command parsing failed: ' + err.message);
      setMessages(prev => [...prev, {
        type: 'system',
        status: 'error',
        message: 'Command parsing failed: ' + err.message
      }]);
    }
  });

  // Command execution mutation
  const executeMutation = useMutation({
    mutationFn: async ({ command_intent, target_agent, action_plan }) => {
      const res = await base44.functions.invoke('aiCommandConsole', {
        action: 'execute_confirmed',
        command_intent,
        target_agent,
        action_plan
      });
      return res.data;
    },
    onSuccess: (data) => {
      // Add execution results
      setMessages(prev => {
        const updated = [...prev];
        // Find the last command message and add results
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].type === 'command') {
            updated[i].results = data.execution_results;
            break;
          }
        }
        return updated;
      });

      // Add summary
      setMessages(prev => [...prev, {
        type: 'system',
        status: 'success',
        message: `Executed ${data.successful_actions}/${data.total_actions} actions successfully`
      }]);

      toast.success(`Command executed: ${data.successful_actions}/${data.total_actions} actions completed`);
    },
    onError: (err) => {
      toast.error('Command execution failed: ' + err.message);
      setMessages(prev => [...prev, {
        type: 'system',
        status: 'error',
        message: 'Execution failed: ' + err.message
      }]);
    }
  });

  const handleSendCommand = (instruction, selectedAgent) => {
    parseMutation.mutate({ instruction, selectedAgent });
  };

  const handleConfirmExecution = (commandIdx) => {
    const command = messages[commandIdx];
    if (command.action_plan) {
      executeMutation.mutate({
        command_intent: command.intent,
        target_agent: command.agent,
        action_plan: command.action_plan
      });
    }
  };

  return (
    <div className="min-h-screen galaxy-bg p-4 md:p-6">
      <div className="max-w-4xl mx-auto h-screen flex flex-col">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-violet-500/10 border border-violet-500/50">
              <Bot className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h1 className="font-orbitron text-2xl font-bold text-white text-glow-violet">VELO AI</h1>
              <p className="text-xs text-slate-400">Autonomous Agent Command Console</p>
            </div>
          </div>

          {/* System Status */}
          {!loadingAgents && agents && (
            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <div className="grid grid-cols-3 gap-3">
                {['ned', 'autopilot', 'vipz'].map(agentKey => {
                  const agent = agents[agentKey];
                  if (!agent) return null;
                  const isActive = agent.status === 'active';
                  return (
                    <div key={agentKey} className="text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        {isActive ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <AlertCircle className="w-3 h-3 text-slate-500" />
                        )}
                        <span className="font-semibold text-slate-300">{agent.name}</span>
                      </div>
                      <p className={`text-slate-400 ${isActive ? 'text-emerald-400' : ''}`}>
                        {isActive ? 'Active & Ready' : 'Inactive'}
                      </p>
                      {agent.capabilities && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {agent.capabilities.slice(0, 2).map((cap, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs py-0">
                              {cap}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto mb-6 space-y-4 pb-4">
          <CommandHistory messages={messages} />
          <div ref={messagesEndRef} />
        </div>

        {/* Command Input */}
        <div className="border-t border-slate-700 pt-4">
          <CommandInput
            onSendCommand={handleSendCommand}
            isLoading={parseMutation.isPending || executeMutation.isPending}
            agents={agents}
          />
        </div>

        {/* Help Section */}
        <div className="mt-4 p-3 rounded-lg bg-slate-900/50 border border-slate-800">
          <p className="text-xs text-slate-400">
            💡 <strong>Tip:</strong> Natural language commands are automatically routed to APEX (Autopilot), CIPHER (Crypto/NED), MERCH (Commerce), or SCOUT (Discovery). You can also manually target a department above.
          </p>
        </div>
      </div>
    </div>
  );
}