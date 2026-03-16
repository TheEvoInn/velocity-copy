import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, Zap, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ChatMessage from './ChatMessage';

export default function ChatPanel() {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (activeConversation) {
      const unsub = base44.agents.subscribeToConversation(activeConversation.id, (data) => {
        setMessages(data.messages || []);
      });
      return () => unsub();
    }
  }, [activeConversation?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    const convs = await base44.agents.listConversations({ agent_name: 'profit_engine' });
    setConversations(convs || []);
    if (convs && convs.length > 0) {
      const full = await base44.agents.getConversation(convs[0].id);
      setActiveConversation(full);
      setMessages(full.messages || []);
    }
  };

  const startNewConversation = async () => {
    setIsCreating(true);
    const conv = await base44.agents.createConversation({
      agent_name: 'profit_engine',
      metadata: { name: `Session ${new Date().toLocaleDateString()}` }
    });
    setActiveConversation(conv);
    setMessages([]);
    setConversations(prev => [conv, ...prev]);
    setIsCreating(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    let conv = activeConversation;
    if (!conv) {
      setIsCreating(true);
      conv = await base44.agents.createConversation({
        agent_name: 'profit_engine',
        metadata: { name: `Session ${new Date().toLocaleDateString()}` }
      });
      setActiveConversation(conv);
      setConversations(prev => [conv, ...prev]);
      setIsCreating(false);
    }

    const msg = input.trim();
    setInput('');
    setIsLoading(true);

    await base44.agents.addMessage(conv, { role: 'user', content: msg });
    setIsLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickActions = [
    "Scan for $0-start opportunities",
    "Find arbitrage gaps now",
    "Generate a fastest-path strategy",
    "What are today's top opportunities?"
  ];

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm font-semibold text-white">Profit Engine AI</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={startNewConversation}
          disabled={isCreating}
          className="text-slate-400 hover:text-white hover:bg-slate-800 h-7 px-2"
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-emerald-500/20 flex items-center justify-center mb-4">
              <Zap className="w-7 h-7 text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Profit Engine Ready</h3>
            <p className="text-xs text-slate-500 mb-6 max-w-xs">
              Ask me to scan for opportunities, generate strategies, or analyze any profit path.
            </p>
            <div className="grid grid-cols-1 gap-2 w-full max-w-xs">
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(action); }}
                  className="text-left text-xs px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-slate-700 transition-colors"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <Loader2 className="h-3.5 w-3.5 text-emerald-400 animate-spin" />
            </div>
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 px-4 py-3">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/50 animate-bounce" />
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/50 animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/50 animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the Profit Engine..."
            className="flex-1 bg-slate-900 border-slate-700 text-white placeholder:text-slate-600 focus-visible:ring-emerald-500/30"
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}