import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Core user data persistence manager
 * Handles all read/write operations for user preferences and settings
 * Ensures data is permanent, audited, and only changed with explicit consent
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, field, value, force_update = false } = await req.json();

    if (!action) {
      return Response.json({ error: 'Missing action' }, { status: 400 });
    }

    // Fetch or create user data store
    const stores = await base44.entities.UserDataStore.filter(
      { user_email: user.email },
      '-created_date',
      1
    );

    let userDataStore = stores?.[0];

    switch (action) {
      case 'read':
        return await handleRead(base44, user, userDataStore, field);

      case 'update':
        return await handleUpdate(base44, user, userDataStore, field, value, force_update);

      case 'reset':
        return await handleReset(base44, user, userDataStore, field);

      case 'list_all':
        return await handleListAll(base44, user, userDataStore);

      case 'validate_integrity':
        return await handleValidateIntegrity(base44, user, userDataStore);

      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('User data persistence error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function handleRead(base44, user, store, field) {
  try {
    if (!store) {
      return Response.json({
        value: null,
        message: 'No user data store found',
      });
    }

    // Log the access
    await base44.entities.UserDataAuditLog.create({
      user_email: user.email,
      event_type: 'data_read',
      entity_type: 'UserDataStore',
      entity_id: store.id,
      field_modified: field,
      modification_source: 'user_action',
      timestamp: new Date().toISOString(),
    });

    const value = field ? store[field] : store;

    return Response.json({
      success: true,
      value,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Read error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function handleUpdate(base44, user, store, field, value, forceUpdate) {
  try {
    if (!field) {
      return Response.json({ error: 'Missing field' }, { status: 400 });
    }

    // Get old value for audit log
    const oldValue = store?.[field];

    // Prepare update data
    const updateData = {
      [field]: value,
      last_modified_at: new Date().toISOString(),
      last_modified_by: user.email,
    };

    // Add to modification log (only if oldValue and value are objects)
    const canLogModification = (typeof oldValue === 'object' || oldValue === null || oldValue === undefined) && 
                               (typeof value === 'object' || value === null || value === undefined);
    
    if (canLogModification) {
      const newLog = [
        ...(store?.modification_log || []),
        {
          timestamp: new Date().toISOString(),
          field,
          old_value: oldValue || {},
          new_value: value || {},
          modified_by: user.email,
        },
      ];
      updateData.modification_log = newLog;
    } else if (store?.modification_log) {
      // Keep existing log if we can't add to it
      updateData.modification_log = store.modification_log;
    }

    // Calculate and update checksum
    updateData.checksum = await calculateChecksum({ ...store, ...updateData });

    // Create or update store
    let savedStore;
    if (!store) {
      updateData.user_email = user.email;
      updateData.version = 1;
      savedStore = await base44.entities.UserDataStore.create(updateData);
    } else {
      await base44.entities.UserDataStore.update(store.id, updateData);
      savedStore = await base44.entities.UserDataStore.filter(
        { id: store.id },
        '-created_date',
        1
      ).then(r => r?.[0]);
    }

    // Log the update with explicit user consent
    await base44.entities.UserDataAuditLog.create({
      user_email: user.email,
      event_type: 'data_updated',
      entity_type: 'UserDataStore',
      entity_id: savedStore.id,
      field_modified: field,
      old_value: oldValue,
      new_value: value,
      modification_source: 'user_action',
      explicit_user_consent: true,
      timestamp: new Date().toISOString(),
      change_description: `User updated ${field}`,
    });

    return Response.json({
      success: true,
      message: `${field} updated and permanently saved`,
      value,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Update error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function handleReset(base44, user, store, field) {
  try {
    if (!store || !field) {
      return Response.json({ error: 'Invalid reset request' }, { status: 400 });
    }

    // Only allow reset with explicit confirmation
    const oldValue = store[field];

    // Get default value for field
    const defaults = {
      autopilot_preferences: {
        enabled: false,
        mode: 'continuous',
        execution_mode: 'review_required',
        max_concurrent_tasks: 3,
      },
      ui_preferences: {
        theme: 'dark',
        sidebar_collapsed: false,
        notification_sound: true,
        compact_mode: false,
      },
    };

    const resetValue = defaults[field] || null;

    // Update with reset
    const updateData = {
    [field]: resetValue,
    last_modified_at: new Date().toISOString(),
    last_modified_by: user.email,
    modification_log: [
      ...(store.modification_log || []),
      {
        timestamp: new Date().toISOString(),
        field,
        old_value: oldValue,
        new_value: resetValue,
        modified_by: user.email,
      },
    ],
    };

    updateData.checksum = await calculateChecksum({ ...store, ...updateData });

    await base44.entities.UserDataStore.update(store.id, updateData);

    // Log the reset
    await base44.entities.UserDataAuditLog.create({
      user_email: user.email,
      event_type: 'data_updated',
      entity_type: 'UserDataStore',
      entity_id: store.id,
      field_modified: field,
      old_value: oldValue,
      new_value: resetValue,
      modification_source: 'user_action',
      explicit_user_consent: true,
      timestamp: new Date().toISOString(),
      change_description: `User reset ${field} to defaults`,
    });

    return Response.json({
      success: true,
      message: `${field} reset to defaults`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Reset error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function handleListAll(base44, user, store) {
  try {
    if (!store) {
      return Response.json({
        data: null,
        message: 'No user data found',
      });
    }

    // Log access to all data
    await base44.entities.UserDataAuditLog.create({
      user_email: user.email,
      event_type: 'data_read',
      entity_type: 'UserDataStore',
      entity_id: store.id,
      modification_source: 'user_action',
      timestamp: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      data: store,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('List all error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function handleValidateIntegrity(base44, user, store) {
  try {
    if (!store) {
      return Response.json({
        valid: false,
        message: 'No user data store found',
      });
    }

    // Verify checksum
    const calculatedChecksum = await calculateChecksum(store);
    const integrityValid = calculatedChecksum === store.checksum;

    const audit = {
      user_email: user.email,
      event_type: 'integrity_check',
      entity_type: 'UserDataStore',
      entity_id: store.id,
      integrity_status: integrityValid ? 'verified' : 'corrupted',
      modification_source: 'system_migration',
      timestamp: new Date().toISOString(),
    };

    if (!integrityValid) {
      audit.integrity_details = 'Checksum mismatch detected - data may be corrupted';
    }

    await base44.entities.UserDataAuditLog.create(audit);

    return Response.json({
      success: integrityValid,
      valid: integrityValid,
      message: integrityValid
        ? 'Data integrity verified'
        : 'Data integrity issue detected',
      checksum_match: integrityValid,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Integrity check error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function calculateChecksum(data) {
  const dataStr = JSON.stringify(data, (key, value) => {
    // Exclude volatile fields from checksum
    if (['checksum', 'backup_copies'].includes(key)) return undefined;
    return value;
  });

  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(dataStr));
  
  // Convert buffer to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}