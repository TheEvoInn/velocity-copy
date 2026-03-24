import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * TAX AUTOMATION ENGINE
 * Monitors wallet earnings, calculates quarterly estimated taxes
 * Triggers form generation, stores in Vault, sends notifications
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, user_email, quarter, year } = body;

    if (action === 'calculate_quarterly_taxes') {
      return await calculateQuarterlyTaxes(base44, user_email || user.email, quarter, year);
    }

    if (action === 'calculate_annual_summary') {
      return await calculateAnnualSummary(base44, user_email || user.email, year || new Date().getFullYear());
    }

    if (action === 'monitor_and_trigger') {
      // Called by scheduler to check all users and trigger quarterly calculations
      if (user.role !== 'admin') {
        return Response.json({ error: 'Admin access required' }, { status: 403 });
      }
      return await monitorAndTrigger(base44);
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('[taxAutomationEngine]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function getQuarterDates(quarter, year) {
  const q = parseInt(quarter);
  const y = parseInt(year);
  
  const starts = [
    new Date(y, 0, 1),   // Q1: Jan 1
    new Date(y, 3, 1),   // Q2: Apr 1
    new Date(y, 6, 1),   // Q3: Jul 1
    new Date(y, 9, 1)    // Q4: Oct 1
  ];
  
  const ends = [
    new Date(y, 2, 31),  // Q1: Mar 31
    new Date(y, 5, 30),  // Q2: Jun 30
    new Date(y, 8, 30),  // Q3: Sep 30
    new Date(y, 11, 31)  // Q4: Dec 31
  ];
  
  return { start: starts[q - 1], end: ends[q - 1] };
}

async function calculateQuarterlyTaxes(base44, userEmail, quarter, year) {
  const now = new Date();
  const currentYear = year || now.getFullYear();
  const currentQuarter = quarter || Math.ceil((now.getMonth() + 1) / 3);

  console.log(`[taxAutomationEngine] Calculating Q${currentQuarter} ${currentYear} taxes for ${userEmail}`);

  try {
    // Fetch user transactions for the quarter
    const { start, end } = await getQuarterDates(currentQuarter, currentYear);
    
    const transactions = await base44.asServiceRole.entities.Transaction.filter(
      { created_by: userEmail },
      '-created_date',
      1000
    ).then(txns => 
      txns.filter(t => {
        const txnDate = new Date(t.created_date);
        return txnDate >= start && txnDate <= end && t.type === 'income';
      })
    ).catch(() => []);

    // Calculate totals
    const grossIncome = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalFees = transactions.reduce((sum, t) => sum + (t.platform_fee || 0), 0);
    const totalTaxWithheld = transactions.reduce((sum, t) => sum + (t.tax_withheld || 0), 0);
    const netIncome = grossIncome - totalFees;

    // Tax calculation (self-employment + income tax)
    // Self-employment tax: 15.3% on 92.35% of net earnings
    const seIncome = netIncome * 0.9235;
    const seTax = seIncome * 0.153;
    
    // Estimated income tax (rough 20% bracket)
    const incomeTax = netIncome * 0.20;
    const estimatedQuarterlyTax = seTax + incomeTax;

    // Fetch user profile for tax info
    const goals = await base44.asServiceRole.entities.UserGoals.filter(
      { created_by: userEmail },
      null,
      1
    ).then(r => r[0]).catch(() => null);

    const identities = await base44.asServiceRole.entities.AIIdentity.filter(
      { user_email: userEmail },
      '-created_date',
      1
    ).catch(() => []);

    const identity = identities[0] || {};
    const kycData = identity.kyc_verified_data || {};

    // Create or update TaxRecord
    const taxRecord = {
      user_email: userEmail,
      tax_year: currentYear,
      quarter: currentQuarter,
      period_start: start.toISOString(),
      period_end: end.toISOString(),
      gross_income: grossIncome,
      platform_fees: totalFees,
      tax_withheld: totalTaxWithheld,
      net_income: netIncome,
      self_employment_income: seIncome,
      self_employment_tax: seTax,
      estimated_income_tax: incomeTax,
      estimated_quarterly_tax: estimatedQuarterlyTax,
      transaction_count: transactions.length,
      calculation_date: new Date().toISOString(),
      form_generated: false,
      form_type: 'estimated_quarterly',
      taxpayer_name: kycData.full_legal_name || identity.name,
      taxpayer_ssn_last4: kycData.ssn_last4,
      taxpayer_address: kycData.residential_address,
      taxpayer_city: kycData.city,
      taxpayer_state: kycData.state,
      taxpayer_zip: kycData.postal_code
    };

    // Store in vault-like record (use CredentialVault or create TaxRecord entity)
    const taxRecordData = await base44.asServiceRole.entities.CredentialVault.create({
      platform: 'tax_system',
      credential_type: 'tax_record',
      linked_account_id: `${userEmail}-Q${currentQuarter}-${currentYear}`,
      is_active: true,
      encrypted_payload: JSON.stringify(taxRecord),
      access_log: [{
        timestamp: new Date().toISOString(),
        task_id: 'quarterly_tax_calc',
        action: 'create',
        purpose: 'quarterly_tax_calculation'
      }]
    }).catch(err => {
      console.warn(`[taxAutomationEngine] Tax record storage failed: ${err.message}`);
      return null;
    });

    console.log(`[taxAutomationEngine] Q${currentQuarter} calculation: $${estimatedQuarterlyTax.toFixed(2)} est. quarterly tax`);

    // Send notification
    await base44.asServiceRole.entities.Notification.create({
      user_email: userEmail,
      type: 'tax_alert',
      title: `📊 Q${currentQuarter} ${currentYear} Estimated Tax Calculated`,
      message: `Your Q${currentQuarter} estimated quarterly tax is $${estimatedQuarterlyTax.toFixed(2)} on $${netIncome.toFixed(2)} net income. W-9/1099 form generation available.`,
      action_type: 'tax_calculation_complete',
      related_entity_type: 'CredentialVault',
      related_entity_id: taxRecordData?.id,
      priority: 'high'
    }).catch(err => console.warn(`[taxAutomationEngine] Notification failed: ${err.message}`));

    // Log activity
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `📈 Q${currentQuarter} ${currentYear} tax calculation: Gross $${grossIncome.toFixed(2)}, Est. Tax $${estimatedQuarterlyTax.toFixed(2)}`,
      severity: 'info',
      metadata: {
        user_email: userEmail,
        quarter: currentQuarter,
        year: currentYear,
        gross_income: grossIncome,
        estimated_quarterly_tax: estimatedQuarterlyTax,
        tax_record_id: taxRecordData?.id
      }
    }).catch(() => null);

    return Response.json({
      success: true,
      quarter: currentQuarter,
      year: currentYear,
      user_email: userEmail,
      gross_income: grossIncome,
      net_income: netIncome,
      estimated_quarterly_tax: estimatedQuarterlyTax,
      self_employment_tax: seTax,
      estimated_income_tax: incomeTax,
      tax_withheld: totalTaxWithheld,
      transaction_count: transactions.length,
      tax_record_id: taxRecordData?.id,
      ready_for_form_generation: true
    });

  } catch (error) {
    console.error('[taxAutomationEngine] Calculation failed:', error.message);
    throw error;
  }
}

