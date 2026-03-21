import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * ENTITY MUTATION LOGGER
 * ACTUAL FIX: Intercept ALL entity mutations and log them to ActivityLog
 * Runs as automation on every entity create/update/delete
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { event, data, old_data } = await req.json();

    if (!event || !data) {
      return Response.json({ success: false, reason: 'Invalid payload' });
    }

    const { type, entity_name, entity_id } = event;
    
    // Generate unique event ID for deduplication
    const eventId = `${entity_name}_${entity_id}_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Determine action description
    let actionType = 'update';
    let description = '';
    
    if (type === 'create') {
      actionType = 'create';
      description = `✚ Created ${entity_name} #${entity_id}`;
    } else if (type === 'update') {
      actionType = 'update';
      // Log which fields changed
      const changes = [];
      if (data && old_data) {
        Object.keys(data).forEach(key => {
          if (data[key] !== old_data[key]) {
            changes.push(`${key}: ${old_data[key]} → ${data[key]}`);
          }
        });
      }
      description = `⟳ Updated ${entity_name} #${entity_id}${changes.length > 0 ? `: ${changes.slice(0, 3).join(', ')}` : ''}`;
    } else if (type === 'delete') {
      actionType = 'delete';
      description = `✕ Deleted ${entity_name} #${entity_id}`;
    }

    // Log to ActivityLog with unique event ID
    const logEntry = {
      action_type: actionType,
      message: description,
      severity: 'info',
      metadata: {
        entity_name: entity_name,
        entity_id: entity_id,
        mutation_type: type,
        event_id: eventId,
        timestamp: new Date().toISOString(),
        user_email: user.email
      }
    };

    // Only add data if it's not too large
    if (JSON.stringify(data).length < 10000) {
      logEntry.metadata.data_snapshot = data;
    }

    await base44.entities.ActivityLog.create(logEntry).catch(err => {
      console.error('Failed to log mutation:', err);
    });

    return Response.json({
      success: true,
      logged: {
        entity: entity_name,
        id: entity_id,
        type: type,
        event_id: eventId
      }
    });

  } catch (error) {
    console.error('Mutation logger error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});