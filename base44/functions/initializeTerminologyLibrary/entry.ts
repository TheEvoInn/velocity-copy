import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Initialize Terminology Library — Seeds with core field types
 * Run once to populate the library with universal field mappings
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.email || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log(`[initializeTerminologyLibrary] Starting initialization`);

    const coreFieldTypes = [
      {
        universal_field_type: 'full_name',
        known_labels: [
          { label: 'Full Name', source: 'common', confidence: 100 },
          { label: 'Legal Name', source: 'common', confidence: 95 },
          { label: 'Your Name', source: 'common', confidence: 90 },
          { label: 'Full legal name', source: 'kyc', confidence: 100 },
          { label: 'Name', source: 'common', confidence: 70 },
        ],
        synonyms: ['legal_name', 'account_name', 'display_name'],
        api_naming_conventions: [
          'fullName',
          'full_name',
          'name_full',
          'legal_name',
          'full_legal_name',
        ],
        split_field_pattern: ['first_name', 'last_name'],
        combined_field_pattern: [],
        websites_seen_on: [
          'upwork',
          'fiverr',
          'stripe',
          'paypal',
          'generic_forms',
        ],
        data_format: 'text',
        user_data_field_mapping: {
          source: 'AIIdentity',
          field: 'name',
        },
        required_fields: true,
      },
      {
        universal_field_type: 'first_name',
        known_labels: [
          { label: 'First Name', source: 'common', confidence: 100 },
          { label: 'Given Name', source: 'common', confidence: 95 },
          { label: 'First', source: 'common', confidence: 85 },
        ],
        synonyms: ['given_name', 'forename'],
        api_naming_conventions: ['firstName', 'first_name', 'given_name'],
        split_field_pattern: [],
        combined_field_pattern: ['full_name'],
        websites_seen_on: [
          'upwork',
          'fiverr',
          'stripe',
          'paypal',
        ],
        data_format: 'text',
        user_data_field_mapping: {
          source: 'AIIdentity',
          field: 'first_name',
        },
        required_fields: true,
      },
      {
        universal_field_type: 'last_name',
        known_labels: [
          { label: 'Last Name', source: 'common', confidence: 100 },
          { label: 'Surname', source: 'common', confidence: 95 },
          { label: 'Family Name', source: 'common', confidence: 90 },
          { label: 'Last', source: 'common', confidence: 85 },
        ],
        synonyms: ['surname', 'family_name'],
        api_naming_conventions: ['lastName', 'last_name', 'surname', 'family_name'],
        split_field_pattern: [],
        combined_field_pattern: ['full_name'],
        websites_seen_on: [
          'upwork',
          'fiverr',
          'stripe',
          'paypal',
        ],
        data_format: 'text',
        user_data_field_mapping: {
          source: 'AIIdentity',
          field: 'last_name',
        },
        required_fields: true,
      },
      {
        universal_field_type: 'email',
        known_labels: [
          { label: 'Email', source: 'common', confidence: 100 },
          { label: 'Email Address', source: 'common', confidence: 100 },
          { label: 'E-mail', source: 'common', confidence: 95 },
          { label: 'Work Email', source: 'common', confidence: 90 },
        ],
        synonyms: ['email_address', 'e_mail'],
        api_naming_conventions: ['email', 'emailAddress', 'email_address'],
        split_field_pattern: [],
        combined_field_pattern: [],
        websites_seen_on: ['all'],
        data_format: 'email',
        user_data_field_mapping: {
          source: 'User',
          field: 'email',
        },
        required_fields: true,
        validation_pattern: '^[^@]+@[^@]+\\.[^@]+$',
      },
      {
        universal_field_type: 'phone',
        known_labels: [
          { label: 'Phone', source: 'common', confidence: 100 },
          { label: 'Phone Number', source: 'common', confidence: 100 },
          { label: 'Telephone', source: 'common', confidence: 95 },
          { label: 'Mobile', source: 'common', confidence: 90 },
        ],
        synonyms: ['phone_number', 'telephone', 'mobile'],
        api_naming_conventions: ['phone', 'phoneNumber', 'phone_number', 'tel'],
        split_field_pattern: [],
        combined_field_pattern: [],
        websites_seen_on: ['all'],
        data_format: 'phone',
        user_data_field_mapping: {
          source: 'KYCVerification',
          field: 'phone_number',
        },
        required_fields: false,
      },
      {
        universal_field_type: 'date_of_birth',
        known_labels: [
          { label: 'Date of Birth', source: 'common', confidence: 100 },
          { label: 'DOB', source: 'common', confidence: 95 },
          { label: 'Birth Date', source: 'common', confidence: 95 },
          { label: 'Date of birth', source: 'kyc', confidence: 100 },
        ],
        synonyms: ['dob', 'birth_date', 'birthdate'],
        api_naming_conventions: [
          'dateOfBirth',
          'date_of_birth',
          'dob',
          'birth_date',
        ],
        split_field_pattern: [],
        combined_field_pattern: [],
        websites_seen_on: ['kyc', 'banking', 'insurance'],
        data_format: 'date',
        user_data_field_mapping: {
          source: 'KYCVerification',
          field: 'date_of_birth',
        },
        required_fields: false,
      },
      {
        universal_field_type: 'address_residential',
        known_labels: [
          { label: 'Address', source: 'common', confidence: 100 },
          { label: 'Street Address', source: 'common', confidence: 95 },
          { label: 'Residential Address', source: 'kyc', confidence: 100 },
          { label: 'Mailing Address', source: 'common', confidence: 90 },
        ],
        synonyms: ['street_address', 'home_address', 'mailing_address'],
        api_naming_conventions: [
          'address',
          'streetAddress',
          'street_address',
          'homeAddress',
        ],
        split_field_pattern: ['address_line1', 'address_line2'],
        combined_field_pattern: [],
        websites_seen_on: ['all'],
        data_format: 'text',
        user_data_field_mapping: {
          source: 'KYCVerification',
          field: 'residential_address',
        },
        required_fields: false,
      },
      {
        universal_field_type: 'username',
        known_labels: [
          { label: 'Username', source: 'common', confidence: 100 },
          { label: 'User Name', source: 'common', confidence: 95 },
          { label: 'Login Name', source: 'common', confidence: 90 },
          { label: 'Handle', source: 'common', confidence: 85 },
        ],
        synonyms: ['user_name', 'login_name', 'handle'],
        api_naming_conventions: [
          'username',
          'user_name',
          'login_name',
          'user_id',
        ],
        split_field_pattern: [],
        combined_field_pattern: [],
        websites_seen_on: ['all'],
        data_format: 'text',
        user_data_field_mapping: {
          source: 'AIIdentity',
          field: 'name',
        },
        required_fields: true,
      },
      {
        universal_field_type: 'password',
        known_labels: [
          { label: 'Password', source: 'common', confidence: 100 },
          { label: 'Pwd', source: 'common', confidence: 90 },
          { label: 'Pass', source: 'common', confidence: 85 },
        ],
        synonyms: ['pwd', 'pass'],
        api_naming_conventions: [
          'password',
          'passwd',
          'pwd',
          'pass',
        ],
        split_field_pattern: [],
        combined_field_pattern: [],
        websites_seen_on: ['all'],
        data_format: 'text',
        user_data_field_mapping: null,
        required_fields: true,
      },
      {
        universal_field_type: 'government_id_type',
        known_labels: [
          { label: 'Government ID Type', source: 'kyc', confidence: 100 },
          { label: 'ID Type', source: 'kyc', confidence: 95 },
          { label: 'Document Type', source: 'kyc', confidence: 90 },
        ],
        synonyms: ['id_type', 'document_type', 'id_document_type'],
        api_naming_conventions: ['governmentIdType', 'id_type', 'document_type'],
        split_field_pattern: [],
        combined_field_pattern: [],
        websites_seen_on: ['kyc', 'banking'],
        data_format: 'select',
        user_data_field_mapping: {
          source: 'KYCVerification',
          field: 'government_id_type',
        },
        required_fields: false,
      },
      {
        universal_field_type: 'bank_account_number',
        known_labels: [
          { label: 'Account Number', source: 'banking', confidence: 100 },
          { label: 'Bank Account Number', source: 'banking', confidence: 100 },
          { label: 'Account #', source: 'banking', confidence: 90 },
        ],
        synonyms: ['account_num', 'acct_number'],
        api_naming_conventions: [
          'accountNumber',
          'account_number',
          'bank_account',
        ],
        split_field_pattern: [],
        combined_field_pattern: [],
        websites_seen_on: ['stripe', 'paypal', 'banking'],
        data_format: 'text',
        user_data_field_mapping: null,
        required_fields: false,
      },
      {
        universal_field_type: 'terms_agree',
        known_labels: [
          { label: 'I agree to the terms', source: 'common', confidence: 100 },
          { label: 'Accept terms and conditions', source: 'common', confidence: 95 },
          { label: 'I accept the ToS', source: 'common', confidence: 90 },
          { label: 'Terms of Service', source: 'common', confidence: 90 },
        ],
        synonyms: ['terms_conditions', 'accept_tos', 'agree_terms'],
        api_naming_conventions: [
          'termsAgreed',
          'terms_agreed',
          'accept_terms',
          'terms_accepted',
        ],
        split_field_pattern: [],
        combined_field_pattern: [],
        websites_seen_on: ['all'],
        data_format: 'checkbox',
        user_data_field_mapping: null,
        required_fields: true,
      },
    ];

    // ═══════════════════════════════════════════════════════════════════════════════
    // SEED THE LIBRARY
    // ═══════════════════════════════════════════════════════════════════════════════
    let created = 0;
    for (const fieldType of coreFieldTypes) {
      try {
        const existing = await base44.asServiceRole.entities.TerminologyLibrary.filter(
          { universal_field_type: fieldType.universal_field_type },
          '-created_date',
          1
        );

        if (existing.length === 0) {
          await base44.asServiceRole.entities.TerminologyLibrary.create({
            ...fieldType,
            last_updated: new Date().toISOString(),
            confidence_score: 100,
            is_active: true,
          });

          created++;
        }
      } catch (err) {
        console.warn(
          `[initializeTerminologyLibrary] Failed to create ${fieldType.universal_field_type}: ${err.message}`
        );
      }
    }

    console.log(
      `[initializeTerminologyLibrary] Initialized ${created} core field types`
    );

    // ═══════════════════════════════════════════════════════════════════════════════
    // SYNC LIBRARY ACROSS PLATFORM
    // ═══════════════════════════════════════════════════════════════════════════════
    await base44.asServiceRole.functions.invoke('synchronizeLibrary', {});

    return Response.json({
      success: true,
      core_field_types_created: created,
      message: `Terminology Library initialized with ${created} core field types`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[initializeTerminologyLibrary] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});