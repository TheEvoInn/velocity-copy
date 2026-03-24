import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * TAX FORM GENERATOR
 * Generates W-9, 1099-NEC forms with pre-filled data
 * Stores forms in Vault for export
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, form_type, user_email, quarter, year, tax_record_id } = body;

    if (action === 'generate_form') {
      return await generateForm(base44, user_email || user.email, form_type, quarter, year, tax_record_id);
    }

    if (action === 'export_form') {
      return await exportForm(base44, tax_record_id);
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('[taxFormGenerator]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function generateForm(base44, userEmail, formType, quarter, year, taxRecordId) {
  console.log(`[taxFormGenerator] Generating ${formType} for ${userEmail}`);

  try {
    // Fetch tax record from vault
    let taxData = null;
    
    if (taxRecordId) {
      const record = await base44.asServiceRole.entities.CredentialVault.filter(
        { id: taxRecordId },
        null,
        1
      ).then(r => r[0]).catch(() => null);
      
      if (record?.encrypted_payload) {
        taxData = JSON.parse(record.encrypted_payload);
      }
    } else if (quarter && year) {
      const record = await base44.asServiceRole.entities.CredentialVault.filter({
        platform: 'tax_system',
        linked_account_id: `${userEmail}-Q${quarter}-${year}`
      }, null, 1).then(r => r[0]).catch(() => null);
      
      if (record?.encrypted_payload) {
        taxData = JSON.parse(record.encrypted_payload);
      }
    }

    if (!taxData) {
      return Response.json({ error: 'Tax data not found' }, { status: 404 });
    }

    // Get KYC data for form population
    const identities = await base44.asServiceRole.entities.AIIdentity.filter(
      { user_email: userEmail },
      '-created_date',
      1
    ).catch(() => []);

    const identity = identities[0] || {};
    const kycData = identity.kyc_verified_data || {};

    let formContent = '';
    let formFileName = '';

    if (formType === 'w9') {
      formContent = generateW9Form(userEmail, taxData, kycData);
      formFileName = `W-9_${userEmail}_${new Date().getFullYear()}.txt`;
    } else if (formType === '1099-nec') {
      formContent = generate1099NECForm(userEmail, taxData, kycData);
      formFileName = `1099-NEC_${userEmail}_${taxData.tax_year}.txt`;
    } else {
      return Response.json({ error: 'Invalid form type' }, { status: 400 });
    }

    // Store form in vault
    const formRecord = await base44.asServiceRole.entities.CredentialVault.create({
      platform: 'tax_system',
      credential_type: 'tax_form',
      linked_account_id: `${userEmail}-${formType}-${taxData.tax_year}`,
      is_active: true,
      encrypted_payload: JSON.stringify({
        form_type: formType,
        form_name: formFileName,
        form_content: formContent,
        taxpayer_name: taxData.taxpayer_name || kycData.full_legal_name,
        taxpayer_email: userEmail,
        tax_year: taxData.tax_year || new Date().getFullYear(),
        quarter: taxData.quarter,
        generated_date: new Date().toISOString(),
        gross_income: taxData.gross_income,
        net_income: taxData.net_income,
        ready_for_export: true
      }),
      access_log: [{
        timestamp: new Date().toISOString(),
        task_id: 'tax_form_generation',
        action: 'generate',
        purpose: `${formType}_form_generation`
      }]
    }).catch(err => {
      console.warn(`[taxFormGenerator] Form storage failed: ${err.message}`);
      return null;
    });

    // Send notification
    await base44.asServiceRole.entities.Notification.create({
      user_email: userEmail,
      type: 'tax_form_ready',
      title: `📄 ${formType.toUpperCase()} Form Generated`,
      message: `Your ${formType.toUpperCase()} form has been generated and is ready for export. Contains pre-filled income and address information.`,
      action_type: 'tax_form_generated',
      related_entity_type: 'CredentialVault',
      related_entity_id: formRecord?.id,
      priority: 'high'
    }).catch(err => console.warn(`[taxFormGenerator] Notification failed: ${err.message}`));

    // Log activity
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `📄 ${formType.toUpperCase()} form generated for ${userEmail} (${taxData.tax_year})`,
      severity: 'info',
      metadata: {
        user_email: userEmail,
        form_type: formType,
        tax_year: taxData.tax_year,
        form_record_id: formRecord?.id,
        gross_income: taxData.gross_income
      }
    }).catch(() => null);

    console.log(`[taxFormGenerator] ${formType} generated: ${formFileName}`);

    return Response.json({
      success: true,
      form_type: formType,
      form_name: formFileName,
      user_email: userEmail,
      form_record_id: formRecord?.id,
      tax_year: taxData.tax_year,
      gross_income: taxData.gross_income,
      ready_for_export: true
    });

  } catch (error) {
    console.error('[taxFormGenerator] Form generation failed:', error.message);
    throw error;
  }
}

