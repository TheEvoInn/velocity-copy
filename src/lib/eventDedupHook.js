import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * useEventDeduplication Hook
 * ACTUAL FIX: Prevents duplicate event processing in React components
 * Tracks event IDs locally and ignores duplicates
 */

export function useEventDeduplication() {
  const processedEvents = useRef(new Set());
  const MAX_SIZE = 1000;

  const isDuplicate = (eventId) => {
    if (processedEvents.current.has(eventId)) {
      return true;
    }
    processedEvents.current.add(eventId);
    
    // Prevent memory bloat
    if (processedEvents.current.size > MAX_SIZE) {
      const arr = Array.from(processedEvents.current);
      arr.slice(0, 200).forEach(id => processedEvents.current.delete(id));
    }
    
    return false;
  };

  const clearProcessed = () => {
    processedEvents.current.clear();
  };

  return { isDuplicate, clearProcessed };
}