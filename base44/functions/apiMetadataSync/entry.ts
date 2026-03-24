import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * API METADATA SYNC ENGINE
 * Syncs discovered/updated APIs to all platform modules
 * Broadcasts in real-time when new APIs become available
 * Updates Autopilot, Discovery, Task Orchestration, and other systems
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, api_id, api_metadata, sync_to_modules } = await req.json();

    if (action === 'sync_new_api') {
      return await syncNewAPI(base44, api_metadata, sync_to_modules);
    } else if (action === 'sync_api_update') {
      return await syncAPIUpdate(base44, api_id, api_metadata);
    } else if (action === 'broadcast_to_autopilot') {
      return await broadcastToAutopilot(base44, api_id, api_metadata);
    } else if (action === 'sync_all_modules') {
      return await syncAllModules(base44, api_id);
    } else {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[apiMetadataSync]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Sync a newly discovered API to all systems
 */
async function syncNewAPI(base44, api_metadata, sync_to_modules) {
  const modules = sync_to_modules || [
    'autopilot',
    'discovery',
    'task_orchestration',
    'identity',
    'credential_vault',
    'notifications',
  ];

  const sync_log = {
    api_name: api_metadata.api_name,
    action: 'sync_new_api',
    modules_synced: [],
    modules_failed: [],
    timestamp: new Date().toISOString(),
  };

  // Store API metadata first
  const stored_api = await base44.entities.APIMetadata.create(api_metadata);

  for (const module of modules) {
    try {
      switch (module) {
        case 'autopilot':
          await syncToAutopilot(base44, stored_api);
          sync_log.modules_synced.push('autopilot');
          break;
        case 'discovery':
          await syncToDiscovery(base44, stored_api);
          sync_log.modules_synced.push('discovery');
          break;
        case 'task_orchestration':
          await syncToTaskOrchestration(base44, stored_api);
          sync_log.modules_synced.push('task_orchestration');
          break;
        case 'identity':
          await syncToIdentity(base44, stored_api);
          sync_log.modules_synced.push('identity');
          break;
        case 'credential_vault':
          await syncToCredentialVault(base44, stored_api);
          sync_log.modules_synced.push('credential_vault');
          break;
        case 'notifications':
          await syncToNotifications(base44, stored_api);
          sync_log.modules_synced.push('notifications');
          break;
      }
    } catch (error) {
      console.warn(`Failed to sync to ${module}:`, error.message);
      sync_log.modules_failed.push({ module, error: error.message });
    }
  }

  // Log the sync event
  await base44.entities.APIDiscoveryLog.create({
    api_id: stored_api.id,
    api_name: stored_api.api_name,
    action_type: 'integrated',
    status: sync_log.modules_failed.length === 0 ? 'success' : 'partial',
    details: sync_log,
    timestamp: new Date().toISOString(),
  });

  return Response.json({
    success: true,
    api_id: stored_api.id,
    api_name: stored_api.api_name,
    sync_log,
  });
}

/**
 * Sync API update to all systems
 */
async function syncAPIUpdate(base44, api_id, updates) {
  const api = await base44.entities.APIMetadata.get(api_id);
  if (!api) {
    return Response.json({ error: 'API not found' }, { status: 404 });
  }

  // Update API metadata
  const updated = await base44.entities.APIMetadata.update(api_id, updates);

  // Broadcast update to all modules
  await syncAllModules(base44, api_id);

  return Response.json({ success: true, updated });
}

/**
 * Sync to Autopilot
 * Make API available for task execution
 */
async function syncToAutopilot(base44, api) {
  try {
    // Call autopilot orchestrator to register API
    await base44.functions.invoke('autopilotOrchestrator', {
      action: 'register_available_api',
      api_id: api.id,
      api_name: api.api_name,
      capabilities: api.capabilities,
      endpoints: api.endpoints,
    });
  } catch (error) {
    console.warn('Autopilot sync failed:', error.message);
  }
}

/**
 * Sync to Discovery Engine
 * Link API to matching opportunity types
 */
async function syncToDiscovery(base44, api) {
  try {
    // Tag API with opportunity categories
    if (api.categories && api.categories.length > 0) {
      await base44.functions.invoke('globalOpportunityDiscovery', {
        action: 'register_api_capability',
        api_id: api.id,
        api_name: api.api_name,
        for_categories: api.categories,
      });
    }
  } catch (error) {
    console.warn('Discovery sync failed:', error.message);
  }
}

/**
 * Sync to Task Orchestration
 * Enable API for task execution workflows
 */
async function syncToTaskOrchestration(base44, api) {
  try {
    await base44.functions.invoke('taskOrchestratorEngine', {
      action: 'register_api',
      api_id: api.id,
      api_name: api.api_name,
      endpoints: api.endpoints,
      capabilities: api.capabilities,
    });
  } catch (error) {
    console.warn('Task Orchestration sync failed:', error.message);
  }
}

/**
 * Sync to Identity Engine
 * Enable identities to use the API
 */
async function syncToIdentity(base44, api) {
  try {
    await base44.functions.invoke('identityEngine', {
      action: 'add_available_api',
      api_id: api.id,
      api_name: api.api_name,
      capabilities: api.capabilities,
    });
  } catch (error) {
    console.warn('Identity sync failed:', error.message);
  }
}

/**
 * Sync to Credential Vault
 * Register credential templates for the API
 */
async function syncToCredentialVault(base44, api) {
  try {
    if (api.required_credentials_format) {
      await base44.functions.invoke('credentialVaultManager', {
        action: 'register_api_credentials',
        api_id: api.id,
        api_name: api.api_name,
        auth_type: api.endpoints?.[0]?.auth_type || 'none',
        credential_format: api.required_credentials_format,
      });
    }
  } catch (error) {
    console.warn('Credential Vault sync failed:', error.message);
  }
}

/**
 * Sync to Notifications
 * Alert admins and users of new capability
 */
async function syncToNotifications(base44, api) {
  try {
    // Create notification about new API capability
    await base44.entities.Notification.create({
      type: 'opportunity_alert',
      severity: 'info',
      title: `New API Available: ${api.api_name}`,
      message: `${api.api_name} is now available for Autopilot execution. Capabilities: ${(api.capabilities || []).join(', ')}`,
      user_email: null, // System-wide notification
      related_entity_type: 'APIMetadata',
      related_entity_id: api.id,
      delivery_channels: ['in_app'],
    });
  } catch (error) {
    console.warn('Notification sync failed:', error.message);
  }
}

/**
 * Broadcast API to Autopilot for immediate execution capability
 */
async function broadcastToAutopilot(base44, api_id, api_metadata) {
  const api = api_metadata || (await base44.entities.APIMetadata.get(api_id));
  if (!api) {
    return Response.json({ error: 'API not found' }, { status: 404 });
  }

  try {
    await syncToAutopilot(base44, api);
    return Response.json({ success: true, message: `${api.api_name} broadcast to Autopilot` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Full sync to all modules at once
 */
async function syncAllModules(base44, api_id) {
  const api = await base44.entities.APIMetadata.get(api_id);
  if (!api) {
    return Response.json({ error: 'API not found' }, { status: 404 });
  }

  const results = {
    api_id,
    api_name: api.api_name,
    synced_modules: [],
    failed_modules: [],
  };

  const modules = [
    { name: 'autopilot', fn: syncToAutopilot },
    { name: 'discovery', fn: syncToDiscovery },
    { name: 'task_orchestration', fn: syncToTaskOrchestration },
    { name: 'identity', fn: syncToIdentity },
    { name: 'credential_vault', fn: syncToCredentialVault },
    { name: 'notifications', fn: syncToNotifications },
  ];

  for (const { name, fn } of modules) {
    try {
      await fn(base44, api);
      results.synced_modules.push(name);
    } catch (error) {
      console.warn(`Sync to ${name} failed:`, error.message);
      results.failed_modules.push({ module: name, error: error.message });
    }
  }

  return Response.json(results);
}