async function exportForm(base44, formRecordId) {
  console.log(`[taxFormGenerator] Exporting form ${formRecordId}`);

  try {
    const record = await base44.asServiceRole.entities.CredentialVault.filter(
      { id: formRecordId },
      null,
      1
    ).then(r => r[0]).catch(() => null);

    if (!record) {
      return Response.json({ error: 'Form not found' }, { status: 404 });
    }

    const formData = JSON.parse(record.encrypted_payload);

    // Create downloadable content
    const exportData = {
      success: true,
      form_type: formData.form_type,
      form_name: formData.form_name,
      form_content: formData.form_content,
      taxpayer_name: formData.taxpayer_name,
      taxpayer_email: formData.taxpayer_email,
      tax_year: formData.tax_year,
      generated_date: formData.generated_date,
      export_timestamp: new Date().toISOString()
    };

    // Log export access
    await base44.asServiceRole.entities.CredentialVault.update(formRecordId, {
      access_log: [...(record.access_log || []), {
        timestamp: new Date().toISOString(),
        task_id: 'form_export',
        action: 'export',
        purpose: 'user_form_download'
      }]
    }).catch(() => null);

    return Response.json(exportData);

  } catch (error) {
    console.error('[taxFormGenerator] Export failed:', error.message);
    throw error;
  }
}

function generateW9Form(email, taxData, kycData) {
  const name = taxData.taxpayer_name || kycData.full_legal_name || 'Name';
  const ssn = kycData.ssn_last4 ? `xxx-xx-${kycData.ssn_last4}` : 'xxx-xx-xxxx';
  const address = taxData.taxpayer_address || kycData.residential_address || '';
  const city = taxData.taxpayer_city || kycData.city || '';
  const state = taxData.taxpayer_state || kycData.state || '';
  const zip = taxData.taxpayer_zip || kycData.postal_code || '';
  const date = new Date().toLocaleDateString();

  return `
FORM W-9
Request for Taxpayer Identification Number and Certification

Generated: ${date}

1. Name: ${name}
2. Business Name (if different): N/A
3. Federal Income Tax Classification: Individual / Self-Employed
4. Address: ${address}
5. City, State, ZIP: ${city}, ${state} ${zip}
6. Account Numbers: ${email}
7. Taxpayer Identification Number (TIN): ${ssn}

Certification:
I certify that the TIN shown on this form is correct (or I am waiting for a number to be issued).

Signature: _________________________  Date: __________

Statement: I certify under penalty of perjury that I am a U.S. citizen or other U.S. person and that the number shown on this form is my correct taxpayer identification number.

Generated by VELOCITY Tax System
This is a pre-filled form template. Please review and sign before submission.
`;
}

function generate1099NECForm(email, taxData, kycData) {
  const name = taxData.taxpayer_name || kycData.full_legal_name || 'Name';
  const ssn = kycData.ssn_last4 ? `xxx-xx-${kycData.ssn_last4}` : 'xxx-xx-xxxx';
  const address = taxData.taxpayer_address || kycData.residential_address || '';
  const city = taxData.taxpayer_city || kycData.city || '';
  const state = taxData.taxpayer_state || kycData.state || '';
  const zip = taxData.taxpayer_zip || kycData.postal_code || '';
  const year = taxData.tax_year || new Date().getFullYear();
  const grossIncome = (taxData.gross_income || 0).toFixed(2);
  const date = new Date().toLocaleDateString();

  return `
FORM 1099-NEC
Nonemployee Compensation

Generated: ${date}

RECIPIENT INFORMATION:
Name: ${name}
Address: ${address}
City, State, ZIP: ${city}, ${state} ${zip}
Account Number: ${email}
TIN: ${ssn}

TAX YEAR: ${year}

Nonemployee Compensation (Box 1): $${grossIncome}

PAYER INFORMATION:
Payer Name: VELOCITY Platform
Contact: payments@velocity.platform
Payer TIN: 12-3456789
Payer Address: San Francisco, CA

PAYMENTS SUMMARY:
This form reports income from independent contractor work performed through the VELOCITY platform.
All amounts are reported as nonemployee compensation subject to self-employment tax.

Certification:
This form is a preliminary document generated by VELOCITY Tax System.
It requires final verification and authorization from the payer before official filing.

Instructions for Recipient:
1. Review accuracy of all information
2. Report amounts on Schedule C (Form 1040)
3. Calculate self-employment tax on Schedule SE
4. Provide completed/signed form to tax professional
5. Keep copy for your records

Disclaimer: This is a pre-filled template. Verify all amounts and information before submitting to tax authorities.
`;
}