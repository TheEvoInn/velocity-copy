import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const NotificationService = {
  getUnreadNotifications: () => base44.entities.Notification.filter({ is_read: false }, '-created_date', 50),
  getNotifications: (_a, _b, limit) => base44.entities.Notification.list('-created_date', limit || 100),
  markAsRead: (id) => base44.entities.Notification.update(id, { is_read: true }),
  dismiss: (id) => base44.entities.Notification.update(id, { is_dismissed: true }),
  dismissAllByType: async (type) => {
    const items = await base44.entities.Notification.filter({ notification_type: type, is_dismissed: false });
    return Promise.all(items.map(n => base44.entities.Notification.update(n.id, { is_dismissed: true })));
  },
};

export function useNotifications(autoRefresh = true) {
  const queryClient = useQueryClient();
  const [unreadCount, setUnreadCount] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);

  // Initialize WebSocket for real-time updates
  useEffect(() => {
    if (!autoRefresh) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/notifications/subscribe`);

    ws.onopen = () => setWsConnected(true);
    ws.onmessage = (event) => {
      const notification = JSON.parse(event.data);
      queryClient.setQueryData(['unreadNotifications'], (old = []) => [notification, ...old]);
      queryClient.setQueryData(['allNotifications'], (old = []) => [notification, ...old]);
    };
    ws.onerror = () => setWsConnected(false);
    ws.onclose = () => setWsConnected(false);

    return () => ws.close();
  }, [autoRefresh, queryClient]);

  // Fetch unread notifications
  const { data: unreadNotifications = [], isLoading: unreadLoading, refetch: refetchUnread } = useQuery({
    queryKey: ['unreadNotifications'],
    queryFn: () => NotificationService.getUnreadNotifications(),
    refetchInterval: autoRefresh && !wsConnected ? 30000 : false, // Fallback to polling if WS disconnected
    staleTime: 5000
  });

  // Fetch all notifications
  const { data: allNotifications = [], isLoading: allLoading, refetch: refetchAll } = useQuery({
    queryKey: ['allNotifications'],
    queryFn: () => NotificationService.getNotifications(null, null, 100),
    refetchInterval: autoRefresh && !wsConnected ? 60000 : false,
    staleTime: 10000
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (notificationId) => NotificationService.markAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unreadNotifications'] });
      queryClient.invalidateQueries({ queryKey: ['allNotifications'] });
    }
  });

  // Dismiss mutation
  const dismissMutation = useMutation({
    mutationFn: (notificationId) => NotificationService.dismiss(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unreadNotifications'] });
      queryClient.invalidateQueries({ queryKey: ['allNotifications'] });
    }
  });

  // Dismiss all by type mutation
  const dismissAllMutation = useMutation({
    mutationFn: (notificationType) => NotificationService.dismissAllByType(notificationType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unreadNotifications'] });
      queryClient.invalidateQueries({ queryKey: ['allNotifications'] });
    }
  });

  // Update unread count
  useEffect(() => {
    setUnreadCount(unreadNotifications.length);
  }, [unreadNotifications]);

  const markAsRead = useCallback((notificationId) => {
    markAsReadMutation.mutate(notificationId);
  }, [markAsReadMutation]);

  const dismiss = useCallback((notificationId) => {
    dismissMutation.mutate(notificationId);
  }, [dismissMutation]);

  const dismissAll = useCallback((notificationType) => {
    dismissAllMutation.mutate(notificationType);
  }, [dismissAllMutation]);

  return {
    unreadNotifications,
    allNotifications,
    unreadCount,
    isLoading: unreadLoading || allLoading,
    markAsRead,
    dismiss,
    dismissAll,
    refetchUnread,
    refetchAll,
    wsConnected,
    notifications: allNotifications
  };
}