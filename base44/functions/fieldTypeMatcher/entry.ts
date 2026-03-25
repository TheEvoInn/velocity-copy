import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Field Type Matcher — Intelligent field label recognition
 * Matches any field label to a universal field type using the Terminology Library
 * Returns the best match + alternatives + confidence scores
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { field_label, context = '', source_platform = '' } = await req.json();

    if (!field_label) {
      return Response.json({ error: 'field_label required' }, { status: 400 });
    }

    console.log(`[fieldTypeMatcher] Analyzing: "${field_label}" from ${source_platform}`);

    // ═══════════════════════════════════════════════════════════════════════════════
    // 1. PREPROCESS THE LABEL
    // ═══════════════════════════════════════════════════════════════════════════════
    const normalized = normalizeLabel(field_label);
    const baseWords = extractWords(normalized);

    console.log(`[fieldTypeMatcher] Normalized: "${normalized}"`);
    console.log(`[fieldTypeMatcher] Base words: [${baseWords.join(', ')}]`);

    // ═══════════════════════════════════════════════════════════════════════════════
    // 2. SEARCH TERMINOLOGY LIBRARY FOR EXACT OR PARTIAL MATCHES
    // ═══════════════════════════════════════════════════════════════════════════════
    const library = await base44.asServiceRole.entities.TerminologyLibrary.list(
      '-confidence_score',
      1000
    );

    const matches = [];

    for (const entry of library) {
      let score = 0;
      const reasons = [];

      // Direct label match
      const labelMatch = entry.known_labels?.find(
        (l) => normalizeLabel(l.label) === normalized
      );
      if (labelMatch) {
        score += 95;
        reasons.push(`exact_label_match(${labelMatch.confidence})`);
      }

      // Synonym match
      if (
        entry.synonyms?.some(
          (s) =>
            normalized.includes(normalizeLabel(s)) ||
            normalizeLabel(s).includes(normalized)
        )
      ) {
        score += 85;
        reasons.push('synonym_match');
      }

      // API naming convention match
      if (
        entry.api_naming_conventions?.some(
          (a) => normalizeLabel(a) === normalized
        )
      ) {
        score += 90;
        reasons.push('api_convention_match');
      }

      // Word-based semantic matching
      const wordMatch = calculateWordOverlap(baseWords, entry);
      if (wordMatch > 0.5) {
        score += Math.floor(wordMatch * 70);
        reasons.push(`word_overlap(${(wordMatch * 100).toFixed(0)}%)`);
      }

      if (score > 30) {
        matches.push({
          universal_field_type: entry.universal_field_type,
          confidence: Math.min(100, score),
          reasons,
          entry,
        });
      }
    }

    // Sort by confidence
    matches.sort((a, b) => b.confidence - a.confidence);

    console.log(`[fieldTypeMatcher] Found ${matches.length} potential matches`);

    // ═══════════════════════════════════════════════════════════════════════════════
    // 3. IF NO MATCH, CREATE DISCOVERY RECORD FOR ADMIN REVIEW
    // ═══════════════════════════════════════════════════════════════════════════════
    let bestMatch = matches[0];
    if (!bestMatch || bestMatch.confidence < 60) {
      console.log(`[fieldTypeMatcher] No confident match found, creating discovery record`);

      try {
        const discovery = await base44.asServiceRole.entities.DiscoveredTerms.create({
          field_label,
          source_platform,
          source_context: context,
          discovered_by_identity: user.id,
          analyzed_patterns: {
            base_words: baseWords,
            word_frequency: calculateWordFrequency(baseWords),
          },
          best_match_type: bestMatch?.universal_field_type || 'unknown',
          match_confidence: bestMatch?.confidence || 0,
          alternative_matches: matches.slice(0, 3).map((m) => ({
            field_type: m.universal_field_type,
            confidence: m.confidence,
          })),
          status: 'pending_admin_review',
        });

        console.log(
          `[fieldTypeMatcher] Discovery record created: ${discovery.id}`
        );
      } catch (err) {
        console.warn(
          `[fieldTypeMatcher] Failed to create discovery record: ${err.message}`
        );
      }
    }

    return Response.json({
      field_label,
      normalized,
      best_match: bestMatch
        ? {
            universal_field_type: bestMatch.universal_field_type,
            confidence: bestMatch.confidence,
            reasons: bestMatch.reasons,
            user_data_mapping: bestMatch.entry.user_data_field_mapping,
          }
        : null,
      alternatives: matches.slice(1, 4).map((m) => ({
        universal_field_type: m.universal_field_type,
        confidence: m.confidence,
      })),
      requires_discovery: !bestMatch || bestMatch.confidence < 60,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[fieldTypeMatcher] Error:', error);
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

function calculateWordOverlap(baseWords, libraryEntry) {
  if (!libraryEntry.known_labels || baseWords.length === 0)
    return 0;

  let totalSimilarity = 0;
  let countMatches = 0;

  for (const label of libraryEntry.known_labels) {
    const libraryWords = extractWords(normalizeLabel(label.label));
    const overlap = baseWords.filter((w) =>
      libraryWords.some((lw) => lw.includes(w) || w.includes(lw))
    ).length;

    if (overlap > 0) {
      totalSimilarity += overlap / Math.max(baseWords.length, libraryWords.length);
      countMatches++;
    }
  }

  return countMatches > 0 ? totalSimilarity / countMatches : 0;
}