async function calculateAnnualSummary(base44, userEmail, year) {
  console.log(`[taxAutomationEngine] Calculating annual summary for ${userEmail}, ${year}`);

  try {
    // Fetch all transactions for the year
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    const transactions = await base44.asServiceRole.entities.Transaction.filter(
      { created_by: userEmail },
      '-created_date',
      2000
    ).then(txns =>
      txns.filter(t => {
        const txnDate = new Date(t.created_date);
        return txnDate >= startDate && txnDate <= endDate && t.type === 'income';
      })
    ).catch(() => []);

    // Calculate annual totals
    const grossIncome = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalFees = transactions.reduce((sum, t) => sum + (t.platform_fee || 0), 0);
    const totalTaxWithheld = transactions.reduce((sum, t) => sum + (t.tax_withheld || 0), 0);
    const netIncome = grossIncome - totalFees;

    // Annual tax calculation
    const seIncome = netIncome * 0.9235;
    const seTax = seIncome * 0.153;
    const incomeTax = netIncome * 0.20;
    const estimatedAnnualTax = seTax + incomeTax;

    // Store annual summary
    const annualRecord = await base44.asServiceRole.entities.CredentialVault.create({
      platform: 'tax_system',
      credential_type: 'annual_tax_summary',
      linked_account_id: `${userEmail}-annual-${year}`,
      is_active: true,
      encrypted_payload: JSON.stringify({
        user_email: userEmail,
        tax_year: year,
        gross_income: grossIncome,
        platform_fees: totalFees,
        net_income: netIncome,
        self_employment_tax: seTax,
        estimated_income_tax: incomeTax,
        total_estimated_tax: estimatedAnnualTax,
        tax_withheld: totalTaxWithheld,
        tax_owed_or_refund: estimatedAnnualTax - totalTaxWithheld,
        transaction_count: transactions.length,
        calculation_date: new Date().toISOString()
      }),
      access_log: [{
        timestamp: new Date().toISOString(),
        task_id: 'annual_tax_summary',
        action: 'create',
        purpose: 'annual_tax_summary'
      }]
    }).catch(err => {
      console.warn(`[taxAutomationEngine] Annual summary storage failed: ${err.message}`);
      return null;
    });

    return Response.json({
      success: true,
      year,
      user_email: userEmail,
      gross_income: grossIncome,
      net_income: netIncome,
      total_estimated_tax: estimatedAnnualTax,
      tax_withheld: totalTaxWithheld,
      tax_owed_or_refund: estimatedAnnualTax - totalTaxWithheld,
      transaction_count: transactions.length,
      summary_record_id: annualRecord?.id
    });

  } catch (error) {
    console.error('[taxAutomationEngine] Annual summary failed:', error.message);
    throw error;
  }
}

