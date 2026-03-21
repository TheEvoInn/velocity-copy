import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Minimize2 } from 'lucide-react';

export default function CommsWindow({ 
  conversation, 
  onClose, 
  onSendMessage, 
  onMinimize,
  isActive 
}) {
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation.messages]);

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(conversation.id, message);
      setMessage('');
    }
  };

  const getSenderColor = (sender) => {
    if (sender === 'VELOCITY AI') return 'text-cyber-cyan';
    if (sender === 'You') return 'text-cyber-gold';
    return 'text-cyber-magenta';
  };

  const getMessageColor = (type) => {
    if (type === 'sent') return 'bg-slate-900/60 border-l-cyber-gold';
    if (type === 'critical') return 'bg-red-900/20 border-l-red-500';
    return 'bg-slate-900/40 border-l-cyber-cyan';
  };

  return (
    <div className="flex flex-col h-96 glass-card border border-cyan-500/30 rounded-lg overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex justify-between items-center p-3 border-b border-cyan-500/20 bg-slate-900/60">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${conversation.isAI ? 'bg-cyber-cyan animate-pulse' : 'bg-cyber-magenta'}`} />
          <span className="font-orbitron text-xs text-cyber-cyan">
            {conversation.name}
            {conversation.unread > 0 && (
              <span className="ml-2 px-1 py-0.5 bg-red-500/40 rounded text-xs">
                {conversation.unread}
              </span>
            )}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onMinimize(conversation.id)}
            className="p-1 hover:bg-slate-700/50 rounded transition-colors"
          >
            <Minimize2 className="w-3 h-3 text-muted-foreground" />
          </button>
          <button
            onClick={() => onClose(conversation.id)}
            className="p-1 hover:bg-red-900/40 rounded transition-colors"
          >
            <X className="w-3 h-3 text-red-400" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {conversation.messages.map((msg) => (
          <div key={msg.id} className="text-xs">
            <div className={`${getSenderColor(msg.sender)} font-mono text-xs mb-0.5`}>
              {msg.sender} {new Date(msg.timestamp).toLocaleTimeString()}
            </div>
            <div className={`px-2 py-1 rounded border-l-2 ${getMessageColor(msg.type)} text-muted-foreground break-words`}>
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-cyan-500/20 bg-slate-900/60">
        <div className="flex gap-1">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type message..."
            className="flex-1 bg-slate-950/80 border border-cyan-500/30 rounded px-2 py-1 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-cyber-cyan transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!message.trim()}
            className="p-1 bg-cyber-cyan/20 border border-cyber-cyan text-cyber-cyan rounded hover:bg-cyber-cyan/40 disabled:opacity-50 transition-colors"
          >
            <Send className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}