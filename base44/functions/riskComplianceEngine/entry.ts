import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await req.json();

    if (action === 'score_opportunities') {
      const opportunities = await base44.entities.Opportunity.filter({
        status: { $nin: ['expired', 'dismissed', 'failed'] }
      });

      const scored = opportunities.map(opp => {
        let riskScore = 50; // baseline
        let fraudFlag = false;

        // ROI analysis
        const profitLow = opp.profit_estimate_low || 0;
        const profitHigh = opp.profit_estimate_high || 0;
        const capital = opp.capital_required || 0;
        const roi = capital > 0 ? ((profitHigh - capital) / capital) * 100 : 0;

        if (roi < 0) riskScore += 30; // negative ROI
        if (roi > 500) riskScore += 15; // suspiciously high
        if (profitHigh > 50000 && capital === 0) {
          riskScore += 25;
          fraudFlag = true; // likely scam
        }

        // Time sensitivity
        if (opp.time_sensitivity === 'immediate') riskScore += 10;

        // Platform reputation
        const suspiciousPlatforms = ['unknown', 'unverified', 'sketchy'];
        if (suspiciousPlatforms.includes(opp.platform?.toLowerCase())) {
          riskScore += 20;
          fraudFlag = true;
        }

        // Velocity score vs risk score correlation
        if (opp.velocity_score > 80 && opp.risk_score > 70) riskScore += 15;

        // Cap at 100
        riskScore = Math.min(100, Math.max(0, riskScore));

        return {
          id: opp.id,
          title: opp.title,
          platform: opp.platform,
          roi_percentage: roi.toFixed(2),
          risk_score: Math.round(riskScore),
          fraud_flag: fraudFlag,
          compliance_risk: riskScore > 70 ? 'high' : riskScore > 40 ? 'medium' : 'low',
          recommendation: fraudFlag ? 'BLOCK' : riskScore > 70 ? 'REVIEW' : 'APPROVE'
        };
      });

      return Response.json({ 
        success: true, 
        opportunities_scored: scored.length,
        opportunities: scored.sort((a, b) => b.risk_score - a.risk_score)
      });
    }

    if (action === 'check_kyc_compliance') {
      const kycVerifications = await base44.entities.KYCVerification.filter({
        created_by: user.email
      }).then(r => r[0]);

      const userGoals = await base44.entities.UserGoals.filter({
        created_by: user.email
      }).then(r => r[0]) || {};

      const compliance = {
        kyc_status: kycVerifications?.status || 'not_started',
        kyc_tier: kycVerifications?.tier || 'none',
        verified_identity: !!kycVerifications?.verified_at,
        documents_submitted: !!kycVerifications?.id_document_url,
        tax_id_on_file: !!kycVerifications?.tax_id,
        compliance_score: 0,
        alerts: [],
        recommendations: []
      };

      // Calculate compliance score
      if (kycVerifications?.status === 'approved') compliance.compliance_score += 40;
      if (kycVerifications?.verified_at) compliance.compliance_score += 30;
      if (kycVerifications?.tax_id) compliance.compliance_score += 20;
      if (kycVerifications?.tier === 'enhanced') compliance.compliance_score += 10;

      // Generate alerts
      if (!kycVerifications) {
        compliance.alerts.push({ type: 'warning', message: 'KYC not started - limited functionality' });
        compliance.recommendations.push('Complete KYC verification to unlock all features');
      }

      if (kycVerifications?.status === 'pending') {
        compliance.alerts.push({ type: 'info', message: 'KYC verification pending - review may take 24-48 hours' });
      }

      if (kycVerifications?.status === 'rejected') {
        compliance.alerts.push({ type: 'critical', message: 'KYC verification rejected - resubmit required' });
        compliance.recommendations.push('Contact support to understand rejection reason and resubmit');
      }

      if (!kycVerifications?.tax_id) {
        compliance.alerts.push({ type: 'warning', message: 'Tax ID not on file - required for payouts' });
        compliance.recommendations.push('Add Tax ID in account settings');
      }

      // Check for auto-earn activity without compliance
      const tasks = await base44.entities.TaskExecutionQueue.filter({
        status: 'completed',
        created_date: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() }
      });

      if (tasks.length > 0 && kycVerifications?.status !== 'approved') {
        compliance.alerts.push({ 
          type: 'critical', 
          message: 'Autopilot activity detected without KYC approval - regulatory risk' 
        });
      }

      return Response.json({ success: true, compliance });
    }

    if (action === 'tax_obligation_check') {
      const transactions = await base44.entities.Transaction.filter({
        type: 'income'
      });

      const thisYear = new Date().getFullYear();
      const yearStart = new Date(thisYear, 0, 1).toISOString();
      const yearTransactions = transactions.filter(t => t.created_date >= yearStart);

      const totalIncome = yearTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
      const totalWithheld = yearTransactions.reduce((sum, t) => sum + (t.tax_withheld || 0), 0);
      const estimatedTax = totalIncome * 0.25; // 25% federal estimate

      const taxObligation = {
        year: thisYear,
        gross_income: totalIncome,
        tax_withheld: totalWithheld,
        estimated_tax_obligation: estimatedTax,
        tax_gap: Math.max(0, estimatedTax - totalWithheld),
        reporting_status: totalIncome > 600 ? 'requires_1099' : 'threshold_not_met',
        alerts: [],
        recommendations: []
      };

      if (taxObligation.tax_gap > 1000) {
        taxObligation.alerts.push({ 
          type: 'critical', 
          message: `Large tax gap detected: $${taxObligation.tax_gap.toFixed(2)} owed` 
        });
        taxObligation.recommendations.push('Consult with tax professional immediately');
      }

      if (totalIncome > 200000) {
        taxObligation.alerts.push({ 
          type: 'warning', 
          message: 'High income threshold - quarterly estimated taxes required' 
        });
      }

      return Response.json({ success: true, tax_obligation: taxObligation });
    }

    if (action === 'generate_compliance_report') {
      const kycCheck = await base44.functions.invoke('riskComplianceEngine', {
        action: 'check_kyc_compliance'
      });

      const taxCheck = await base44.functions.invoke('riskComplianceEngine', {
        action: 'tax_obligation_check'
      });

      const oppScores = await base44.functions.invoke('riskComplianceEngine', {
        action: 'score_opportunities'
      });

      const report = {
        generated_at: new Date().toISOString(),
        user_email: user.email,
        kyc: kycCheck.data.compliance,
        tax: taxCheck.data.tax_obligation,
        high_risk_opportunities: oppScores.data.opportunities.filter(o => o.recommendation === 'BLOCK').length,
        overall_risk_level: 'green',
        critical_issues: []
      };

      if (kycCheck.data.compliance.alerts.some(a => a.type === 'critical')) {
        report.critical_issues.push('Critical KYC issue');
        report.overall_risk_level = 'red';
      }

      if (taxCheck.data.tax_obligation.alerts.some(a => a.type === 'critical')) {
        report.critical_issues.push('Critical tax issue');
        report.overall_risk_level = 'red';
      }

      if (oppScores.data.opportunities.filter(o => o.fraud_flag).length > 3) {
        report.critical_issues.push('Multiple fraud flags detected');
        report.overall_risk_level = 'yellow';
      }

      if (report.overall_risk_level === 'green' && kycCheck.data.compliance.alerts.length > 0) {
        report.overall_risk_level = 'yellow';
      }

      return Response.json({ success: true, report });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Compliance engine error:', error);
    return Response.json(
      { error: error.message || 'Compliance check failed' },
      { status: 500 }
    );
  }
});