async function monitorAndTrigger(base44) {
  const results = {
    timestamp: new Date().toISOString(),
    users_processed: 0,
    calculations_triggered: 0,
    errors: []
  };

  try {
    // Get all active users
    const users = await base44.asServiceRole.entities.User.list('-created_date', 1000)
      .catch(() => []);

    const now = new Date();
    const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
    const currentYear = now.getFullYear();

    for (const user of users) {
      try {
        // Only trigger if near quarter end (last 7 days of quarter)
        const daysFromQuarterEnd = getDaysToQuarterEnd(now, currentQuarter);
        if (daysFromQuarterEnd > 7) continue;

        // Check if already calculated this quarter
        const existingCalc = await base44.asServiceRole.entities.CredentialVault.filter({
          linked_account_id: `${user.email}-Q${currentQuarter}-${currentYear}`,
          platform: 'tax_system'
        }, null, 1).then(r => r[0]).catch(() => null);

        if (existingCalc) continue;

        // Trigger calculation
        const calcResult = await base44.asServiceRole.functions.invoke('taxAutomationEngine', {
          action: 'calculate_quarterly_taxes',
          user_email: user.email,
          quarter: currentQuarter,
          year: currentYear
        });

        if (calcResult.data?.success) {
          results.calculations_triggered++;
        }

        results.users_processed++;
      } catch (err) {
        results.errors.push(`User ${user.email}: ${err.message}`);
      }
    }

    // Log activity
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `📊 Tax automation: Processed ${results.users_processed} users, triggered ${results.calculations_triggered} calculations`,
      severity: 'info',
      metadata: results
    }).catch(() => null);

    console.log(`[taxAutomationEngine] Monitor/trigger complete: ${results.calculations_triggered} calculations`);
    return Response.json({ success: true, ...results });

  } catch (error) {
    console.error('[taxAutomationEngine] Monitor/trigger failed:', error.message);
    throw error;
  }
}

function getDaysToQuarterEnd(now, quarter) {
  const quartersEndMonthDays = [31, 30, 30, 31]; // Mar 31, Jun 30, Sep 30, Dec 31
  const endMonth = quarter * 3 - 1;
  const endDay = quartersEndMonthDays[quarter - 1];
  
  const quarterEnd = new Date(now.getFullYear(), endMonth, endDay);
  const daysLeft = (quarterEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return daysLeft;
}