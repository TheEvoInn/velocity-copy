import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import OpenAI from 'npm:openai@4.47.1';

/**
 * KYC Document Analyzer
 * Uses OpenAI Vision to:
 * 1. Extract name, DOB, expiry, ID number from government ID images
 * 2. Compare selfie to ID photo (face match)
 * 3. Cross-validate extracted data against submitted form data
 * 4. Compute autopilot clearance levels
 * 5. Sync verified PII to the linked AIIdentity
 *
 * Actions:
 *   analyze_documents  — run full AI analysis on a KYC record (admin only)
 *   sync_to_identity   — push verified KYC data to an AIIdentity record (admin only)
 *   get_analysis       — retrieve stored analysis for a KYC record (admin only)
 */

const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });

    const body = await req.json();
    const { action, kyc_id, identity_id } = body;

    if (action === 'analyze_documents') {
      return await analyzeDocuments(base44, kyc_id, user);
    }

    if (action === 'sync_to_identity') {
      return await syncToIdentity(base44, kyc_id, identity_id, user);
    }

    if (action === 'get_analysis') {
      const all = await base44.asServiceRole.entities.KYCVerification.list('-created_date', 500);
      const kyc = all.find(r => r.id === kyc_id);
      if (!kyc) return Response.json({ error: 'KYC record not found' }, { status: 404 });
      return Response.json({ ai_analysis: kyc.ai_analysis || null, ai_analysis_status: kyc.ai_analysis_status });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[kycDocAnalyzer] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function analyzeDocuments(base44, kyc_id, adminUser) {
  console.log(`[kycDocAnalyzer] Starting analysis for KYC: ${kyc_id}`);

  // Load KYC record
  const all = await base44.asServiceRole.entities.KYCVerification.list('-created_date', 500);
  const kyc = all.find(r => r.id === kyc_id);
  if (!kyc) return Response.json({ error: 'KYC record not found' }, { status: 404 });

  // Mark as pending
  await base44.asServiceRole.entities.KYCVerification.update(kyc_id, {
    ai_analysis_status: 'pending'
  });

  const analysisResult = {
    analyzed_at: new Date().toISOString(),
    analysis_version: '1.0',
    id_front: null,
    id_back: null,
    face_match: null,
    cross_validation: null,
    extracted_pii: null,
    autopilot_clearance: null,
    error: null
  };

  try {
    // Step 1: Extract data from ID Front
    if (kyc.id_document_front_url) {
      console.log('[kycDocAnalyzer] Analyzing ID front...');
      analysisResult.id_front = await extractIDData(kyc.id_document_front_url, 'front');
    }

    // Step 2: Extract data from ID Back
    if (kyc.id_document_back_url) {
      console.log('[kycDocAnalyzer] Analyzing ID back...');
      analysisResult.id_back = await extractIDBackData(kyc.id_document_back_url);
    }

    // Step 3: Face match — compare selfie to ID front
    if (kyc.selfie_url && kyc.id_document_front_url) {
      console.log('[kycDocAnalyzer] Running face match...');
      analysisResult.face_match = await runFaceMatch(kyc.id_document_front_url, kyc.selfie_url);
    }

    // Step 4: Cross-validate extracted data against submitted form data
    analysisResult.cross_validation = crossValidate(kyc, analysisResult.id_front);

    // Step 5: Build consolidated PII from best sources
    const extracted = analysisResult.id_front || {};
    analysisResult.extracted_pii = {
      full_legal_name: extracted.extracted_name || kyc.full_legal_name,
      date_of_birth: extracted.extracted_dob || kyc.date_of_birth,
      id_number: extracted.extracted_id_number || kyc.government_id_number,
      id_type: extracted.id_type_detected || kyc.government_id_type,
      id_expiry: extracted.extracted_expiry || kyc.government_id_expiry,
      address: extracted.extracted_address || kyc.residential_address,
      ssn_provided: !!(kyc.tax_id),
      tax_id_provided: !!(kyc.tax_id)
    };

    // Step 6: Determine autopilot clearance
    const verdict = analysisResult.cross_validation?.overall_verdict;
    const faceScore = analysisResult.face_match?.match_score || 0;
    const hasSSN = !!(kyc.tax_id);
    const isApproved = kyc.status === 'approved' || kyc.admin_status === 'approved';

    analysisResult.autopilot_clearance = {
      can_submit_w9: isApproved && hasSSN,
      can_submit_1099_forms: isApproved && hasSSN,
      can_submit_grant_applications: isApproved && verdict !== 'fail',
      can_use_government_portals: isApproved && verdict === 'pass',
      can_submit_financial_onboarding: isApproved && faceScore >= 70,
      can_attach_id_documents: isApproved && !!(kyc.id_document_front_url),
      kyc_tier: isApproved ? (hasSSN ? 'enhanced' : 'standard') : 'none'
    };

    // Save analysis back to KYC record
    await base44.asServiceRole.entities.KYCVerification.update(kyc_id, {
      ai_analysis: analysisResult,
      ai_analysis_status: 'completed',
      access_log: [
        ...(kyc.access_log || []),
        {
          accessed_at: new Date().toISOString(),
          accessed_by: adminUser.email,
          purpose: 'ai_document_analysis',
          module: 'kycDocAnalyzer'
        }
      ]
    });

    console.log(`[kycDocAnalyzer] Analysis complete for KYC: ${kyc_id}`);
    return Response.json({ success: true, ai_analysis: analysisResult });

  } catch (error) {
    analysisResult.error = error.message;
    await base44.asServiceRole.entities.KYCVerification.update(kyc_id, {
      ai_analysis: analysisResult,
      ai_analysis_status: 'failed'
    });
    throw error;
  }
}

async function extractIDData(imageUrl, side) {
  const prompt = `You are a KYC document analysis system. Analyze this government ID (${side} side) image.

Extract ALL visible information precisely:
- Full legal name (exactly as printed)
- Date of birth (ISO format YYYY-MM-DD)
- Document expiry date (ISO format YYYY-MM-DD)
- Document/ID number (exactly as printed)
- Address (if visible)
- Document type (passport, drivers_license, national_id, state_id)
- Issuing country (2-letter ISO code)
- Issuing state/province (if applicable)
- Any signs of tampering, alteration, or digital manipulation

Respond in JSON only:
{
  "extracted_name": "string or null",
  "extracted_dob": "YYYY-MM-DD or null",
  "extracted_expiry": "YYYY-MM-DD or null", 
  "extracted_id_number": "string or null",
  "extracted_address": "string or null",
  "id_type_detected": "passport|drivers_license|national_id|state_id|unknown",
  "issuing_country": "2-letter ISO code or null",
  "issuing_state": "string or null",
  "confidence_score": 0-100,
  "is_expired": true|false,
  "tampering_detected": true|false,
  "raw_text": "all visible text concatenated"
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } }
        ]
      }
    ],
    max_tokens: 800,
    response_format: { type: 'json_object' }
  });

  const text = response.choices[0].message.content;
  return JSON.parse(text);
}

async function extractIDBackData(imageUrl) {
  const prompt = `Analyze the back of this government ID document.
Extract: barcode data, MRZ (machine-readable zone) data, any additional fields.
Respond in JSON only:
{
  "barcode_data": "string or null",
  "mrz_data": "string or null", 
  "additional_info": "string or null",
  "confidence_score": 0-100
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } }
        ]
      }
    ],
    max_tokens: 400,
    response_format: { type: 'json_object' }
  });

  return JSON.parse(response.choices[0].message.content);
}

