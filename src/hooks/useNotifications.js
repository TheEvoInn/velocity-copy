export function useNotifications() {
  return {
    unreadNotifications: [],
    allNotifications: [],
    unreadCount: 0,
    isLoading: false,
    markAsRead: async () => {},
    dismiss: async () => {},
    dismissAll: async () => {},
    refetchUnread: async () => {},
    refetchAll: async () => {},
    wsConnected: false,
    notifications: [],
  };
}
