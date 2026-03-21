import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export function useCommsData() {
  const [conversations, setConversations] = useState(new Map());
  const [activeConversation, setActiveConversation] = useState(null);

  useEffect(() => {
    // Subscribe to notifications as messaging events
    const subscription = base44.entities.Notification?.subscribe?.((event) => {
      if (event.type === 'create') {
        const notification = event.data;
        const senderId = notification.created_by || 'system';
        const message = {
          id: notification.id,
          sender: senderId === 'system' ? 'VELOCITY AI' : senderId.split('@')[0],
          content: notification.message,
          timestamp: notification.created_date,
          type: notification.severity || 'info'
        };

        setConversations(prev => {
          const updated = new Map(prev);
          const convId = senderId;
          const conv = updated.get(convId) || {
            id: convId,
            name: senderId === 'system' ? 'VELOCITY AI' : senderId,
            messages: [],
            isAI: senderId === 'system',
            unread: 0
          };
          conv.messages.push(message);
          if (activeConversation !== convId) {
            conv.unread += 1;
          }
          updated.set(convId, conv);
          return updated;
        });
      }
    });

    return () => {
      if (typeof subscription === 'function') subscription();
    };
  }, [activeConversation]);

  const sendMessage = async (conversationId, content) => {
    try {
      // Create a notification entry for the outgoing message
      if (base44.entities.Notification?.create) {
        await base44.entities.Notification.create({
          message: content,
          severity: 'info'
        });
      }

      // Update conversation
      setConversations(prev => {
        const updated = new Map(prev);
        const conv = updated.get(conversationId);
        if (conv) {
          conv.messages.push({
            id: `msg-${Date.now()}`,
            sender: 'You',
            content: content,
            timestamp: new Date().toISOString(),
            type: 'sent'
          });
          updated.set(conversationId, conv);
        }
        return updated;
      });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return {
    conversations: Array.from(conversations.values()),
    activeConversation,
    setActiveConversation,
    sendMessage
  };
}