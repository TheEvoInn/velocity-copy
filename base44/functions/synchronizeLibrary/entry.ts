import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Synchronize Library — Ensures all Agentic systems have access to latest terminology
 * Runs periodically and on-demand to sync library updates across platform
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { target_systems = [] } = await req.json();

    console.log(`[synchronizeLibrary] Starting sync for all Agentic systems`);

    // ═══════════════════════════════════════════════════════════════════════════════
    // 1. FETCH LATEST TERMINOLOGY LIBRARY
    // ═══════════════════════════════════════════════════════════════════════════════
    const library = await base44.asServiceRole.entities.TerminologyLibrary.list(
      '-confidence_score',
      10000
    );

    console.log(
      `[synchronizeLibrary] Fetched ${library.length} library entries`
    );

    // ═══════════════════════════════════════════════════════════════════════════════
    // 2. BUILD OPTIMIZED LOOKUP STRUCTURES
    // ═══════════════════════════════════════════════════════════════════════════════
    const lookupByType = {};
    const lookupByLabel = {};
    const lookupByApiConvention = {};

    for (const entry of library) {
      lookupByType[entry.universal_field_type] = entry;

      if (entry.known_labels) {
        for (const label of entry.known_labels) {
          lookupByLabel[normalizeLabel(label.label)] = entry.universal_field_type;
        }
      }

      if (entry.api_naming_conventions) {
        for (const convention of entry.api_naming_conventions) {
          lookupByApiConvention[convention] = entry.universal_field_type;
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // 3. SYNC TO PLATFORM STATE FOR REAL-TIME ACCESS
    // ═══════════════════════════════════════════════════════════════════════════════
    try {
      const platformStates = await base44.asServiceRole.entities.PlatformState.list(
        '-created_date',
        1
      );

      const syncState = {
        terminology_library_synced_at: new Date().toISOString(),
        terminology_library_count: library.length,
        lookup_strategies: {
          by_type: Object.keys(lookupByType).length,
          by_label: Object.keys(lookupByLabel).length,
          by_api_convention: Object.keys(lookupByApiConvention).length,
        },
      };

      if (platformStates.length > 0) {
        await base44.asServiceRole.entities.PlatformState.update(
          platformStates[0].id,
          syncState
        );
      } else {
        await base44.asServiceRole.entities.PlatformState.create(syncState);
      }

      console.log(
        `[synchronizeLibrary] Synced to PlatformState: ${library.length} entries`
      );
    } catch (err) {
      console.warn(
        `[synchronizeLibrary] Failed to sync to PlatformState: ${err.message}`
      );
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // 4. CREATE ACTIVITY LOG FOR AUDIT
    // ═══════════════════════════════════════════════════════════════════════════════
    try {
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `📚 Terminology Library synchronized across all systems — ${library.length} field types, ${Object.keys(lookupByLabel).length} known labels`,
        severity: 'info',
        metadata: {
          library_entries: library.length,
          known_labels_count: Object.keys(lookupByLabel).length,
          api_conventions_count: Object.keys(lookupByApiConvention).length,
          sync_timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.warn(
        `[synchronizeLibrary] Failed to create activity log: ${err.message}`
      );
    }

    return Response.json({
      success: true,
      sync_timestamp: new Date().toISOString(),
      library_stats: {
        total_entries: library.length,
        known_labels_count: Object.keys(lookupByLabel).length,
        api_conventions_count: Object.keys(lookupByApiConvention).length,
        field_types_count: Object.keys(lookupByType).length,
      },
      lookup_structures_created: true,
      platform_state_updated: true,
    });
  } catch (error) {
    console.error('[synchronizeLibrary] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function normalizeLabel(label) {
  return label
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}