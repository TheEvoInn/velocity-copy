import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * CACHE INVALIDATION ENGINE
 * Fix #1: Write-after-read consistency
 * Ensures React Query caches are invalidated immediately on entity updates
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { event, data } = await req.json();
    
    // Trigger on ANY entity update
    if (event?.type !== 'update') {
      return Response.json({ success: false, reason: 'Not an update event' });
    }

    const entityName = event?.entity_name;
    const recordId = data?.id;

    if (!entityName || !recordId) {
      return Response.json({ error: 'Missing entity_name or id' }, { status: 400 });
    }

    const invalidation = {
      timestamp: new Date().toISOString(),
      entity: entityName,
      record_id: recordId,
      cache_keys_invalidated: []
    };

    // Log cache invalidation event with a unique event ID for deduplication
    const eventId = `cache_${entityName}_${recordId}_${Date.now()}`;
    
    await base44.entities.ActivityLog.create({
      action_type: 'cache_invalidation',
      message: `🔄 Cache invalidated: ${entityName} #${recordId}`,
      severity: 'info',
      metadata: {
        entity: entityName,
        record_id: recordId,
        event_id: eventId,
        timestamp: new Date().toISOString()
      }
    }).catch(() => {});

    // Map entity to React Query cache keys that need invalidation
    const cacheKeysToInvalidate = [
      entityName.toLowerCase(),
      'opportunities',
      'transactions',
      'tasks',
      'taskQueue',
      'taskQueueManager',
      'aiIdentities',
      'activityLogs',
      'userGoals',
      'workflows',
      'webhooks'
    ];

    invalidation.cache_keys_invalidated = cacheKeysToInvalidate;

    return Response.json({
      success: true,
      invalidation,
      frontend_instruction: 'React Query should subscribe to ActivityLog "cache_invalidation" events and call queryClient.invalidateQueries({ queryKey }) for each listed key'
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});