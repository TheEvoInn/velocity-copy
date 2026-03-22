import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

class NotificationService {
  constructor() {
    this.subscriptions = [];
    this.activeListeners = new Map();
    this.notificationQueue = [];
  }

  // Subscribe to real-time entity changes
  subscribeToEntity(entityName, callback) {
    const unsubscribe = base44.entities[entityName]?.subscribe?.((event) => {
      callback(event);
    });

    if (unsubscribe) {
      this.subscriptions.push(unsubscribe);
    }
    return unsubscribe;
  }

  // Show toast notification
  showNotification(type, message, options = {}) {
    const defaultOptions = {
      duration: 5000,
      position: 'top-right',
      ...options
    };

    switch (type) {
      case 'success':
        return toast.success(message, defaultOptions);
      case 'error':
        return toast.error(message, defaultOptions);
      case 'warning':
        return toast.warning(message, defaultOptions);
      case 'info':
        return toast.info(message, defaultOptions);
      case 'loading':
        return toast.loading(message, defaultOptions);
      default:
        return toast(message, defaultOptions);
    }
  }

  // Initialize all real-time listeners
  initializeListeners(onNotification) {
    // Listen for new opportunities
    this.subscribeToEntity('Opportunity', (event) => {
      if (event.type === 'create') {
        const notification = {
          id: event.id,
          type: 'opportunity',
          title: event.data?.title || 'New Opportunity',
          message: `New ${event.data?.category || 'opportunity'} available: ${event.data?.title}`,
          data: event.data,
          timestamp: new Date()
        };
        this.showNotification('success', notification.message, { duration: 6000 });
        onNotification?.(notification);
      }
    });

    // Listen for task completions
    this.subscribeToEntity('AITask', (event) => {
      if (event.type === 'update' && event.data?.status === 'completed') {
        const notification = {
          id: event.id,
          type: 'task_completed',
          title: 'Task Completed',
          message: `Task "${event.data?.task_name}" completed successfully`,
          data: event.data,
          timestamp: new Date()
        };
        this.showNotification('success', notification.message);
        onNotification?.(notification);
      }
    });

    // Listen for crypto transactions
    this.subscribeToEntity('CryptoTransaction', (event) => {
      if (event.type === 'create') {
        const notification = {
          id: event.id,
          type: 'crypto_transaction',
          title: 'Transaction Finalized',
          message: `${event.data?.transaction_type}: ${event.data?.amount} ${event.data?.token_symbol} ($${event.data?.value_usd})`,
          data: event.data,
          timestamp: new Date()
        };
        this.showNotification('success', notification.message, { duration: 6000 });
        onNotification?.(notification);
      }
    });

    // Listen for task queue updates
    this.subscribeToEntity('TaskExecutionQueue', (event) => {
      if (event.type === 'update') {
        if (event.data?.status === 'completed') {
          const notification = {
            id: event.id,
            type: 'execution_completed',
            title: 'Execution Complete',
            message: `Execution for "${event.data?.opportunity_type}" completed`,
            data: event.data,
            timestamp: new Date()
          };
          this.showNotification('success', notification.message);
          onNotification?.(notification);
        } else if (event.data?.status === 'failed') {
          const notification = {
            id: event.id,
            type: 'execution_failed',
            title: 'Execution Failed',
            message: `Execution failed: ${event.data?.error_message || 'Unknown error'}`,
            data: event.data,
            timestamp: new Date()
          };
          this.showNotification('error', notification.message, { duration: 7000 });
          onNotification?.(notification);
        }
      }
    });

    // Listen for KYC status updates
    this.subscribeToEntity('KYCVerification', (event) => {
      if (event.type === 'update') {
        if (event.data?.status === 'approved') {
          const notification = {
            id: event.id,
            type: 'kyc_approved',
            title: 'KYC Approved',
            message: 'Your KYC verification has been approved',
            data: event.data,
            timestamp: new Date()
          };
          this.showNotification('success', notification.message);
          onNotification?.(notification);
        } else if (event.data?.status === 'rejected') {
          const notification = {
            id: event.id,
            type: 'kyc_rejected',
            title: 'KYC Rejected',
            message: `KYC rejected: ${event.data?.rejection_reason || 'See details'}`,
            data: event.data,
            timestamp: new Date()
          };
          this.showNotification('error', notification.message, { duration: 8000 });
          onNotification?.(notification);
        }
      }
    });

    // Listen for Autopilot WorkOpportunity completions (high-value)
    this.subscribeToEntity('WorkOpportunity', (event) => {
      if (event.type === 'update') {
        const data = event.data || {};
        // High-value task completed
        if (data.status === 'active' && data.estimated_pay >= 10) {
          const notification = {
            id: event.id,
            type: 'task_completed',
            title: '🤖 Autopilot Task Complete',
            message: `"${data.title}" completed — estimated $${(data.estimated_pay * 0.85).toFixed(2)} earned`,
            data,
            timestamp: new Date()
          };
          this.showNotification('success', notification.message, { duration: 7000 });
          onNotification?.(notification);
        }
        // Task rejected / errored
        if (data.status === 'rejected') {
          const notification = {
            id: event.id,
            type: 'execution_failed',
            title: '⚠️ Task Requires Attention',
            message: `"${data.title}" on ${data.platform || 'unknown platform'} could not be completed`,
            data,
            timestamp: new Date()
          };
          this.showNotification('error', notification.message, { duration: 9000 });
          onNotification?.(notification);
        }
      }
    });

    // Listen for Autopilot earnings (WalletTransaction creates)
    this.subscribeToEntity('WalletTransaction', (event) => {
      if (event.type === 'create' && event.data?.type === 'earning') {
        const amount = event.data?.amount || 0;
        if (amount >= 5) {
          const notification = {
            id: event.id,
            type: 'wallet_updated',
            title: '💰 Earnings Deposited',
            message: `+$${amount.toFixed(2)} from ${event.data?.source || 'Autopilot'} added to wallet`,
            data: event.data,
            timestamp: new Date()
          };
          this.showNotification('success', notification.message, { duration: 6000 });
          onNotification?.(notification);
        }
      }
    });

    // Listen for wallet updates
    this.subscribeToEntity('IdentityWallet', (event) => {
      if (event.type === 'update') {
        const notification = {
          id: event.id,
          type: 'wallet_updated',
          title: 'Wallet Updated',
          message: `Wallet "${event.data?.wallet_name}" updated`,
          data: event.data,
          timestamp: new Date()
        };
        this.showNotification('info', notification.message);
        onNotification?.(notification);
      }
    });
  }

  // Cleanup all subscriptions
  dispose() {
    this.subscriptions.forEach(unsub => unsub?.());
    this.subscriptions = [];
    this.activeListeners.clear();
  }

  // Get notification history from current session
  getNotificationHistory() {
    return this.notificationQueue;
  }

  // Clear notification history
  clearHistory() {
    this.notificationQueue = [];
  }
}

export const notificationService = new NotificationService();