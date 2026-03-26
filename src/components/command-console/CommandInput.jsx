/**
 * Command Input Component
 * Natural language input with agent selection and suggestions
 */
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Zap, Bot, Sparkles, HelpCircle } from 'lucide-react';

const COMMAND_SUGGESTIONS = [
  { text: 'Scale digital commerce storefront by 20%', agent: 'vipz', icon: '📈' },
  { text: 'Adjust crypto staking exposure', agent: 'ned', icon: '💰' },
  { text: 'Execute and complete high-value tasks', agent: 'autopilot', icon: '⚡' },
  { text: 'Scan for new staking opportunities', agent: 'ned', icon: '📊' },
  { text: 'Generate and launch email campaigns', agent: 'vipz', icon: '✉️' },
  { text: 'Claim all eligible airdrops', agent: 'ned', icon: '🎁' },
  { text: 'Discover digital resell products', agent: 'vipz', icon: '🛒' },
  { text: 'Scan and queue new opportunities', agent: 'autopilot', icon: '🔍' },
];

export default function CommandInput({ onSendCommand, isLoading, agents }) {
  const [input, setInput] = useState('');
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (showSuggestions && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showSuggestions]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendCommand(input, selectedAgent);
    setInput('');
    setSelectedAgent(null);
  };

  const handleSuggestionClick = (suggestion) => {
    setInput(suggestion.text);
    setSelectedAgent(suggestion.agent);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const getAgentColor = (agent) => {
    const colors = {
      ned: 'border-cyan-500/50 bg-cyan-500/10',
      autopilot: 'border-violet-500/50 bg-violet-500/10',
      vipz: 'border-pink-500/50 bg-pink-500/10'
    };
    return colors[agent] || 'border-slate-500/50 bg-slate-500/10';
  };

  const getAgentLabel = (agent) => {
    const labels = {
      ned: '🔷 NED (Crypto & Blockchain)',
      autopilot: '⚡ Autopilot (Execution)',
      vipz: '📱 VIPZ (Commerce & Marketing)'
    };
    return labels[agent] || agent;
  };

  return (
    <div className="space-y-3">
      {/* Agent Status */}
      {agents && (
        <div className="grid grid-cols-3 gap-2">
          {['ned', 'autopilot', 'vipz'].map(agentName => {
            const agent = agents[agentName];
            return agent ? (
              <button
                key={agentName}
                onClick={() => setSelectedAgent(selectedAgent === agentName ? null : agentName)}
                className={`p-2 rounded-lg border transition-all text-xs font-medium ${
                  selectedAgent === agentName
                    ? getAgentColor(agentName).replace('/10', '/30')
                    : getAgentColor(agentName)
                }`}
              >
                <div className="font-bold">{getAgentLabel(agentName)}</div>
                <div className="text-xs opacity-70">{agent.status}</div>
              </button>
            ) : null;
          })}
        </div>
      )}

      {/* Input Area */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => input === '' && setShowSuggestions(true)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !isLoading) {
                handleSend();
              }
            }}
            placeholder="Issue a command... e.g., 'scale marketing spend by 20%'"
            className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none transition-colors"
          />

          {/* Suggestions Dropdown */}
          {showSuggestions && input === '' && (
            <div className="absolute top-full mt-2 left-0 right-0 bg-slate-900 border border-slate-700 rounded-lg shadow-lg z-50">
              <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                <p className="text-xs text-slate-400 font-semibold px-2 mb-2">Quick Commands</p>
                {COMMAND_SUGGESTIONS.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full text-left p-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg">{suggestion.icon}</span>
                      <div className="flex-1">
                        <p className="text-sm text-white">{suggestion.text}</p>
                        <p className="text-xs text-slate-400 mt-1">{getAgentLabel(suggestion.agent)}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <Button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className="bg-violet-600 hover:bg-violet-500 text-white px-6 gap-2"
        >
          <Send className="w-4 h-4" />
          {isLoading ? 'Processing...' : 'Execute'}
        </Button>
      </div>

      {/* Helper Text */}
      <p className="text-xs text-slate-500 flex items-center gap-2">
        <HelpCircle className="w-3 h-3" />
        Commands are routed to NED (Crypto), Autopilot (Execution), or VIPZ (Commerce). Select an agent above or type naturally.
      </p>
    </div>
  );
}