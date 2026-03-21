import { useEffect, useState, useRef } from 'react';
import { notificationService } from '@/services/notificationService';

export function useRealTimeNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const handleNewNotification = (notification) => {
      setNotifications(prev => [notification, ...prev].slice(0, 50)); // Keep last 50
      setUnreadCount(prev => prev + 1);
    };

    notificationService.initializeListeners(handleNewNotification);

    return () => {
      notificationService.dispose();
    };
  }, []);

  const clearNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  const markAsRead = () => {
    setUnreadCount(0);
  };

  return {
    notifications,
    unreadCount,
    clearNotifications,
    markAsRead
  };
}