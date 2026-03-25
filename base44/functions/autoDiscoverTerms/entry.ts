import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Auto-Discover Terms — Scans forms/APIs and discovers new field labels
 * Automatically analyzes new terms and adds them to the Terminology Library
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      field_labels = [],
      source_platform = '',
      source_url = '',
      context = '',
      task_id = '',
      identity_id = '',
    } = await req.json();

    if (!field_labels || field_labels.length === 0) {
      return Response.json(
        { error: 'field_labels array required' },
        { status: 400 }
      );
    }

    console.log(
      `[autoDiscoverTerms] Processing ${field_labels.length} labels from ${source_platform}`
    );

    const discovered = [];
    const alreadyKnown = [];

    // ═══════════════════════════════════════════════════════════════════════════════
    // 1. FOR EACH LABEL, CHECK IF IT'S ALREADY IN THE LIBRARY
    // ═══════════════════════════════════════════════════════════════════════════════
    const library = await base44.asServiceRole.entities.TerminologyLibrary.list(
      '-confidence_score',
      1000
    );

    for (const label of field_labels) {
      const normalized = normalizeLabel(label);

      // Check if this exact label exists
      const existing = library.find(
        (e) =>
          e.known_labels?.some(
            (kl) => normalizeLabel(kl.label) === normalized
          )
      );

      if (existing) {
        // Update occurrence count
        const labelEntry = existing.known_labels.find(
          (kl) => normalizeLabel(kl.label) === normalized
        );
        if (labelEntry) {
          labelEntry.occurrence_count = (labelEntry.occurrence_count || 0) + 1;
          labelEntry.last_seen = new Date().toISOString();

          await base44.asServiceRole.entities.TerminologyLibrary.update(
            existing.id,
            {
              known_labels: existing.known_labels,
              last_updated: new Date().toISOString(),
            }
          );

          alreadyKnown.push({
            label,
            field_type: existing.universal_field_type,
            status: 'updated_occurrence_count',
          });
        }
      } else {
        // New term — create discovery record
        const discoveryRecord = await base44.asServiceRole.entities.DiscoveredTerms.create(
          {
            field_label: label,
            source_platform,
            source_url,
            source_context: context,
            discovered_by_task: task_id,
            discovered_by_identity: identity_id,
            analyzed_patterns: {
              base_words: extractWords(normalized),
              word_frequency: calculateWordFrequency(
                extractWords(normalized)
              ),
            },
            status: 'pending_analysis',
          }
        );

        discovered.push({
          label,
          discovery_id: discoveryRecord.id,
          status: 'pending_analysis',
        });

        console.log(
          `[autoDiscoverTerms] Created discovery record for "${label}": ${discoveryRecord.id}`
        );
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // 2. FOR EACH NEW DISCOVERY, RUN ANALYSIS & MATCH
    // ═══════════════════════════════════════════════════════════════════════════════
    for (const disc of discovered) {
      try {
        const matchResult = await base44.asServiceRole.functions.invoke(
          'fieldTypeMatcher',
          {
            field_label: disc.label,
            context,
            source_platform,
          }
        );

        if (
          matchResult.data?.best_match &&
          matchResult.data.best_match.confidence > 70
        ) {
          // High confidence match — auto-approve and add to library
          await addTermToLibrary(
            base44,
            disc.label,
            matchResult.data.best_match.universal_field_type,
            source_platform,
            context,
            matchResult.data.best_match.confidence,
            matchResult.data.best_match.reasons
          );

          disc.status = 'auto_approved';
        }
      } catch (err) {
        console.warn(
          `[autoDiscoverTerms] Analysis failed for "${disc.label}": ${err.message}`
        );
      }
    }

    return Response.json({
      success: true,
      source_platform,
      total_labels_processed: field_labels.length,
      already_known: alreadyKnown.length,
      newly_discovered: discovered.length,
      newly_discovered_details: discovered,
      already_known_details: alreadyKnown,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[autoDiscoverTerms] Error:', error);
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

function extractWords(label) {
  return label
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .map((w) => w.toLowerCase());
}

function calculateWordFrequency(words) {
  const freq = {};
  words.forEach((w) => {
    freq[w] = (freq[w] || 0) + 1;
  });
  return freq;
}

async function addTermToLibrary(
  base44,
  fieldLabel,
  fieldType,
  sourcePlatform,
  context,
  confidence,
  reasons
) {
  try {
    // Check if this field type already exists in library
    const existing = await base44.asServiceRole.entities.TerminologyLibrary.filter(
      { universal_field_type: fieldType },
      '-created_date',
      1
    );

    if (existing.length > 0) {
      // Add label to existing entry
      const entry = existing[0];
      const newLabel = {
        label: fieldLabel,
        source: sourcePlatform,
        context,
        confidence: Math.min(100, confidence),
        discovered_at: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        occurrence_count: 1,
      };

      const knownLabels = entry.known_labels || [];
      knownLabels.push(newLabel);

      await base44.asServiceRole.entities.TerminologyLibrary.update(
        entry.id,
        {
          known_labels: knownLabels,
          last_updated: new Date().toISOString(),
        }
      );

      console.log(
        `[autoDiscoverTerms] Added "${fieldLabel}" to existing type "${fieldType}"`
      );
    } else {
      // Create new library entry
      await base44.asServiceRole.entities.TerminologyLibrary.create({
        universal_field_type: fieldType,
        known_labels: [
          {
            label: fieldLabel,
            source: sourcePlatform,
            context,
            confidence: Math.min(100, confidence),
            discovered_at: new Date().toISOString(),
            last_seen: new Date().toISOString(),
            occurrence_count: 1,
          },
        ],
        last_updated: new Date().toISOString(),
      });

      console.log(
        `[autoDiscoverTerms] Created new library entry for type "${fieldType}" with label "${fieldLabel}"`
      );
    }
  } catch (err) {
    console.warn(
      `[autoDiscoverTerms] Failed to add term to library: ${err.message}`
    );
  }
}