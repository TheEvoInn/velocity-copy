import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * AUDIT USER RECORDS
 * Deep search of ALL entity types for records associated with target user
 * Searches by: created_by, email fields, identity links, platform account references
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const { target_email = 'dawnvernor@yahoo.com' } = body;

    const audit = {
      timestamp: new Date().toISOString(),
      target_email,
      entity_search_results: {},
    };

    // List of all entities to search
    const entitiesToSearch = [
      'CredentialVault',
      'KYCVerification',
      'LinkedAccount',
      'LinkedAccountCreation',
      'AIIdentity',
      'UserGoals',
      'Opportunity',
      'TaskExecutionQueue',
      'Transaction',
      'WalletTransaction',
      'InPlatformEmail',
      'PlatformCredential',
      'EncryptedCredential',
      'Notification',
      'UserIntervention',
      'ActivityLog',
    ];

    console.log(`[AUDIT] Searching ${entitiesToSearch.length} entities for ${target_email}`);

    for (const entityName of entitiesToSearch) {
      try {
        const results = await base44.asServiceRole.entities[entityName].list('-created_date', 200).catch(e => {
          console.warn(`[AUDIT] Could not list ${entityName}: ${e.message}`);
          return [];
        });

        const recordsArray = Array.isArray(results) ? results : [];
        
        // Search for records matching target_email in ANY field
        const matches = recordsArray.filter(record => {
          const asString = JSON.stringify(record).toLowerCase();
          return asString.includes(target_email.toLowerCase());
        });

        if (matches.length > 0) {
          audit.entity_search_results[entityName] = {
            total_records: recordsArray.length,
            matches_found: matches.length,
            record_ids: matches.map(m => ({ id: m.id, created_by: m.created_by, created_date: m.created_date })),
          };
          console.log(`[AUDIT] ${entityName}: ${matches.length} matches found`);
        }
      } catch (e) {
        console.error(`[AUDIT] Error searching ${entityName}: ${e.message}`);
      }
    }

    return Response.json({ success: true, audit });
  } catch (error) {
    console.error('[auditUserRecords]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});