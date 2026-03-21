import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Hook to fetch, manage, and subscribe to real-time notifications
 */
export function useNotifications() {
  const qc = useQueryClient();

  // Fetch all notifications for current user
  const { data: notifications = [], refetch, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const notifs = await base44.entities.Notification.list('-priority_index', 100);
      return notifs.sort((a, b) => {
        // Unread first, then by priority
        if (a.is_read !== b.is_read) return a.is_read ? 1 : -1;
        return (b.priority_index || 0) - (a.priority_index || 0);
      });
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: (notifId) =>
      base44.entities.Notification.update(notifId, { is_read: true, read_at: new Date().toISOString() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Dismiss notification
  const dismissMutation = useMutation({
    mutationFn: (notifId) =>
      base44.entities.Notification.update(notifId, { is_dismissed: true, dismissed_at: new Date().toISOString() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Subscribe to real-time notification updates
  useEffect(() => {
    const unsubscribe = base44.entities.Notification.subscribe((event) => {
      if (event.type === 'create' || event.type === 'update') {
        refetch();
      }
    });

    return unsubscribe;
  }, [refetch]);

  const unreadCount = notifications.filter((n) => !n.is_read && !n.is_dismissed).length;
  const visibleNotifications = notifications.filter((n) => !n.is_dismissed);

  return {
    notifications: visibleNotifications,
    unreadCount,
    isLoading,
    markAsRead: (notifId) => markAsReadMutation.mutate(notifId),
    dismiss: (notifId) => dismissMutation.mutate(notifId),
    refetch,
  };
}