import { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useNotifications() {
  const queryClient = useQueryClient();

  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await base44.entities.Notification.filter(
        { is_dismissed: false },
        '-created_date',
        100
      );
      return res;
    },
    refetchInterval: 5000 // Poll every 5 seconds
  });

  // Real-time subscription
  useEffect(() => {
    const unsubscribe = base44.entities.Notification.subscribe((event) => {
      if (event.type === 'create' || event.type === 'update') {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }
    });
    return unsubscribe;
  }, [queryClient]);

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId) => {
      return await base44.entities.Notification.update(notificationId, {
        is_read: true,
        read_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  // Dismiss mutation
  const dismissMutation = useMutation({
    mutationFn: async (notificationId) => {
      return await base44.entities.Notification.update(notificationId, {
        is_dismissed: true,
        dismissed_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  // Create notification helper (for internal use)
  const createNotification = useCallback(async (notification) => {
    return await base44.entities.Notification.create(notification);
  }, []);

  // Get unread count
  const unreadCount = notifications.filter(n => !n.is_read && !n.is_dismissed).length;

  // Get by severity
  const getBySeverity = useCallback((severity) => {
    return notifications.filter(n => n.severity === severity && !n.is_dismissed);
  }, [notifications]);

  // Get by type
  const getByType = useCallback((type) => {
    return notifications.filter(n => n.type === type && !n.is_dismissed);
  }, [notifications]);

  return {
    notifications,
    isLoading,
    unreadCount,
    markAsRead: (id) => markAsReadMutation.mutate(id),
    dismiss: (id) => dismissMutation.mutate(id),
    dismissAll: async () => {
      for (const notif of notifications.filter(n => !n.is_dismissed)) {
        await dismissMutation.mutateAsync(notif.id);
      }
    },
    createNotification,
    getBySeverity,
    getByType,
    critical: notifications.filter(n => n.severity === 'critical' && !n.is_dismissed),
    urgent: notifications.filter(n => n.severity === 'urgent' && !n.is_dismissed),
    warnings: notifications.filter(n => n.severity === 'warning' && !n.is_dismissed)
  };
}