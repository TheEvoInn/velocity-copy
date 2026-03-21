import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export function useBridgeAlerts(onAlert) {
  useEffect(() => {
    if (!onAlert) return;

    // Subscribe to notification changes
    const unsubscribe = base44.entities.Notification.subscribe((event) => {
      if (event.type === 'create' || event.type === 'update') {
        const notification = event.data;

        // Convert to alert event
        const alertEvent = {
          type: notification.action_type || notification.severity,
          message: notification.message,
          severity: notification.severity || 'info',
          station: mapMetadataToStation(notification.metadata),
          timestamp: Date.now()
        };

        // Trigger callback
        onAlert(alertEvent);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [onAlert]);
}

// Map notification metadata to station location
function mapMetadataToStation(metadata) {
  if (!metadata) return null;

  const metaStr = JSON.stringify(metadata).toLowerCase();

  if (metaStr.includes('financial') || metaStr.includes('balance') || metaStr.includes('wallet')) {
    return 'tactical'; // Financial station
  } else if (metaStr.includes('identity') || metaStr.includes('profile') || metaStr.includes('account')) {
    return 'comms'; // Identity/account station
  } else if (metaStr.includes('task') || metaStr.includes('job') || metaStr.includes('opportunity')) {
    return 'log'; // Task/logging station
  }

  return null; // Broadcast to center
}

export default useBridgeAlerts;