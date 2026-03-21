import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import NotificationService from '@/services/notificationService';

export function useNotifications(autoRefresh = true) {
  const queryClient = useQueryClient();
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread notifications
  const { data: unreadNotifications = [], isLoading: unreadLoading, refetch: refetchUnread } = useQuery({
    queryKey: ['unreadNotifications'],
    queryFn: () => NotificationService.getUnreadNotifications(),
    refetchInterval: autoRefresh ? 30000 : false, // Refetch every 30 seconds
    staleTime: 5000
  });

  // Fetch all notifications
  const { data: allNotifications = [], isLoading: allLoading, refetch: refetchAll } = useQuery({
    queryKey: ['allNotifications'],
    queryFn: () => NotificationService.getNotifications(null, null, 100),
    refetchInterval: autoRefresh ? 60000 : false,
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
    refetchAll
  };
}