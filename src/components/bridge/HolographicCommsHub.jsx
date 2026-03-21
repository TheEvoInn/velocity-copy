import React, { useState } from 'react';
import { MessageSquare, Plus } from 'lucide-react';
import CommsWindow from './CommsWindow';
import { useCommsData } from '@/hooks/useCommsData';

export default function HolographicCommsHub() {
  const { conversations, activeConversation, setActiveConversation, sendMessage } = useCommsData();
  const [openConversations, setOpenConversations] = useState([]);
  const [minimized, setMinimized] = useState({});

  const handleOpenConversation = (conversationId) => {
    if (!openConversations.includes(conversationId)) {
      setOpenConversations(prev => [...prev, conversationId]);
    }
    setActiveConversation(conversationId);
    setMinimized(prev => ({ ...prev, [conversationId]: false }));
  };

  const handleCloseConversation = (conversationId) => {
    setOpenConversations(prev => prev.filter(id => id !== conversationId));
    if (activeConversation === conversationId) {
      const remaining = openConversations.filter(id => id !== conversationId);
      setActiveConversation(remaining[0] || null);
    }
  };

  const handleMinimize = (conversationId) => {
    setMinimized(prev => ({
      ...prev,
      [conversationId]: !prev[conversationId]
    }));
  };

  const activeConversations = conversations.filter(c => openConversations.includes(c.id));
  const availableConversations = conversations.filter(c => !openConversations.includes(c.id));

  return (
    <div className="fixed right-4 bottom-80 pointer-events-auto space-y-2 max-w-sm">
      {/* Comms Hub Control */}
      <div className="glass-card p-3 w-48">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-cyber-cyan" />
            <span className="font-orbitron text-xs text-cyber-cyan">COMMS HUB</span>
          </div>
          <span className="text-xs text-muted-foreground">{conversations.length} active</span>
        </div>

        {/* Active Channels */}
        <div className="space-y-1 max-h-32 overflow-y-auto mb-2">
          {conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => handleOpenConversation(conv.id)}
              className={`w-full text-left px-2 py-1 rounded text-xs transition-all flex items-center gap-2 ${
                openConversations.includes(conv.id)
                  ? 'bg-cyber-cyan/20 border border-cyber-cyan text-cyber-cyan'
                  : 'bg-slate-900/40 border border-slate-700 text-muted-foreground hover:border-slate-600'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${conv.isAI ? 'bg-cyber-cyan' : 'bg-cyber-magenta'}`} />
              <span className="flex-1 truncate">{conv.name}</span>
              {conv.unread > 0 && (
                <span className="px-1 bg-red-500/40 rounded text-xs">{conv.unread}</span>
              )}
            </button>
          ))}
        </div>

        {availableConversations.length > 0 && (
          <div className="text-xs text-muted-foreground border-t border-slate-700 pt-2">
            <div className="text-cyber-cyan mb-1">Available channels:</div>
            {availableConversations.map(conv => (
              <div key={conv.id} className="text-xs text-muted-foreground flex items-center gap-1">
                <div className={`w-1 h-1 rounded-full ${conv.isAI ? 'bg-cyber-cyan' : 'bg-cyber-magenta'}`} />
                {conv.name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Open Conversation Windows */}
      <div className="space-y-2">
        {activeConversations.map(conv => {
          if (minimized[conv.id]) {
            return (
              <button
                key={conv.id}
                onClick={() => handleMinimize(conv.id)}
                className="glass-card px-3 py-1 rounded text-xs text-cyber-cyan font-orbitron hover:bg-cyan-500/10 transition-colors"
              >
                [{conv.name}]
              </button>
            );
          }
          return (
            <CommsWindow
              key={conv.id}
              conversation={conv}
              onClose={handleCloseConversation}
              onSendMessage={sendMessage}
              onMinimize={handleMinimize}
              isActive={activeConversation === conv.id}
            />
          );
        })}
      </div>

      {/* Holographic scan lines effect */}
      <div className="absolute inset-0 pointer-events-none opacity-5">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500 to-transparent animate-pulse" />
      </div>
    </div>
  );
}