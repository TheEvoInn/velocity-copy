import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export function useBridgeAlerts(onAlertCallback) {
  useEffect(() => {
    let unsubscribe = null;

    const setupSubscription = async () => {
      try {
        // Subscribe to Notification entity changes
        unsubscribe = base44.entities.Notification?.subscribe?.((event) => {
          if (event.type === 'create' || event.type === 'update') {
            const notification = event.data;
            
            // Transform notification to alert event
            const alertEvent = {
              type: 'notification.created',
              message: notification.message || notification.title || 'New alert',
              severity: notification.severity || 'info',
              station: mapNotificationToStation(notification.category),
              timestamp: new Date(notification.created_date || Date.now()).toISOString()
            };
            
            onAlertCallback(alertEvent);
          }
        });
      } catch (error) {
        console.warn('Bridge alerts subscription unavailable:', error.message);
        // Graceful degradation - alerts still work, just not real-time
      }
    };

    setupSubscription();

    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [onAlertCallback]);
}

/**
 * Maps notification category to bridge station
 */
function mapNotificationToStation(category) {
  const stationMap = {
    'tactical': 'tactical',
    'comms': 'comms',
    'communication': 'comms',
    'log': 'log',
    'system': 'log',
    'alert': 'log',
    'warning': 'tactical',
    'critical': 'tactical',
    'success': 'comms',
    'info': 'log'
  };
  
  return stationMap[category?.toLowerCase()] || 'log';
}

export default useBridgeAlerts;