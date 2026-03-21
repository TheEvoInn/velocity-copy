import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * EVENT DEDUPLICATION SERVICE
 * ACTUAL FIX: Track processed event IDs to prevent duplicate handling
 * Stores recent event IDs in a rolling window (last 1000 events)
 */

const eventWindow = new Set();
const MAX_WINDOW = 1000;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event_id, action } = await req.json();

    if (action === 'check') {
      // Check if event was already processed
      const isDuplicate = eventWindow.has(event_id);
      
      if (!isDuplicate) {
        eventWindow.add(event_id);
        // Keep window size manageable
        if (eventWindow.size > MAX_WINDOW) {
          const arr = Array.from(eventWindow);
          arr.slice(0, 100).forEach(id => eventWindow.delete(id));
        }
      }

      return Response.json({
        success: true,
        event_id,
        isDuplicate,
        windowSize: eventWindow.size
      });
    }

    if (action === 'clear') {
      eventWindow.clear();
      return Response.json({ success: true, message: 'Event window cleared' });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});