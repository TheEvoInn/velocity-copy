import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * UNIVERSAL MUTATION LOGGER
 * ACTUAL FIX: Server-side endpoint that wraps entity mutations
 * All mutation functions call this first to ensure logging
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { entity_name, operation, record_id, data, old_data } = await req.json();

    if (!entity_name || !operation) {
      return Response.json({ error: 'Missing entity_name or operation' }, { status: 400 });
    }

    // Generate unique event ID
    const eventId = `${entity_name}_${record_id || 'new'}_${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Perform the actual mutation
    let result = null;
    let error = null;

    try {
      const entityRef = base44.entities[entity_name];
      
      if (!entityRef) {
        throw new Error(`Entity ${entity_name} not found`);
      }

      if (operation === 'create') {
        result = await entityRef.create(data);
      } else if (operation === 'update') {
        result = await entityRef.update(record_id, data);
      } else if (operation === 'delete') {
        await entityRef.delete(record_id);
        result = { id: record_id, deleted: true };
      } else {
        throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (err) {
      error = err.message;
      console.error(`Mutation error: ${entity_name}.${operation}:`, err);
    }

    // Log to ActivityLog immediately (before returning)
    const logEntry = {
      action_type: operation === 'create' ? 'create' : operation === 'update' ? 'update' : 'delete',
      message: `⟳ ${operation.toUpperCase()} ${entity_name}${record_id ? ` #${record_id}` : ''}`,
      severity: error ? 'warning' : 'info',
      metadata: {
        entity_name,
        entity_id: result?.id || record_id,
        operation,
        event_id: eventId,
        timestamp: new Date().toISOString(),
        success: !error,
        error: error || null
      }
    };

    // Add data snapshot if not too large
    if (data && JSON.stringify(data).length < 5000) {
      logEntry.metadata.data = data;
    }
    if (old_data && JSON.stringify(old_data).length < 5000) {
      logEntry.metadata.old_data = old_data;
    }

    // Log synchronously before returning
    await base44.entities.ActivityLog.create(logEntry).catch(err => {
      console.error('Failed to log mutation:', err);
    });

    if (error) {
      return Response.json({ success: false, error, logged: true }, { status: 400 });
    }

    return Response.json({
      success: true,
      result,
      logged: true,
      event_id: eventId
    });

  } catch (error) {
    console.error('Universal logger error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});