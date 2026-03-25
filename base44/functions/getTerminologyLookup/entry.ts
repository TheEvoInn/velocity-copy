import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Get Terminology Lookup — Returns optimized library lookup for runtime use
 * Used by Autopilot, form-filling engines, and all Agentic systems
 * Provides fast, indexed access to field type mappings
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch entire library
    const library = await base44.asServiceRole.entities.TerminologyLibrary.list(
      '-confidence_score',
      10000
    );

    // Build lookup indexes
    const lookups = {
      by_type: {},
      by_normalized_label: {},
      by_api_convention: {},
      split_patterns: {},
      combined_patterns: {},
      websites: {},
    };

    for (const entry of library) {
      if (!entry.is_active) continue;

      // By type
      lookups.by_type[entry.universal_field_type] = {
        field_type: entry.universal_field_type,
        known_labels: entry.known_labels || [],
        synonyms: entry.synonyms || [],
        api_naming_conventions: entry.api_naming_conventions || [],
        data_format: entry.data_format,
        user_data_mapping: entry.user_data_field_mapping,
        validation_pattern: entry.validation_pattern,
        required: entry.required_fields,
        confidence: entry.confidence_score,
      };

      // By normalized label
      if (entry.known_labels) {
        for (const label of entry.known_labels) {
          const normalized = normalizeLabel(label.label);
          lookups.by_normalized_label[normalized] = entry.universal_field_type;
        }
      }

      // By API convention
      if (entry.api_naming_conventions) {
        for (const convention of entry.api_naming_conventions) {
          lookups.by_api_convention[convention] = entry.universal_field_type;
        }
      }

      // Split patterns
      if (entry.split_field_pattern?.length > 0) {
        lookups.split_patterns[entry.universal_field_type] = entry.split_field_pattern;
      }

      // Combined patterns
      if (entry.combined_field_pattern?.length > 0) {
        for (const component of entry.combined_field_pattern) {
          if (!lookups.combined_patterns[component]) {
            lookups.combined_patterns[component] = [];
          }
          lookups.combined_patterns[component].push(entry.universal_field_type);
        }
      }

      // Websites
      if (entry.websites_seen_on) {
        for (const website of entry.websites_seen_on) {
          if (!lookups.websites[website]) {
            lookups.websites[website] = [];
          }
          lookups.websites[website].push(entry.universal_field_type);
        }
      }
    }

    return Response.json({
      success: true,
      lookups,
      stats: {
        total_field_types: library.length,
        total_known_labels: Object.keys(lookups.by_normalized_label).length,
        total_api_conventions: Object.keys(lookups.by_api_convention).length,
        total_websites: Object.keys(lookups.websites).length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[getTerminologyLookup] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function normalizeLabel(label) {
  return label
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}