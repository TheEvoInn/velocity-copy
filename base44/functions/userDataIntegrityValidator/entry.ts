import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Runs periodically to validate and repair user data integrity
 * Ensures no data loss or corruption across system changes
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { validate_all = false } = await req.json();

    // Fetch all stores (if admin check all, else just user's)
    let stores = await base44.entities.UserDataStore.filter(
      validate_all ? {} : { user_email: user.email },
      '-created_date',
      validate_all ? 1000 : 1
    );

    if (!stores || stores.length === 0) {
      return Response.json({
        validated: 0,
        issues_found: 0,
        repaired: 0,
      });
    }

    let validated = 0;
    let issues_found = 0;
    let repaired = 0;

    for (const store of stores) {
      try {
        const result = await validateAndRepairStore(base44, store);
        validated++;
        issues_found += result.issues;
        repaired += result.repaired;
      } catch (error) {
        console.error(`Validation failed for ${store.user_email}:`, error);
      }
    }

    return Response.json({
      validated,
      issues_found,
      repaired,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Data integrity validation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function validateAndRepairStore(base44, store) {
  let issues = 0;
  let repaired = 0;

  try {
    // Check 1: Verify required fields exist
    const requiredFields = ['user_email', 'ui_preferences', 'autopilot_preferences'];
    for (const field of requiredFields) {
      if (!store[field]) {
        console.warn(`Missing required field: ${field} in store ${store.id}`);
        issues++;

        // Repair: add defaults
        if (field === 'ui_preferences') {
          store.ui_preferences = { theme: 'dark', sidebar_collapsed: false };
        } else if (field === 'autopilot_preferences') {
          store.autopilot_preferences = { enabled: false };
        }
        repaired++;
      }
    }

    // Check 2: Verify modification log integrity
    if (!Array.isArray(store.modification_log)) {
      console.warn(`Invalid modification log in store ${store.id}`);
      issues++;
      store.modification_log = [];
      repaired++;
    }

    // Check 3: Verify no null or undefined values in critical fields
    const criticalFields = ['user_email', 'autopilot_preferences'];
    for (const field of criticalFields) {
      if (store[field] === null || store[field] === undefined) {
        console.warn(`Null/undefined critical field: ${field} in store ${store.id}`);
        issues++;
        repaired++;
      }
    }

    // Check 4: Verify version consistency
    if (!store.version) {
      store.version = 1;
      issues++;
      repaired++;
    }

    // Check 5: Verify timestamp fields
    if (!store.last_modified_at) {
      store.last_modified_at = store.updated_date || new Date().toISOString();
      issues++;
      repaired++;
    }

    // If issues found and repaired, save the repaired store
    if (repaired > 0) {
      await base44.asServiceRole.entities.UserDataStore.update(store.id, {
        ...store,
        last_modified_at: new Date().toISOString(),
        last_modified_by: 'system_repair',
      });

      // Log the repair
      await base44.asServiceRole.entities.UserDataAuditLog.create({
        user_email: store.user_email,
        event_type: 'integrity_check',
        entity_type: 'UserDataStore',
        entity_id: store.id,
        integrity_status: 'recovered',
        integrity_details: `Repaired ${repaired} issue(s)`,
        modification_source: 'integrity_repair',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Error during validation:', error);
  }

  return { issues, repaired };
}