async function runFaceMatch(idImageUrl, selfieUrl) {
  const prompt = `You are a biometric face verification system. Compare the face on the government ID document to the selfie photo.

Analyze:
1. Are the faces of the same person? Consider lighting, angle, aging
2. Does the selfie show a live person (not a photo of a photo)?
3. Similarity score 0-100 (70+ = likely same person, 85+ = strong match)

Respond in JSON only:
{
  "match_score": 0-100,
  "match_verdict": "match|likely_match|likely_mismatch|mismatch|inconclusive",
  "liveness_check": true|false,
  "notes": "brief explanation"
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'text', text: 'Image 1 — Government ID:' },
          { type: 'image_url', image_url: { url: idImageUrl, detail: 'high' } },
          { type: 'text', text: 'Image 2 — Selfie:' },
          { type: 'image_url', image_url: { url: selfieUrl, detail: 'high' } }
        ]
      }
    ],
    max_tokens: 300,
    response_format: { type: 'json_object' }
  });

  return JSON.parse(response.choices[0].message.content);
}

function crossValidate(kyc, extracted) {
  if (!extracted) {
    return {
      name_matches_submitted: null,
      dob_matches_submitted: null,
      expiry_valid: null,
      discrepancies: ['No extracted data available'],
      overall_verdict: 'review_required'
    };
  }

  const discrepancies = [];

  // Name match (case-insensitive, partial match allowed)
  const submittedName = (kyc.full_legal_name || '').toLowerCase().trim();
  const extractedName = (extracted.extracted_name || '').toLowerCase().trim();
  const nameMatches = submittedName && extractedName && (
    submittedName === extractedName ||
    submittedName.includes(extractedName.split(' ')[0]) ||
    extractedName.includes(submittedName.split(' ')[0])
  );
  if (!nameMatches && extractedName) {
    discrepancies.push(`Name mismatch: submitted "${kyc.full_legal_name}", extracted "${extracted.extracted_name}"`);
  }

  // DOB match
  const submittedDOB = kyc.date_of_birth || '';
  const extractedDOB = extracted.extracted_dob || '';
  const dobMatches = submittedDOB && extractedDOB && submittedDOB === extractedDOB;
  if (!dobMatches && extractedDOB) {
    discrepancies.push(`DOB mismatch: submitted "${submittedDOB}", extracted "${extractedDOB}"`);
  }

  // Expiry valid
  const expiryValid = extracted.is_expired === false;
  if (extracted.is_expired) {
    discrepancies.push(`ID document is expired (expiry: ${extracted.extracted_expiry})`);
  }

  // Tampering
  if (extracted.tampering_detected) {
    discrepancies.push('Potential document tampering detected');
  }

  let verdict = 'pass';
  if (discrepancies.length > 0) {
    verdict = extracted.tampering_detected || extracted.is_expired ? 'fail' : 'review_required';
  }

  return {
    name_matches_submitted: nameMatches,
    dob_matches_submitted: dobMatches,
    expiry_valid: expiryValid,
    discrepancies,
    overall_verdict: verdict
  };
}

async function syncToIdentity(base44, kyc_id, identity_id, adminUser) {
  console.log(`[kycDocAnalyzer] Syncing KYC ${kyc_id} to identity ${identity_id}`);

  // Load KYC
  const all = await base44.asServiceRole.entities.KYCVerification.list('-created_date', 500);
  const kyc = all.find(r => r.id === kyc_id);
  if (!kyc) return Response.json({ error: 'KYC record not found' }, { status: 404 });

  if (kyc.status !== 'approved' && kyc.admin_status !== 'approved') {
    return Response.json({ error: 'KYC must be approved before syncing to identity' }, { status: 400 });
  }

  // Load identity — if no specific one, find the active identity for this user's email
  let identityRecord = null;
  if (identity_id) {
    const ids = await base44.asServiceRole.entities.AIIdentity.filter({ id: identity_id }, null, 1);
    identityRecord = ids[0];
  }
  if (!identityRecord) {
    // Try to find active identity
    const activeIds = await base44.asServiceRole.entities.AIIdentity.filter({ is_active: true }, null, 1);
    identityRecord = activeIds[0];
  }
  if (!identityRecord) {
    return Response.json({ error: 'No identity found to sync to' }, { status: 404 });
  }

  const analysis = kyc.ai_analysis || {};
  const pii = analysis.extracted_pii || {};
  const clearance = analysis.autopilot_clearance || {};
  const faceMatch = analysis.face_match || {};

  // Build kyc_verified_data payload
  const kycVerifiedData = {
    kyc_id: kyc.id,
    synced_at: new Date().toISOString(),
    kyc_tier: clearance.kyc_tier || (kyc.status === 'approved' ? 'standard' : 'none'),
    full_legal_name: pii.full_legal_name || kyc.full_legal_name,
    date_of_birth: pii.date_of_birth || kyc.date_of_birth,
    residential_address: pii.address || kyc.residential_address,
    city: kyc.city,
    state: kyc.state,
    postal_code: kyc.postal_code,
    country: kyc.country,
    phone_number: kyc.phone_number,
    email: kyc.email_verified,
    government_id_type: pii.id_type || kyc.government_id_type,
    government_id_number: pii.id_number || kyc.government_id_number,
    government_id_expiry: pii.id_expiry || kyc.government_id_expiry,
    tax_id: kyc.tax_id || null,
    ssn_last4: kyc.tax_id ? kyc.tax_id.slice(-4) : null,
    id_document_front_url: kyc.id_document_front_url,
    id_document_back_url: kyc.id_document_back_url,
    selfie_url: kyc.selfie_url,
    ai_extracted_name: pii.full_legal_name,
    ai_extracted_dob: pii.date_of_birth,
    ai_extracted_id_number: pii.id_number,
    ai_extracted_expiry: pii.id_expiry,
    face_match_score: faceMatch.match_score || null,
    autopilot_clearance: {
      can_submit_w9: clearance.can_submit_w9 || false,
      can_submit_1099_forms: clearance.can_submit_1099_forms || false,
      can_submit_grant_applications: clearance.can_submit_grant_applications || false,
      can_use_government_portals: clearance.can_use_government_portals || false,
      can_submit_financial_onboarding: clearance.can_submit_financial_onboarding || false,
      can_attach_id_documents: clearance.can_attach_id_documents || false
    }
  };

  await base44.asServiceRole.entities.AIIdentity.update(identityRecord.id, {
    kyc_verified_data: kycVerifiedData
  });

  // Also update KYC record with allowed modules
  const allowedModules = [];
  if (clearance.can_submit_w9) allowedModules.push('w9_forms');
  if (clearance.can_submit_grant_applications) allowedModules.push('grant_applications');
  if (clearance.can_use_government_portals) allowedModules.push('government_portals');
  if (clearance.can_submit_financial_onboarding) allowedModules.push('financial_onboarding');
  if (clearance.can_attach_id_documents) allowedModules.push('id_document_tasks');

  await base44.asServiceRole.entities.KYCVerification.update(kyc_id, {
    allowed_modules: allowedModules,
    access_log: [
      ...(kyc.access_log || []),
      {
        accessed_at: new Date().toISOString(),
        accessed_by: adminUser.email,
        purpose: 'sync_to_identity',
        module: 'kycDocAnalyzer'
      }
    ]
  });

  console.log(`[kycDocAnalyzer] Synced KYC to identity "${identityRecord.name}"`);
  return Response.json({
    success: true,
    identity_name: identityRecord.name,
    identity_id: identityRecord.id,
    kyc_tier: kycVerifiedData.kyc_tier,
    allowed_modules: allowedModules,
    autopilot_clearance: kycVerifiedData.autopilot_clearance
  });
}