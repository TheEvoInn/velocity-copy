import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Autopilot Form Filling with Terminology — Fills forms using intelligent field matching
 * Integrates Terminology Library into actual form execution
 * Called by TaskExecutionQueue when a form needs to be filled
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      task_execution_id,
      form_fields = [],
      identity_id = '',
      user_data = {},
    } = await req.json();

    if (!form_fields || form_fields.length === 0) {
      return Response.json({ error: 'form_fields required' }, { status: 400 });
    }

    console.log(
      `[autopilotFormFillingWithTerminology] Processing ${form_fields.length} form fields`
    );

    // ═══════════════════════════════════════════════════════════════════════════════
    // 1. GET TERMINOLOGY LOOKUP
    // ═══════════════════════════════════════════════════════════════════════════════
    const lookupResult = await base44.asServiceRole.functions.invoke(
      'getTerminologyLookup',
      {}
    );
    const lookups = lookupResult.data?.lookups;

    if (!lookups) {
      return Response.json(
        { error: 'Failed to load terminology library' },
        { status: 500 }
      );
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // 2. MATCH EACH FORM FIELD TO UNIVERSAL TYPE & GET USER DATA
    // ═══════════════════════════════════════════════════════════════════════════════
    const filled_fields = [];
    const unmatched_fields = [];
    const discovered_terms = [];

    for (const field of form_fields) {
      const fieldName = field.name || field.label || '';
      const normalized = normalizeLabel(fieldName);

      console.log(
        `[autopilotFormFillingWithTerminology] Matching field: "${fieldName}"`
      );

      // Try direct normalized match
      const directMatch = lookups.by_normalized_label[normalized];
      if (directMatch) {
        const fieldTypeData = lookups.by_type[directMatch];
        const value = extractUserDataForFieldType(
          directMatch,
          user_data,
          fieldTypeData.user_data_mapping
        );

        if (value) {
          filled_fields.push({
            field_name: fieldName,
            universal_field_type: directMatch,
            value,
            matched_by: 'direct_label',
            confidence: 95,
          });
          continue;
        }
      }

      // Try API convention match
      const apiMatch = lookups.by_api_convention[fieldName];
      if (apiMatch) {
        const fieldTypeData = lookups.by_type[apiMatch];
        const value = extractUserDataForFieldType(
          apiMatch,
          user_data,
          fieldTypeData.user_data_mapping
        );

        if (value) {
          filled_fields.push({
            field_name: fieldName,
            universal_field_type: apiMatch,
            value,
            matched_by: 'api_convention',
            confidence: 90,
          });
          continue;
        }
      }

      // Try word-based semantic matching
      let bestMatch = null;
      let bestScore = 0;

      for (const [type, typeData] of Object.entries(lookups.by_type)) {
        const score = calculateFieldSimilarity(
          normalized,
          typeData.known_labels
        );
        if (score > bestScore && score > 0.5) {
          bestScore = score;
          bestMatch = { type, data: typeData };
        }
      }

      if (bestMatch) {
        const value = extractUserDataForFieldType(
          bestMatch.type,
          user_data,
          bestMatch.data.user_data_mapping
        );

        if (value) {
          filled_fields.push({
            field_name: fieldName,
            universal_field_type: bestMatch.type,
            value,
            matched_by: 'semantic_match',
            confidence: Math.floor(bestScore * 100),
          });
          continue;
        }
      }

      // No match — record for discovery
      unmatched_fields.push({
        field_name: fieldName,
        field_label: field.label || fieldName,
        field_type: field.type || 'text',
        reason: 'no_match_found',
      });

      discovered_terms.push({
        field_label: fieldName,
        source_platform: 'task_execution',
        source_context: `Task ${task_execution_id}`,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // 3. TRIGGER AUTO-DISCOVERY FOR UNMATCHED FIELDS
    // ═══════════════════════════════════════════════════════════════════════════════
    if (discovered_terms.length > 0) {
      try {
        await base44.asServiceRole.functions.invoke('autoDiscoverTerms', {
          field_labels: discovered_terms.map((t) => t.field_label),
          source_platform: 'autopilot_form_fill',
          source_url: '',
          context: `Task execution ${task_execution_id}`,
          task_id: task_execution_id,
          identity_id,
        });

        console.log(
          `[autopilotFormFillingWithTerminology] Discovered ${discovered_terms.length} new terms`
        );
      } catch (err) {
        console.warn(
          `[autopilotFormFillingWithTerminology] Discovery failed: ${err.message}`
        );
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // 4. LOG EXECUTION RESULTS
    // ═══════════════════════════════════════════════════════════════════════════════
    const fillRate = (filled_fields.length / form_fields.length) * 100;

    try {
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `📋 Form filling with Terminology Library — ${filled_fields.length}/${form_fields.length} fields matched (${fillRate.toFixed(0)}%)`,
        severity: fillRate > 80 ? 'success' : 'warning',
        metadata: {
          task_execution_id,
          total_fields: form_fields.length,
          filled: filled_fields.length,
          unmatched: unmatched_fields.length,
          fill_rate: fillRate,
          newly_discovered: discovered_terms.length,
        },
      });
    } catch (err) {
      console.warn(
        `[autopilotFormFillingWithTerminology] Failed to log activity: ${err.message}`
      );
    }

    return Response.json({
      success: true,
      task_execution_id,
      total_fields: form_fields.length,
      filled_fields: filled_fields.length,
      unmatched_fields: unmatched_fields.length,
      fill_rate: fillRate,
      form_data: filled_fields.reduce(
        (acc, f) => {
          acc[f.field_name] = f.value;
          return acc;
        },
        {}
      ),
      matched_details: filled_fields,
      unmatched_details: unmatched_fields,
      newly_discovered_count: discovered_terms.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[autopilotFormFillingWithTerminology] Error:', error);
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

function calculateFieldSimilarity(normalizedField, knownLabels) {
  let maxSimilarity = 0;

  for (const label of knownLabels) {
    const normalizedLabel = normalizeLabel(label.label);
    const similarity = stringSimilarity(normalizedField, normalizedLabel);
    maxSimilarity = Math.max(maxSimilarity, similarity);
  }

  return maxSimilarity;
}

function stringSimilarity(a, b) {
  const aWords = a.split(' ');
  const bWords = b.split(' ');

  let matches = 0;
  for (const word of aWords) {
    if (bWords.some((w) => w.includes(word) || word.includes(w))) {
      matches++;
    }
  }

  return matches / Math.max(aWords.length, bWords.length);
}

function extractUserDataForFieldType(
  fieldType,
  userData,
  userDataMapping
) {
  if (!userDataMapping) return null;

  // Simplified extraction — in real implementation would query entities
  const mappingKey = userDataMapping.field;
  return userData[mappingKey] || null;
}